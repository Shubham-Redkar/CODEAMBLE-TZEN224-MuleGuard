import functools
import hashlib
from typing import Any, Callable


def deterministic(func: Callable) -> Callable:
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        return result

    wrapper._is_deterministic = True
    return wrapper


def assert_deterministic(func: Callable, *args, **kwargs) -> bool:
    result1 = func(*args, **kwargs)
    result2 = func(*args, **kwargs)

    hash1 = hashlib.sha256(str(result1).encode()).hexdigest()
    hash2 = hashlib.sha256(str(result2).encode()).hexdigest()

    return hash1 == hash2
