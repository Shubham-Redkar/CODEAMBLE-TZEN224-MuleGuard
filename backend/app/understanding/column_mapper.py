from decimal import Decimal
from datetime import datetime, date
from typing import Optional

from app.understanding.canonical_schema import CanonicalTransaction


_DATE_FORMATS = ["%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y", "%Y%m%d", "%d.%m.%Y", "%b %d %Y", "%d-%b-%Y"]


def _parse_date(val: str) -> Optional[date]:
    val = val.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(val, fmt).date()
        except (ValueError, OSError):
            continue
    return None


def _parse_amount(val: str) -> Optional[Decimal]:
    val = val.strip().replace(",", "").replace("₹", "").replace("$", "").replace(" ", "")
    if val.startswith("(") and val.endswith(")"):
        val = "-" + val[1:-1]
    if val.startswith("-"):
        neg = True
        val = val[1:]
    else:
        neg = False
    if val.replace(".", "").isdigit():
        amt = Decimal(val)
        return -amt if neg else amt
    return None


def map_row_to_transaction(
    row: list[str],
    col_map: dict[int, str],
    statement_id: int,
    row_index: int,
) -> Optional[CanonicalTransaction]:
    if not col_map:
        return None

    fields: dict[str, Optional[str]] = {}
    for col_idx, field_name in col_map.items():
        if col_idx < len(row):
            fields[field_name] = row[col_idx]

    txn_date_s = fields.get("txn_date")
    txn_date = _parse_date(txn_date_s) if txn_date_s else None
    if txn_date is None:
        return None

    value_date_s = fields.get("value_date")
    value_date = _parse_date(value_date_s) if value_date_s else None

    debit_s = fields.get("debit_amount")
    debit = _parse_amount(debit_s) if debit_s else None

    credit_s = fields.get("credit_amount")
    credit = _parse_amount(credit_s) if credit_s else None

    balance_s = fields.get("balance_after")
    balance = _parse_amount(balance_s) if balance_s else None

    return CanonicalTransaction(
        row_id=f"{statement_id}-{row_index}",
        txn_date=txn_date,
        value_date=value_date,
        narration=fields.get("narration", "") or "",
        reference_no=fields.get("reference_no"),
        debit_amount=debit,
        credit_amount=credit,
        balance_after=balance,
        source_row_confidence=1.0,
    )
