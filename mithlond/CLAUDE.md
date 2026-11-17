# CLAUDE.md — mithlond

## Purpose
Mithlond is a research and advocacy initiative examining AI-era data center
infrastructure in Hampton Roads through a commons framework: who owns the compute,
who bears the environmental costs, and whether local communities receive structural
economic benefit.

---

## Non-hallucination & anti-slop rules

### Content guardrails
- **Never invent data center facts, policy claims, or infrastructure statistics.**
  All specifics must come from Jason or cited sources (Virginia tax policy, facility
  announcements, sea-level rise data, etc.).
- **No placeholder text.** Use `<!-- TODO: ... -->` and flag what's needed.
- **No fabricated quotes from officials, companies, or community members.**
- **No invented figures** on energy use, tax exemptions, or economic impact.

### Code/copy quality guardrails
- **No unnecessary frameworks.** Justify any build tool or dependency addition.
- **No unused dependencies.**
- **No boilerplate dumps.**
- **No emoji unless Jason explicitly requests them.**
- **No marketing language / buzzwords.**

### Process guardrails
- Before writing any research or policy copy, confirm the claims with Jason.
- When in doubt about a technical or policy detail, add a `<!-- VERIFY: ... -->` comment.
- Do not commit fabricated or placeholder content.

---

## Project facts
- Live site: https://mithlond.jason-edelman.org/
- Repo: https://github.com/jedelman/mithlond
- Author: Jason Edelman
- Geographic focus: Hampton Roads, Virginia

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
**Compute as commons.** AI-era data center infrastructure is a new form of enclosure:
private capture of a resource with massive public externalities (energy, water,
sea-level risk, tax exemptions). The project asks whether Hampton Roads can assert
community ownership or benefit-sharing over this infrastructure before the enclosure
is complete.

### Related projects

**Power Explained** (`power-explained.jason-edelman.org` / `github.com/jedelman/power-explained`)
The source of the analytical framework. Link there when the argument needs
theoretical grounding.

**Ghent Streets** (`ghent-zoning-reform.jason-edelman.org` / `github.com/jedelman/ghent-zoning-reform`)
Applies the same commons lens to urban space in Norfolk. A parallel case study
in a different domain.

### Development implications
- Research and advocacy copy should foreground the commons argument, not just
  environmental or economic impact in isolation — the structural ownership question
  is the point.
- Cross-link to Power Explained when introducing the commons framing.
- Do not invent connections to Ghent Streets that Jason hasn't made explicitly.
- Sea-level rise data and Virginia tax exemption figures must be cited; never estimated.

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
