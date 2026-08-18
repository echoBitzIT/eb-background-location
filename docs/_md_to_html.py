#!/usr/bin/env python3
"""One-off Markdown → HTML for the QA audit PDF. Not an app dependency."""

from __future__ import annotations

import html
import re
from pathlib import Path


def inline_format(text: str) -> str:
    parts: list[str] = []
    i = 0
    while i < len(text):
        if text.startswith("`", i):
            end = text.find("`", i + 1)
            if end != -1:
                parts.append(f"<code>{html.escape(text[i + 1 : end])}</code>")
                i = end + 1
                continue
        if text.startswith("**", i):
            end = text.find("**", i + 2)
            if end != -1:
                inner = inline_format(text[i + 2 : end])
                parts.append(f"<strong>{inner}</strong>")
                i = end + 2
                continue
        if text.startswith("[", i):
            m = re.match(r"\[([^\]]+)\]\(([^)]+)\)", text[i:])
            if m:
                parts.append(
                    f'<a href="{html.escape(m.group(2), quote=True)}">'
                    f"{inline_format(m.group(1))}</a>"
                )
                i += m.end()
                continue
        parts.append(html.escape(text[i], quote=False))
        i += 1
    return "".join(parts)


def split_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def is_sep_row(cells: list[str]) -> bool:
    if not cells:
        return False
    return all(re.fullmatch(r":?-{3,}:?", c.replace(" ", "")) for c in cells)


def md_to_html(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    i = 0
    in_code = False
    code_buf: list[str] = []
    in_ul = False
    in_ol = False

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    while i < len(lines):
        line = lines[i]

        if line.startswith("```"):
            close_lists()
            if not in_code:
                in_code = True
                code_buf = []
            else:
                out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
                in_code = False
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if re.match(r"^\|.+\|$", line.strip()) or (
            line.strip().startswith("|") and "|" in line.strip()[1:]
        ):
            close_lists()
            table_lines = []
            while i < len(lines) and "|" in lines[i]:
                table_lines.append(lines[i])
                i += 1
            rows = [split_row(r) for r in table_lines]
            if len(rows) >= 2 and is_sep_row(rows[1]):
                header, body = rows[0], rows[2:]
            else:
                header, body = rows[0], rows[1:]
            out.append('<table><thead><tr>')
            for c in header:
                out.append(f"<th>{inline_format(c)}</th>")
            out.append("</tr></thead><tbody>")
            for row in body:
                if is_sep_row(row):
                    continue
                out.append("<tr>")
                for c in row:
                    out.append(f"<td>{inline_format(c)}</td>")
                out.append("</tr>")
            out.append("</tbody></table>")
            continue

        if line.strip() == "---":
            close_lists()
            out.append("<hr/>")
            i += 1
            continue

        heading = re.match(r"^(#{1,6})\s+(.*)$", line)
        if heading:
            close_lists()
            level = len(heading.group(1))
            out.append(f"<h{level}>{inline_format(heading.group(2))}</h{level}>")
            i += 1
            continue

        ul = re.match(r"^[-*]\s+(.*)$", line)
        if ul:
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline_format(ul.group(1))}</li>")
            i += 1
            continue

        ol = re.match(r"^(\d+)\.\s+(.*)$", line)
        if ol:
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{inline_format(ol.group(2))}</li>")
            i += 1
            continue

        if not line.strip():
            close_lists()
            i += 1
            continue

        close_lists()
        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith("#") and not lines[i].startswith("|") and not lines[i].startswith("```") and not lines[i].startswith("- ") and not lines[i].strip() == "---":
            if re.match(r"^\d+\.\s+", lines[i]):
                break
            para.append(lines[i])
            i += 1
        out.append("<p>" + inline_format(" ".join(para)) + "</p>")

    close_lists()
    if in_code:
        out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
    return "\n".join(out)


CSS = """
@page { size: A4; margin: 16mm 14mm 18mm 14mm; }
html, body {
  font-family: DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #1a1a1a;
}
h1 { font-size: 20pt; margin: 0 0 12pt; page-break-after: avoid; }
h2 { font-size: 14pt; margin: 18pt 0 8pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; page-break-after: avoid; }
h3 { font-size: 12pt; margin: 14pt 0 6pt; page-break-after: avoid; }
h4 { font-size: 11pt; margin: 12pt 0 4pt; page-break-after: avoid; }
p { margin: 0 0 8pt; }
ul, ol { margin: 0 0 10pt 18pt; }
li { margin-bottom: 3pt; }
hr { border: none; border-top: 1px solid #bbb; margin: 14pt 0; }
code {
  font-family: DejaVu Sans Mono, Liberation Mono, Consolas, monospace;
  font-size: 8.5pt;
  background: #f3f3f3;
  padding: 0 3px;
}
pre {
  background: #f4f4f4;
  border: 1px solid #ddd;
  padding: 8pt;
  font-size: 7.5pt;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  page-break-inside: auto;
}
pre code { background: none; padding: 0; font-size: inherit; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 12pt;
  font-size: 8pt;
  page-break-inside: auto;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th, td {
  border: 1px solid #ccc;
  padding: 4pt 5pt;
  vertical-align: top;
  text-align: left;
  word-wrap: break-word;
}
th { background: #eef2f6; font-weight: 700; }
a { color: #1a4a7a; }
.cover-meta { color: #444; margin-bottom: 16pt; }
"""


def wrap_document(body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Geo Employee Tracker — QA &amp; Bug Audit Report</title>
<style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>
"""


def main() -> None:
    root = Path(__file__).resolve().parent
    md = (root / "QA_Audit_Report.md").read_text(encoding="utf-8")
    html_doc = wrap_document(md_to_html(md))
    out = root / "QA_Audit_Report.html"
    out.write_text(html_doc, encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
