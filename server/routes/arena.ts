import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { json, readJsonBody } from '../http';
import type { RouteDefinition } from '../pipeline';

// These handlers NEVER construct or use a service-role client.
export function arenaRoutes(): RouteDefinition[] {
  return [
    { method: 'GET', path: '/api/arenas', routeClass: 'read', handler: async ctx => {
      if (!ctx.config.supabaseUrl || !ctx.config.supabaseAnonKey) return json({ error: 'Database is not configured.' }, { status: 503 });
      const client = createClient(ctx.config.supabaseUrl, ctx.config.supabaseAnonKey, { auth: { persistSession: false } });
      const { data, error } = await client.rpc('arena_catalog');
      return error ? json({ error: 'Arena database setup is required. Apply the Admin/Arena migration.' }, { status: 503 }) : json(data);
    } },
    { method: 'POST', path: '/api/arena/action', routeClass: 'read', handler: async ctx => {
      const authorization = ctx.request.headers.get('authorization');
      if (!authorization || !ctx.config.supabaseUrl || !ctx.config.supabaseAnonKey) return json({ error: 'Sign in to enter the arena.' }, { status: 401 });
      const body = await readJsonBody(ctx.request, ctx.config.maxBodyBytes);
      if (!body.ok) return body.response;
      const input = z.object({ arenaId: z.string().uuid(), action: z.enum(['register', 'start', 'view', 'submit', 'forfeit', 'finish']), problemId: z.string().max(64).optional(), answer: z.string().max(256).optional() }).safeParse(body.value);
      if (!input.success) return json({ error: 'Invalid arena action.' }, { status: 400 });
      const client = createClient(ctx.config.supabaseUrl, ctx.config.supabaseAnonKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
      const { data, error } = await client.rpc('arena_action', { p_arena: input.data.arenaId, p_action: input.data.action, p_problem: input.data.problemId ?? null, p_answer: input.data.answer ?? null });
      return error ? json({ error: error.code === 'P0001' ? error.message : 'Arena database is unavailable.' }, { status: 409 }) : json(data);
    } },
  ];
}
