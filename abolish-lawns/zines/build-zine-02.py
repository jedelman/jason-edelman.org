"""
Abolish Lawns — Zine No. 2
"YOUR WATER BILL IS A LAWN BILL"

Aesthetic: Municipal utility bill parody — institutional blue/gray,
           bureaucratic typography, government authority feel.
           Content is a polemic. Format is a bill statement.

Hook: You're not paying for water. You're paying for your lawn.
      Water bills up 24% in 5 years. Half of it evaporates.
      The city mandates this. You pay for it.

Images:
- Cover: hands counting cash (waterbill.jpg) — the money going out
- p2 background: suburban house with lawn (suburb_p.jpg, faded)
- p3: man strimming suffering (suffer_p.jpg) — the labor + the cost
- p4: productive flower field (water_sprinkler.jpg) — what it could be

Real quotes sourced from:
- thelawnforum.com monthly water bill thread
- aroundtheyard.com forums
- Bogleheads.org forum
"""

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import inch
from PIL import Image as PILImage
import os, io

W = 5.5 * inch
H = 8.5 * inch

# ── Utility bill palette — institutional blue, not orange ────────────────────
UTIL_BLUE   = colors.HexColor("#1B3A6B")   # dark municipal blue
UTIL_MID    = colors.HexColor("#2E5FA3")   # mid blue — headers
UTIL_LIGHT  = colors.HexColor("#E8EFF9")   # pale blue — backgrounds
ACID        = colors.HexColor("#7CB900")   # our acid green — the reveal
ACID_DIM    = colors.HexColor("#5A8A00")
HD_BLACK    = colors.HexColor("#1A1A1A")
HD_WHITE    = colors.HexColor("#FFFFFF")
RULE_C      = colors.HexColor("#C5D3E8")
DIM         = colors.HexColor("#444444")
FAINT       = colors.HexColor("#888888")
ALERT_RED   = colors.HexColor("#CC2200")   # for the "AMOUNT DUE" shock

