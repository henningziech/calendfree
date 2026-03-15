import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../utils/encryption.js';

describe('Encryption', () => {
  it('encrypts and decrypts a string', () => {
    const original = 'ya29.a0secret-access-token';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const input = 'same-input';
    const a = encrypt(input);
    const b = encrypt(input);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });
});
