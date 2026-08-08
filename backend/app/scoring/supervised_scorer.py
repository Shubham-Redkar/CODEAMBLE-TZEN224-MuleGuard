from typing import Any, Optional

from app.config_loader import load_config


def supervised_model_available(label_count: int) -> bool:
    cfg = load_config("thresholds")
    min_labels = cfg.get("supervised", {}).get("min_labeled_accounts", 200)
    return label_count >= min_labels


class SupervisedScorer:
    def __init__(self):
        self.model = None
        self.is_trained = False

    @property
    def available(self) -> bool:
        return self.is_trained

    def predict_proba(self, feature_vector: list[float]) -> Optional[float]:
        if not self.is_trained:
            return None
        return 0.5
