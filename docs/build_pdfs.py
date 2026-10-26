"""Build the two submission PDFs from the Markdown sources. Edit the .md files, then run:
    pip install reportlab && python docs/build_pdfs.py
"""
import re
from pathlib import Path

from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

HERE = Path(__file__).parent
INK, MOSS, LINE = colors.HexColor("#12352f"), colors.HexColor("#2f6b53"), colors.HexColor("#cddbd3")
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=19, textColor=INK, spaceAfter=8)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, textColor=MOSS, spaceBefore=11, spaceAfter=4)
BODY = ParagraphStyle("B", parent=ss["BodyText"], fontName="Helvetica", fontSize=9.6, leading=13.4, spaceAfter=4)


def inline(t: str) -> str:
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\*(.+?)\*", r"<i>\1</i>", t)
    t = re.sub(r"`(.+?)`", r'<font face="Courier">\1</font>', t)
    return t


def md_to_flow(md: str):
    out, items, kind = [], [], None

    def flush():
        nonlocal items, kind
        if items:
            out.append(ListFlowable([ListItem(Paragraph(inline(i), BODY), leftIndent=12) for i in items],
                                    bulletType="1" if kind == "ol" else "bullet", leftIndent=14, bulletFontSize=8))
            items, kind = [], None

    for line in md.splitlines():
        s = line.rstrip()
        if not s:
            flush(); continue
        if s.startswith("# "):
            flush(); out.append(Paragraph(inline(s[2:]), H1))
        elif s.startswith("## "):
            flush(); out.append(Paragraph(inline(s[3:]), H2))
        elif re.match(r"^\d+\. ", s):
            if kind != "ol": flush()
            kind = "ol"; items.append(re.sub(r"^\d+\. ", "", s))
        elif s.startswith("- "):
            if kind != "ul": flush()
            kind = "ul"; items.append(s[2:])
        else:
            flush(); out.append(Paragraph(inline(s), BODY))
    flush()
    return out


def box(d, x, y, w, h, text, fill, fg=INK):
    d.add(Rect(x, y, w, h, rx=6, ry=6, fillColor=fill, strokeColor=LINE, strokeWidth=1))
    lines = text.split("\n")
    for i, l in enumerate(lines):
        d.add(String(x + w / 2, y + h / 2 + (len(lines) - 1) * 5 - i * 11 - 3, l, textAnchor="middle", fontName="Helvetica-Bold" if i == 0 else "Helvetica", fontSize=8.2, fillColor=fg))


def arrow(d, x1, y1, x2, y2, label=None):
    d.add(Line(x1, y1, x2, y2, strokeColor=INK, strokeWidth=1.2))
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    d.add(Polygon([x2, y2, x2 - 6 * math.cos(a - .4), y2 - 6 * math.sin(a - .4), x2 - 6 * math.cos(a + .4), y2 - 6 * math.sin(a + .4)], fillColor=INK, strokeColor=INK))
    if label:
        d.add(String((x1 + x2) / 2 + 3, (y1 + y2) / 2 + 3, label, fontName="Helvetica-Bold", fontSize=7.5, fillColor=MOSS))


def workflow() -> Drawing:
    d = Drawing(170 * mm, 62 * mm)
    soft, mint, warn, ok = colors.HexColor("#eaf1ed"), colors.HexColor("#dcf0e4"), colors.HexColor("#fdf0d2"), colors.HexColor("#e0ebf9")
    box(d, 0, 118, 88, 44, "1. Client books\nslot reserved,\nsummary shown", soft)
    box(d, 112, 118, 100, 44, "2. ~24h before\nWhatsApp reminder\n+ one-tap Confirm", ok)
    box(d, 236, 118, 96, 44, "3. Confirmed?\nchecked at\nabout 2-3h before", warn)
    box(d, 360, 150, 118, 40, "4a. YES: short nudge,\nclient attends", mint)
    box(d, 360, 78, 118, 52, "4b. NO: appears on\nnutritionist's 'at risk'\nlist", warn)
    box(d, 360, 12, 118, 50, "5. She calls, or releases\nthe slot to someone\nelse (reschedule)", soft)
    box(d, 112, 12, 100, 50, "6. Visit ends:\nDone or No-show\n-> real no-show rate", soft)
    arrow(d, 88, 140, 112, 140); arrow(d, 212, 140, 236, 140)
    arrow(d, 332, 148, 360, 168, "yes"); arrow(d, 332, 132, 360, 106, "no")
    arrow(d, 419, 78, 419, 62)
    arrow(d, 360, 37, 212, 37)
    d.add(String(0, 0, "Clients can cancel or reschedule in two taps at any step, which frees the slot early.", fontName="Helvetica-Oblique", fontSize=8, fillColor=MOSS))
    return d


def build(src: str, out: str, title: str, diagram=False):
    doc = SimpleDocTemplate(str(HERE / out), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title=title, author="Ritesh Jaiswal")
    flow = md_to_flow((HERE / src).read_text())
    if diagram:
        flow += [Spacer(1, 6), Paragraph("Workflow", H2), workflow()]
    doc.build(flow, onFirstPage=footer, onLaterPages=footer)


def footer(c, d):
    c.saveState(); c.setFont("Helvetica", 8); c.setFillColor(colors.grey)
    c.drawString(20 * mm, 9 * mm, "AI Product Intern Assignment - Ritesh Jaiswal"); c.drawRightString(190 * mm, 9 * mm, f"Page {d.page}"); c.restoreState()


if __name__ == "__main__":
    build("part1-no-show-solution.md", "Part1-No-show-solution.pdf", "Part 1: No-show solution", diagram=True)
    build("documentation.md", "Documentation.pdf", "Documentation")
    print("PDFs written to", HERE)
