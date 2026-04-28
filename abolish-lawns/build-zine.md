# build-zine.md — Abolish Lawns Zine Production Guidelines

## What a zine is for

Zines are the primary opinion-shifting artifact of this project. They are designed to be:

- **Printed at home** on a single sheet of letter paper, folded in half (A5 format, 5.5" × 8.5")
- **Left somewhere** — doorsteps, coffee shop counters, community boards, car windshields, city council waiting rooms
- **Self-reproducing** — every zine instructs the reader to print more
- **Readable in 90 seconds** — the hook must land before anyone decides to read further

The goal is not to convert skeptics. It is to give ammunition and permission to people who already agree but haven't said so out loud. They become the distribution network.

---

## Format

**Page size:** 5.5" × 8.5" (A5 / half-letter)
**Pages:** 4 (prints front and back of one letter sheet, fold in half)
**Color:** Full color in PDF; must also work in black-and-white print (test this)
**Output:** PDF in `abolish-lawns/static/zines/`

**Page order:**
1. **Cover** — the hook. Must work as a standalone object. This is what someone picks up.
2. **Inside left (p.2)** — the indictment. Data and argument. The "you were right" page.
3. **Inside right (p.3)** — solidarity + alternatives. "You're not alone / here's what would be better."
4. **Back cover (p.4)** — the ask. What we're doing, how to join, URL, "print more of these."

---

## Design system

All zines share a consistent design language. Do not deviate without a documented reason.

### Typography
- **Display / headlines:** DejaVu Sans Condensed Bold (`Cond`) — institutional, zero warmth, authority
- **Body:** Liberation Sans (`Sans`, `SansBold`, `SansItal`) — readable at small sizes, prints cleanly
- **Code / metadata:** Liberation Mono (`Mono`) — for SKU fields, URLs, fine print

### Colors
```
HD_ORANGE  #F96302   — Home Depot orange. Used sparingly: thin top band, bottom strip, back cover header
ACID       #7CB900   — Lawn-destruction green. Positive claims, "YOUR LAWN?", arrows, checkmarks
HD_BLACK   #1A1A1A   — Near-black. All display text.
HD_WHITE   #FFFFFF   — Page background.
HD_LTGRAY  #F2F2F2   — Quote backgrounds, spec strip.
DIM        #555555   — Body text on interior pages.
FAINT      #999999   — Captions, attribution, fine print.
CC_RED     #CC0000   — ✗ marks only. Do not use elsewhere.
```

### Layout constants
```python
W = 5.5 * inch   # page width
H = 8.5 * inch   # page height
PAD = 0.22–0.28 * inch   # page margin (cover uses 0.22, interior pages use 0.28)
```

### Rules and dividers
- Heavy rule (1.0–1.5pt, black): section breaks, under headlines
- Thin rule (0.5pt, `#CCCCCC`): within-section dividers, around pullquotes
- Acid rule: use only for maximum emphasis — sparingly
- Never use colored left-border accent stripes

---

## The Home Depot decoy aesthetic

Zine No. 1 establishes the visual language. Subsequent zines may depart from it but should understand what it's doing:

**Why it works:**
- Looks like something you'd find at a hardware store — disarms the reader
- Product-spec formatting (SKU, active ingredient, fine print) makes the political content land as a reveal
- The "slightly wrong" details reward a second look without being campy or ironic
- Works in a context where a political pamphlet would be ignored

