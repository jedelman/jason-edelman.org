"""
Abolish Lawns — Zine No. 3
"YOUR LAWN USES MORE WATER THAN AI."

Audience: Environmentalists, people already writing senators about data centers,
           people angry about AI water use.

Argument: Your anger at data centers is correct AND misdirected.
          US lawns use ~170x more water than all US data centers combined.
          Both are enclosures. The lawn is the one you have leverage over TODAY.
          Direct action: stop watering, let it go, plant something, make it visible.

Aesthetic: Environmental organization direct mail parody.
           Sierra Club / NRDC alarming mailer energy.
           Forest green, earth tones, alarming chart, urgent sans-serif.
           The alarming chart is about lawns.

Numbers (all verified):
- US lawn irrigation: ~2.9 trillion gallons/year (multiple sources)
- US data centers direct: ~17 billion gallons/year (Lawrence Berkeley Lab 2023)
- Ratio: ~170x (US lawns vs US data centers, direct consumption only)
- Global AI data centers: ~260 billion gallons/year implied
- Ratio lawns vs global AI: ~11x (Substack "You Don't Actually Care" 2026)
- Source: Shehabi et al. 2024 via MOST Policy Initiative; EPA WaterSense
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

# ── Environmental org palette — forest green, earth, alarm ──────────────────
ENV_GREEN   = colors.HexColor("#1B4332")   # deep forest green
ENV_MID     = colors.HexColor("#2D6A4F")   # mid green
ENV_LIGHT   = colors.HexColor("#D8F3DC")   # pale mint background
ENV_EARTH   = colors.HexColor("#6B4226")   # earth brown
ACID        = colors.HexColor("#7CB900")   # our acid green
ALARM_RED   = colors.HexColor("#B91C1C")   # alarm
ALARM_AMBER = colors.HexColor("#B45309")   # warning
HD_BLACK    = colors.HexColor("#1A1A1A")
HD_WHITE    = colors.HexColor("#FFFFFF")
RULE_C      = colors.HexColor("#A8D5B5")
DIM         = colors.HexColor("#374151")
FAINT       = colors.HexColor("#6B7280")

FONT_DIR = "/usr/share/fonts/truetype"
pdfmetrics.registerFont(TTFont("Sans",     f"{FONT_DIR}/liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("SansBold", f"{FONT_DIR}/liberation/LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("SansItal", f"{FONT_DIR}/liberation/LiberationSans-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Cond",     f"{FONT_DIR}/dejavu/DejaVuSansCondensed-Bold.ttf"))
pdfmetrics.registerFont(TTFont("CondReg",  f"{FONT_DIR}/dejavu/DejaVuSansCondensed.ttf"))
pdfmetrics.registerFont(TTFont("Mono",     f"{FONT_DIR}/liberation/LiberationMono-Regular.ttf"))

A = "/home/claude/zine_assets"

# ── helpers ───────────────────────────────────────────────────────────────────

def new_page(c): c.showPage(); c.setPageSize((W, H))

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

def img(c, path, x, y, w, h, halign="center", valign="center", overlay=None, alpha=0.45, gray=False):
    from reportlab.lib.utils import ImageReader
    pimg = PILImage.open(path).convert("RGB")
    if gray:
        pimg = pimg.convert("L").convert("RGB")
    iw, ih = pimg.size
    scale = max(w/iw, h/ih)
    nw, nh = iw*scale, ih*scale
    ox = {"left":0,"center":(nw-w)/2,"right":nw-w}[halign]
    oy = {"bottom":0,"center":(nh-h)/2,"top":nh-h}[valign]
    pimg = pimg.resize((int(nw), int(nh)), PILImage.LANCZOS)
    pimg = pimg.crop((int(ox), int(oy), int(ox+w), int(oy+h)))
    if overlay:
        ov = PILImage.new("RGB", pimg.size, overlay)
        pimg = PILImage.blend(pimg, ov, alpha)
    buf = io.BytesIO(); pimg.save(buf, "JPEG", quality=88); buf.seek(0)
    c.saveState(); c.drawImage(ImageReader(buf), x, y, w, h, mask="auto"); c.restoreState()

def bar_chart(c, x, y, w, h):
    """Draw the key comparison bar chart inline."""
    # Data: US lawns vs US data centers vs global AI (all in billion gallons)
    bars = [
        ("US Lawns",         2900, ALARM_RED),
        ("Global AI Data Centers", 260, ALARM_AMBER),
        ("US Data Centers",   17,  ENV_MID),
    ]
    max_val = 2900
    bar_h = h / (len(bars) * 2)
    label_w = 1.55 * inch
    bar_area = w - label_w - 0.3*inch

    for i, (label, val, col) in enumerate(bars):
        by = y + h - (i+1)*(bar_h*1.8)
        bar_len = (val / max_val) * bar_area

        # Label
        c.saveState(); c.setFont("Sans", 7); c.setFillColor(DIM)
        c.drawString(x, by + bar_h*0.25, label)
        c.restoreState()

        # Bar
        c.saveState(); c.setFillColor(col)
        c.rect(x + label_w, by, bar_len, bar_h, fill=1, stroke=0)
        c.restoreState()

        # Value label
        val_str = f"{val:,}B gal/yr" if val >= 100 else f"{val}B gal/yr"
        c.saveState(); c.setFont("Mono", 6.5); c.setFillColor(col)
        c.drawString(x + label_w + bar_len + 4, by + bar_h*0.25, val_str)
        c.restoreState()

def footer(c):
    rule(c, 0, 0.19*inch, W, ENV_GREEN, 1.5)
    t(c, "jason-edelman.org/abolish-lawns", W/2, 0.08*inch,
      "Mono", 6, FAINT, "center")


# ── PAGE 1: COVER ─────────────────────────────────────────────────────────────

def cover(c):
    bg(c, HD_WHITE)
    PAD = 0.22*inch

    # Green org header — Sierra Club energy
    hdr_h = 0.52*inch
    fr(c, 0, H-hdr_h, W, hdr_h, ENV_GREEN)
    t(c, "WATER CONSERVATION", PAD, H-0.20*inch, "SansBold", 8, HD_WHITE)
    t(c, "ACTION BULLETIN", PAD, H-0.36*inch, "Sans", 7.5,
      colors.HexColor("#74C69D"))
    t(c, "URGENT", W-PAD, H-0.28*inch, "Cond", 14, ACID, "right")

    # Cover image — servers, grayscale, slightly green-tinted
    # (The alarming image they expect — but then we pivot)
    img_h = 2.0*inch
    img_y = H - hdr_h - img_h
    img(c, f"{A}/servers.jpg", 0, img_y, W, img_h,
        halign="center", valign="center",
        overlay=(10, 40, 20), alpha=0.35, gray=True)

    # Caption — sets up the pivot
    fr(c, 0, img_y, W, 0.26*inch, colors.HexColor("#000000"))
    t(c, "THIS IS NOT YOUR BIGGEST WATER PROBLEM.",
      PAD, img_y+0.09*inch, "Cond", 8.5, ACID)

    # HEADLINE
    hl_y = img_y - 0.18*inch
    t(c, "YOUR LAWN", PAD, hl_y, "Cond", 42, ENV_GREEN)
    t(c, "USES MORE", PAD, hl_y - 0.60*inch, "Cond", 42, HD_BLACK)
    t(c, "WATER THAN AI.", PAD, hl_y - 1.20*inch, "Cond", 34, ALARM_RED)

    rule(c, PAD, hl_y-1.35*inch, W-2*PAD, ENV_GREEN, 1.5)

    # Sub-deck
    y = hl_y - 1.55*inch
    y = para(c,
        "170 times more, to be precise. "
        "Your anger at data centers is correct. "
        "This is where to aim it.",
        PAD, y, "SansBold", 10, HD_BLACK, 14, W-2*PAD)

    y -= 0.14*inch
    bullets = [
        ("✓", ACID,       "The comparison you need, sourced and precise"),
        ("✓", ACID,       "Why both problems have the same root cause"),
        ("✓", ACID,       "What you can do today without a senator"),
        ("✓", ACID,       "The commons argument that connects them"),
        ("✗", ALARM_RED,  "A defense of AI water use"),
        ("✗", ALARM_RED,  "Any suggestion your anger is wrong"),
    ]
    for mark, mc, label in bullets:
        t(c, mark, PAD, y, "SansBold", 9, mc)
        t(c, label, PAD+0.18*inch, y, "Sans", 8, HD_BLACK)
        y -= 0.185*inch

    # Bottom strip
    strip_h = 0.72*inch
    fr(c, 0, 0, W, strip_h, ENV_LIGHT)
    rule(c, 0, strip_h, W, ENV_GREEN, 1.0)
    t(c, "US LAWNS: ~2.9 TRILLION GAL/YR",
      PAD, strip_h-0.22*inch, "Mono", 7, ALARM_RED)
    t(c, "US DATA CENTERS: ~17 BILLION GAL/YR",
      PAD, strip_h-0.38*inch, "Mono", 7, ENV_MID)
    t(c, "RATIO: ~170×", W-PAD, strip_h-0.30*inch,
      "Cond", 18, ALARM_RED, "right")
    t(c, "Source: Lawrence Berkeley Lab 2023; EPA WaterSense",
      W/2, 0.09*inch, "Mono", 5.5, FAINT, "center")


# ── PAGE 2: THE NUMBERS ───────────────────────────────────────────────────────

def page_numbers(c):
    bg(c, HD_WHITE)
    PAD = 0.28*inch
    fr(c, 0, H-0.07*inch, W, 0.07*inch, ENV_GREEN)
    t(c, "§ 01", PAD, H-0.26*inch, "Mono", 7, FAINT)

    t(c, "THE NUMBERS.", PAD, H-0.58*inch, "Cond", 34, ENV_GREEN)
    t(c, "PRECISELY.", PAD, H-0.94*inch, "Cond", 34, ALARM_RED)
    rule(c, PAD, H-1.05*inch, W-2*PAD, ENV_GREEN, 1.0)

    y = H-1.22*inch
    y = para(c,
        "Before the argument, the data. "
        "Every figure here is sourced. "
        "Check the bibliography at jason-edelman.org/abolish-lawns/bibliography.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    # The comparison chart
    y -= 0.16*inch
    chart_h = 1.10*inch
    fr(c, PAD-0.05*inch, y-chart_h-0.12*inch,
       W-2*PAD+0.1*inch, chart_h+0.32*inch, ENV_LIGHT)
    t(c, "ANNUAL US WATER CONSUMPTION BY SOURCE",
      PAD, y, "Mono", 6.5, ENV_GREEN)
    y -= 0.14*inch
    bar_chart(c, PAD, y-chart_h, W-2*PAD, chart_h)
    y -= chart_h + 0.24*inch

    t(c, "Sources: Lawrence Berkeley Lab (Shehabi et al. 2024); EPA WaterSense; joshuaheathscott.substack.com",
      PAD, y, "Mono", 5, FAINT)
    y -= 0.18*inch

    rule(c, PAD, y, W-2*PAD, RULE_C, 0.5)
    y -= 0.20*inch

    y = para(c,
        "US lawn irrigation consumes approximately 2.9 trillion gallons per year. "
        "All US data centers combined consume approximately 17 billion gallons "
        "directly — about 170 times less. "
        "Including indirect water use from electricity generation raises "
        "data center consumption to around 211 billion gallons — "
        "still 14 times less than lawns.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.14*inch
    y = para(c,
        "Half of all lawn irrigation water evaporates before reaching roots. "
        "Data centers increasingly recycle cooling water and source non-potable supply. "
        "The trends are moving in opposite directions.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.18*inch
    rule(c, PAD, y, W-2*PAD, RULE_C, 0.5)
    y -= 0.20*inch

    # The honest caveat — this audience demands it
    fr(c, PAD-0.05*inch, y-0.82*inch, W-2*PAD+0.1*inch, 0.92*inch,
       colors.HexColor("#FEF3C7"))
    t(c, "THE HONEST CAVEAT", PAD, y, "Cond", 9, ALARM_AMBER)
    y -= 0.15*inch
    y = para(c,
        "Data center water use is a real problem — especially locally. "
        "A single Meta data center in Newton County, GA uses 10% of the "
        "entire county's water. These are not abstract national statistics "
        "for people whose aquifer is being drawn down. "
        "The national comparison does not cancel the local harm. "
        "Both are enclosures. Both deserve your anger. "
        "The lawn is the one you can act on today.",
        PAD, y, "Sans", 7.5, DIM, 11.5, W-2*PAD)
    y -= 0.12*inch

    footer(c)


# ── PAGE 3: SAME ROOT CAUSE ───────────────────────────────────────────────────

def page_root(c):
    bg(c, HD_WHITE)
    PAD = 0.28*inch
    fr(c, 0, H-0.07*inch, W, 0.07*inch, ENV_GREEN)
    t(c, "§ 02 — 03", PAD, H-0.26*inch, "Mono", 7, FAINT)

    t(c, "SAME ROOT", PAD, H-0.58*inch, "Cond", 30, ENV_GREEN)
    t(c, "CAUSE.", PAD, H-0.90*inch, "Cond", 30, HD_BLACK)
    rule(c, PAD, H-1.00*inch, W-2*PAD, ENV_GREEN, 1.0)

    y = H-1.18*inch
    y = para(c,
        "Data centers extract shared water resources for private profit, "
        "externalize the environmental costs onto local communities, "
        "and operate behind opacity and regulatory capture. "
        "Lawns extract shared water resources for the performance of conformity, "
        "externalize the ecological costs onto watersheds and downstream communities, "
        "and operate behind municipal ordinances and HOA covenants that make "
        "refusal costly.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.12*inch
    y = para(c,
        "Both are enclosures. The commons — shared water, shared ecological "
        "function, shared land — captured for private or corporate use with "
        "costs pushed onto everyone else.",
        PAD, y, "SansBold", 9, HD_BLACK, 13.5, W-2*PAD)

    # Lightbulb-in-drought image — the environmental cliché, but honest
    y -= 0.10*inch
    img_h = 1.35*inch
    img(c, f"{A}/dry_grass.jpg", 0, y-img_h, W, img_h,
        halign="center", valign="center",
        overlay=(20, 30, 10), alpha=0.2)
    fr(c, 0, y-img_h, W, 0.20*inch, colors.HexColor("#000000"))
    t(c, "THE DROUGHT YOUR LAWN IS MAKING WORSE.",
      PAD, y-img_h+0.07*inch, "Cond", 8.5, ACID)
    y = y - img_h - 0.18*inch

    rule(c, PAD, y, W-2*PAD, ENV_GREEN, 1.0)
    y -= 0.20*inch
    t(c, "THE DIFFERENCE IS LEVERAGE.", PAD, y, "Cond", 16, HD_BLACK)
    y -= 0.22*inch

    y = para(c,
        "You cannot turn off a Meta data center. "
        "You can stop watering your lawn. Today. Right now. "
        "You can rip it out. You can plant something that supports "
        "pollinators, sequesters carbon, infiltrates stormwater, "
        "and does not require pesticide. "
        "You cannot petition Google's cooling tower. "
        "You can make your 40 million square feet of American lawn "
        "do something other than evaporate.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.14*inch

    # Real quote from the Lincoln Institute piece
    fr(c, PAD-0.05*inch, y-0.44*inch, W-2*PAD+0.1*inch, 0.56*inch, ENV_LIGHT)
    y = para(c,
        '"America has a well-documented addiction to green grass '
        'that is also not serving us well."',
        PAD, y, "SansItal", 8.5, HD_BLACK, 13, W-2*PAD)
    t(c, "— Lincoln Institute of Land Policy, 2026",
      PAD+0.08*inch, y+0.02*inch, "Sans", 6.5, FAINT)
    y -= 0.20*inch

    y = para(c,
        "The solution to both problems is the same: "
        "collective governance of shared resources "
        "instead of private extraction at public cost. "
        "Start with the one on your property.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    footer(c)


# ── PAGE 4: BACK COVER ────────────────────────────────────────────────────────

def page_back(c):
    bg(c, HD_WHITE)
    PAD = 0.28*inch

    # Green header
    hdr_h = 1.5*inch
    fr(c, 0, H-hdr_h, W, hdr_h, ENV_GREEN)
    t(c, "§ 04 — 05", PAD, H-0.26*inch, "Mono", 7,
      colors.HexColor("#74C69D"))
    t(c, "ACT ON WHAT", PAD, H-0.62*inch, "Cond", 28, HD_WHITE)
    t(c, "YOU CAN REACH.", PAD, H-0.98*inch, "Cond", 28, ACID)
    t(c, "NOW.", PAD, H-1.32*inch, "Cond", 22, colors.HexColor("#74C69D"))

    # Protest/action image
    img_h = 1.4*inch
    img_y = H - hdr_h - img_h
    img(c, f"{A}/protest.jpg", 0, img_y, W, img_h,
        halign="center", valign="center",
        overlay=(10, 40, 20), alpha=0.25)
    fr(c, 0, img_y, W, 0.20*inch, colors.HexColor("#000000"))
    t(c, "Your senator isn't the only lever.",
      PAD, img_y+0.07*inch, "Cond", 8.5, ACID)

    y = img_y - 0.18*inch

    y = para(c,
        "You don't need to choose between fighting data centers "
        "and fighting lawns. Both are the same fight. "
        "One of them you can start on your property this week.",
        PAD, y, "Sans", 8.5, HD_BLACK, 13, W-2*PAD)

    y -= 0.12*inch
    rule(c, PAD, y, W-2*PAD, RULE_C, 0.5)
    y -= 0.16*inch

    actions = [
        ("STOP WATERING.",
         "Now. Your lawn will go dormant, not dead. "
         "Calculate what you save. Post it."),
        ("PULL IT OUT.",
         "Native plants, food, clover, bare earth — anything. "
         "Your front yard converted is an argument "
         "every neighbor has to walk past."),
        ("DOCUMENT THE PUSHBACK.",
         "HOA notice? Neighbor complaint? Code enforcement? "
         "Make it public. Every enforcement action is free advertising "
         "for why this mandate needs to end."),
        ("CONNECT THE FIGHTS.",
         "The same framework that lets corporations extract water "
         "from aquifers lets HOAs extract labor from homeowners. "
         "It's all enclosure. Name it."),
    ]
    for title, body in actions:
        t(c, title, PAD, y, "Cond", 9, ENV_GREEN); y -= 0.14*inch
        y = para(c, body, PAD+0.08*inch, y, "Sans", 7.5, DIM, 11,
                 W-2*PAD-0.08*inch)
        y -= 0.10*inch

    rule(c, PAD, y, W-2*PAD, ENV_GREEN, 1.5)
    y -= 0.20*inch

    t(c, "jason-edelman.org/abolish-lawns", W/2, y,
      "SansBold", 10, ACID, "center")
    y -= 0.17*inch
    t(c, "@abolish.lawns — commons framework: power-explained.jason-edelman.org",
      W/2, y, "Sans", 6.5, FAINT, "center")
    y -= 0.14*inch
    t(c, "PRINT THIS. SHARE IT. PROPAGATE FREELY.",
      W/2, y, "Cond", 9, ENV_GREEN, "center")

    fr(c, 0, 0, W, 0.34*inch, ENV_GREEN)
    t(c, "ABOLISH LAWNS — NO. 3 — 2025 — FREE TO REPRODUCE",
      W/2, 0.12*inch, "Cond", 8, HD_WHITE, "center")


# ── MAIN ──────────────────────────────────────────────────────────────────────

OUTPUT = "/mnt/user-data/outputs/abolish-lawns-zine-03.pdf"
c = canvas.Canvas(OUTPUT, pagesize=(W, H))
c.setTitle("Abolish Lawns — Zine No. 3: Your Lawn Uses More Water Than AI")
c.setAuthor("Jason Edelman")
c.setSubject("Lawn abolition / water commons / AI water comparison")

cover(c);       new_page(c)
page_numbers(c); new_page(c)
page_root(c);   new_page(c)
page_back(c)

c.save()
print(f"Written: {OUTPUT}")
