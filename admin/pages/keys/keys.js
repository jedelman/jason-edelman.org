// The key page: make a P-256 key with the browser's own crypto, show the private half as a multikey
// (the form atproto tools read) and the public half as a did:key, and check a saved key. Before the
// public key is shown, the page derives it a second way (P256 math from the private scalar) and
// signs and verifies a test message, so a bad key is never handed out.
;(function () {
  'use strict'
  const $ = (id) => document.getElementById(id)
  const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
  let current = null

  async function make() {
    $('made').hidden = true
    $('public-box').hidden = true
    $('saved').checked = false
    $('save-msg').textContent = ''
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const d = b64u(jwk.d), x = b64u(jwk.x), y = b64u(jwk.y)
    const pub = P256.didKeyFromXY(x, y)
    const msg = new TextEncoder().encode('recovery key check')
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, msg)
    const ok = (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, sig, msg)) && P256.didKeyFromPrivate(d) === pub
    if (!ok) { $('check-msg').textContent = 'The key failed its self-check. Make another.'; $('check-msg').className = 'bad'; return }
    current = { priv: P256.privateMultikey(d), pub, agent: ($('agent').value || 'agent').trim() }
    $('priv').value = current.priv
    $('pub').value = current.pub
    $('check-msg').textContent = 'Self-check passed: the public key was derived two ways and a test signature verified.'
    $('check-msg').className = 'ok'
    $('made').hidden = false
    $('save').hidden = !('PasswordCredential' in window)
  }

  async function save() {
    if (!current || !('PasswordCredential' in window)) return
    try {
      const cred = new PasswordCredential({ id: `atproto recovery key, ${current.agent}`, password: current.priv, name: `atproto recovery key, ${current.agent}` })
      await navigator.credentials.store(cred)
      $('save-msg').textContent = 'Your browser asked to save it. Check that it saved, under this site, named for the agent.'
    } catch {
      $('save-msg').textContent = "Your browser didn't offer to save it. Copy the private key into your password manager instead."
    }
  }

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied' } catch { btn.textContent = 'Select it and copy' }
    setTimeout(() => { btn.textContent = btn.id === 'copy-pub' ? 'Copy public key' : 'Copy private key' }, 2500)
  }

  function check() {
    try {
      const d = P256.parsePrivateMultikey($('check-priv').value)
      $('checked').textContent = 'Its public key: ' + P256.didKeyFromPrivate(d)
      $('checked').className = 'ok'
    } catch (e) {
      $('checked').textContent = e.message
      $('checked').className = 'bad'
    }
    $('check-priv').value = ''
  }

  $('make').addEventListener('click', make)
  $('save').addEventListener('click', save)
  $('copy-priv').addEventListener('click', (e) => current && copy(current.priv, e.target))
  $('copy-pub').addEventListener('click', (e) => current && copy(current.pub, e.target))
  $('saved').addEventListener('change', (e) => { $('public-box').hidden = !e.target.checked })
  $('check').addEventListener('click', check)
})()
