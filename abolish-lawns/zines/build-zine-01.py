"""
Abolish Lawns — Zine No. 1 (v3)
Real images. Real quotes. Sharpened hooks.

Cover image: man strimming lawn, head down, joyless (suffer_p.jpg)
p2 backdrop: cheesy suburb house with perfect lawn (suburb_p.jpg)
p4: vineyard / productive land (garden.jpg)

Quotes sourced from:
- Miranda July, "No One Belongs Here More Than You" (2007)
- Hatch Magazine forum commenter (hatchmag.com)
- The Lawn Forum / thelawnforum.com
- Quora (attributed)
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

HD_ORANGE  = colors.HexColor("#F96302")
HD_BLACK   = colors.HexColor("#1A1A1A")
HD_WHITE   = colors.HexColor("#FFFFFF")
HD_LTGRAY  = colors.HexColor("#F2F2F2")
ACID       = colors.HexColor("#7CB900")
DIM        = colors.HexColor("#555555")
FAINT      = colors.HexColor("#999999")
RULE_C     = colors.HexColor("#CCCCCC")

FONT_DIR = "/usr/share/fonts/truetype"
pdfmetrics.registerFont(TTFont("Sans",     f"{FONT_DIR}/liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("SansBold", f"{FONT_DIR}/liberation/LiberationSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("SansItal", f"{FONT_DIR}/liberation/LiberationSans-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Cond",     f"{FONT_DIR}/dejavu/DejaVuSansCondensed-Bold.ttf"))
pdfmetrics.registerFont(TTFont("CondReg",  f"{FONT_DIR}/dejavu/DejaVuSansCondensed.ttf"))
pdfmetrics.registerFont(TTFont("Mono",     f"{FONT_DIR}/liberation/LiberationMono-Regular.ttf"))

A = "/home/claude/zine_assets"

# ── helpers ───────────────────────────────────────────────────────────────────

def new_page(c):
    c.showPage(); c.setPageSize((W, H))

def bg(c, col=HD_WHITE):
    c.saveState(); c.setFillColor(col)
    c.rect(0, 0, W, H, fill=1, stroke=0); c.restoreState()

def fr(c, x, y, w, h, col):
    c.saveState(); c.setFillColor(col)
    c.rect(x, y, w, h, fill=1, stroke=0); c.restoreState()

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

def img(c, path, x, y, w, h, halign="center", valign="center", alpha_overlay=None):
    from reportlab.lib.utils import ImageReader
    pimg = PILImage.open(path).convert("RGB")
    iw, ih = pimg.size
    scale = max(w/iw, h/ih)
    nw, nh = iw*scale, ih*scale
    ox = {"left":0,"center":(nw-w)/2,"right":nw-w}[halign]
    oy = {"bottom":0,"center":(nh-h)/2,"top":nh-h}[valign]
    pimg = pimg.resize((int(nw), int(nh)), PILImage.LANCZOS)
    pimg = pimg.crop((int(ox), int(oy), int(ox+w), int(oy+h)))
    if alpha_overlay:
        # darken with a color overlay for legibility
        overlay = PILImage.new("RGB", pimg.size, alpha_overlay)
        pimg = PILImage.blend(pimg, overlay, 0.45)
    buf = io.BytesIO(); pimg.save(buf, "JPEG", quality=88); buf.seek(0)
    c.saveState(); c.drawImage(ImageReader(buf), x, y, w, h, mask="auto"); c.restoreState()

def footer(c):
    rule(c, 0, 0.19*inch, W, HD_BLACK, 0.5)
    t(c, "jason-edelman.org/abolish-lawns", W/2, 0.08*inch, "Mono", 6, FAINT, "center")

def barcode(c, x, y):
    import random; random.seed(42)
    bx = x
    for _ in range(30):
        bw = random.choice([1.5,2.5,4,1])
        if random.random()>0.45:
            c.saveState(); c.setFillColor(HD_BLACK)
            c.rect(bx,y,bw,26,fill=1,stroke=0); c.restoreState()
        bx += bw+0.8
    t(c,"ABOLISH-LAWNS.ORG",x+52,y-8,"Mono",5.5,HD_BLACK,"center")


# ── PAGE 1: COVER ─────────────────────────────────────────────────────────────

def cover(c):
    bg(c)
    PAD = 0.22*inch

    # Thin orange category band
    band_h = 0.42*inch
    fr(c, 0, H-band_h, W, band_h, HD_ORANGE)
    t(c,"LAWN CARE",PAD,H-0.27*inch,"Cond",11,HD_WHITE)
    t(c,"INFORMATION GUIDE",PAD+1.02*inch,H-0.27*inch,"CondReg",10,HD_WHITE)
    # PRO badge
    bs = 0.36*inch
    fr(c, W-bs-0.1*inch, H-bs-0.04*inch, bs, bs, HD_BLACK)
    t(c,"PRO",W-bs*0.5-0.1*inch,H-bs*0.5-0.04*inch+4,"Cond",8,HD_WHITE,"center")
    t(c,"SRS",W-bs*0.5-0.1*inch,H-bs*0.5-0.04*inch-5,"Cond",6.5,HD_WHITE,"center")

    # Suffering image — man strimming, head down, joyless
    img_h = 2.5*inch
    img_y = H - band_h - img_h
    img(c, f"{A}/suffer_p.jpg", 0, img_y, W, img_h, halign="center", valign="center")
    # Caption — needs to be readable, so dark strip at bottom of image
    caption_h = 0.26*inch
    fr(c, 0, img_y, W, caption_h, colors.HexColor("#000000"))
    t(c,"EVERY SATURDAY, UNTIL YOU DIE.",PAD,img_y+0.09*inch,"Cond",9.5,HD_ORANGE)

    # Headline — pushed down, clear of caption by a comfortable margin
    hl_y = img_y - 0.22*inch
    t(c,"HATE MOWING",PAD,hl_y,"Cond",46,HD_BLACK)
    t(c,"YOUR LAWN?",PAD,hl_y-0.66*inch,"Cond",46,ACID)

    rule(c, PAD, hl_y-0.80*inch, W-2*PAD, HD_BLACK, 1.5)

    # Feature bullets — product style
    items = [
        ("✓", ACID,                      "Your gut is correct"),
        ("✓", ACID,                      "The actual reason lawns exist"),
        ("✓", ACID,                      "What 40M acres of grass costs you"),
        ("✓", ACID,                      "What grows instead, and how to get there"),
        ("✗", colors.HexColor("#CC0000"),"Lawn fertilizer tips"),
        ("✗", colors.HexColor("#CC0000"),"Any reason to keep mowing"),
    ]
    y = hl_y - 0.98*inch
    for mark, mc, label in items:
        t(c, mark, PAD, y, "SansBold", 9, mc)
        t(c, label, PAD+0.18*inch, y, "Sans", 8.5, HD_BLACK)
        y -= 0.19*inch

    # Bottom spec strip
    strip_h = 1.05*inch
    fr(c, 0, 0, W, strip_h, HD_LTGRAY)
    rule(c, 0, strip_h, W, HD_BLACK, 0.75)

    specs = [("SKU","LAWN-ABOLITION-001"),("EDITION","First"),
             ("COVERAGE","Your whole block"),("ACTIVE INGREDIENT","Class consciousness")]
    sx, sy = 0.18*inch, strip_h-0.22*inch
    for lbl, val in specs:
        t(c,lbl,sx,sy,"Mono",5.5,FAINT); t(c,val,sx,sy-0.135*inch,"SansBold",7,HD_BLACK)
        sx += 1.26*inch

    barcode(c, W-1.28*inch, 0.22*inch)

    fine = ("For best results, share with neighbors. May cause disagreements with HOA boards. "
            "Not responsible for policy changes. Keep away from turf industry lobbyists. Propagate freely.")
    words = fine.split(); line, lines_out = "", []
    for w2 in words:
        t2=(line+" "+w2).strip()
        if len(t2)<78: line=t2
        else: lines_out.append(line); line=w2
    if line: lines_out.append(line)
    fy = 0.33*inch
    c.saveState(); c.setFont("Sans",5); c.setFillColor(FAINT)
    for ln in reversed(lines_out):
        c.drawCentredString(W/2,fy,ln); fy+=0.095*inch
    c.restoreState()


# ── PAGE 2: YOUR GUT IS CORRECT ───────────────────────────────────────────────

def page_gut(c):
    bg(c)
    PAD = 0.28*inch

    # Faint suburb house behind text — desaturated, low opacity
    # Use as full-bleed background, heavily darkened
    pimg = PILImage.open(f"{A}/suburb_p.jpg").convert("RGB")
    iw, ih = pimg.size
    # Desaturate and lighten heavily to use as texture
    from PIL import ImageEnhance, ImageFilter
    pimg_gray = pimg.convert("L").convert("RGB")
    pimg_fade = PILImage.blend(pimg_gray, PILImage.new("RGB", pimg_gray.size, (248,248,244)), 0.88)
    buf = io.BytesIO(); pimg_fade.save(buf, "JPEG", quality=80); buf.seek(0)
    from reportlab.lib.utils import ImageReader
    c.saveState()
    scale = max(float(W)/iw, float(H)/ih)
    nw, nh = iw*scale, ih*scale
    c.drawImage(ImageReader(buf), 0, 0, nw, nh, mask="auto")
    c.restoreState()

    fr(c, 0, H-0.07*inch, W, 0.07*inch, HD_ORANGE)
    t(c,"§ 01",PAD,H-0.26*inch,"Mono",7,FAINT)

    t(c,"YOUR GUT IS",PAD,H-0.60*inch,"Cond",34,HD_BLACK)
    t(c,"CORRECT.",PAD,H-0.96*inch,"Cond",34,ACID)
    rule(c,PAD,H-1.07*inch,W-2*PAD,HD_BLACK,1.0)

    y = H-1.26*inch
    y = para(c,
        "You are not lazy. You are not a bad neighbor. "
        "You have been mowing because it is legally required and costly to stop.",
        PAD, y, "SansBold", 9.5, HD_BLACK, 14, W-2*PAD)

    y -= 0.13*inch
    y = para(c,
        "The American lawn covers 40 million acres — more than any food crop. "
        "We spend $153 billion a year on it. 9 billion gallons of water a day. "
        "Half that water evaporates before reaching the roots.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.12*inch
    y = para(c,
        "Lawns produce nothing edible, support almost no insect life, and receive "
        "more pesticide per acre than any agricultural crop. The runoff poisons "
        "local waterways. This is not a side effect. It is what lawns do.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    # Real quote 1 — Miranda July, dry and perfect
    y -= 0.18*inch
    rule(c,PAD,y,W-2*PAD,RULE_C,0.5); y -= 0.18*inch
    fr(c, PAD-0.05*inch, y-0.44*inch, W-2*PAD+0.1*inch, 0.55*inch, HD_LTGRAY)
    y = para(c,
        '"We don\'t really believe in mowing the lawn; we do it only '
        'to avoid unnecessary engagement with the neighbors."',
        PAD, y, "SansItal", 9, HD_BLACK, 13, W-2*PAD)
    t(c,"— Miranda July, No One Belongs Here More Than You (2007)",
      PAD+0.08*inch, y+0.02*inch, "Sans", 6.5, FAINT)
    y -= 0.18*inch
    rule(c,PAD,y,W-2*PAD,RULE_C,0.5); y -= 0.20*inch

    y = para(c,
        "Hundreds of municipalities classify vegetation above 8–12 inches as "
        "a 'public health menace.' 78 million Americans live under HOA covenants "
        "specifying lawn standards and fining noncompliance. "
        "These rules run with the land. They do not expire.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.18*inch
    t(c,"You were right to hate it.",PAD,y,"SansBold",10.5,HD_BLACK)

    footer(c)


# ── PAGE 3: YOU'RE NOT ALONE / WHAT WOULD BE BETTER ──────────────────────────

def page_better(c):
    bg(c)
    PAD = 0.28*inch
    fr(c, 0, H-0.07*inch, W, 0.07*inch, HD_ORANGE)
    t(c,"§ 02 — 03",PAD,H-0.26*inch,"Mono",7,FAINT)

    t(c,"YOU'RE NOT",PAD,H-0.60*inch,"Cond",30,HD_BLACK)
    t(c,"ALONE.",PAD,H-0.92*inch,"Cond",30,ACID)
    rule(c,PAD,H-1.02*inch,W-2*PAD,HD_BLACK,1.0)

    y = H-1.20*inch
    y = para(c,
        "The lawn care industry spends heavily to make dissent feel eccentric. "
        "It isn't. Here are three people who said the quiet part out loud.",
        PAD, y, "Sans", 9, HD_BLACK, 13.5, W-2*PAD)

    y -= 0.10*inch

    # Real quotes — sourced
    voices = [
        ('"I hate mowing the lawn. Hate it. My body goes on autopilot '
         'while my brain tries to figure a way out of ever doing this again. '
         'I am Sisyphus."',
         "Hatch Magazine reader, hatchmag.com"),

        ('"Their spirits were probably broken ten years ago."',
         "thelawnforum.com — on neighbors who stopped caring"),

        ('"I hate mowing the lawn. I hate the idea of wasting resources '
         'on something as stupid and superficial as grass, '
         'but I have an HOA."',
         "Quora, question on HOA lawn standards"),
    ]

    for quote, attr in voices:
        quote_h = 0.5*inch if len(quote) < 80 else 0.68*inch
        fr(c, PAD-0.05*inch, y-quote_h+0.14*inch, W-2*PAD+0.1*inch, quote_h, HD_LTGRAY)
        y = para(c, quote, PAD, y, "SansItal", 8, HD_BLACK, 12, W-2*PAD)
        t(c, "— "+attr, PAD+0.08*inch, y+0.02*inch, "Sans", 6.5, FAINT)
        y -= 0.20*inch

    # Meadow image — the "after"
    y -= 0.04*inch
    img_h = 1.25*inch
    img(c, f"{A}/garden.jpg", 0, y-img_h, W, img_h, halign="center", valign="top",
        alpha_overlay=(10, 40, 10))
    fr(c, 0, y-img_h, W, 0.18*inch, colors.HexColor("#000000"))
    t(c,"WHAT PRODUCTIVE LAND LOOKS LIKE.",PAD,y-img_h+0.06*inch,"Cond",8,HD_WHITE)
    y = y - img_h - 0.15*inch

    rule(c,PAD,y,W-2*PAD,HD_BLACK,1.0); y -= 0.20*inch
    t(c,"WHAT WOULD BE BETTER.",PAD,y,"Cond",17,HD_BLACK); y -= 0.22*inch

    alts = [
        ("Native meadow",
         "Once-a-year mow. 10–100x more insect life. No irrigation. "
         "Requires repealing your local weed ordinance."),
        ("Front-yard food",
         "Prohibited by HOA in most planned communities, illegal by zoning in many cities. "
         "Produces food. This is the correct use of your land."),
        ("Community food forest",
         "Shared harvests. Requires a commons, not a HOA."),
        ("Bioswale",
         "Reduces flooding. Saves the city money. Often eligible for a rebate "
         "your city won't advertise."),
        ("Nothing",
         "Let it return to local ecology. Illegal in most of America. "
         "That fact is the argument."),
    ]
    for title, body in alts:
        t(c,"▸  "+title.upper(),PAD,y,"SansBold",8,ACID); y -= 0.13*inch
        y = para(c,body,PAD+0.14*inch,y,"Sans",7.5,DIM,11,W-2*PAD-0.14*inch)
        y -= 0.07*inch

    footer(c)


# ── PAGE 4: BACK COVER ────────────────────────────────────────────────────────

def page_join(c):
    bg(c)
    PAD = 0.28*inch

    hdr_h = 1.5*inch
    fr(c, 0, H-hdr_h, W, hdr_h, HD_ORANGE)
    t(c,"§ 04 — 05",PAD,H-0.26*inch,"Mono",7,HD_WHITE)
    t(c,"WHAT WE'RE DOING.",PAD,H-0.64*inch,"Cond",28,HD_WHITE)
    t(c,"HOW TO JOIN.",PAD,H-1.00*inch,"Cond",28,HD_BLACK)
    t(c,"WHY IT MATTERS.",PAD,H-1.33*inch,"Cond",15,HD_WHITE)

    # Vineyard / productive land image
    img_h = 1.4*inch
    img_y = H - hdr_h - img_h
    img(c, f"{A}/garden.jpg", 0, img_y, W, img_h, halign="center", valign="center")
    fr(c, 0, img_y, W, 0.18*inch, colors.HexColor("#000000"))
    t(c,"This land could be productive. It isn't, because it's a lawn.",
      PAD, img_y+0.06*inch, "Cond", 8, HD_WHITE)

    y = img_y - 0.18*inch

    y = para(c,
        "Abolish Lawns shifts public opinion, gives owners a gradient "
        "of actions, and provides the policy language for reform at scale. "
        "Opinion first. Policy follows.",
        PAD, y, "Sans", 8.5, HD_BLACK, 13, W-2*PAD)

    y -= 0.12*inch
    rule(c,PAD,y,W-2*PAD,RULE_C,0.5); y -= 0.16*inch

    tracks = [
        ("SHIFT OPINION",   "Zines and factsheets for people who already know the lawn is wrong."),
        ("SUPPORT OWNERS",  "From 'stop watering' to 'challenge your HOA covenant in court.'"),
        ("CHANGE POLICY",   "Model ordinances and legislative language for planners who want to act."),
    ]
    for title, body in tracks:
        t(c,title,PAD,y,"Cond",9,HD_BLACK); y -= 0.13*inch
        y = para(c,body,PAD+0.08*inch,y,"Sans",7.5,DIM,11,W-2*PAD-0.08*inch)
        y -= 0.10*inch

    rule(c,PAD,y,W-2*PAD,HD_BLACK,1.5); y -= 0.24*inch
    t(c,"JOIN US.",PAD,y,"Cond",26,HD_BLACK); y -= 0.20*inch

    actions = [
        "Read the manifesto: jason-edelman.org/abolish-lawns",
        "Follow @abolish.lawns on Instagram",
        "Print this. Leave it somewhere. Print more.",
        "Stop watering. See what happens.",
        "Show up to your next city council meeting.",
    ]
    for action in actions:
        t(c,"→",PAD,y,"SansBold",9,ACID)
        y = para(c,action,PAD+0.17*inch,y,"Sans",8.5,HD_BLACK,12,W-2*PAD-0.17*inch)
        y -= 0.04*inch

    y -= 0.10*inch
    rule(c,PAD,y,W-2*PAD,RULE_C,0.5); y -= 0.15*inch
    t(c,"PRINT THIS. SHARE IT. PROPAGATE FREELY.",W/2,y,"Cond",9,HD_BLACK,"center")
    y -= 0.17*inch
    t(c,"jason-edelman.org/abolish-lawns",W/2,y,"SansBold",10.5,ACID,"center")
    y -= 0.16*inch
    t(c,"commons framework: power-explained.jason-edelman.org",
      W/2,y,"Sans",6.5,FAINT,"center")

    fr(c,0,0,W,0.34*inch,HD_ORANGE)
    t(c,"ABOLISH LAWNS — NO. 1 — 2025 — FREE TO REPRODUCE",
      W/2,0.12*inch,"Cond",8,HD_WHITE,"center")


# ── MAIN ──────────────────────────────────────────────────────────────────────

OUTPUT = "/mnt/user-data/outputs/abolish-lawns-zine-01.pdf"
c = canvas.Canvas(OUTPUT, pagesize=(W, H))
c.setTitle("Abolish Lawns — Zine No. 1: Hate Mowing Your Lawn?")
c.setAuthor("Jason Edelman")
c.setSubject("Commons restoration / lawn abolition")

cover(c);    new_page(c)
page_gut(c); new_page(c)
page_better(c); new_page(c)
page_join(c)

c.save()
print(f"Written: {OUTPUT}")
