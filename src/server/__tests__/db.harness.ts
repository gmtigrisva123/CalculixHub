/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A real PostgreSQL instance for the migration tests.
 *
 * PGlite is PostgreSQL 18 compiled to WebAssembly, so these tests run the
 * migrations against the actual engine -- real constraints, real triggers, real
 * row-level security -- with no Docker daemon and no hosted project. Schema
 * defects surface here rather than during a production deploy.
 *
 * The one thing it cannot supply is Supabase's own `auth` schema, which is
 * created by GoTrue rather than by these migrations. It is stubbed below with
 * the two pieces the migrations actually depend on: the `auth.users` table they
 * reference, and `auth.uid()`, which every RLS policy is written against.
 * `auth.uid()` reads the same session setting Supabase uses, so `asUser()` here
 * puts the database in the same state a real authenticated request does.
 *
 * What this proves: the schema applies, the constraints hold, the triggers fire,
 * and the RLS policies permit and deny exactly what they claim.
 * What it cannot prove: that GoTrue issues the JWT correctly, or that Realtime
 * delivers a change. Those need a live project and are called out as such.
 */

import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * `fileURLToPath`, not `.pathname`.
 *
 * A file URL is not a filesystem path, and the two only look alike on POSIX.
 * `.pathname` hands back the URL's own encoding: a leading slash before the
 * drive letter and every space still percent-escaped, so on Windows this
 * resolved to "/D:/DESKTOP%20ALL%20FILES%202/..." and `readdirSync` failed with
 * ENOENT before a single migration could be read. `fileURLToPath` performs the
 * real conversion -- decoding the escapes and producing a native separator and
 * drive form -- and is a no-op difference on Linux and macOS, which is why the
 * bug survived CI.
 */
const MIGRATIONS_DIR = fileURLToPath(new URL('../../../supabase/migrations', import.meta.url));

/**
 * Minimal stand-in for the schema GoTrue owns.
 *
 * `auth.uid()` is marked STABLE, not IMMUTABLE, because its result changes with
 * the session setting -- marking it immutable would let the planner fold it to a
 * constant and cache an authorization decision across users.
 */
const AUTH_STUB = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create or replace function auth.role()
  returns text
  language sql
  stable
  as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
  $$;
`;

export interface TestDatabase {
  /** Run SQL with no result, as the table owner (bypasses RLS). */
  exec(sql: string): Promise<void>;
  /** Run a parameterised query as the table owner (bypasses RLS). */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /**
   * Run a query as a specific authenticated user, with RLS enforced.
   *
   * `set local role` drops from the owner to a role RLS applies to -- policies
   * are bypassed for table owners, so without this every policy test would
   * pass vacuously.
   */
  asUser<T = Record<string, unknown>>(userId: string | null, sql: string, params?: unknown[]): Promise<T[]>;
  /** Create an account, firing the same trigger a real sign-up fires. */
  createUser(input: { email: string; username?: string; displayName?: string }): Promise<string>;
  close(): Promise<void>;
}

/** Apply every migration in filename order, exactly as Supabase does. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const db = new PGlite();
  await db.exec(AUTH_STUB);

  // Roles Supabase defines. `authenticated` and `anon` are what RLS policies
  // are evaluated against; both must be non-superuser for policies to apply.
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
    end $$;
    grant usage on schema public, auth to authenticated, anon;
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  // Grant after the tables exist, mirroring Supabase's default grants. RLS is
  // what constrains these roles; the grant only makes the tables reachable.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on all tables in schema public to anon;
    grant usage, select on all sequences in schema public to authenticated;
  `);

  const query = async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    (await db.query<T>(sql, params)).rows;

  return {
    exec: async (sql) => void (await db.exec(sql)),
    query,

    async asUser<T>(userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
      await db.exec('begin');
      try {
        await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
        await db.query(`select set_config('request.jwt.claim.role', $1, true)`, [
          userId ? 'authenticated' : 'anon',
        ]);
        await db.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);

        const result = await db.query<T>(sql, params);
        await db.exec('commit');
        return result.rows;
      } catch (error) {
        await db.exec('rollback');
        // Postgres reports a policy violation with the table name but not the
        // statement, which is not enough to tell which of several similar
        // queries in a test failed. Re-throw with the statement attached.
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${message}\n  as: ${userId ?? 'anon'}\n  sql: ${sql.replace(/\s+/g, ' ').trim()}\n  params: ${JSON.stringify(params)}`,
        );
      }
    },

    async createUser({ email, username, displayName }) {
      const meta = JSON.stringify({
        ...(username ? { username } : {}),
        ...(displayName ? { display_name: displayName } : {}),
      });

      const rows = await query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
        [email, meta],
      );

      return rows[0]!.id;
    },

    close: () => db.close(),
  };
}
