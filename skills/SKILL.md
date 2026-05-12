---
name: stakeholder-review
description: >
  Multi-stakeholder document review and guided rewrite skill. Use this whenever
  a user wants to stress-test, sharpen, or improve a document — pitch deck,
  landing page, proposal, essay, policy brief, fundraising ask, cold email,
  manifesto, or any persuasive or informational document — by reading it through
  the eyes of its real audiences before rewriting. Triggers on: "read this as
  a stakeholder", "stress test this", "who would push back on this", "make this
  work for everyone", "sharpen the argument", "what am I missing", "iterate on
  this document", "revision pass", or any request to improve a document by
  considering how different audiences would receive it. Also use proactively
  when a user shares a document and asks for feedback — this skill produces
  structured, actionable feedback rather than generic critique.
---

# Stakeholder Review & Guided Rewrite

A three-phase process for stress-testing and improving any document by inhabiting the perspectives of its real audiences — including hostile, indifferent, and unintended readers — before revising.

## When to use this skill

- User shares a document and wants it improved, sharpened, or stress-tested
- User wants to know "who would push back on this and why"
- User wants a document to work for multiple different audiences simultaneously
- User asks for a revision pass, iteration, or "another round"
- User wants to pressure-test an argument before publishing or sending

## Phase 1: Stakeholder Identification

Before reading the document, identify who will encounter it. Do not default to the obvious intended audience — cast wide.

### How to identify stakeholders

Read the document and ask:

