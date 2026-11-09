#!/usr/bin/env node
/**
 * Make the proof-of-work gate for the homepage contact form (contact.js).
 *
 *   node scripts/contact-gate.mjs someone@example.com [bits]
 *
 * The address never ships in plain text. A random number n is hidden in
 * [0, 2^bits); the page ships only SHA-256(salt:n) and the address XORed with
 * SHA-256(salt:key:n). The visitor's browser finds n by trying every number,
 * about 2^(bits-1) hashes on average (well under a second on a laptop at the
 * default 19 bits), then unlocks the address. Cheap for one person writing to
 * Jason, costly for a scraper harvesting many pages. Paste the printed object
 * over GATE in contact.js.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';

const address = process.argv[2];
const bits = Number(process.argv[3] || 19);
if (!address || address.length > 32) {
  console.error('usage: node scripts/contact-gate.mjs <address, at most 32 bytes> [bits]');
  process.exit(1);
}

const sha = (s) => createHash('sha256').update(s).digest();
const salt = randomBytes(8).toString('hex');
const n = randomInt(0, 2 ** bits);
const key = sha(`${salt}:key:${n}`);
const enc = Buffer.from(address, 'utf8').map((byte, i) => byte ^ key[i]);

console.log(JSON.stringify({
  salt,
  bits,
  target: sha(`${salt}:${n}`).toString('hex'),
  enc: Buffer.from(enc).toString('hex'),
}, null, 2));
