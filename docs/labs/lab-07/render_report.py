#!/usr/bin/env python3
"""Render the self-contained Lab 7 Markdown report and resolve page ranges."""

from __future__ import annotations

import html
import re
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader
from weasyprint import HTML


source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
markdown = source.read_text(encoding="utf-8")


def inline(text: str, image_base: Path) -> str:
    image_pattern = re.compile(r"!\[([^\]]*)\]\(([^ )]+)\)")
    links: list[tuple[str, str]] = []

    def hold_link(match: re.Match[str]) -> str:
        href = html.escape(match.group(2), quote=True)
        label = inline(match.group(1), image_base)
        links.append((href, label))
        return f"\x00LINK{len(links) - 1}\x00"

    text = re.sub(r"(?<!!)\[([^\]]+)\]\(([^ )]+)\)", hold_link, text)
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)

    def image(match: re.Match[str]) -> str:
        alt = html.escape(match.group(1), quote=True)
        path = Path(match.group(2))
        if not path.is_absolute():
            path = image_base / path
        extra_class = " storyboard-window" if match.group(1).lower().startswith("storyboard:") else ""
        return f'<div class="screenshot-window{extra_class}"><img class="evidence-image" src="{path.resolve().as_uri()}" alt="{alt}"></div>'

    text = image_pattern.sub(image, text)
    for index, (href, label) in enumerate(links):
        text = text.replace(f"\x00LINK{index}\x00", f'<a href="{href}">{label}</a>')
    return text


def table_cells(line: str) -> list[str]:
    return [part.strip() for part in line.strip().strip("|").split("|")]


def markdown_to_html(content: str, image_base: Path) -> str:
    lines = content.splitlines()
    out: list[str] = []
    para: list[str] = []
    code_lines: list[str] = []
    quote_lines: list[str] = []
    list_type: str | None = None
    section_classes: list[str] = []
    in_code = False
    i = 0

    def flush_para() -> None:
        if para:
            out.append("<p>" + inline(" ".join(para), image_base) + "</p>")
            para.clear()

    def close_list() -> None:
        nonlocal list_type
        if list_type:
            out.append(f"</{list_type}>")
            list_type = None

    def flush_quote() -> None:
        if quote_lines:
            out.append("<blockquote><p>" + inline(" ".join(quote_lines), image_base) + "</p></blockquote>")
            quote_lines.clear()

    while i < len(lines):
        raw = lines[i]
        line = raw.strip()

        if line.startswith("```"):
            flush_para(); close_list(); flush_quote()
            if in_code:
                out.append("<pre><code>" + html.escape("\n".join(code_lines)) + "</code></pre>")
                code_lines.clear()
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_lines.append(raw)
            i += 1
            continue
        if line == "[[PAGEBREAK]]":
            flush_para(); close_list(); flush_quote()
            out.append('<div class="page-break"></div>')
            i += 1
            continue
        if line.startswith(":::"):
            flush_para(); close_list(); flush_quote()
            if line == ":::" and section_classes:
                out.append("</section>")
                section_classes.pop()
            elif line != ":::":
                class_name = re.sub(r"[^a-z0-9-]", "", line[3:].strip().lower())
                if not class_name:
                    raise RuntimeError("A report block needs a class name, for example :::cover")
                out.append(f'<section class="{class_name}">')
                section_classes.append(class_name)
            else:
                raise RuntimeError("Found ::: without an open report block")
            i += 1
            continue
        if not line:
            flush_para(); close_list(); flush_quote()
            i += 1
            continue
        if line == "---":
            flush_para(); close_list(); flush_quote()
            out.append("<hr>")
            i += 1
            continue
        if line.startswith("|") and "|" in line[1:]:
            flush_para(); close_list(); flush_quote()
            rows = [raw]
            j = i + 1
            while j < len(lines) and lines[j].strip().startswith("|"):
                rows.append(lines[j])
                j += 1
            head = table_cells(rows[0])
            body = [table_cells(row) for row in rows[2:]]
            out.append('<table class="report-table"><thead><tr>')
            out.extend("<th>" + inline(cell, image_base) + "</th>" for cell in head)
            out.append("</tr></thead><tbody>")
            for row in body:
                row += [""] * (len(head) - len(row))
                out.append("<tr>" + "".join("<td>" + inline(cell, image_base) + "</td>" for cell in row[:len(head)]) + "</tr>")
            out.append("</tbody></table>")
            i = j
            continue
        heading = re.match(r"^(#{1,3})\s+(.*)$", line)
        if heading:
            flush_para(); close_list(); flush_quote()
            level, title = len(heading.group(1)), heading.group(2)
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            out.append(f'<h{level} id="{slug}">{inline(title, image_base)}</h{level}>')
            i += 1
            continue
        if line.startswith("> "):
            flush_para(); close_list()
            quote_lines.append(line[2:])
            i += 1
            continue
        if line.startswith("- "):
            flush_para(); flush_quote()
            if list_type != "ul":
                close_list()
                out.append("<ul>")
                list_type = "ul"
            out.append("<li>" + inline(line[2:], image_base) + "</li>")
            i += 1
            continue
        ordered = re.match(r"^\d+\.\s+(.*)$", line)
        if ordered:
            flush_para(); flush_quote()
            if list_type != "ol":
                close_list()
                out.append("<ol>")
                list_type = "ol"
            out.append("<li>" + inline(ordered.group(1), image_base) + "</li>")
            i += 1
            continue
        close_list(); flush_quote()
        para.append(line)
        i += 1

    flush_para(); close_list(); flush_quote()
    if section_classes:
        raise RuntimeError(f"Unclosed report block(s): {', '.join(section_classes)}")
    return "\n".join(out)