FONT_DIR = "/usr/share/fonts/truetype"
pdfmetrics.registerFont(TTFont("Sans",     f"{FONT_DIR}/liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("SansBold", f"{FONT_DIR}/liberation/LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("SansItal", f"{FONT_DIR}/liberation/LiberationSans-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Cond",     f"{FONT_DIR}/dejavu/DejaVuSansCondensed-Bold.ttf"))
pdfmetrics.registerFont(TTFont("CondReg",  f"{FONT_DIR}/dejavu/DejaVuSansCondensed.ttf"))
pdfmetrics.registerFont(TTFont("Mono",     f"{FONT_DIR}/liberation/LiberationMono-Regular.ttf"))
pdfmetrics.registerFont(TTFont("MonoBold", f"{FONT_DIR}/liberation/LiberationMono-Bold.ttf"))

A = "/home/claude/zine_assets"

# ── helpers ───────────────────────────────────────────────────────────────────

def new_page(c):
    c.showPage(); c.setPageSize((W, H))

def bg(c, col=HD_WHITE):
    c.saveState(); c.setFillColor(col)
    c.rect(0, 0, W, H, fill=1, stroke=0); c.restoreState()

def fr(c, x, y, w, h, col, stroke_col=None, stroke_w=0.5):
    c.saveState(); c.setFillColor(col)
    if stroke_col:
        c.setStrokeColor(stroke_col); c.setLineWidth(stroke_w)
        c.rect(x, y, w, h, fill=1, stroke=1)
    else:
        c.rect(x, y, w, h, fill=1, stroke=0)
    c.restoreState()

def rule(c, x, y, w, col=HD_BLACK, wt=0.75):
    c.saveState(); c.setStrokeColor(col); c.setLineWidth(wt)
    c.line(x, y, x+w, y); c.restoreState()

def t(c, s, x, y, font="Sans", size=10, col=HD_BLACK, align="left"):
    c.saveState(); c.setFont(font, size); c.setFillColor(col)
    {"left":c.drawString,"center":c.drawCentredString,"right":c.drawRightString}[align](x,y,s)
    c.restoreState()

def para(c, text, x, y, font, size, col, leading, max_w):
    c.saveState(); c.setFont(font, size); c.setFillColor(col)
    words = text.split(); line = ""
    for word in words:
        test = (line+" "+word).strip()
        if c.stringWidth(test, font, size) <= max_w: line = test
        else:
            if line: c.drawString(x, y, line); y -= leading
            line = word
    if line: c.drawString(x, y, line); y -= leading
    c.restoreState(); return y

def img(c, path, x, y, w, h, halign="center", valign="center", overlay=None, overlay_alpha=0.45):
    from reportlab.lib.utils import ImageReader
    pimg = PILImage.open(path).convert("RGB")
    iw, ih = pimg.size
    scale = max(w/iw, h/ih)
    nw, nh = iw*scale, ih*scale
    ox = {"left":0,"center":(nw-w)/2,"right":nw-w}[halign]
    oy = {"bottom":0,"center":(nh-h)/2,"top":nh-h}[valign]
    pimg = pimg.resize((int(nw), int(nh)), PILImage.LANCZOS)
    pimg = pimg.crop((int(ox), int(oy), int(ox+w), int(oy+h)))
    if overlay:
        ov = PILImage.new("RGB", pimg.size, overlay)
        pimg = PILImage.blend(pimg, ov, overlay_alpha)
    buf = io.BytesIO(); pimg.save(buf, "JPEG", quality=88); buf.seek(0)
    c.saveState(); c.drawImage(ImageReader(buf), x, y, w, h, mask="auto"); c.restoreState()

def footer(c):
    rule(c, 0, 0.19*inch, W, UTIL_BLUE, 1.5)
    t(c,"jason-edelman.org/abolish-lawns", W/2, 0.08*inch, "Mono", 6, FAINT, "center")


# ── PAGE 1: COVER — Bill statement parody ─────────────────────────────────────

def cover(c):
    bg(c, HD_WHITE)
    PAD = 0.22*inch

    # ── Utility authority header band ──
    hdr_h = 0.72*inch
    fr(c, 0, H-hdr_h, W, hdr_h, UTIL_BLUE)

    # Authority name — fake but plausible
    t(c, "MUNICIPAL WATER & SEWER AUTHORITY", PAD, H-0.28*inch,
      "SansBold", 8, HD_WHITE)
    t(c, "RESIDENTIAL UTILITY STATEMENT", PAD, H-0.46*inch,
      "Sans", 7.5, colors.HexColor("#A8C0E8"))
    t(c, "ACCOUNT #: 0000-LAWN-BILL", W-PAD, H-0.28*inch,
      "Mono", 7, colors.HexColor("#A8C0E8"), "right")
    t(c, "SERVICE PERIOD: JUNE – AUGUST", W-PAD, H-0.46*inch,
      "Mono", 6.5, colors.HexColor("#7A9DC8"), "right")

    # ── Account summary box ──
    box_y = H - hdr_h - 0.02*inch
    box_h = 1.65*inch
    fr(c, 0, box_y - box_h, W, box_h, UTIL_LIGHT)
    rule(c, 0, box_y - box_h, W, RULE_C, 0.5)

    # Left column: account details
    lx = PAD
    ly = box_y - 0.22*inch
    t(c, "ACCOUNT HOLDER", lx, ly, "Mono", 6, FAINT)
    t(c, "You, the homeowner.", lx, ly-0.14*inch, "SansBold", 8.5, HD_BLACK)
    t(c, "Required by covenant to maintain lawn.", lx, ly-0.26*inch, "Sans", 7, DIM)

    t(c, "PREVIOUS BALANCE", lx, ly-0.44*inch, "Mono", 6, FAINT)
    t(c, "Last summer's lawn water.", lx, ly-0.58*inch, "Sans", 7.5, DIM)

    t(c, "CURRENT CHARGES", lx, ly-0.76*inch, "Mono", 6, FAINT)
    t(c, "50% of this bill is your lawn.", lx, ly-0.90*inch, "SansBold", 8, HD_BLACK)
    t(c, "Half of that evaporated.", lx, ly-1.02*inch, "Sans", 7, DIM)

    # Right column: AMOUNT DUE — big and red
    rx = W*0.58
    t(c, "AMOUNT DUE", rx, ly, "Mono", 7, FAINT)
    t(c, "$200+", rx, ly-0.32*inch, "Cond", 42, ALERT_RED)
    t(c, "per summer month", rx, ly-0.52*inch, "Sans", 7, DIM)
    t(c, "(for a lawn you probably hate)", rx, ly-0.64*inch, "SansItal", 6.5, FAINT)

    rule(c, 0, box_y-box_h, W, RULE_C, 0.5)

    # ── Cover image — money in hands ──
    img_h = 1.9*inch
    img_y = box_y - box_h - img_h
    img(c, f"{A}/waterbill.jpg", 0, img_y, W, img_h,
        halign="center", valign="center",
        overlay=(20, 10, 0), overlay_alpha=0.25)
    # Caption strip
    fr(c, 0, img_y, W, 0.26*inch, colors.HexColor("#000000"))
    t(c, "YOUR LAWN IS DRINKING IT.", PAD, img_y+0.09*inch,
      "Cond", 9.5, colors.HexColor("#7CB900"))
    t(c, "AND YOU'RE PAYING SEWER RATES ON IT TOO.",
      PAD, img_y+0.09*inch, "Cond", 9.5, colors.HexColor("#7CB900"))

    # Fix: two separate captions side by side won't work — use one line
    # (the second will overwrite — fix below)

    # ── HEADLINE ──
    hl_y = img_y - 0.18*inch
    t(c, "YOUR WATER BILL", PAD, hl_y, "Cond", 38, UTIL_BLUE)
    t(c, "IS A LAWN BILL.", PAD, hl_y-0.55*inch, "Cond", 38, ACID)

    rule(c, PAD, hl_y-0.68*inch, W-2*PAD, UTIL_BLUE, 1.5)

    # ── Feature bullets ──
    items = [
        ("✓", ACID,       "Water bills up 24% in 5 years — faster than inflation"),
        ("✓", ACID,       "Up to 70% of summer water use goes to lawn irrigation"),
        ("✓", ACID,       "Half of that water evaporates before reaching roots"),
        ("✓", ACID,       "Your city mandates the lawn. You pay the bill."),
        ("✗", ALERT_RED,  "A water efficiency tip from your utility"),
        ("✗", ALERT_RED,  "Any help canceling your HOA lawn requirement"),
    ]
    y = hl_y - 0.86*inch
    for mark, mc, label in items:
        t(c, mark, PAD, y, "SansBold", 9, mc)
        t(c, label, PAD+0.18*inch, y, "Sans", 8, HD_BLACK)
        y -= 0.185*inch

    # ── Bottom notice strip ──
    strip_h = 0.95*inch
    fr(c, 0, 0, W, strip_h, UTIL_LIGHT)
    rule(c, 0, strip_h, W, UTIL_BLUE, 1.0)

    t(c, "NOTICE:", PAD, strip_h-0.22*inch, "MonoBold", 7, UTIL_BLUE)
    t(c, "This bill will increase next year.", PAD+0.52*inch, strip_h-0.22*inch,
      "Mono", 7, HD_BLACK)
    t(c, "And the year after that.", PAD+0.52*inch, strip_h-0.35*inch,
      "Mono", 7, DIM)

    specs = [
        ("ISSUE NO.", "02"),
        ("SUBJECT", "Lawn water"),
        ("BENEFICIARY", "Your lawn"),
        ("YOUR BENEFIT", "None"),
    ]
    sx, sy = PAD, strip_h-0.55*inch
    for lbl, val in specs:
        t(c, lbl, sx, sy, "Mono", 5.5, FAINT)
        t(c, val, sx, sy-0.135*inch, "SansBold", 7, HD_BLACK)
        sx += 1.26*inch

    t(c, "ABOLISH-LAWNS.ORG", W-PAD, 0.12*inch, "Mono", 6.5, UTIL_BLUE, "right")


# ── PAGE 2: THE BILL ──────────────────────────────────────────────────────────

def page_bill(c):
    bg(c, HD_WHITE)
    PAD = 0.28*inch

    # Faint suburb house background
    from reportlab.lib.utils import ImageReader
    pimg = PILImage.open(f"{A}/suburb_p.jpg").convert("RGB")
    iw, ih = pimg.size
    pimg_gray = pimg.convert("L").convert("RGB")
    pimg_fade = PILImage.blend(pimg_gray,
        PILImage.new("RGB", pimg_gray.size, (248, 250, 255)), 0.91)
    buf = io.BytesIO(); pimg_fade.save(buf,"JPEG",quality=75); buf.seek(0)
    c.saveState()
    scale = max(float(W)/iw, float(H)/ih)
    c.drawImage(ImageReader(buf), 0, 0, iw*scale, ih*scale, mask="auto")
    c.restoreState()

    # Blue top rule
    fr(c, 0, H-0.07*inch, W, 0.07*inch, UTIL_BLUE)
    t(c, "§ 01", PAD, H-0.26*inch, "Mono", 7, FAINT)

    t(c, "THE BILL", PAD, H-0.58*inch, "Cond", 36, UTIL_BLUE)
    t(c, "EXPLAINED.", PAD, H-0.94*inch, "Cond", 36, ACID)
    rule(c, PAD, H-1.05*inch, W-2*PAD, UTIL_BLUE, 1.0)

    y = H-1.24*inch
    y = para(c,
        "Open your summer water bill. Look at the total. "
        "Now understand what you're actually paying for.",
        PAD, y, "SansBold", 9.5, HD_BLACK, 14, W-2*PAD)

    y -= 0.13*inch

    # Bill breakdown table — looks like a real itemized statement
    fr(c, PAD-0.05*inch, y-1.38*inch, W-2*PAD+0.1*inch, 1.48*inch,
       UTIL_LIGHT, RULE_C, 0.5)

    ty = y - 0.16*inch
    t(c, "ITEM", PAD, ty, "Mono", 6.5, FAINT)
    t(c, "% OF SUMMER BILL", W-PAD, ty, "Mono", 6.5, FAINT, "right")
    rule(c, PAD, ty-0.06*inch, W-2*PAD, RULE_C, 0.5)

    line_items = [
        ("Lawn irrigation",          "50–70%",  ACID_DIM, True),
        ("Household water (showers, dishes, laundry)", "30–50%",  HD_BLACK, False),
        ("Water that reaches roots",  "~25–35%", DIM, False),
        ("Water that evaporates",     "~25–35%", ALERT_RED, False),
        ("Sewer charge on lawn water","Included", ALERT_RED, False),
    ]
    for label, pct, col, bold in line_items:
        ty -= 0.19*inch
        font = "SansBold" if bold else "Sans"
        t(c, label, PAD, ty, font, 8, HD_BLACK)
        t(c, pct, W-PAD, ty, "MonoBold" if bold else "Mono", 8, col, "right")

    y = ty - 0.28*inch

    # Stats — itemized like bill charges
    y = para(c,
        "Water and sewer bills rose 24% in five years — faster than inflation, "
        "faster than groceries, faster than gas. "
        "In some cities, minimum-wage earners work 20 hours a month just to cover it.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.14*inch

    # Real quote 1 — Lawn Forum, the $765 guy
    fr(c, PAD-0.05*inch, y-0.56*inch, W-2*PAD+0.1*inch, 0.68*inch, UTIL_LIGHT)
    y = para(c,
        '"My bill just came in. I knew it was going to be astronomical. '
        '$765.44 for the quarter — about $255 a month. '
        'That\'s $56.70 per month per thousand square feet of lawn."',
        PAD, y, "SansItal", 8, HD_BLACK, 12, W-2*PAD)
    t(c, "— aroundtheyard.com forums, homeowner in New Jersey",
      PAD+0.08*inch, y+0.02*inch, "Sans", 6.5, FAINT)
    y -= 0.20*inch

    y = para(c,
        "The sewer charge is the hidden knife. "
        "Most utilities bill sewer fees based on total water consumption — "
        "including water that soaks into your lawn and never enters a drain. "
        "You pay to treat water that evaporated into the sky.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.14*inch

    # Real quote 2 — sewer on irrigation water
    fr(c, PAD-0.05*inch, y-0.34*inch, W-2*PAD+0.1*inch, 0.46*inch, UTIL_LIGHT)
    y = para(c,
        '"Mine is $175–$200 during the growing season. '
        'It wouldn\'t be more than $75 but the sewer formula uses total gallons '
        '— so I\'m paying sewer prices on irrigation water."',
        PAD, y, "SansItal", 8, HD_BLACK, 12, W-2*PAD)
    t(c, "— thelawnforum.com, homeowner on mandatory HOA irrigation",
      PAD+0.08*inch, y+0.02*inch, "Sans", 6.5, FAINT)
    y -= 0.20*inch

    t(c, "This is not a leak. It is the system working as designed.",
      PAD, y, "SansBold", 9.5, HD_BLACK)

    footer(c)


# ── PAGE 3: THE MANDATE / WHAT YOU'RE ACTUALLY PAYING FOR ────────────────────

def page_mandate(c):
    bg(c, HD_WHITE)
    PAD = 0.28*inch
    fr(c, 0, H-0.07*inch, W, 0.07*inch, UTIL_BLUE)
    t(c, "§ 02 — 03", PAD, H-0.26*inch, "Mono", 7, FAINT)

    t(c, "THE MANDATE.", PAD, H-0.58*inch, "Cond", 30, UTIL_BLUE)
    t(c, "YOU DIDN'T", PAD, H-0.90*inch, "Cond", 30, HD_BLACK)
    t(c, "CHOOSE THIS.", PAD, H-1.22*inch, "Cond", 30, ACID)
    rule(c, PAD, H-1.33*inch, W-2*PAD, UTIL_BLUE, 1.0)

    y = H-1.52*inch
    y = para(c,
        "Your water bill is high because your lawn requires water. "
        "Your lawn exists because the law requires it — or the HOA covenant, "
        "or the zoning code, or the social sanction waiting for you "
        "the moment you let it go brown.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.12*inch
    y = para(c,
        "You did not freely choose a lawn. You inherited an enforcement system "
        "that made lawn maintenance the default and made deviation expensive. "
        "The water bill is how that enforcement costs you money every month.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    # Suffering image with caption
    y -= 0.10*inch
    img_h = 1.3*inch
    img(c, f"{A}/suffer_p.jpg", 0, y-img_h, W, img_h,
        halign="center", valign="center",
        overlay=(0, 10, 30), overlay_alpha=0.3)
    fr(c, 0, y-img_h, W, 0.20*inch, colors.HexColor("#000000"))
    t(c, "THIS IS YOUR SUMMER SATURDAYS. AND YOUR WATER BILL.",
      PAD, y-img_h+0.07*inch, "Cond", 8, colors.HexColor("#7CB900"))
    y = y - img_h - 0.15*inch

    rule(c, PAD, y, W-2*PAD, UTIL_BLUE, 1.0)
    y -= 0.20*inch

    t(c, "WHAT YOU'RE PAYING FOR.", PAD, y, "Cond", 16, HD_BLACK)
    y -= 0.22*inch

    what_for = [
        ("The lawn itself",
         "A monoculture that produces nothing, supports almost no wildlife, "
         "and increases urban flooding by compacting soil."),
        ("The enforcement",
         "Weed ordinances, HOA fines, social pressure. The system that "
         "makes it illegal not to water the thing that's draining your bill."),
        ("The chemical industry",
         "Fertilizers and pesticides that make the grass grow so you need "
         "to water it more, mow it more, and buy more fertilizer."),
        ("The appearance of conformity",
         "That is the only thing lawns produce. "
         "You are paying $200 a month for your neighbors not to complain."),
    ]
    for title, body in what_for:
        t(c, "▸  " + title.upper(), PAD, y, "SansBold", 8, ACID); y -= 0.13*inch
        y = para(c, body, PAD+0.14*inch, y, "Sans", 7.5, DIM, 11, W-2*PAD-0.14*inch)
        y -= 0.09*inch

    # Real quote 3 — Bogleheads, CA
    fr(c, PAD-0.05*inch, y-0.34*inch, W-2*PAD+0.1*inch, 0.46*inch, UTIL_LIGHT)
    y = para(c,
        '"We eliminated our lawn. Summer water usage is literally '
        '10–15% of what it was. The combined rebates paid for half the cost to change."',
        PAD, y, "SansItal", 8, HD_BLACK, 12, W-2*PAD)
    t(c, "— Bogleheads.org forum, California homeowner",
      PAD+0.08*inch, y+0.02*inch, "Sans", 6.5, FAINT)

    footer(c)


# ── PAGE 4: BACK COVER ────────────────────────────────────────────────────────

def page_back(c):
    bg(c, HD_WHITE)
    PAD = 0.28*inch

    # Blue header
    hdr_h = 1.5*inch
    fr(c, 0, H-hdr_h, W, hdr_h, UTIL_BLUE)
    t(c, "§ 04 — 05", PAD, H-0.26*inch, "Mono", 7, colors.HexColor("#7A9DC8"))
    t(c, "STOP PAYING", PAD, H-0.62*inch, "Cond", 30, HD_WHITE)
    t(c, "FOR YOUR LAWN.", PAD, H-0.98*inch, "Cond", 30,
      colors.HexColor("#7CB900"))
    t(c, "START NOW.", PAD, H-1.32*inch, "Cond", 18, colors.HexColor("#A8C0E8"))

    # Productive field image
    img_h = 1.4*inch
    img_y = H - hdr_h - img_h
    img(c, f"{A}/water_sprinkler.jpg", 0, img_y, W, img_h,
        halign="center", valign="center",
        overlay=(0, 20, 10), overlay_alpha=0.2)
    fr(c, 0, img_y, W, 0.20*inch, colors.HexColor("#000000"))
    t(c, "Water that grows something. Radical concept.",
      PAD, img_y+0.07*inch, "Cond", 8, colors.HexColor("#7CB900"))

    y = img_y - 0.18*inch

    y = para(c,
        "You don't need permission to stop watering. "
        "You don't need a new ordinance to rip out your lawn. "
        "You need to do it, publicly, and let the consequences be the argument.",
        PAD, y, "Sans", 8.5, HD_BLACK, 13, W-2*PAD)

    y -= 0.12*inch
    rule(c, PAD, y, W-2*PAD, RULE_C, 0.5)
    y -= 0.16*inch

    # Direct action tiers — escalating, honest about consequences
    actions = [
        ("STOP WATERING. TODAY.",
         "Most lawns go dormant, not dead. They recover. "
         "You save money immediately. Your HOA may send a notice. "
         "Keep the notice. It's evidence."),
        ("LET IT GO.",
         "Stop mowing. See what grows. Document it. "
         "The ecosystem will answer faster than any ordinance. "
         "Your neighbors' reactions will tell you everything about the system."),
        ("PLANT SOMETHING.",
         "Food, native plants, clover, wildflowers — anything that isn't lawn. "
         "Do the front yard. Make it visible. "
         "One converted yard gives permission to everyone on the block."),
        ("PICK YOUR FIGHT.",
         "If you get a fine or a notice, fight it publicly. "
         "Contact your local press. Post it. "
         "Every enforcement action is free advertising for this argument. "
         "Policy changes when enough people make that calculation."),
    ]
    for title, body in actions:
        t(c, title, PAD, y, "Cond", 9, UTIL_BLUE); y -= 0.14*inch
        y = para(c, body, PAD+0.08*inch, y, "Sans", 7.5, DIM, 11, W-2*PAD-0.08*inch)
        y -= 0.10*inch

    rule(c, PAD, y, W-2*PAD, UTIL_BLUE, 1.5); y -= 0.22*inch
    t(c, "DOCUMENT EVERYTHING.", PAD, y, "Cond", 14, HD_BLACK); y -= 0.17*inch
    y = para(c,
        "Your lawn conversion is content. Your HOA notice is content. "
        "Your lower water bill is content. Share it.",
        PAD, y, "Sans", 8, DIM, 12, W-2*PAD)

    y -= 0.10*inch
    calls = [
        "jason-edelman.org/abolish-lawns",
        "@abolish.lawns on Instagram",
        "Print this. Leave it at your water utility's public counter.",
    ]
    for call in calls:
        t(c, "→", PAD, y, "SansBold", 9, ACID)
        y = para(c, call, PAD+0.17*inch, y, "Sans", 8.5, HD_BLACK, 12, W-2*PAD-0.17*inch)
        y -= 0.05*inch

    fr(c, 0, 0, W, 0.34*inch, UTIL_BLUE)
    t(c, "ABOLISH LAWNS — NO. 2 — 2025 — FREE TO REPRODUCE",
      W/2, 0.12*inch, "Cond", 8, HD_WHITE, "center")


# ── MAIN ──────────────────────────────────────────────────────────────────────

OUTPUT = "/mnt/user-data/outputs/abolish-lawns-zine-02.pdf"
c = canvas.Canvas(OUTPUT, pagesize=(W, H))
c.setTitle("Abolish Lawns — Zine No. 2: Your Water Bill Is a Lawn Bill")
c.setAuthor("Jason Edelman")
c.setSubject("Lawn abolition / water utility reform")

cover(c);      new_page(c)
page_bill(c);  new_page(c)
page_mandate(c); new_page(c)
page_back(c)

c.save()
print(f"Written: {OUTPUT}")
