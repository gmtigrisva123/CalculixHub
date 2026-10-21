/**
 * Settings for a QA run, from the environment.
 *
 *   QA_BASE_URL     the deployed site (default https://calculixhub.com)
 *   QA_EMAIL_BASE   the inbox every QA address delivers to, e.g. team@gmail.com.
 *                   Accounts sign up as team+cxqa-<name>@gmail.com; the
 *                   `+cxqa-` tag is what puts them in the QA cohort.
 *   QA_ADMIN_CODE   the Admin access code, for the administrator personas only.
 *                   Read by the browser daemon and typed into the page; never
 *                   printed or written to disk.
 *   QA_OUT          where a run writes its files (default qa/out)
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const QA_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(process.env.QA_OUT ?? join(QA_ROOT, 'out'));
export const BASE_URL = (process.env.QA_BASE_URL ?? 'https://calculixhub.com').replace(/\/$/, '');
export const COHORT_TAG = 'cxqa-';

export function emailBase() {
  const base = (process.env.QA_EMAIL_BASE ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(base)) {
    throw new Error('Set QA_EMAIL_BASE to the inbox QA mail should reach, e.g. QA_EMAIL_BASE=team@gmail.com (no plus tag).');
  }
  return base;
}

/** team@gmail.com + "linh.pham" -> team+cxqa-linh.pham@gmail.com */
export function qaAddress(base, slug) {
  const [local, domain] = base.split('@');
  return `${local}+${COHORT_TAG}${slug}@${domain}`;
}

export function outPath(...parts) {
  const path = join(OUT, ...parts);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}
