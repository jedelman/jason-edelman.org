# CLAUDE.md — ghent-zoning-reform

## Purpose
Ghent Streets is a community advocacy campaign for zoning reform in Norfolk,
Virginia's HC-G2 historic district — to allow street-level commercial activity
by right and restore pedestrian vitality to the neighborhood.

---

## Non-hallucination & anti-slop rules

### Content guardrails
- **Never invent zoning facts, ordinance numbers, or regulatory claims.** All
  specifics must come from Jason or cited Norfolk/Virginia sources.
- **No placeholder text.** Use `<!-- TODO: ... -->` and flag what's needed.
- **No fabricated quotes from residents, officials, or stakeholders.**
- **No invented statistics** about foot traffic, property values, or permit costs.

### Code/copy quality guardrails
- **No unnecessary frameworks.** Justify any build tool or dependency addition.
- **No unused dependencies.**
- **No boilerplate dumps.**
- **No emoji unless Jason explicitly requests them.**
- **No marketing language / buzzwords.**

### Process guardrails
- Before writing any policy or advocacy copy, confirm the claims with Jason.
- When in doubt about a regulatory detail, add a `<!-- VERIFY: ... -->` comment.
- Do not commit fabricated or placeholder content.

---

## Project facts
- Live site: https://ghent-zoning-reform.jason-edelman.org/
- Repo: https://github.com/jedelman/ghent-zoning-reform
- Author: Jason Edelman
- Location focus: Norfolk, Virginia — HC-G2 historic district

---

## Intellectual through-line across Jason's projects

This project applies the commons framework developed in **Power Explained**.
Understanding that framework is essential context for working on this site.

### The commons framework (from Power Explained)
- Systemic problems are design features, not failures. They serve someone.
- Meaningful change comes from building alternatives, not from electoral politics alone.
- The commons — resources governed collectively for shared benefit — is the
  practical alternative to both state control and private enclosure.

### How this project applies it
**Urban space as commons.** Current HC-G2 zoning encloses street-level commercial
activity behind permitting costs that favor property owners over community use.
The campaign to restore commercial activity by-right is a commons restoration
argument: returning shared neighborhood infrastructure to collective benefit.

### Related projects

**Power Explained** (`power-explained.jason-edelman.org` / `github.com/jedelman/power-explained`)
The source of the analytical framework. Link there when the argument needs
theoretical grounding.

**Mithlond** (`mithlond.jason-edelman.org` / `github.com/jedelman/mithlond`)
Applies the same commons lens to compute infrastructure in Hampton Roads.
A parallel case study in a different domain.

### Development implications
- Advocacy copy should be grounded in the commons argument, not just
  "isn't it nice to have cafés" — the structural claim is the point.
- Cross-link to Power Explained when introducing the commons framing.
- Do not invent connections to Mithlond that Jason hasn't made explicitly.

---

## Session start instructions

**At the start of every session in this repo, load the memory substrate:**

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
