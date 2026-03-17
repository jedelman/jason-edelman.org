# CLAUDE.md — jason-edelman.org

## Purpose
This is Jason Edelman's personal CV / portfolio one-pager.

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

## Project links
- power-explained: https://power-explained.jason-edelman.org/ — repo: https://github.com/jedelman/power-explained
- mithlond: https://mithlond.jason-edelman.org/ — repo: https://github.com/jedelman/mithlond
- ghent-zoning-reform: https://ghent-zoning-reform.jason-edelman.org/ — repo: https://github.com/jedelman/ghent-zoning-reform

## Socials
- LinkedIn: https://www.linkedin.com/in/jason-edelman-168b1370
- GitHub: https://github.com/jedelman
- Bluesky: https://bsky.app/profile/jason-edelman.org

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
