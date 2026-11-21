import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const P = createRequire(import.meta.url)('../public/keys/p256.js')

const b64u = (s) => Uint8Array.from(Buffer.from(s, 'base64url'))

test('the public key from the private scalar matches the browser crypto key, for many keys', async () => {
  for (let i = 0; i < 20; i++) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
    assert.equal(P.didKeyFromPrivate(b64u(jwk.d)), P.didKeyFromXY(b64u(jwk.x), b64u(jwk.y)))
  }
})

test('private multikeys round-trip and are recognized', () => {
  const d = new Uint8Array(32).fill(7)
  const mk = P.privateMultikey(d)
  assert.match(mk, /^z42t/)
  assert.deepEqual([...P.parsePrivateMultikey(mk)], [...d])
  assert.throws(() => P.parsePrivateMultikey('did:key:zDnae'))
  assert.throws(() => P.parsePrivateMultikey('z' + P.b58encode(new Uint8Array(34))))
})

test('the generator point gives the known did:key for scalar 1', () => {
  assert.match(P.didKeyFromPrivate(1n), /^did:key:zDnae/)
  assert.throws(() => P.didKeyFromPrivate(0n))
  assert.throws(() => P.didKeyFromPrivate(P.N))
})
