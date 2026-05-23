"""Tier-progression helpers — single source of truth for thresholds."""
from models import Tier

TIER_THRESHOLDS = [
    (Tier.BRONZE, 0),
    (Tier.SILVER, 1000),
    (Tier.GOLD, 5000),
]


def tier_for_balance(balance: int) -> Tier:
    current = Tier.BRONZE
    for tier, threshold in TIER_THRESHOLDS:
        if balance >= threshold:
            current = tier
    return current


def progress_to_next(balance: int):
    """Return (next_tier_name | None, points_remaining | None, progress_percent_0_100).

    For Gold (top tier), next_tier is None and progress is 100.
    For Bronze/Silver, progress is the % of the way through the current tier
    band toward the next threshold.
    """
    for i, (tier, threshold) in enumerate(TIER_THRESHOLDS):
        next_idx = i + 1
        if next_idx >= len(TIER_THRESHOLDS):
            return None, None, 100
        next_tier, next_threshold = TIER_THRESHOLDS[next_idx]
        if balance < next_threshold:
            span = next_threshold - threshold
            done = balance - threshold
            pct = max(0, min(100, int(round(done / span * 100))))
            remaining = max(0, next_threshold - balance)
            return next_tier.value, remaining, pct
    return None, None, 100
