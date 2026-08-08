import re
from typing import Optional


_UPI_PATTERN = re.compile(r"UPI/(?:P2A|P2M|P2P|CR|DR)?/?\d*/([A-Za-z0-9.\-@_ ]+)", re.IGNORECASE)
_NEFT_IMPS_PATTERN = re.compile(r"(?:NEFT|IMPS|RTGS)[-/](?:CR|DR)?[-/]?([A-Z0-9]+)[-/]([A-Za-z0-9 ._\-]+)", re.IGNORECASE)
_ATM_PATTERN = re.compile(r"ATM[/-](\w+)", re.IGNORECASE)
_POS_PATTERN = re.compile(r"POS[/-](\w+)", re.IGNORECASE)
_CHEQUE_PATTERN = re.compile(r"(?:CH(?:Q|EQUE)|CHEQUE)\s*[#:/]?\s*(\d+)", re.IGNORECASE)
_VPA_PATTERN = re.compile(r"[\w.\-]+@[\w]+")


def extract_counterparty(narration: str) -> Optional[str]:
    m = _UPI_PATTERN.search(narration)
    if m:
        name = m.group(1).strip().rstrip("/")
        if name:
            return name

    m = _NEFT_IMPS_PATTERN.search(narration)
    if m:
        name = m.group(2).strip()
        if name:
            return name

    m = _ATM_PATTERN.search(narration)
    if m:
        return m.group(1).strip()

    m = _POS_PATTERN.search(narration)
    if m:
        return m.group(1).strip()

    m = _VPA_PATTERN.search(narration)
    if m:
        return m.group(0)

    tokens = re.split(r"[/\s\-]+", narration)
    longest = max((t for t in tokens if t.isalpha() and len(t) > 3), key=len, default=None)
    return longest


def is_self_transfer(narration: str, account_holder: Optional[str]) -> bool:
    if not account_holder:
        return False
    self_patterns = ["own a/c", "self transfer", "transfer to own", "own account"]
    if any(p in narration.lower() for p in self_patterns):
        return True
    if account_holder.lower() in narration.lower():
        return True
    return False
