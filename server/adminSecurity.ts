import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashCode(code: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(code, salt, 64).toString('hex');
}
export function checkCode(code: string, hash: string): boolean {
  const [salt, encoded] = hash.split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(encoded ?? '')) return false;
  return timingSafeEqual(scryptSync(code, salt, 64), Buffer.from(encoded, 'hex'));
}
export function mintAdminSession(userId: string, version: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, version, expires: Date.now() + 30 * 60_000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
}
export function validAdminSession(token: string, userId: string, version: number, secret: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) return false;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return claims.userId === userId && claims.version === version && claims.expires > Date.now();
  } catch { return false; }
}
