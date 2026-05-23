from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from loyalty import TIER_THRESHOLDS
from models import Offer, StoreScope, Tier, User
from schemas import OfferResponse, OffersListResponse
from security import get_current_user

router = APIRouter(prefix="/api/offers", tags=["offers"])

EXPIRING_SOON_DAYS = 3
_TIER_RANK = {t.value: i for i, (t, _) in enumerate(TIER_THRESHOLDS)}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_eligible(offer: Offer, user_tier: str) -> bool:
    if offer.tier_required is None:
        return True
    required = offer.tier_required.value if hasattr(offer.tier_required, "value") else str(offer.tier_required)
    return _TIER_RANK.get(user_tier, 0) >= _TIER_RANK.get(required, 0)


def _days_remaining(valid_until: datetime, now: datetime) -> int:
    if valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)
    delta = valid_until - now
    return max(0, delta.days + (1 if delta.seconds > 0 else 0))


@router.get("", response_model=OffersListResponse)
def list_offers(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    scope: Optional[str] = Query(None, pattern="^(all|sitewide|specific)$"),
    category: Optional[str] = None,
    expiring_soon: bool = False,
    eligible_only: bool = False,
    q: Optional[str] = None,
):
    now = _now()
    query = db.query(Offer).filter(Offer.valid_until > now)

    if scope == "sitewide":
        query = query.filter(Offer.store_scope == StoreScope.ALL)
    elif scope == "specific":
        query = query.filter(Offer.store_scope == StoreScope.SPECIFIC)

    if category:
        query = query.filter(Offer.category == category)

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Offer.title.ilike(like),
                Offer.description.ilike(like),
                Offer.category.ilike(like),
            )
        )

    offers = query.order_by(Offer.valid_until.asc()).all()

    user_tier = user.tier.value if hasattr(user.tier, "value") else str(user.tier)

    items: list[OfferResponse] = []
    for o in offers:
        days = _days_remaining(o.valid_until, now)
        if expiring_soon and days > EXPIRING_SOON_DAYS:
            continue
        eligible = _is_eligible(o, user_tier)
        if eligible_only and not eligible:
            continue
        items.append(
            OfferResponse(
                id=o.id,
                title=o.title,
                description=o.description,
                discount_label=o.discount_label,
                category=o.category,
                valid_from=o.valid_from,
                valid_until=o.valid_until,
                store_scope=o.store_scope.value,
                store_id=o.store_id,
                store_name=o.store_name,
                tier_required=o.tier_required.value if o.tier_required else None,
                days_remaining=days,
                is_eligible=eligible,
            )
        )

    categories = sorted({o.category for o in db.query(Offer).filter(Offer.valid_until > now).all()})

    return OffersListResponse(items=items, total=len(items), categories=categories)
