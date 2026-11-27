// The Agency's Worker: its own atproto PDS (pds.js, MIT, @pdsjs/cloudflare, pinned exactly; upstream calls itself
// experimental) and agency.jason-edelman.org. Routing is in site.js, kept apart so the tests never load pds.js. The
// account is made once, by autonomist's scripts/birth.mjs with --handle agency.jason-edelman.org and --pds
// https://pds.agency.jason-edelman.org: its first rotation key is Jason's recovery key, and its signing key lives only
// in the PDS. pds.js runs its own hourly maintenance and backups on a Durable Object alarm. The one cron here is the
// morning briefing (briefing.js), off unless BRIEFING is "on".
import pds, { PDSDurableObject } from '@pdsjs/cloudflare'
import { route, configured } from './site.js'
import { runBriefing } from './briefing.js'

export { PDSDurableObject }

export default {
  fetch(req, env, ctx) {
    return route(req, env, (r) => pds.fetch(r, env, ctx))
  },
  async scheduled(event, env, ctx) {
    if (env.BRIEFING !== 'on' || !configured(env)) return
    ctx.waitUntil(runBriefing(env, { fetch, pdsFetch: (r) => pds.fetch(r, env, ctx) }).catch((err) => console.log(JSON.stringify({ briefing: 'failed', error: String(err?.message || err).slice(0, 200) }))))
  },
}
