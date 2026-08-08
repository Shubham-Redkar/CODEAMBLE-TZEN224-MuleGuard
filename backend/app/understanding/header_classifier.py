from datetime import datetime
from typing import Optional

from rapidfuzz import fuzz

from app.config_loader import load_config

FIELD_HINTS: dict[str, list[str]] = {
    "txn_date": ["date", "txn date", "transaction date", "value date", "trans date"],
    "value_date": ["value date", "value dt", "val dt"],
    "narration": ["narration", "description", "particulars", "details", "remarks", "transaction details"],
    "debit_amount": ["debit", "withdrawal", "dr", "amount debited", "withdrawal amt", "debit amount"],
    "credit_amount": ["credit", "deposit", "cr", "amount credited", "deposit amt", "credit amount"],
    "balance_after": ["balance", "closing balance", "running balance", "available balance", "balance amt"],
    "reference_no": ["ref", "cheque no", "chq/ref", "transaction id", "chq no", "ref no"],
}


def _try_parse_date(val: str) -> bool:
    if not val or len(val) < 6:
        return False
    fmt_candidates = ["%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%Y%m%d", "%d.%m.%Y"]
    for fmt in fmt_candidates:
        try:
            datetime.strptime(val.strip(), fmt)
            return True
        except (ValueError, OSError):
            continue
    return False


def _is_numeric(val: str) -> bool:
    try:
        float(val.strip().replace(",", "").replace("₹", "").replace("$", "").replace(" ", ""))
        return True
    except ValueError:
        return False


def _content_heuristic(field: str, sample_values: list[str]) -> float:
    if not sample_values:
        return 0.0
    non_empty = [v for v in sample_values if v.strip()]
    if not non_empty:
        return 0.0

    if field == "txn_date":
        date_count = sum(1 for v in non_empty if _try_parse_date(v))
        return date_count / len(non_empty)

    if field == "value_date":
        date_count = sum(1 for v in non_empty if _try_parse_date(v))
        return date_count / len(non_empty) * 0.8

    if field == "narration":
        long_count = sum(1 for v in non_empty if len(v) > 10)
        unique_ratio = len(set(non_empty)) / max(len(non_empty), 1)
        return (long_count / len(non_empty)) * 0.5 + unique_ratio * 0.5

    if field in ("debit_amount", "credit_amount", "balance_after"):
        num_count = sum(1 for v in non_empty if _is_numeric(v))
        return num_count / len(non_empty)

    if field == "reference_no":
        alnum_count = sum(1 for v in non_empty if v.isalnum() or any(c.isdigit() for c in v))
        unique_ratio = len(set(non_empty)) / max(len(non_empty), 1)
        return (alnum_count / len(non_empty)) * 0.5 + unique_ratio * 0.5

    return 0.0


def _header_score(field: str, header_raw: str) -> float:
    hints = FIELD_HINTS.get(field, [])
    if not hints:
        return 0.0
    return max(fuzz.token_sort_ratio(header_raw.lower(), h.lower()) / 100.0 for h in hints)


def classify_columns(
    headers: list[str], sample_rows: list[list[str]]
) -> dict[int, tuple[str, float]]:
    cfg = load_config("thresholds")
    h_weight = cfg.get("column_mapping", {}).get("header_score_weight", 0.5)
    c_weight = cfg.get("column_mapping", {}).get("content_score_weight", 0.5)
    min_accept = cfg.get("header_classification", {}).get("field_min_acceptance", 0.55)

    assignments: dict[int, tuple[str, float]] = {}
    used_fields: set[str] = set()

    for col_idx, header_raw in enumerate(headers):
        sample_values = [r[col_idx] for r in sample_rows[:50] if col_idx < len(r)]

        best_field: Optional[str] = None
        best_score = 0.0

        for field in FIELD_HINTS:
            hs = _header_score(field, header_raw)
            cs = _content_heuristic(field, sample_values)
            combined = hs * h_weight + cs * c_weight

            if combined > best_score and combined >= min_accept:
                best_score = combined
                best_field = field

        if best_field and best_field not in used_fields:
            assignments[col_idx] = (best_field, best_score)
            used_fields.add(best_field)
        elif best_field:
            existing_score = assignments.get(col_idx, (None, 0.0))[1]
            if best_score > existing_score:
                assignments[col_idx] = (best_field, best_score)

    return assignments
