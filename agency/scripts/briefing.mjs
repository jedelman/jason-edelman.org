#!/usr/bin/env node
// A dry run of the morning briefing (src/briefing.js) from anywhere with network access: it reads exactly what the
// Worker reads (members' public records, Lichen, the Agency's own repo, all public), prints the note it would write and
// what it would do with it (create, edit, skip, hold), and writes nothing. Run: npm run briefing:dry
import { runBriefing } from '../src/briefing.js'

const env = { HOSTNAME: 'pds.agency.jason-edelman.org' }
const { text, decision } = await runBriefing(env, { fetch, pdsFetch: fetch, dry: true, log: () => {} })
console.log(text)
console.log('\n---')
console.log('would:', Object.keys(decision)[0], decision.skip || decision.hold || '')
