import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const scrypt = promisify(scryptCb);
const KEYLEN = 64;

/** Returns `saltHex:hashHex`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
