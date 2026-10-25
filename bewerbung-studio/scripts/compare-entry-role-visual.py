"""Puts the real PDF pages (scripts/capture-entry-role-visual.cjs) beside the preview pages of the same fixture.

    python scripts/compare-entry-role-visual.py <fixture name>...

For every page: tmp/entry-role-qa/visual/<name>-side-<page>.png (preview left, PDF right, the differing pixels in red on the
right third) and the share of pixels that differ by more than a small anti-aliasing tolerance. HTML/DOM checks alone do not
prove that both surfaces look alike; this does it on the pixels.
"""
import sys
from pathlib import Path

import fitz
import numpy as np
from PIL import Image

out = Path("tmp/entry-role-qa/visual")
for name in [arg for arg in sys.argv[1:] if not arg.startswith("-")]:
    pdf = fitz.open(out / f"{name}.pdf")
    for index, page in enumerate(pdf, start=1):
        pixmap = page.get_pixmap(dpi=96)
        printed = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        slices = sorted(out.glob(f"{name}-preview-{index}-*.png"))
        if not slices:
            print(f"{name} page {index}: no preview page")
            continue
        # The capture comes in slices of device pixels: stacked, then scaled to the 96 dpi of the PDF pages (794 px wide).
        parts = [Image.open(path).convert("RGB") for path in slices]
        stacked = Image.new("RGB", (parts[0].width, sum(part.height for part in parts)), "white")
        y = 0
        for part in parts:
            stacked.paste(part, (0, y))
            y += part.height
        preview = stacked.resize((printed.width, round(stacked.height * printed.width / stacked.width)), Image.LANCZOS)
        width, height = min(printed.width, preview.width), min(printed.height, preview.height)
        a = np.asarray(preview.crop((0, 0, width, height)), dtype=np.int16)
        b = np.asarray(printed.crop((0, 0, width, height)), dtype=np.int16)
        differs = np.abs(a - b).max(axis=2) > 48
        share = differs.mean() * 100
        overlay = np.asarray(printed.crop((0, 0, width, height))).copy()
        overlay[differs] = [220, 30, 30]
        side = Image.new("RGB", (width * 3, height), "white")
        side.paste(preview.crop((0, 0, width, height)), (0, 0))
        side.paste(printed.crop((0, 0, width, height)), (width, 0))
        side.paste(Image.fromarray(overlay), (width * 2, 0))
        side.save(out / f"{name}-side-{index}.png")
        print(f"{name} page {index}: {share:.2f} % of the pixels differ")
    previews = {path.name.split("-preview-")[1].split("-")[0] for path in out.glob(f"{name}-preview-*-*.png")}
    if len(pdf) != len(previews):
        print(f"{name}: {len(pdf)} PDF pages, {len(previews)} preview pages")
