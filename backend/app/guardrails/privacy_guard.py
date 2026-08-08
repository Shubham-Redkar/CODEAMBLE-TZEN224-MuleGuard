import logging
import re
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


PII_PATTERNS = [
    (re.compile(r"\b\d{16}\b"), "[ACCOUNT_NUMBER]"),
    (re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"), "[IFSC_CODE]"),
    (re.compile(r"\b\d{12}\b"), "[AADHAAR]"),
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]{1}\b"), "[PAN]"),
    (re.compile(r"\b\d{10}\b"), "[MOBILE]"),
]


def redact_pii(text: str) -> str:
    for pattern, replacement in PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class PIIRedactionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        return response


class PIIRedactingLogger:
    def __init__(self, logger: logging.Logger):
        self._logger = logger

    def info(self, msg: str, *args, **kwargs):
        self._logger.info(redact_pii(msg), *args, **kwargs)

    def error(self, msg: str, *args, **kwargs):
        self._logger.error(redact_pii(msg), *args, **kwargs)

    def warning(self, msg: str, *args, **kwargs):
        self._logger.warning(redact_pii(msg), *args, **kwargs)
