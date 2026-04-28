# abolish-lawns-proxy

Cloudflare Worker that proxies `jason-edelman.org/abolish-lawns/*` to the
`abolish-lawns` Cloudflare Pages deployment.

## Deploy

```bash
cd proxy
npm install
npm run deploy
```

Requires `CLOUDFLARE_API_TOKEN` in env or `wrangler login`.

## How it works

- Route `jason-edelman.org/abolish-lawns/*` → this Worker
- Worker strips `/abolish-lawns` prefix and fetches from `abolish-lawns.pages.dev`
- Rewrites any upstream redirect `location` headers back to `jason-edelman.org/abolish-lawns`
- URL in browser stays `jason-edelman.org/abolish-lawns/...`
