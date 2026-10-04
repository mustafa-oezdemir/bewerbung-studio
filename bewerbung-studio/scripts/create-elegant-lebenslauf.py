#!/usr/bin/env python3
"""Create the bundled Elegant Word Lebenslauf templates.

The generated files are editable OOXML documents. The visual version uses a
fixed 67/33 A4 layout table; the ATS version uses a single text column.
Existing output files are never overwritten unless --force is supplied.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from lxml import etree
from PIL import Image, ImageDraw
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE
from docx.enum.text import (
    WD_ALIGN_PARAGRAPH,
    WD_BREAK,
    WD_LINE_SPACING,
    WD_TAB_ALIGNMENT,
)
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor, Twips


# compact_reference_guide with named "Elegant A4 CV" overrides.
PAGE_WIDTH_DXA = 11_906
PAGE_HEIGHT_DXA = 16_838
PAGE_MARGIN_DXA = 0
CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA
LEFT_COLUMN_DXA = 7_770
RIGHT_COLUMN_DXA = CONTENT_WIDTH_DXA - LEFT_COLUMN_DXA
SIDEBAR = "244762"
ACCENT = "1597F2"
INK = "3C474D"
MUTED = "626B70"
LIGHT = "D7E0E7"
WHITE = "FFFFFF"
FONT = "Arial"


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")


def set_cell_margins(
    cell,
    *,
    top: int = 180,
    bottom: int = 180,
    start: int = 0,
    end: int = 0,
) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.find(qn("w:tcMar"))
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for side, value in {
        "top": top,
        "bottom": bottom,
        "start": start,
        "end": end,
    }.items():
        element = tc_mar.find(qn(f"w:{side}"))
        if element is None:
            element = OxmlElement(f"w:{side}")
            tc_mar.append(element)
        element.set(qn("w:w"), str(value))
        element.set(qn("w:type"), "dxa")


def set_table_borders_none(table) -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for name in ("top", "left", "bottom", "right", "insideH", "insideV"):
        border = borders.find(qn(f"w:{name}"))
        if border is None:
            border = OxmlElement(f"w:{name}")
            borders.append(border)
        border.set(qn("w:val"), "nil")


def apply_table_geometry(
    table,
    widths_dxa: Iterable[int],
    *,
    indent_dxa: int = 0,
) -> None:
    widths = list(widths_dxa)
    total = sum(widths)
    table.autofit = False
    tbl_pr = table._tbl.tblPr

    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:type"), "dxa")
    tbl_w.set(qn("w:w"), str(total))

    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:type"), "dxa")
    tbl_ind.set(qn("w:w"), str(indent_dxa))

    layout = tbl_pr.find(qn("w:tblLayout"))
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        tbl_pr.append(layout)
    layout.set(qn("w:type"), "fixed")

    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        grid_col = OxmlElement("w:gridCol")
        grid_col.set(qn("w:w"), str(width))
        grid.append(grid_col)

    for column_index, width in enumerate(widths):
        table.columns[column_index].width = Twips(width)
    for row in table.rows:
        row.height = None
        for column_index, cell in enumerate(row.cells):
            width = widths[column_index]
            cell.width = Twips(width)
            tc_w = cell._tc.get_or_add_tcPr().find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                cell._tc.get_or_add_tcPr().append(tc_w)
            tc_w.set(qn("w:type"), "dxa")
            tc_w.set(qn("w:w"), str(width))
            set_cell_margins(cell)


def set_run_font(
    run,
    *,
    size: float,
    color: str,
    bold: bool = False,
    italic: bool = False,
) -> None:
    run.font.name = FONT
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:hAnsi"), FONT)
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    run.italic = italic


def set_paragraph_indents(paragraph, *, sidebar: bool = False) -> None:
    paragraph.paragraph_format.left_indent = Twips(550 if sidebar else 720)
    paragraph.paragraph_format.right_indent = Twips(550 if sidebar else 420)


def configure_style(
    doc: Document,
    name: str,
    *,
    size: float,
    color: str,
    bold: bool = False,
    italic: bool = False,
    before: float = 0,
    after: float = 0,
    line: float = 1.08,
    base: str | None = None,
) -> None:
    styles = doc.styles
    style = (
        styles[name]
        if name in styles
        else styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    )
    if base:
        style.base_style = styles[base]
    style.font.name = FONT
    style._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:ascii"), FONT)
    style._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:hAnsi"), FONT)
    style.font.size = Pt(size)
    style.font.color.rgb = RGBColor.from_string(color)
    style.font.bold = bold
    style.font.italic = italic
    style.paragraph_format.space_before = Pt(before)
    style.paragraph_format.space_after = Pt(after)
    style.paragraph_format.line_spacing = line


def configure_styles(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:ascii"), FONT)
    normal._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:hAnsi"), FONT)
    normal.font.size = Pt(9)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing = 1.08

    styles = [
        ("CV Name", 22, INK, False, False, 0, 3, 1.0, None),
        ("CV Title", 13.5, ACCENT, False, False, 0, 0, 1.02, None),
        ("CV Fields", 9.2, MUTED, False, False, 2, 1, 1.08, None),
        ("Section Left", 14, INK, False, False, 15, 5, 1.0, None),
        ("Entry Role", 10.5, INK, False, False, 7, 1, 1.0, None),
        ("Entry Company", 10, ACCENT, False, False, 0, 2, 1.0, None),
        ("Entry Meta", 9.2, MUTED, False, False, 0, 2, 1.0, None),
        ("Body Compact", 9.2, MUTED, False, False, 0, 2, 1.12, None),
        ("Sidebar Heading", 13, WHITE, False, False, 18, 6, 1.0, None),
        ("Sidebar Body", 9.2, WHITE, False, False, 0, 5, 1.15, None),
        ("Sidebar Strong", 10.2, WHITE, False, False, 6, 1, 1.05, None),
        ("Sidebar Muted", 9, LIGHT, False, False, 0, 5, 1.12, None),
        ("Optional", 9.2, INK, False, False, 0, 2, 1.1, None),
        ("Optional Sidebar", 9.2, WHITE, False, False, 0, 5, 1.15, None),
        ("Optional Heading", 14, INK, False, False, 15, 5, 1.0, None),
        ("Optional Sidebar Heading", 13, WHITE, False, False, 18, 6, 1.0, None),
        ("Optional Bullet", 9, MUTED, False, False, 0, 1, 1.08, "List Bullet"),
        ("Cell Terminator", 1, WHITE, False, False, 0, 0, 1.0, None),
        ("ATS Name", 24, INK, True, False, 0, 2, 1.0, None),
        ("ATS Section", 12, SIDEBAR, True, False, 10, 4, 1.0, None),
    ]
    for (
        name,
        size,
        color,
        bold,
        italic,
        before,
        after,
        line,
        base,
    ) in styles:
        configure_style(
            doc,
            name,
            size=size,
            color=color,
            bold=bold,
            italic=italic,
            before=before,
            after=after,
            line=line,
            base=base,
        )

    for style_name in ("List Bullet", "Optional Bullet"):
        style = doc.styles[style_name]
        style.font.name = FONT
        style.font.size = Pt(9)
        style.font.color.rgb = RGBColor.from_string(MUTED)
        style.paragraph_format.left_indent = Twips(980)
        style.paragraph_format.first_line_indent = Twips(-240)
        style.paragraph_format.space_after = Pt(1)
        style.paragraph_format.right_indent = Twips(420)
        style.paragraph_format.line_spacing = 1.08


def configure_page(doc: Document, *, ats: bool = False) -> None:
    section = doc.sections[0]
    section.page_width = Twips(PAGE_WIDTH_DXA)
    section.page_height = Twips(PAGE_HEIGHT_DXA)
    margin = Mm(15) if ats else Twips(PAGE_MARGIN_DXA)
    section.top_margin = margin
    section.bottom_margin = margin
    section.left_margin = margin
    section.right_margin = margin
    section.header_distance = Mm(0)
    section.footer_distance = Mm(0)

    section_pr = section._sectPr
    doc_grid = section_pr.find(qn("w:docGrid"))
    if doc_grid is None:
        doc_grid = OxmlElement("w:docGrid")
        section_pr.append(doc_grid)
    doc_grid.set(qn("w:linePitch"), "312")


def add_sidebar_page_background(doc: Document) -> None:
    """Paint the full-height sidebar in the header layer.

    Keeping the background separate from the content table prevents Word from
    creating a trailing blank page when the visible sidebar reaches the bottom
    edge of A4.
    """
    section = doc.sections[0]
    header = section.header
    paragraph = header.paragraphs[0]
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = Pt(1)
    run = paragraph.add_run()
    pict = OxmlElement("w:pict")
    rectangle = etree.Element("{urn:schemas-microsoft-com:vml}rect")
    rectangle.set("id", "ElegantSidebarBackground")
    rectangle.set(
        "style",
        "position:absolute;"
        f"left:{LEFT_COLUMN_DXA / 20:.2f}pt;top:0pt;"
        f"width:{RIGHT_COLUMN_DXA / 20:.2f}pt;"
        f"height:{PAGE_HEIGHT_DXA / 20:.2f}pt;"
        "z-index:-251654144;"
        "mso-position-horizontal-relative:page;"
        "mso-position-vertical-relative:page;"
        "mso-wrap-style:none",
    )
    rectangle.set("fillcolor", f"#{SIDEBAR}")
    rectangle.set("stroked", "f")
    pict.append(rectangle)
    run._r.append(pict)


def clear_cell(cell) -> None:
    for paragraph in cell.paragraphs:
        paragraph._element.getparent().remove(paragraph._element)
    cell.add_paragraph()


def add_paragraph(
    container,
    text: str,
    style: str,
    *,
    sidebar: bool = False,
    alignment: WD_ALIGN_PARAGRAPH | None = None,
    keep_with_next: bool = False,
    keep_together: bool = False,
) -> object:
    paragraph = container.add_paragraph(style=style)
    set_paragraph_indents(paragraph, sidebar=sidebar)
    paragraph.alignment = alignment
    paragraph.paragraph_format.keep_with_next = keep_with_next
    paragraph.paragraph_format.keep_together = keep_together
    paragraph.add_run(text)
    return paragraph


def add_left_section_heading(cell, placeholder: str) -> None:
    paragraph = add_paragraph(
        cell,
        placeholder,
        "Optional Heading",
        keep_with_next=True,
    )
    p_pr = paragraph._p.get_or_add_pPr()
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "3")
    bottom.set(qn("w:color"), "BFC5C8")
    border.append(bottom)
    p_pr.append(border)


def add_sidebar_heading(cell, placeholder: str) -> None:
    paragraph = add_paragraph(
        cell,
        placeholder,
        "Optional Sidebar Heading",
        sidebar=True,
        keep_with_next=True,
    )
    p_pr = paragraph._p.get_or_add_pPr()
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "3")
    bottom.set(qn("w:color"), "E6EBEF")
    border.append(bottom)
    p_pr.append(border)


def add_experience(cell, index: int) -> None:
    role = add_paragraph(
        cell,
        "",
        "Entry Role",
        keep_with_next=True,
        keep_together=True,
    )
    role.paragraph_format.tab_stops.add_tab_stop(
        Twips(LEFT_COLUMN_DXA - 1_140),
        WD_TAB_ALIGNMENT.RIGHT,
    )
    role.add_run(f"{{{{POSITION_{index}}}}}")
    role.add_run("\t")
    date_run = role.add_run(
        f"{{{{STARTDATUM_{index}}}}}{{{{DATUM_TRENNER_{index}}}}}"
        f"{{{{ENDDATUM_{index}}}}}"
    )
    set_run_font(date_run, size=9.2, color=MUTED)

    company = add_paragraph(
        cell,
        "",
        "Entry Company",
        keep_with_next=True,
        keep_together=True,
    )
    set_paragraph_indents(company)
    company.paragraph_format.tab_stops.add_tab_stop(
        Twips(LEFT_COLUMN_DXA - 1_140),
        WD_TAB_ALIGNMENT.RIGHT,
    )
    company.add_run(f"{{{{UNTERNEHMEN_{index}}}}}")
    company.add_run("\t")
    location_run = company.add_run(f"{{{{ARBEITSORT_{index}}}}}")
    set_run_font(location_run, size=9.2, color=MUTED)
    add_paragraph(
        cell,
        f"{{{{BESCHREIBUNG_{index}}}}}",
        "Optional",
        keep_together=True,
    ).style = "Body Compact"
    for achievement_index in range(1, 6):
        add_paragraph(
            cell,
            f"{{{{ERFOLG_{index}_{achievement_index}}}}}",
            "Optional Bullet",
            keep_together=True,
        )


def add_education(cell, index: int) -> None:
    add_paragraph(
        cell,
        f"{{{{ABSCHLUSS_{index}}}}}",
        "Entry Role",
        keep_with_next=True,
        keep_together=True,
    )
    add_paragraph(
        cell,
        f"{{{{FACHRICHTUNG_{index}}}}}",
        "Optional",
        keep_with_next=True,
        keep_together=True,
    ).style = "Body Compact"
    company = add_paragraph(
        cell,
        "",
        "Entry Company",
        keep_with_next=True,
        keep_together=True,
    )
    set_paragraph_indents(company)
    company.paragraph_format.tab_stops.add_tab_stop(
        Twips(LEFT_COLUMN_DXA - 1_140),
        WD_TAB_ALIGNMENT.RIGHT,
    )
    company.add_run(f"{{{{HOCHSCHULE_{index}}}}}")
    company.add_run("\t")
    location_run = company.add_run(
        f"{{{{AUSBILDUNG_START_{index}}}}}"
        f"{{{{AUSBILDUNG_DATUM_TRENNER_{index}}}}}"
        f"{{{{AUSBILDUNG_ENDE_{index}}}}} "
        f"{{{{AUSBILDUNG_ORT_{index}}}}}"
    )
    set_run_font(location_run, size=9.2, color=MUTED)


def create_profile_placeholder(path: Path) -> None:
    image = Image.new("RGB", (760, 760), "#E8F1F7")
    draw = ImageDraw.Draw(image)
    draw.ellipse((250, 105, 510, 365), fill="#9AB4C8")
    draw.rounded_rectangle((155, 390, 605, 710), radius=110, fill="#9AB4C8")
    image.save(path, "PNG")


def add_profile_picture(cell, placeholder_path: Path) -> None:
    paragraph = cell.add_paragraph()
    set_paragraph_indents(paragraph, sidebar=True)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(46)
    run = paragraph.add_run()
    shape = run.add_picture(
        str(placeholder_path),
        width=Mm(28),
        height=Mm(28),
    )
    shape._inline.docPr.set("descr", "PROFILFOTO")
    shape._inline.docPr.set("title", "PROFILFOTO")


def remove_initial_cell_paragraph(cell) -> None:
    if len(cell.paragraphs) == 1 and not cell.paragraphs[0].text:
        paragraph = cell.paragraphs[0]
        paragraph._element.getparent().remove(paragraph._element)


def build_elegant(output_path: Path, *, force: bool) -> Path:
    if output_path.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite existing file: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    placeholder_path = output_path.parent / ".elegant-profile-placeholder.png"
    create_profile_placeholder(placeholder_path)

    doc = Document()
    configure_page(doc)
    configure_styles(doc)
    add_sidebar_page_background(doc)

    table = doc.add_table(rows=1, cols=2)
    set_table_borders_none(table)
    apply_table_geometry(table, [LEFT_COLUMN_DXA, RIGHT_COLUMN_DXA])
    row = table.rows[0]
    row.height = None
    row.cells[0].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
    row.cells[1].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
    left, right = row.cells
    set_cell_shading(left, WHITE)
    set_cell_shading(right, SIDEBAR)
    set_cell_margins(
        left,
        top=1_050,
        bottom=120,
        start=0,
        end=0,
    )
    set_cell_margins(
        right,
        top=720,
        bottom=120,
        start=0,
        end=0,
    )
    remove_initial_cell_paragraph(left)
    remove_initial_cell_paragraph(right)

    add_paragraph(
        left,
        "{{BEWERBER_NAME}}",
        "CV Name",
        keep_with_next=True,
    )
    add_paragraph(
        left,
        "{{BERUFSBEZEICHNUNG}}",
        "CV Title",
        keep_with_next=True,
    )
    contact_line = add_paragraph(
        left,
        "{{BEWERBER_ADRESSE}}, {{BEWERBER_PLZ}} {{BEWERBER_ORT}} | "
        "{{BEWERBER_EMAIL}} | {{BEWERBER_TELEFON}}",
        "Optional",
    )
    contact_line.style = "CV Fields"
    contact_line.paragraph_format.space_after = Pt(22)

    add_left_section_heading(left, "{{BERUFSERFAHRUNG_TITEL}}")
    for index in range(1, 6):
        add_experience(left, index)

    add_left_section_heading(left, "{{AUSBILDUNG_TITEL}}")
    for index in range(1, 4):
        add_education(left, index)

    for title_key, content_key in (
        ("PROJEKTE_TITEL", "PROJEKTE"),
        ("WEITERBILDUNGEN_TITEL", "WEITERBILDUNGEN"),
        ("ZERTIFIKATE_TITEL", "ZERTIFIKATE"),
        ("VEROEFFENTLICHUNGEN_TITEL", "VEROEFFENTLICHUNGEN"),
    ):
        add_left_section_heading(left, f"{{{{{title_key}}}}}")
        add_paragraph(left, f"{{{{{content_key}}}}}", "Optional")

    add_profile_picture(right, placeholder_path)

    add_sidebar_heading(right, "{{ZUSAMMENFASSUNG_TITEL}}")
    add_paragraph(
        right,
        "{{ZUSAMMENFASSUNG}}",
        "Optional Sidebar",
        sidebar=True,
    )

    add_sidebar_heading(right, "{{STAERKEN_TITEL}}")
    for index in range(1, 4):
        add_paragraph(
            right,
            f"{{{{STAERKE_{index}_TITEL}}}}",
            "Optional Sidebar",
            sidebar=True,
            keep_with_next=True,
        ).style = "Sidebar Strong"
        add_paragraph(
            right,
            f"{{{{STAERKE_{index}_BESCHREIBUNG}}}}",
            "Optional Sidebar",
            sidebar=True,
        ).style = "Sidebar Muted"

    add_sidebar_heading(right, "{{KENNTNISSE_TITEL}}")
    for index in range(1, 6):
        add_paragraph(
            right,
            f"{{{{KENNTNIS_KATEGORIE_{index}}}}}",
            "Optional Sidebar",
            sidebar=True,
            keep_with_next=True,
        ).style = "Sidebar Strong"
        add_paragraph(
            right,
            f"{{{{KENNTNIS_EINTRAEGE_{index}}}}}",
            "Optional Sidebar",
            sidebar=True,
        ).style = "Sidebar Muted"

    add_sidebar_heading(right, "{{SPRACHEN_TITEL}}")
    for index in range(1, 4):
        add_paragraph(
            right,
            f"{{{{SPRACHE_{index}}}}}",
            "Optional Sidebar",
            sidebar=True,
            keep_with_next=True,
        ).style = "Sidebar Strong"
        add_paragraph(
            right,
            f"{{{{SPRACHNIVEAU_{index}}}}}",
            "Optional Sidebar",
            sidebar=True,
        ).style = "Sidebar Muted"

    doc.save(output_path)
    placeholder_path.unlink(missing_ok=True)
    return output_path


def add_ats_experience(doc: Document, index: int) -> None:
    add_paragraph(
        doc,
        f"{{{{POSITION_{index}}}}}",
        "Entry Role",
        keep_with_next=True,
        keep_together=True,
    )
    add_paragraph(
        doc,
        f"{{{{UNTERNEHMEN_{index}}}}} | "
        f"{{{{STARTDATUM_{index}}}}}{{{{DATUM_TRENNER_{index}}}}}"
        f"{{{{ENDDATUM_{index}}}}} | {{{{ARBEITSORT_{index}}}}}",
        "Optional",
        keep_with_next=True,
        keep_together=True,
    ).style = "Entry Meta"
    add_paragraph(
        doc,
        f"{{{{BESCHREIBUNG_{index}}}}}",
        "Optional",
        keep_together=True,
    )
    for achievement_index in range(1, 6):
        add_paragraph(
            doc,
            f"{{{{ERFOLG_{index}_{achievement_index}}}}}",
            "Optional Bullet",
            keep_together=True,
        )


def add_ats_education(doc: Document, index: int) -> None:
    add_paragraph(
        doc,
        f"{{{{ABSCHLUSS_{index}}}}}",
        "Entry Role",
        keep_with_next=True,
        keep_together=True,
    )
    add_paragraph(
        doc,
        f"{{{{FACHRICHTUNG_{index}}}}}",
        "Optional",
        keep_with_next=True,
        keep_together=True,
    )
    add_paragraph(
        doc,
        f"{{{{HOCHSCHULE_{index}}}}} | "
        f"{{{{AUSBILDUNG_START_{index}}}}}"
        f"{{{{AUSBILDUNG_DATUM_TRENNER_{index}}}}}"
        f"{{{{AUSBILDUNG_ENDE_{index}}}}} | "
        f"{{{{AUSBILDUNG_ORT_{index}}}}}",
        "Optional",
        keep_together=True,
    ).style = "Entry Meta"


def build_ats(output_path: Path, *, force: bool) -> Path:
    if output_path.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite existing file: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    configure_page(doc, ats=True)
    configure_styles(doc)

    add_paragraph(
        doc,
        "{{BEWERBER_NAME}}",
        "ATS Name",
        keep_with_next=True,
    )
    add_paragraph(
        doc,
        "{{BERUFSBEZEICHNUNG}}",
        "CV Title",
        keep_with_next=True,
    )
    add_paragraph(
        doc,
        "{{BEWERBER_ADRESSE}}, {{BEWERBER_PLZ}} {{BEWERBER_ORT}} | "
        "{{BEWERBER_EMAIL}} | {{BEWERBER_TELEFON}}",
        "Optional",
    )

    add_paragraph(
        doc,
        "{{ZUSAMMENFASSUNG_TITEL}}",
        "Optional Heading",
        keep_with_next=True,
    ).style = "ATS Section"
    add_paragraph(doc, "{{ZUSAMMENFASSUNG}}", "Optional")

    add_paragraph(
        doc,
        "{{BERUFSERFAHRUNG_TITEL}}",
        "Optional Heading",
        keep_with_next=True,
    ).style = "ATS Section"
    for index in range(1, 6):
        add_ats_experience(doc, index)

    add_paragraph(
        doc,
        "{{AUSBILDUNG_TITEL}}",
        "Optional Heading",
        keep_with_next=True,
    ).style = "ATS Section"
    for index in range(1, 4):
        add_ats_education(doc, index)

    for title_key, content_key in (
        ("KENNTNISSE_TITEL", "KENNTNISSE"),
        ("SPRACHEN_TITEL", "SPRACHEN_ATS"),
        ("ZERTIFIKATE_TITEL", "ZERTIFIKATE"),
        ("WEITERBILDUNGEN_TITEL", "WEITERBILDUNGEN"),
    ):
        add_paragraph(
            doc,
            f"{{{{{title_key}}}}}",
            "Optional Heading",
            keep_with_next=True,
        ).style = "ATS Section"
        add_paragraph(doc, f"{{{{{content_key}}}}}", "Optional")

    doc.save(output_path)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create Elegant Lebenslauf Word templates",
    )
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--ats-output", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    print(build_elegant(args.output.resolve(), force=args.force))
    if args.ats_output:
        print(build_ats(args.ats_output.resolve(), force=args.force))


if __name__ == "__main__":
    main()
