# Polemic: Argument Mapping Engine

A logic-based system for mapping, analyzing, and visualizing debates using principles from classical rhetoric and modern argumentation theory.

## Overview

Polemic is a **diagrammatic reasoning system** designed to expose the logical and emotional structure of arguments. It's built on three layers:

1. **Knowledge Base (Prolog)** — Represents claims, facts, and logical relationships
2. **Reasoning Engine (Python)** — Executes structured queries to analyze the argument landscape
3. **Visualization (React)** — Displays the debate map with interactive exploration

The system makes visible what skilled debaters like Socrates did implicitly: **finding the actual point of disagreement (stasis) and distinguishing it from downstream implications**.

## Architecture

### Layer 1: Knowledge Representation (`polemic_kb.pl`)

A Prolog schema defining:

**Core Predicates:**
- `claim(ID, Speaker, Text, Type, Confidence, Timestamp)` — Any assertion by a participant
- `fact(ID, Domain, Assertion, Source, Verified, Timestamp)` — Grounded, verifiable facts
- `relation(Type, FromID, ToID, Strength, Timestamp)` — Logical relationships between ideas
- `assumption(ClaimID, Text)` — Implicit prerequisites
- `affect(ClaimID, Emotion, Intensity)` — Emotional/rhetorical charge

**Claim Types:**
- `empirical` — Factual claims (about the world)
- `normative` — Value-based claims (how things should be)
- `definitional` — Claims about meaning or categories
- `jurisdictional` — Claims about scope or authority
- `hypothetical` — Conditional scenarios

**Relation Types:**
- `entails` — A logically implies B
- `contradicts` — A and B cannot both be true
- `supports` — A makes B more credible
- `weakens` — A makes B less credible
- `presupposes` — A assumes B is true
- `follows_from` — B is a consequence of A
- `equivalent` — A and B say the same thing

**Derived Rules:**
- `closure(A, B)` — Transitive entailment (A implies chains of claims)
- `stasis_point(X)` — X is a true point of disagreement
- `vulnerable(Claim)` — Claim is weak (low confidence, weak foundation)
- `high_leverage(Claim)` — Claim has outsized rhetorical power

### Layer 2: Reasoning Engine (`polemic_server.py`)

A Python system that:
- **Loads** JSON knowledge bases into memory
- **Executes** structured queries (no free-form Prolog needed)
- **Exports** results as graph data for visualization

**Query Types:**

```python
engine.query("entails", {"from": "claim_abol_002"})
# Returns: all claims that claim_abol_002 entails

engine.query("stasis", {})
# Returns: points of actual disagreement between speakers

engine.query("vulnerabilities", {"speaker": "abolitionist"})
# Returns: weak claims in abolitionist position

engine.query("leverage", {})
# Returns: high-impact claims ranked by leverage score

engine.query("position", {"speaker": "abolitionist"})
# Returns: complete reconstruction of speaker's position

engine.query("ground_check", {"claim_id": "claim_abol_002"})
# Returns: what facts ground this claim?
```

### Layer 3: Knowledge Base Format (`lawns_debate.json`)

JSON structure representing a complete debate:

```json
{
  "domain": "lawns",
  "participants": [
    { "name": "abolitionist", "role": "advocate", "position": "..." },
    { "name": "preservationist", "role": "opponent", "position": "..." }
  ],
  "facts": [
    {
      "id": "fact_water_002",
      "domain": "water",
      "assertion": "Lawn irrigation is 8-9 billion gallons per day",
      "source": "EPA WaterSense Program",
      "verified": true
    }
  ],
  "claims": [
    {
      "id": "claim_abol_002",
      "speaker": "abolitionist",
      "text": "Lawn irrigation consumes nearly 25% of all public water supply",
      "type": "empirical",
      "confidence": 0.95
    }
  ],
  "relations": [
    {
      "type": "entails",
      "from": "fact_water_002",
      "to": "claim_abol_002",
      "strength": 0.95
    }
  ],
  "affects": [
    {
      "claim": "claim_abol_002",
      "emotion": "shame",
      "intensity": 0.85
    }
  ]
}
```

**Why JSON?**
- Portable (users can fork/share debate maps as files)
- Git-friendly (diffs show how arguments evolve)
- Works as artifact in Claude
- Easy to bootstrap (no schema migration)
- Foundation for future database migration

### Layer 4: Visualization (`polemic_visualizer.jsx`)

React component that displays:
- **Stasis Section** — The actual point of disagreement highlighted
- **Facts Panel** — Grounded, verified facts
- **Claim Panels** — Claims organized by speaker
- **Details Panel** — Selected node's logical relationships and emotional charge
- **Interactive Exploration** — Click any node to see what it entails/contradicts

## Usage

### 1. Defining a Debate

Create a JSON file mapping the argument space:

```json
{
  "domain": "lawns",
  "participants": [...],
  "facts": [
    { "id": "fact_water_001", "assertion": "...", "source": "EPA", "verified": true }
  ],
  "claims": [
    { "id": "claim_001", "speaker": "abolitionist", "text": "...", "type": "empirical", "confidence": 0.95 }
  ],
  "relations": [
    { "type": "entails", "from": "fact_water_001", "to": "claim_001", "strength": 0.95 }
  ]
}
```

### 2. Querying the Engine

