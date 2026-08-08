from typing import Any, Optional

from app.config_loader import load_config


def decide_tier(
    fused_score: float,
    rule_score: float | None,
    anomaly_score: float | None,
    extraction_confidence: str,
    rules_triggered: bool,
) -> tuple[str, dict[str, Any]]:
    cfg = load_config("thresholds")
    dec = cfg.get("decision", {})
    t_high = dec.get("confirmed_suspicious_min", 75)
    t_low = dec.get("likely_legitimate_max", 25)

    thresholds_applied = {"T_high": t_high, "T_low": t_low}

    if fused_score >= t_high and rules_triggered and extraction_confidence != "low":
        tier = "CONFIRMED_SUSPICIOUS"
    elif fused_score <= t_low and (anomaly_score is None or anomaly_score < 0.3) and extraction_confidence == "high":
        tier = "LIKELY_LEGITIMATE"
    else:
        tier = "REVIEW_REQUIRED"

    return tier, thresholds_applied
