// jason-edelman.org's Worker. The site is static assets; this only runs for /video/* (run_worker_first in
// wrangler.toml), because Cloudflare's static assets ignore byte ranges and send the whole file, and Safari (iPhone,
// iPad, Mac) won't play a <video> from a server that does that. Here the asset is fetched whole and the asked-for
// slice returned as a 206. Everything else never reaches this code.

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/video/') || res.status !== 200) return res;

    const headers = new Headers(res.headers);
    headers.set('Accept-Ranges', 'bytes');
    const range = request.headers.get('Range');
    if (!range || request.method === 'HEAD') return new Response(res.body, { status: 200, headers });

    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());   // one range; anything else gets the whole file
    if (!m || (m[1] === '' && m[2] === '')) return new Response(res.body, { status: 200, headers });
    const body = await res.arrayBuffer();
    const size = body.byteLength;
    let start, end;
    if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }   // the last n bytes
    else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
    if (start >= size || start > end) {
      headers.set('Content-Range', `bytes */${size}`);
      headers.delete('Content-Length');
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};
