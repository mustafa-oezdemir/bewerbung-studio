"""Real-PDF check of a one-column DIN template (tmp/<TEMPLATE>-page-qa after check-resume-page-qa.cjs).

For every fixture: page count of the exported PDF and of the printed preview, every career bullet exactly once in the
exported PDF text (no bullet lost, none twice), each break between the pages at the same bullet in both PDFs, and the
pixel difference of the rasterised pages (150 dpi). `--png` also writes page PNGs for a visual check.
    [TEMPLATE=einspaltig] python scripts/check-resume-page-pdf.py [filter...] [--png]
"""
import json
import os
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF

OUT = Path(f"tmp/{os.environ.get('TEMPLATE', 'klassisch')}-page-qa")
args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
png = "--png" in sys.argv


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("­", "")).strip()


def pages_text(pdf: fitz.Document):
    return [norm(page.get_text("text")) for page in pdf]


def raster_diff(left: fitz.Document, right: fitz.Document):
    worst = 0.0
    for a, b in zip(left, right):
        pa = a.get_pixmap(dpi=150, colorspace=fitz.csGRAY)
        pb = b.get_pixmap(dpi=150, colorspace=fitz.csGRAY)
        if (pa.width, pa.height) != (pb.width, pb.height):
            return 100.0
        sa, sb = pa.samples, pb.samples
        diff = sum(1 for x, y in zip(sa, sb) if abs(x - y) > 48)
        worst = max(worst, diff / len(sa) * 100)
    return worst


problems = 0
manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf8"))
for entry in manifest:
    name = entry["file"]
    if args and not any(arg in name for arg in args):
        continue
    plan = json.loads((OUT / f"{name}.plan.json").read_text(encoding="utf8"))
    pdf = fitz.open(OUT / f"{name}.pdf")
    preview = fitz.open(OUT / f"{name}-preview.pdf")
    texts = pages_text(pdf)
    preview_texts = pages_text(preview)
    issues = []
    if len(pdf) != len(plan["pagePlan"]):
        issues.append(f"PDF pages {len(pdf)} != planned {len(plan['pagePlan'])}")
    if len(preview) != len(pdf):
        issues.append(f"preview pages {len(preview)} != PDF {len(pdf)}")
    breaks = []
    for station in plan["expected"]:
        for index, bullet in enumerate(station["bullets"]):
            needle = norm(bullet)
            pages = [number + 1 for number, text in enumerate(texts) if needle in text]
            preview_pages = [number + 1 for number, text in enumerate(preview_texts) if needle in text]
            count = sum(text.count(needle) for text in texts)
            if count != 1:
                issues.append(f"bullet {station['role']} #{index + 1} printed {count}x")
            if pages != preview_pages:
                issues.append(f"bullet {station['role']} #{index + 1} on PDF {pages} / preview {preview_pages}")
            breaks.append((station["role"], index + 1, pages[:1]))
    split = {}
    for role, index, pages in breaks:
        if pages:
            split.setdefault(role, []).append(pages[0])
    splits = {role: sorted(set(pages)) for role, pages in split.items() if len(set(pages)) > 1}
    diff = raster_diff(pdf, preview) if len(pdf) == len(preview) else 100.0
    if diff > 0.05:
        issues.append(f"raster diff {diff:.3f}% of pixels")
    if png:
        for number, page in enumerate(pdf):
            page.get_pixmap(dpi=110).save(OUT / f"{name}-p{number + 1}.png")
    problems += len(issues)
    print(f"{name}: {len(pdf)} p (preview {len(preview)}), raster diff {diff:.3f}%, entries across pages {splits or '-'}"
          + ("" if not issues else "\n  " + "\n  ".join(issues)))
print("problems", problems)
sys.exit(1 if problems else 0)
