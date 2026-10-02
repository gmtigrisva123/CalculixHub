import { describe, expect, it } from 'vitest';
import { deriveSignupUsername } from './authInput';

describe('signup username derivation', () => {
  it('keeps Vietnamese names usable without exposing the email', () => {
    expect(deriveSignupUsername('Đặng Hồng Anh', 'private@example.com')).toBe('danghonganh');
  });

  it('falls back for names without Latin letters', () => {
    expect(deriveSignupUsername('李華', 'reader.2026@example.com')).toBe('reader2026');
    expect(deriveSignupUsername('李華', '李華@example.com')).toBe('learner');
  });

  it('bounds the candidate for the database collision suffix', () => {
    expect(deriveSignupUsername('A Very Long Display Name For Learning', 'private@example.com')).toHaveLength(20);
  });
});
