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
        return f'<div class="screenshot-window"><img class="evidence-image" src="{path.resolve().as_uri()}" alt="{alt}"></div>'

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
    return "\n".join(out)


styles = r"""
@page { size: A4; margin: 15mm 14mm 17mm;
  @bottom-right { content: "Quevo · Lab 7 · " counter(page) " / " counter(pages); font: 8pt Arial, sans-serif; color: #686868; }
}
* { box-sizing: border-box; }
body { font-family: Arial, "Liberation Sans", sans-serif; font-size: 9pt; line-height: 1.35; color: #202124; }
h1 { color: #111; font-size: 31pt; line-height: 1.05; margin: 12mm 0 4mm; letter-spacing: -0.7pt; }
h1 + h2 { border: 0; color: #555; font-size: 17pt; margin: 0 0 13mm; }
h2 { color: #16231b; font-size: 16pt; line-height: 1.15; margin: 17pt 0 8pt; padding-bottom: 4pt; border-bottom: 1px solid #cdd5cf; break-after: avoid; }
h3 { color: #25392d; font-size: 11.5pt; line-height: 1.15; margin: 12pt 0 5pt; break-after: avoid; }
p { margin: 4pt 0 7pt; orphans: 2; widows: 2; }
strong { color: #151b17; }
a { color: #176b4d; text-decoration: none; }
hr { border: 0; border-top: 1px solid #d4d4d4; margin: 11pt 0; }
.page-break { break-before: page; height: 0; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 7.3pt; line-height: 1.25; table-layout: fixed; }
thead { display: table-header-group; }
th { text-align: left; background: #edf1ee; color: #243b2d; font-weight: 700; }
th, td { border: 0.45pt solid #cbd2cd; padding: 4pt 4.2pt; vertical-align: top; overflow-wrap: anywhere; }
tr { break-inside: avoid; }
ul, ol { margin: 4pt 0 8pt 13pt; padding-left: 8pt; }
li { margin: 2pt 0; padding-left: 1pt; }
blockquote { border-left: 2.5pt solid #7a9985; margin: 5pt 0 8pt 4pt; padding: 2pt 0 2pt 8pt; color: #333; font-style: italic; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 7.2pt; overflow-wrap: anywhere; }
pre { white-space: pre-wrap; font-size: 7.1pt; line-height: 1.3; background: #f4f5f4; border: 0.6pt solid #d8ddda; padding: 7pt; break-inside: avoid; }
.screenshot-window { width: 100%; height: 94mm; overflow: hidden; margin: 6pt auto 3pt; break-inside: avoid; }
.evidence-image { display: block; width: 100%; max-width: none; height: auto; max-height: none; object-fit: contain; margin: 0 auto; }
img { image-rendering: auto; }
/* Keep the introductory identification compact on the cover. */
h1:first-of-type { margin-top: 10mm; }
h1:first-of-type ~ p { margin: 5pt 0; }
"""


def render(content: str, path: Path) -> None:
    body = markdown_to_html(content, source.parent)
    document = '<!doctype html><html><head><meta charset="utf-8"><style>' + styles + '</style></head><body>' + body + '</body></html>'
    HTML(string=document, base_url=source.parent.as_uri()).write_pdf(path)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def page_containing(reader: PdfReader, phrase: str) -> int:
    target = normalize(phrase)
    # The first two pages are the cover and contents, which repeat the section
    # names. Start after them to find the actual section heading.
    for number, page in enumerate(reader.pages[2:], start=3):
        if target in normalize(page.extract_text() or ""):
            return number
    raise RuntimeError(f"Could not find section heading in rendered PDF: {phrase}")


part_heads = {
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
    starts = {token: page_containing(reader, heading) for token, heading in part_heads.items()}
    ends = {
        "{{PAGE_PART_A}}": starts["{{PAGE_PART_B}}"] - 1,
        "{{PAGE_PART_B}}": starts["{{PAGE_PART_C}}"] - 1,
        "{{PAGE_PART_C}}": starts["{{PAGE_PART_D}}"] - 1,
        "{{PAGE_PART_D}}": starts["{{PAGE_EVIDENCE}}"] - 1,
        "{{PAGE_EVIDENCE}}": len(reader.pages),
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