styles = r"""
@page { size: A4; margin: 15mm 14mm 17mm;
  @bottom-left { content: "CPE334  ·  EN-046  ·  2 Boys 1 Repo"; font: 7.4pt Arial, sans-serif; color: #747b75; }
  @bottom-right { content: "LAB 7  ·  " counter(page) " / " counter(pages); font: 7.4pt Arial, sans-serif; color: #747b75; }
}
* { box-sizing: border-box; }
body { font-family: Arial, "Liberation Sans", sans-serif; font-size: 9.5pt; line-height: 1.45; color: #202421; }
h1 { color: #101712; font-size: 32pt; line-height: 1.05; margin: 12mm 0 4mm; letter-spacing: -0.7pt; }
h1 + h2 { border: 0; color: #59635d; font-size: 17pt; margin: 0 0 13mm; }
h2 { color: #163b2a; font-size: 18pt; line-height: 1.15; margin: 18pt 0 9pt; padding-bottom: 5pt; border-bottom: 1.5px solid #c8d6cd; break-after: avoid; }
h3 { color: #244a35; font-size: 12pt; line-height: 1.2; margin: 13pt 0 5pt; break-after: avoid; }
p { margin: 4pt 0 7pt; orphans: 2; widows: 2; }
strong { color: #141d17; }
a { color: #176b4d; text-decoration: underline; text-decoration-color: #b3cbbd; text-underline-offset: 1.5pt; }
hr { border: 0; border-top: 1px solid #d4d4d4; margin: 11pt 0; }
.page-break { break-before: page; height: 0; }
table { border-collapse: collapse; width: 100%; margin: 7pt 0 11pt; font-size: 8pt; line-height: 1.34; table-layout: fixed; }
thead { display: table-header-group; }
th { text-align: left; background: #eaf0ec; color: #213b2b; font-weight: 700; }
th, td { border: 0.55pt solid #d3dcd6; padding: 5pt 5.4pt; vertical-align: top; overflow-wrap: anywhere; }
tbody tr:nth-child(even) { background: #f8faf8; }
tr { break-inside: avoid; }
ul, ol { margin: 4pt 0 9pt 14pt; padding-left: 9pt; }
li { margin: 3pt 0; padding-left: 1pt; }
blockquote { border-left: 3pt solid #43805b; background: #f3f7f4; margin: 7pt 0 10pt; padding: 8pt 10pt; color: #303a33; font-style: italic; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 7.2pt; overflow-wrap: anywhere; }
pre { white-space: pre-wrap; font-size: 7.5pt; line-height: 1.42; background: #f5f7f5; border: 0.7pt solid #d6dfd8; padding: 9pt; break-inside: avoid; }
.screenshot-window { width: 100%; height: auto; max-height: 225mm; overflow: visible; margin: 8pt auto 5pt; break-inside: avoid; text-align: center; }
.evidence-image { display: block; width: 100%; max-width: 100%; height: auto; max-height: 225mm; object-fit: contain; margin: 0 auto; }
img { image-rendering: auto; }
.cover { min-height: 250mm; padding: 17mm 15mm; border: 0.8pt solid #d7e0da; border-left: 7pt solid #176b4d; background: #f6f8f6; break-inside: avoid; }
.cover > p:first-of-type { margin: 0 0 17mm; color: #176b4d; font-size: 9pt; font-weight: 700; letter-spacing: 1.5pt; text-transform: uppercase; }
.cover h1 { font-size: 43pt; margin: 0 0 5mm; }
.cover h1 + h2 { color: #56615a; font-size: 22pt; margin: 0 0 18mm; }
.cover p { margin: 8pt 0; font-size: 10.2pt; }
.cover blockquote { margin-top: 18mm; font-style: normal; font-size: 12pt; }
.cover table { margin-top: 12mm; font-size: 9pt; }
.cover td, .cover th { padding: 8pt; }
.summary { break-inside: avoid; }
.summary > h2 { margin-top: 0; }
.metric-grid ul { list-style: none; margin: 12pt 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; }
.metric-grid li { margin: 0; padding: 10pt 11pt; border: 0.7pt solid #d9e2dc; border-top: 2.5pt solid #43805b; background: #f8faf8; font-size: 9.3pt; }
.metric-grid strong { display: block; color: #17452e; font-size: 15pt; margin-bottom: 3pt; }
.takeaway { border: 0.7pt solid #c9d9ce; border-radius: 4pt; padding: 9pt 11pt; background: #f2f7f3; }
.timeline ol, .process ol { list-style: none; margin: 8pt 0 12pt; padding: 0; counter-reset: timeline; }
.timeline li, .process li { position: relative; margin: 0; padding: 0 0 11pt 26pt; border-left: 1pt solid #b8c9bd; break-inside: avoid; }
.timeline li::before, .process li::before { counter-increment: timeline; content: counter(timeline, decimal-leading-zero); position: absolute; left: -10pt; top: 0; width: 19pt; height: 19pt; border-radius: 50%; background: #176b4d; color: white; text-align: center; line-height: 19pt; font-size: 7.5pt; font-weight: 700; }
.timeline li:last-child, .process li:last-child { border-left-color: transparent; }
.timeline li strong:first-child, .process li strong:first-child { color: #173c29; }
.discussion-log table { font-size: 8.3pt; }
.release-steps table { font-size: 8.5pt; }
.storyboard-window { max-height: 165mm; }
.storyboard-window .evidence-image { width: auto; max-width: 100%; height: auto; max-height: 165mm; }
.screenshot-detail .evidence-image { max-height: 218mm; }
.screenshot-detail .storyboard-window .evidence-image { width: auto; max-width: 100%; height: auto; max-height: 165mm; }
.screenshot-detail h3 { margin-bottom: 3pt; }
.release-steps ol { list-style: none; margin: 8pt 0 12pt; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 7pt; counter-reset: release; }
.release-steps li { position: relative; margin: 0; padding: 9pt 9pt 9pt 31pt; min-height: 31mm; border: 0.7pt solid #d9e2dc; border-left: 2.5pt solid #43805b; background: #f8faf8; break-inside: avoid; }
.release-steps li::before { counter-increment: release; content: counter(release, decimal-leading-zero); position: absolute; left: 8pt; top: 8pt; color: #176b4d; font-size: 9pt; font-weight: 700; }
.release-steps li strong:first-child { color: #17452e; }
.evidence-register table { font-size: 8.2pt; }
"""