**The rules:**
- Orange band is **thin** (≤0.42") and at the **top only** on the cover. Not a full background.
- The headline lives in the **white zone** below the image. Never split across color zones.
- "EVERY SATURDAY, UNTIL YOU DIE." or equivalent caption goes **inside the image** on a solid black strip. It must be readable — min 9pt Cond in orange on black.
- SKU, edition, coverage, active ingredient at the bottom. These should be factual-looking and then wrong in an interesting way.
- Fine print is real legal-sounding text that gradually becomes impossible.
- The barcode reads `ABOLISH-LAWNS.ORG`. Always.

**Future zines may use different aesthetic registers** (see Zine Series below), but the first impression should never be "activist pamphlet." It should be something else that then becomes that.

---

## Cover structure (required elements)

```
[thin orange category band — "LAWN CARE / INFORMATION GUIDE" + PRO badge]
[full-width image — 2.0–2.6" tall]
  └─ [solid black caption strip at image bottom — in HD_ORANGE, Cond, ≥9pt]
[HEADLINE LINE 1 — Cond 46pt, HD_BLACK]
[HEADLINE LINE 2 — Cond 46pt, ACID]
[1.5pt black rule]
[bullet list — ✓ in ACID, ✗ in CC_RED, 8.5pt Sans]
[spec strip — HD_LTGRAY, 1.05" tall]
  └─ [SKU / EDITION / COVERAGE / ACTIVE INGREDIENT — Mono labels, SansBold values]
  └─ [barcode — reads ABOLISH-LAWNS.ORG]
  └─ [fine print — 5pt Sans, FAINT, centered]
```

**Headline layout rule:** Both headline lines must be in the same background zone (white). Never split the question across color zones. The two lines read as one unit; color is the only contrast variable.

---

## Image sourcing

Images come from **Pexels** (more reliable URL structure than Unsplash for programmatic access).

Pexels format: `https://images.pexels.com/photos/{ID}/pexels-photo-{ID}.jpeg?w=900`

### Image categories used

| Role | Description | Where used |
|---|---|---|
| **Suffering** | Person mowing/strimming, head down, zero joy | Cover |
| **The before** | Perfect cheesy suburban lawn or glossy house | p.2 background (faded) |
| **The after** | Native meadow, wildflower patch, food forest | p.3 image |
| **Productive land** | Vineyard, farm, community garden, food forest | p.4 image |

### Image treatment

- **Cover image:** full color, cropped to fill width. Caption strip overlaid on bottom.
- **p.2 background:** heavily desaturated and faded (blend 88% toward near-white). Texture only — text must be fully legible over it.
- **p.3 image:** full color with slight green overlay (`alpha_overlay=(10, 40, 10)`). Full width, 1.2–1.4" tall.
- **p.4 image:** full color. Full width, 1.3–1.5" tall. Caption on solid black strip at bottom.

### Image treatment code pattern

```python
def img(c, path, x, y, w, h, halign="center", valign="center", alpha_overlay=None):
    pimg = PILImage.open(path).convert("RGB")
    iw, ih = pimg.size
    scale = max(w/iw, h/ih)
    nw, nh = iw*scale, ih*scale
    ox = {"left":0,"center":(nw-w)/2,"right":nw-w}[halign]
    oy = {"bottom":0,"center":(nh-h)/2,"top":nh-h}[valign]
    pimg = pimg.resize((int(nw), int(nh)), PILImage.LANCZOS)
    pimg = pimg.crop((int(ox), int(oy), int(ox+w), int(oy+h)))
    if alpha_overlay:
        overlay = PILImage.new("RGB", pimg.size, alpha_overlay)
        pimg = PILImage.blend(pimg, overlay, 0.45)
    buf = io.BytesIO(); pimg.save(buf, "JPEG", quality=88); buf.seek(0)
    c.drawImage(ImageReader(buf), x, y, w, h, mask="auto")
```

---

## Quotes

**Use real quotes with real attribution.** No composites, no fabrications.

Good sources:
- Reddit: r/NoLawns, r/lawncare (search for complaint threads)
- Hatch Magazine comments (hatchmag.com)
- The Lawn Forum (thelawnforum.com)
- Quora lawn complaint threads
- Local news HOA dispute coverage
- Literary sources (Miranda July, Michael Pollan, etc.)

**Attribution format:** `— First name, source/context` or `— Author Name, Title (Year)`

**Quote formatting:**
- Italicized, 8pt SansItal
- Light gray background (`HD_LTGRAY`) box behind each quote
- Attribution: 6.5pt Sans, `FAINT` color, indented 0.08"
- Never fabricate a quote. If you need a voice, find one.

---

## Prose rules

These apply to all text in all zines.

1. **Every sentence must earn its place.** After drafting, cut 25% of the words without reordering them.
2. **Short sentences hit harder than long ones.** Break compound sentences. Let periods do work.
3. **End paragraphs with a landing, not a trail-off.** The last sentence of a section should be the strongest.
4. **Name the mechanism, not just the harm.** Don't just say the lawn is bad — say what makes it mandatory and who benefits.
5. **No exclamation points.** The data is damning enough.
6. **No "we believe" or "we think."** State the argument. Let readers decide.
7. **The principled argument is the spine; the data is armor.** Even if every statistic were contested, the enclosure argument would still stand. Don't let the zine feel like it depends on the numbers.

---

## Statistics and sourcing

All numbers must appear in `src/lib/data/bibliography.ts` before going in a zine.

Current verified stats for use:
- **40 million acres** of lawn in the US (Milesi et al. 2005, NASA/UCSB) — more than any irrigated crop
- **$153 billion** annual landscaping services industry (NALP/IBIS World 2025)
- **9 billion gallons/day** residential landscape irrigation (EPA WaterSense)
- **3–9×** more pesticide per acre than agricultural crops (OSU Extension; Beyond Pesticides)
- **78 million Americans** in community associations (CAI Factbook 2025)
- **50%** of irrigation water is wasted (EPA WaterSense)

If a stat isn't in the bibliography, don't use it. If you add a new stat to a zine, add it to the bibliography first.

---

## Production workflow

```
1. Draft content in a Google Doc or markdown file first.
   Get Jason's approval on the argument and quotes before building.

2. Source images.
   Verify with PIL that images are actually what they claim to be
   (Unsplash/Pexels URL → ID mapping is unreliable — always visually verify).

3. Build the PDF.
   Script lives at: abolish-lawns/zines/build-zine-NN.py
   Output goes to: abolish-lawns/static/zines/abolish-lawns-zine-NN.pdf

4. Verify in a PDF viewer.
   Check: text legibility, image quality, caption visibility,
   headline reading order, print-to-black-and-white test.

5. Add to the zines page.
   Update src/routes/zines/+page.svelte with the new entry.

6. Commit both the script and the PDF.
   The PDF is a static asset — commit it directly to the repo.
   git add static/zines/ zines/build-zine-NN.py
   git commit -m "feat: zine no. NN — [hook]"
```

---

## Zine series

We are not limited to the Home Depot aesthetic. Planned future registers:

| No. | Hook | Aesthetic register | Primary audience |
|---|---|---|---|
| 01 | HATE MOWING YOUR LAWN? | Home Depot product decoy | HOA captives, closet dissenters |
| 02 | YOUR CITY IS WASTING YOUR WATER | Municipal utility bill parody | Renters, urban residents |
| 03 | THE HOA IS NOT YOUR FRIEND | HOA violation notice parody | Millennial homeowners |
| 04 | WHAT GROWS INSTEAD | Seed packet / garden catalog | Convert-curious, Boomers |
| 05 | FOR CITY PLANNERS | Dry policy brief, no decoy | Zoomer planners, policymakers |

Each zine stands alone. A reader should not need to have read the manifesto first.

---

## File naming

```
zines/build-zine-01.py           — build script, committed to repo
static/zines/abolish-lawns-zine-01.pdf   — output, committed to repo
```

PDFs go in `static/` so SvelteKit serves them as static assets at:
`/abolish-lawns/zines/abolish-lawns-zine-NN.pdf`

---

## What makes a zine work

The test: would someone who picked this up at a coffee shop read all four pages?

For that to happen:
- The cover must create enough curiosity or recognition that they open it
- The first inside page must confirm within 10 seconds that their time is not being wasted
- The argument must feel like it's on their side, not lecturing them
- The back cover must give them something to do

If any of those fail, the zine fails regardless of how good the content is.