1. **Who is this written for?** (intended primary audience)
2. **Who else will see it?** (secondary audiences — forwarded, shared, discovered)
3. **Who could kill this?** (decision-makers, opponents, gatekeepers)
4. **Who is indifferent but reachable?** (people who could become allies or opponents)
5. **Who is actively hostile?** (people whose interests this threatens, or who will project their biases onto it)
6. **Who is missing entirely?** (people the document doesn't address who should be)

### Stakeholder types to consider

These are prompts, not a checklist. Derive actual stakeholders from the document.

- **The intended beneficiary** — the person this is supposedly for. Do they recognize themselves in it?
- **The decision-maker** — whoever has to say yes. What are their actual concerns (budget, risk, precedent, political)?
- **The skeptic** — informed, not hostile, just unconvinced. What would they need to see?
- **The opponent** — whose interests conflict. What's their best counter-argument?
- **The uninvolved bystander** — not engaged, possibly affected. What's in it for them? What do they fear?
- **The expert** — will check the numbers, the citations, the internal consistency. Where does it fail scrutiny?
- **The journalist / social sharer** — will it survive being quoted out of context? What's the pull quote?
- **The future reader** — context will be missing. Will it make sense without the conversation that produced it?

Present the stakeholder list to the user before proceeding. Ask if anyone is missing. Add or remove based on their input.

---

## Phase 2: Stakeholder Reads

For each stakeholder, read the document *as that person*. This is not a surface read — it requires genuine inhabitation.

### Rules for stakeholder reads

**Go deep, not broad.** Three genuine questions from one stakeholder are worth more than ten shallow observations across all of them.

**Prioritize questions over objections.** The most useful output is not "they would hate X" but "they would ask Y" — questions the document fails to answer, or answers badly.

**Include tell-me-mores.** What does the stakeholder want to know more about? Where does the document earn interest it doesn't deliver on?

**Include trust breaks.** What specific claim, framing, word choice, or omission would cause this stakeholder to stop trusting the document?

**Include entry point failures.** Where does this person stop reading, and why?

### Stakeholder read format

For each stakeholder, produce:

```
## [Stakeholder Name/Type]

**Entry point:** How does this person encounter the document? What's their state of mind?

**Questions raised:** (the document fails to answer these, or answers them badly)
- ...

**Trust breaks:** (specific things that would cause disengagement)
- ...

**Tell-me-mores:** (places where the document earns interest it doesn't pay off)
- ...

**What they need that isn't here:**
- ...
```

Do not editorialize during Phase 2. Record the stakeholder's perspective, not your own judgment about whether their concern is valid.

After completing all reads, present them to the user and ask: "Anything missing or off-base? Any stakeholder I've mischaracterized, or one I should add?" Incorporate corrections before proceeding to the brief.

---

## Phase 3: Revision Brief

Compile all stakeholder notes into a single prioritized revision brief. This is where editorial judgment happens.

### Priority tiers

**MUST HAVE — argument breaks without these**
A finding belongs here if:
- Fixing it changes whether the document achieves its purpose
- Leaving it in will cause a key stakeholder to disengage or actively oppose
- It represents a factual error, unsupported claim, or internal contradiction

**NICE TO HAVE — sharpens without breaking**
A finding belongs here if:
- It would improve the document for one or more stakeholders
- Leaving it doesn't break the argument, but fixing it improves credibility or resonance
- It's a missed opportunity rather than a flaw

**MUST DROP — hurts more than it helps**
A finding belongs here if:
- A specific word, framing, claim, or section actively undermines the argument
- It will be weaponized by opponents or cause eye-rolls among skeptics
- It's doing work the rest of the document already does better

**SEQUENCE CHANGES — structural, not content**
A finding belongs here if:
- The content is right but appears in the wrong order
- An argument lands before the reader has the context to receive it
- A key point is buried when it should lead

### Brief format

```
# Revision Brief — [Document Name]

## MUST HAVE
### [Short title]
**Source:** [Which stakeholder(s) raised this]
**Problem:** [What's wrong and why it matters]
**Fix:** [Specific, actionable guidance — not "improve this" but "add X" or "change Y to Z"]

## NICE TO HAVE
[Same format]

## MUST DROP
[Same format]

## SEQUENCE CHANGES
[Same format]

## Priority order for rewrite
Phase 1 (do first): [list items by code]
Phase 2 (sharpen): [list items]
Phase 3 (refinement): [list items if time allows]
```

Present the brief to the user. Confirm priorities before rewriting. Users may re-rank, add, or drop items.

---

## Phase 4: Guided Rewrite

Execute the rewrite in priority order: Phase 1 items first. Do not touch Phase 3 items until Phase 1 is solid.

### Rules for the rewrite

**Follow the brief, not the impulse.** If something isn't in the brief, don't change it. New ideas during rewriting go into a "next pass" note, not into the current document.

**Preserve voice.** The goal is a sharper version of the same document, not a different document. Match register, rhythm, and tone of the original unless the brief specifically calls for a tonal change.

**Show, don't just fix.** For Must Drop items, explain briefly why the dropped content hurt before removing it. For Must Have additions, integrate them as if they were always there — not as patches.

**Be honest about tradeoffs.** Some Must Have fixes for one stakeholder create friction for another. Name the tradeoff when it exists; don't paper over it.

**Preserve what's working.** Call out what the document does well that should be protected through the rewrite.

---

## Running the process

### Full run (default)
1. Identify stakeholders → confirm with user
2. Phase 2 reads → all stakeholders in sequence
3. Compile brief → present to user, confirm priorities
4. Rewrite → Phase 1 first, then Phase 2

### Quick pass (user is in a hurry)
Ask: "Do you want the full process (stakeholder reads + brief + rewrite) or a quick pass (brief + rewrite only)?" If quick pass: skip Phase 2 reads, go directly to brief based on a fast scan, confirm, rewrite.

### Read-only (user wants diagnosis, not rewrite)
Stop after Phase 3. Deliver the brief. Don't rewrite unless asked.

### Single-stakeholder (user specifies)
Run Phase 2 for only the specified stakeholder. Compile a brief from that read only. Ask whether to proceed to rewrite.

---

## Quality checks

After the rewrite, verify:

- [ ] Every Phase 1 item from the brief is addressed
- [ ] No Must Drop content remains
- [ ] Sequence changes are implemented
- [ ] Voice is consistent with original
- [ ] No new problems introduced that weren't in the original

If the rewrite introduces a new problem, note it and offer to fix before delivering.

---

## Notes on inhabiting stakeholders

The most common failure mode in stakeholder reads is **performing skepticism rather than feeling it**. A performed read produces: "The opponent might object to the framing of X." A genuine read produces: "I've been in this meeting before. The first thing I'm going to do is check whether that $43M NOI number accounts for vacancy rates, because every pro forma I've seen overstates this, and if it doesn't, I'm done."

The difference is specificity and stakes. Push for both.

Hostile stakeholders in particular require genuine inhabitation. The goal is not to validate their hostility or to dismiss it — it's to understand exactly where their best argument is strongest, so the document can either address it or consciously choose not to.

The uninvolved or indifferent stakeholder is often the most important and most neglected. They are the ones who will show up to oppose something they don't understand, or fail to show up in support of something that would benefit them. A document that doesn't give them a reason to care has failed its hardest test.