def render(content: str, path: Path) -> None:
    body = markdown_to_html(content, source.parent)
    document = '<!doctype html><html><head><meta charset="utf-8"><style>' + styles + '</style></head><body>' + body + '</body></html>'
    HTML(string=document, base_url=source.parent.as_uri()).write_pdf(path)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def page_containing(reader: PdfReader, phrase: str) -> int:
    target = normalize(phrase)
    # The cover, executive summary and contents can repeat section names.
    for number, page in enumerate(reader.pages[3:], start=4):
        if target in normalize(page.extract_text() or ""):
            return number
    raise RuntimeError(f"Could not find section heading in rendered PDF: {phrase}")


part_heads = {
    "{{PAGE_SUMMARY}}": "Executive summary",
    "{{PAGE_DISCUSSIONS}}": "Discussion and decision log",
    "{{PAGE_STEPS}}": "Step-by-step maintenance and release",
    "{{PAGE_CHAIN}}": "Version and release chain",
    "{{PAGE_PART_A}}": "Part A — Change impact and updated contract",
    "{{PAGE_PART_B}}": "Part B — Implementation and regression-safe delivery",
    "{{PAGE_PART_C}}": "Part C — Objective engineering metrics",
    "{{PAGE_PART_D}}": "Part D — Readiness and retrospective",
    "{{PAGE_EVIDENCE}}": "Evidence register and source notes",
}