```python
from polemic_server import PalemicEngine, init_engine

# Initialize
init_engine("lawns_debate.json")

# Find stasis (actual disagreement)
result = engine.query("stasis", {})
# → Shows claims that are contradicted by multiple speakers

# Find leverage points (high-impact claims)
result = engine.query("leverage", {})
# → Ranks claims by implications + emotional intensity

# Check what grounds a claim
result = engine.query("ground_check", {"claim_id": "claim_abol_002"})
# → Shows facts that support this claim
```

### 3. Visualizing

Import the React component and pass the KB export:

```jsx
<PalemicVisualizer debateData={debateJSON} />
```

The visualizer shows:
- Facts vs. Claims (visual distinction)
- Speaker positions (color-coded)
- Contradictions (marked as stasis points)
- Logical chains (entailment relationships)

## Key Insights from the Lawns Debate

The system reveals:

### Stasis (Actual Disagreement)
The real argument is NOT about water or ecology. It's about:
1. **Value** — Do lawns provide net benefit or harm?
2. **Definition** — Are lawns choice or enforcement?
3. **Possibility** — Can water conservation and lawns coexist?

### Leverage
The abolitionist's highest-leverage claim:
- "Lawn irrigation = 25% of public water supply"
- Implies: water is being wasted on non-food
- Emotional charge: shame (0.85)
- Leverage score: 0.955

### Vulnerabilities
The preservationist's weakest claims:
- "Technology can solve this" (confidence: 0.65, no facts support it)
- "Property values would drop" (confidence: 0.60, disputed)

### Ground
The abolitionist's position is **heavily grounded** in verified facts:
- 14 facts from EPA, USGS, USDA, academic sources
- Every empirical claim connects to at least one fact
- Confidence ranges 0.85-0.98

The preservationist's position is **normative** (value-based):
- Claims about beauty, choice, mental health
- Confidence 0.70-0.80
- No factual grounding (and shouldn't be — these are values)

## Design Principles

### 1. **Separate Fact from Value**
The system distinguishes:
- Empirical claims (truth-apt, can be verified)
- Normative claims (value-based, can't be "wrong")
- Definitional claims (about meaning)

This prevents the common rhetorical move of smuggling values into facts.

### 2. **Make Stasis Visible**
Socrates found the actual point of disagreement by asking "Do we agree on X?" repeatedly. Polemic does this automatically.

### 3. **Show Emotional Territory**
Arguments work on emotion (pathos) as much as logic (logos). The `affects` predicate maps which claims hit which emotional registers.

### 4. **Expose Assumptions**
The `presupposes` relation makes visible what a claim requires to be true. If that assumption is weak, the whole position is vulnerable.

### 5. **Distinguish Leverage from Truth**
A claim can be:
- Logically weak but emotionally powerful (high leverage, low grounding)
- Logically strong but emotionally neutral (good foundation, low persuasiveness)
- Strong on both dimensions (rare, deadly)

## Limitations & Future Work

### Current (MVP)
- JSON-based KB (good for small-medium debates, < 100 claims)
- Python reasoning engine (simpler than full Prolog, but less expressive)
- React visualization (interactive but doesn't show spatial layout like force-directed graphs)

### Next Phase
- **Prolog Backend** — Switch to SWI-Prolog for full logical expressivity
- **Persistence Layer** — Move from JSON to database (PostgreSQL + Notion sync)
- **Collaborative Maps** — Multiple users editing the same debate in real-time
- **Advanced Visualization** — Force-directed graphs, 3D layouts, animated implications
- **Integration** — MCP server for Claude, API for external tools

### Future (Product)
- **Templates** — Pre-built schemas for common debate types (policy, tech, philosophy)
- **Debate Library** — Curated maps of real debates (climate, AI, economics)
- **AI Extraction** — Claude automatically extracts claims/facts from text
- **Multi-Language** — Support debates in multiple languages
- **Mobile App** — Access, edit, explore debate maps on phone

## Technical Stack

- **Reasoning:** Prolog schema + Python engine
- **Data:** JSON (MVP), PostgreSQL (future)
- **Visualization:** React + D3.js
- **Integration:** MCP server (Claude), REST API (future)

## File Structure

```
polemic/
├── polemic_kb.pl           # Prolog schema & rules
├── lawns_debate.json       # Test case: complete lawn debate
├── polemic_server.py       # Python reasoning engine
├── polemic_visualizer.jsx  # React visualization
└── README.md               # This file
```

## Testing

```bash
# Test the reasoning engine
python3 polemic_server.py

# Expected output:
# - Loads lawns_debate.json
# - Finds stasis points
# - Calculates leverage scores
# - Reconstructs positions
# - Exports graph for visualization
```

## References

### Classical Rhetoric
- **Stasis Theory** — Hermagoras of Temnos, developed by Roman orators
  - Where does disagreement lie? (conjecture, definition, quality, jurisdiction)
- **Ethos/Pathos/Logos** — Aristotle
  - Three modes of persuasion (credibility, emotion, logic)

### Modern Argumentation
- **Habermas** — Communicative action and discourse ethics
- **Toulmin** — Argument structures (claim, evidence, warrant, backing)
- **Dung** — Abstract argumentation frameworks

### Rhetorical Tech
- **Deleuze & Guattari** — The diagram as working surface for thought
- **Latour** — Actor-network theory and controversy mapping

## License

This is part of the abolish-lawns.org project. See parent repo for license.

---

**Questions? Ideas for improvement? File an issue or reach out.**
