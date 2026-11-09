// The homepage contact form: a proof-of-work gate in front of a mailto link.
// The address never ships in plain text (see scripts/contact-gate.mjs). The
// browser searches for a hidden number, a few hundred thousand SHA-256 hashes,
// well under a second on a laptop, and only then can it unlock the address and
// open the visitor's own mail app with their message. No server, no third party.
(() => {
  // Made by: node scripts/contact-gate.mjs <address> 19
  const GATE = {
    salt: 'd3d78233b0c085d5',
    bits: 19,
    target: 'f87fa53824696349fd827e445bd1cda296eacab94253b313d18d89847414c81e',
    enc: 'ce318e6d6dc91456f08e6f739f120fd5289015',
  };

  // SHA-256 of a short ASCII string (one block, under 56 bytes), as 8 words.
  // The constants are the fractional parts of the cube and square roots of the
  // first primes, computed here rather than typed out.
  const primes = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
  const frac = (x) => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
  const K = Uint32Array.from(primes, (p) => frac(Math.cbrt(p)));
  const H0 = Uint32Array.from(primes.slice(0, 8), (p) => frac(Math.sqrt(p)));
  const W = new Uint32Array(64);

  function sha256(str) {
    W.fill(0, 0, 16);
    const len = str.length;
    for (let i = 0; i < len; i++) W[i >> 2] |= str.charCodeAt(i) << (24 - (i & 3) * 8);
    W[len >> 2] |= 0x80 << (24 - (len & 3) * 8);
    W[15] = len * 8;
    for (let i = 16; i < 64; i++) {
      const x = W[i - 15], y = W[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[i] = W[i - 16] + s0 + W[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, h] = H0;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    return [a, b, c, d, e, f, g, h].map((v, i) => (v + H0[i]) >>> 0);
  }
  const words = (hex) => Array.from({ length: 8 }, (_, i) => parseInt(hex.slice(i * 8, i * 8 + 8), 16));
  const target = words(GATE.target);

  // Search in slices so the page stays responsive; report progress as we go.
  let solving = null;
  function solve(onProgress) {
    if (solving) return solving;
    solving = new Promise((resolve) => {
      const limit = 2 ** GATE.bits;
      let n = 0;
      (function slice() {
        const end = Math.min(n + 20000, limit);
        for (; n < end; n++) {
          const w = sha256(`${GATE.salt}:${n}`);
          if (w[0] === target[0] && w.every((v, i) => v === target[i])) {
            const key = sha256(`${GATE.salt}:key:${n}`);
            const bytes = GATE.enc.match(/../g).map((x, i) => parseInt(x, 16) ^ ((key[i >> 2] >>> (24 - (i & 3) * 8)) & 0xff));
            return resolve(String.fromCharCode(...bytes));
          }
        }
        onProgress(n / limit);
        if (n < limit) setTimeout(slice, 0); else resolve(null);
      })();
    });
    return solving;
  }

  const form = document.getElementById('contact');
  if (!form) return;
  const check = form.querySelector('#contact-human');
  const status = form.querySelector('.contact-status');
  const send = form.querySelector('button[type="submit"]');
  const topic = form.querySelector('#contact-topic');
  let address = null;

  form.hidden = false;
  form.parentElement.querySelector('.contact-nojs')?.remove();

  // Start the work quietly as soon as someone starts writing.
  form.addEventListener('focusin', () => solve(() => {}), { once: true });

  check.addEventListener('change', async () => {
    if (!check.checked) return;
    check.disabled = true;
    status.textContent = 'Checking…';
    address = await solve((p) => { status.textContent = `Checking… ${Math.round(p * 100)}%`; });
    if (!address) {
      status.textContent = 'That check failed. You can reach me on Bluesky instead.';
      return;
    }
    status.textContent = 'Thanks. You can send it now.';
    send.disabled = false;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!address || !form.reportValidity()) return;
    const name = form.querySelector('#contact-name').value.trim();
    const message = form.querySelector('#contact-message').value.trim();
    const subject = `${topic.value} (from ${name})`;
    const url = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\n${name}`)}`;
    status.innerHTML = '';
    status.append('Your mail app should open with your message. If it didn’t, write to ');
    const link = document.createElement('a');
    link.href = url;
    link.textContent = address;
    status.append(link, '.');
    location.href = url;
  });

  // Elsewhere on the page, "Email" buttons jump here with a topic chosen.
  document.querySelectorAll('a[data-contact-topic]').forEach((a) => {
    a.addEventListener('click', () => {
      topic.value = a.dataset.contactTopic;
      setTimeout(() => form.querySelector('#contact-name').focus({ preventScroll: true }), 300);
    });
  });
})();
