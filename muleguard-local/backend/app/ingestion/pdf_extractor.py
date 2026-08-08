from pathlib import Path
from typing import Optional

import pdfplumber
from pdfplumber.page import Page


def _is_header_row(row: list[str | None], prev_header: list[str] | None = None) -> bool:
    text = " ".join(str(c or "").strip().lower() for c in row)
    header_hints = ["date", "narration", "particulars", "debit", "credit", "withdrawal",
                    "deposit", "balance", "transaction", "chq", "ref", "value"]
    keyword_hits = sum(1 for hint in header_hints if hint in text)
    if keyword_hits >= 3:
        return True
    if prev_header and len(row) == len(prev_header):
        similarity = sum(1 for a, b in zip(row, prev_header) if str(a or "").strip() == str(b or "").strip())
        if similarity / max(len(row), 1) > 0.7:
            return True
    return False


def _clean_table(table_data: list[list[str | None]]) -> list[list[str]]:
    cleaned: list[list[str]] = []
    seen_headers: Optional[list[str]] = None
    for row in table_data:
        str_row = [str(c or "").strip() for c in row]
        if _is_header_row(row, seen_headers):
            seen_headers = str_row
            continue
        if any(c for c in str_row):
            cleaned.append(str_row)
    return cleaned


def _merge_tables(all_tables: list[list[list[str]]]) -> list[list[str]]:
    merged: list[list[str]] = []
    seen_headers: Optional[list[str]] = None
    for table in all_tables:
        for row in table:
            if _is_header_row(row, seen_headers):
                seen_headers = row
                continue
            if any(c for c in row):
                merged.append(row)
    return merged


def extract_text_layer_pdf(file_path: str | Path) -> list[list[str]]:
    path = Path(file_path)
    all_tables: list[list[list[str]]] = []

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if table:
                    cleaned = _clean_table(table)
                    if cleaned:
                        all_tables.append(cleaned)

            if not tables:
                text = page.extract_text()
                if text:
                    lines = [line.split() for line in text.split("\n") if line.strip()]
                    if lines:
                        all_tables.append(lines)

    return _merge_tables(all_tables)


def extract_pdf(file_path: str | Path) -> list[list[str]]:
    rows = extract_text_layer_pdf(file_path)
    if len(rows) >= 3:
        return rows
    try:
        from app.ingestion.ocr_fallback import ocr_pdf
        return ocr_pdf(file_path)
    except Exception:
        return rows
