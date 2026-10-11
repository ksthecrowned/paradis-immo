import { createHmac } from 'crypto';

/**
 * TOTP RFC 6238 minimal (HMAC-SHA1, 30 s, 6 chiffres) sans dépendance
 * externe — les stores npm sont pourtant standard, mais on évite un ajout
 * de provider à ce stade (spec 15 B2 P1, à passer sur otplib plus tard
 * pour le QR provisioning).
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20): string {
  const buffer = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i += 1) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpAt(secret: string, timeMs: number): string {
  const counter = Math.floor(timeMs / 30_000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const now = Date.now();
  for (let drift = -window; drift <= window; drift += 1) {
    if (totpAt(secret, now + drift * 30_000) === code) return true;
  }
  return false;
}