# Replace the visible page ranges in the source contents table with tokens for
# the first render. This keeps the Markdown readable while recalculating the
# PDF's table of contents whenever pagination changes.
toc_titles = {
    "Executive summary": "{{PAGE_SUMMARY}}",
    "Discussion and decision log": "{{PAGE_DISCUSSIONS}}",
    "Step-by-step maintenance and release": "{{PAGE_STEPS}}",
    "Version and release chain": "{{PAGE_CHAIN}}",
    "Part A — Change impact and updated contract": "{{PAGE_PART_A}}",
    "Part B — Implementation and regression-safe delivery": "{{PAGE_PART_B}}",
    "Part C — Objective engineering metrics": "{{PAGE_PART_C}}",
    "Part D — Readiness and retrospective": "{{PAGE_PART_D}}",
    "Evidence register and source notes": "{{PAGE_EVIDENCE}}",
}
toc_lines: list[str] = []
for line in markdown.splitlines():
    if line.startswith("|"):
        cells = line.split("|")
        if len(cells) > 3:
            title = cells[1].strip()
            if title in toc_titles:
                cells[2] = f" {toc_titles[title]} "
                line = "|".join(cells)
    toc_lines.append(line)
markdown = "\n".join(toc_lines)

with tempfile.TemporaryDirectory(prefix="quevo-lab7-render-") as temp_dir:
    preliminary = Path(temp_dir) / "preliminary.pdf"
    render(markdown, preliminary)
    reader = PdfReader(str(preliminary))
    starts = {
        token: 2 if token == "{{PAGE_SUMMARY}}" else page_containing(reader, heading)
        for token, heading in part_heads.items()
    }
    ordered_tokens = list(part_heads)
    ends = {
        token: (starts[token] if token == "{{PAGE_SUMMARY}}" else
                starts[ordered_tokens[index + 1]] - 1 if index + 1 < len(ordered_tokens) else len(reader.pages))
        for index, token in enumerate(ordered_tokens)
    }
    replacements = {
        token: f"{starts[token]}–{ends[token]}" if starts[token] != ends[token] else str(starts[token])
        for token in part_heads
    }
    for token, value in replacements.items():
        markdown = markdown.replace(token, value)
    output.parent.mkdir(parents=True, exist_ok=True)
    render(markdown, output)

final_reader = PdfReader(str(output))
print(f"Created {output} ({len(final_reader.pages)} pages, {output.stat().st_size:,} bytes)")
print("Contents ranges:", "; ".join(f"{token}: {value}" for token, value in replacements.items()))
print("Extracted text characters:", sum(len(page.extract_text() or "") for page in final_reader.pages))
