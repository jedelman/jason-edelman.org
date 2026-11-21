// p256.js: the small amount of key math the key page needs, with no dependencies, so the page can
// run offline and send nothing anywhere. P-256 point multiplication (to derive a public key from a
// saved private key), base58btc, and the multikey / did:key encodings that atproto uses.
// Runs in the browser (window.P256) and in Node (module.exports), so the tests run the same code.
;(function (root) {
  'use strict'
  const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn
  const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
  const A = P - 3n
  const G = [0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n, 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n]

  const mod = (a, m = P) => { const r = a % m; return r >= 0n ? r : r + m }
  function inv(a, m = P) {
    let [r0, r1, s0, s1] = [mod(a, m), m, 1n, 0n]
    while (r1 !== 0n) { const q = r0 / r1;[r0, r1] = [r1, r0 - q * r1];[s0, s1] = [s1, s0 - q * s1] }
    return mod(s0, m)
  }
  function add(p1, p2) {
    if (!p1) return p2
    if (!p2) return p1
    const [x1, y1] = p1, [x2, y2] = p2
    if (x1 === x2 && mod(y1 + y2) === 0n) return null
    const l = x1 === x2 && y1 === y2 ? mod((3n * x1 * x1 + A) * inv(2n * y1)) : mod((y2 - y1) * inv(x2 - x1))
    const x3 = mod(l * l - x1 - x2)
    return [x3, mod(l * (x1 - x3) - y1)]
  }
  function mul(k, pt = G) {
    let r = null, q = pt
    while (k > 0n) { if (k & 1n) r = add(r, q); q = add(q, q); k >>= 1n }
    return r
  }

  const toBig = (bytes) => bytes.reduce((a, b) => (a << 8n) | BigInt(b), 0n)
  function toBytes(n, len = 32) { const out = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n } return out }
  const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of arrs) { out.set(x, o); o += x.length } return out }

  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  function b58encode(bytes) {
    let n = toBig(bytes), s = ''
    while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n }
    for (const b of bytes) { if (b === 0) s = '1' + s; else break }
    return s
  }
  function b58decode(str) {
    let n = 0n
    for (const c of str) { const i = B58.indexOf(c); if (i < 0) throw new Error('not base58'); n = n * 58n + BigInt(i) }
    const body = []
    while (n > 0n) { body.unshift(Number(n & 0xffn)); n >>= 8n }
    let zeros = 0
    for (const c of str) { if (c === '1') zeros++; else break }
    return new Uint8Array([...new Array(zeros).fill(0), ...body])
  }

  // multicodec prefixes (unsigned varints): p256-pub 0x1200, p256-priv 0x1306
  const PUB = new Uint8Array([0x80, 0x24])
  const PRIV = new Uint8Array([0x86, 0x26])

  function compress([x, y]) { return concat(new Uint8Array([y & 1n ? 0x03 : 0x02]), toBytes(x)) }

  /** The public did:key for a private scalar (bytes or bigint). */
  function didKeyFromPrivate(d) {
    const k = typeof d === 'bigint' ? d : toBig(d)
    if (k <= 0n || k >= N) throw new Error('not a valid P-256 private key')
    return 'did:key:z' + b58encode(concat(PUB, compress(mul(k))))
  }
  /** The private key as a multibase multikey (z...), the form atproto tools use. */
  const privateMultikey = (dBytes) => 'z' + b58encode(concat(PRIV, dBytes))
  /** Decode a saved private multikey back to its 32-byte scalar. */
  function parsePrivateMultikey(s) {
    s = String(s || '').trim()
    if (!s.startsWith('z')) throw new Error('A private key here starts with "z".')
    const bytes = b58decode(s.slice(1))
    if (bytes.length !== 34 || bytes[0] !== PRIV[0] || bytes[1] !== PRIV[1]) throw new Error('That is not a P-256 private key in multikey form.')
    return bytes.slice(2)
  }
  /** The did:key for a public point given as JWK-style x and y bytes. */
  const didKeyFromXY = (x, y) => 'did:key:z' + b58encode(concat(PUB, compress([toBig(x), toBig(y)])))

  const api = { didKeyFromPrivate, privateMultikey, parsePrivateMultikey, didKeyFromXY, b58encode, b58decode, mul, toBig, toBytes, G, N }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.P256 = api
})(typeof window !== 'undefined' ? window : globalThis)
