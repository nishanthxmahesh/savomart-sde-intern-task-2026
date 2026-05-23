from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from loyalty import progress_to_next
from models import Coupon, PointsTransaction, User
from schemas import CouponResponse, ProfileResponse, TransactionResponse
from security import get_current_user

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/me", response_model=ProfileResponse)
def get_profile(user: User = Depends(get_current_user)):
    next_tier, remaining, pct = progress_to_next(user.points_balance)
    return ProfileResponse(
        id=user.id,
        name=user.name,
        mobile_number=user.mobile_number,
        points_balance=user.points_balance,
        tier=user.tier.value,
        member_since=user.created_at,
        next_tier=next_tier,
        points_to_next_tier=remaining,
        tier_progress_percent=pct,
    )


@router.get("/coupons", response_model=list[CouponResponse])
def get_my_coupons(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = _now()
    coupons = (
        db.query(Coupon)
        .filter(
            Coupon.user_id == user.id,
            Coupon.is_used == False,  # noqa: E712
            Coupon.expires_at > now,
        )
        .order_by(Coupon.expires_at.asc())
        .all()
    )
    out: list[CouponResponse] = []
    for c in coupons:
        exp = c.expires_at if c.expires_at.tzinfo else c.expires_at.replace(tzinfo=timezone.utc)
        days = max(0, (exp - now).days)
        out.append(
            CouponResponse(
                id=c.id,
                code=c.code,
                discount_value=c.discount_value,
                discount_type=c.discount_type.value,
                description=c.description,
                expires_at=c.expires_at,
                applicable_store_id=c.applicable_store_id,
                days_remaining=days,
            )
        )
    return out


@router.get("/transactions", response_model=list[TransactionResponse])
def get_my_transactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 10,
):
    limit = max(1, min(50, limit))
    txns = (
        db.query(PointsTransaction)
        .filter(PointsTransaction.user_id == user.id)
        .order_by(PointsTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return txns
