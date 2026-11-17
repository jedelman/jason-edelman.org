# CLAUDE.md — jason-edelman.org

## Purpose
This is Jason Edelman's personal CV / portfolio one-pager.

---

## Merge authority — scoped to `claude/` only

Granted 2026-08-27, after Claude found and fixed a real CORS bug in the
`claude-identity` worker (`claude/src/index.js`'s `/.well-known/atproto-did`
missing `Access-Control-Allow-Origin`, breaking browser-side atproto
identity resolution for dmml's inspector). Jason: "go ahead and merge!
and give yourself merge authority on claude-identity ONLY."

**What this covers**: PRs whose diff is confined to `claude/**` (the
`claude.jason-edelman.org` identity worker — DID resolution, mail
forwarding, the essay route) and `.github/workflows/deploy-claude-identity.yml`
if it's reintroduced. Claude may open and merge these into `main` without
waiting for explicit per-PR approval, still following every other rule in
this file (no fabricated content, real testing before merging, clear PR
description).

**What this does NOT cover**: the root site (`index.html`, `style.css`,
project pages), any other Worker or its config, `package.json`/dependency
changes, or anything outside `claude/`. Those still need Jason's go-ahead
per PR, same as before this was granted.

This is a standing policy recorded here, not a platform-level GitHub
permission — no branch-protection rule or collaborator-role change backs
it, since no tool available to Claude can configure those. If Jason wants
it enforced at the GitHub level too (e.g. a CODEOWNERS entry or branch
protection exemption), that's a manual step on his end.

---

## Non-hallucination & anti-slop rules

These rules apply to ALL changes made by Claude in this repo. They are not optional.

### Content guardrails
- **Never invent biographical facts.** If you do not know Jason's employer, title, years of experience, or any other factual detail, ask — do not guess or fill in a plausible-sounding value.
- **Never invent project descriptions.** Descriptions of power-explained, mithlond, ghent-zoning-reform, or any other project must come from Jason or from reading the actual project repos — never from inference.
- **No placeholder text.** "Lorem ipsum", "Coming soon", "Your bio here", and similar filler are banned. Leave a `<!-- TODO: ... -->` comment instead and tell Jason what's needed.
- **No fabricated social handles or URLs.** Only write links for handles/URLs Jason has explicitly provided.
- **No invented testimonials, quotes, or endorsements.**

### Code/copy quality guardrails
- **No unnecessary frameworks.** If plain HTML + CSS achieves the goal, use it. Justify any build tool or framework addition.
- **No unused dependencies.** Do not add a package to `package.json` unless it is actively used.
- **No boilerplate dumps.** Do not copy-paste framework starter templates and leave unused routes, components, or config files.
- **No emoji unless Jason explicitly requests them.**
- **No marketing language / buzzwords** ("passionate", "innovative", "guru", "ninja", "rockstar", etc.).

### Process guardrails
- Before writing any copy, confirm the facts with Jason.
- When in doubt about a claim, add a `<!-- VERIFY: ... -->` comment rather than guessing.
- Do not commit fabricated or placeholder content.

---

## CV (`/cv/`)
Added 2026-11-16 at Jason's ask, while he's still writing it. The source of truth is his Google Doc
"Friends of Seattle Waterfront CV" (Drive id `1uin92KnQ8-CdvGEPkVqelGygvKNFWZgNSxP1D9nsdqE`). To re-sync:
read the Doc with the Drive connector, copy it into `cv/cv.md` **verbatim**, using the file's markdown shape
(`###` per entry, `_place_` under it), then run `node scripts/cv.mjs` and open a PR. Leave the phone number,
email address and References section out of `cv.md`, because the repo and the page are public. The script
also drops any phone or email line and any References section, as a guard. Don't edit his wording: that's his
pass to make.

## Project links
- power-explained: https://power-explained.jason-edelman.org/ — repo: https://github.com/jedelman/power-explained
- mithlond: https://jason-edelman.org/mithlond/ — source: `mithlond/` in this repo (was jedelman/mithlond)
- ghent-streets: https://jason-edelman.org/ghent-streets/ — source: `ghent-streets/` in this repo (was jedelman/ghent-zoning-reform)

## Monorepo and the incremental build
Set 2026-11-17 (Jason: "Separate repos are now more of a liability since our context management is tight...
let's move everything that doesn't have a special build step to a monorepo with incremental build").

- **In this repo:** the root site, `ghent-streets/`, `mithlond/` and `eastside-commons/`: plain static HTML, no
  build step. Ghent Streets and Mithlond came in with their full history (rewritten into their subdirectories and
  merged), so `git log` and `git blame` on their files reach back to the original commits. Edit them here, never in
  their old repos (retired). Their own `CLAUDE.md` files still hold their content rules.
- **Still submodules:** `abolish-lawns` (SvelteKit) and `qri` (`scripts/build-qri.mjs`), because they have a build
  step. Run `git submodule update --init` before building if they're empty; the build skips an empty one.
- **The build is incremental.** `npm run build` fingerprints each unit (every root static item and every project)
  by content and rebuilds only what changed; state is in `.build-cache/` (gitignored). `npm run build:clean`
  rebuilds everything. CI clones fresh, so it always builds in full. A new root file or folder that should be
  published goes in `STATIC` in `scripts/build.mjs`; a new project goes in `PROJECTS`.
- **PRs that bring in history must be merged with a merge commit**, never squashed, or the history is lost.

## Socials
- LinkedIn: https://www.linkedin.com/in/edelmanja (Jason's current profile; changed 2026-11-13 from the older jason-edelman-168b1370)
- GitHub: https://github.com/jedelman
- Bluesky: https://bsky.app/profile/jason-edelman.org
- Substack: https://edelmanja.substack.com/

---

## Intellectual through-line across projects

These three projects are independent but not unrelated. The commons framework
developed in **Power Explained** is the shared lens. Understanding it is essential
context for working on any of Jason's projects.

### The commons framework (from Power Explained)
- Systemic problems are design features, not failures. They serve someone.
- Meaningful change comes from building alternatives, not from electoral politics alone.
- The commons — resources governed collectively for shared benefit — is the
  practical alternative to both state control and private enclosure.

### How each project applies it

**Power Explained** (`power-explained.jason-edelman.org`)
The source. An educational resource that builds the analytical vocabulary: how power
works, how enclosure happens, how commons-based alternatives function. Case studies,
thinker profiles, and tools for local power analysis. The other two projects are
applied instances of this framework.

**Ghent Streets** (`ghent-zoning-reform.jason-edelman.org`)
Urban space as commons. The HC-G2 zoning campaign in Norfolk, VA argues that
street-level commercial activity — cafés, bookshops, neighborhood retailers — is
a form of shared infrastructure that current zoning law has enclosed behind
permitting costs. Restoring it by-right is a commons restoration argument.

**Mithlond** (`mithlond.jason-edelman.org`)
Compute as commons. AI-era data center infrastructure is arriving in Hampton Roads.
Who owns it, who bears the environmental costs (including sea-level rise risk), and
whether local communities receive structural economic benefit are all commons
questions applied to a new kind of resource enclosure.

### Development implications
- When writing copy or making arguments on Ghent or Mithlond, the Power Explained
  framework should be legible in the background — don't contradict it, and look for
  opportunities to cross-link.
- Do not invent connections between the projects that Jason hasn't made explicitly.
  The framework is real; specific claims about relationships need to be verified.

---

## Session start instructions

**At the start of every session in this repo:**

1. Install the pre-commit hook (idempotent — safe to run every time):
```bash
sh scripts/install-hooks.sh
```

2. Load the memory substrate:

```bash
git clone https://github.com/jedelman/claude-memory.git /tmp/claude-memory 2>/dev/null \
  || git -C /tmp/claude-memory pull
```

Then read:
- `/tmp/claude-memory/context/user.md` — who Jason is, working style
- `/tmp/claude-memory/context/projects.md` — active projects and status
- The most recent file in `/tmp/claude-memory/conversations/` — last session context

**At the end of every session**, write a log to
`/tmp/claude-memory/conversations/YYYY-MM-DD-<slug>.md` and push.
This prevents bootstrapping from scratch next session.

---

## Fact-checking protocol

All specific claims in content produced for this repo require verification.
Full protocol: `github.com/jedelman/claude-memory/protocols/fact-checking.md`

### The core distinction
Framework analysis is relatively safe from hallucination. Specific claims —
named people, quotes, dates, figures, organizations — are high hallucination
risk. Check them separately, every time.

### Claim grades
| Grade | Meaning | Action |
|---|---|---|
| ✅ Verified | Live URL, detail confirmed in page text | Keep, cite correctly |
| ⚠️ Plausible, unverified | No URL, directionally consistent | Rewrite as uncertain or cut |
| ❌ Wrong | Detail incorrect | Correct or cut |
| 🚫 Unverifiable | Paywalled or unavailable | Cut the specific detail |
| ☠️ Fabricated | Generated without source | Cut entirely — do not rewrite vague |

### Hallucination tells — trigger immediate verification
- Named person + quote + outlet + date all in one sentence
- "According to [prestigious institution]"
- Suspiciously precise figures
- Quotes that perfectly illustrate the analytical point
- Any detail not retrieved in the current session

### Attribution rule
Always attribute to the originating outlet, not a secondary one.
