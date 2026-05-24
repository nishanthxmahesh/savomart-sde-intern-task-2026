from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from admin_security import get_current_admin
from database import get_db
from models import (
    AdminUser,
    Offer,
    PointsTransaction,
    SupportTicket,
    Tier,
    User,
)
from schemas import (
    AdminAnalyticsResponse,
    AnalyticsBar,
    AnalyticsTimeseriesPoint,
)

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=AdminAnalyticsResponse)
def admin_analytics(
    _admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    now = _now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 1. Points issued vs redeemed THIS MONTH
    issued = (
        db.query(func.coalesce(func.sum(PointsTransaction.delta), 0))
        .filter(PointsTransaction.delta > 0, PointsTransaction.created_at >= month_start)
        .scalar()
        or 0
    )
    redeemed = (
        db.query(func.coalesce(func.sum(-PointsTransaction.delta), 0))
        .filter(PointsTransaction.delta < 0, PointsTransaction.created_at >= month_start)
        .scalar()
        or 0
    )
    points_issued_vs_redeemed = [
        AnalyticsBar(label="Issued", value=int(issued)),
        AnalyticsBar(label="Redeemed", value=int(redeemed)),
    ]

    # 2. Tier distribution
    tier_rows = (
        db.query(User.tier, func.count(User.id)).group_by(User.tier).all()
    )
    counts = {row[0].value if hasattr(row[0], "value") else str(row[0]): row[1] for row in tier_rows}
    tier_distribution = [
        AnalyticsBar(label=t.value, value=int(counts.get(t.value, 0))) for t in Tier
    ]

    # 3. Top offer categories (by count of active offers per category)
    cat_rows = (
        db.query(Offer.category, func.count(Offer.id))
        .filter(Offer.valid_until > now)
        .group_by(Offer.category)
        .order_by(func.count(Offer.id).desc())
        .limit(8)
        .all()
    )
    top_offer_categories = [AnalyticsBar(label=c, value=int(n)) for c, n in cat_rows]

    # 4. Ticket volume by category (all-time, all status)
    tcat_rows = (
        db.query(SupportTicket.category, func.count(SupportTicket.id))
        .group_by(SupportTicket.category)
        .order_by(func.count(SupportTicket.id).desc())
        .all()
    )
    ticket_volume_by_category = [AnalyticsBar(label=c, value=int(n)) for c, n in tcat_rows]

    # 5. Signups over last 30 days (one bucket per day, zero-filled)
    cutoff = now - timedelta(days=29)
    cutoff_day = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
    recent_users = (
        db.query(User.created_at).filter(User.created_at >= cutoff_day).all()
    )
    bucket: Counter = Counter()
    for (created_at,) in recent_users:
        bucket[created_at.date().isoformat()] += 1

    signups_last_30_days: list[AnalyticsTimeseriesPoint] = []
    for i in range(30):
        d = (cutoff_day + timedelta(days=i)).date().isoformat()
        signups_last_30_days.append(
            AnalyticsTimeseriesPoint(date=d, value=int(bucket.get(d, 0)))
        )

    return AdminAnalyticsResponse(
        points_issued_vs_redeemed=points_issued_vs_redeemed,
        tier_distribution=tier_distribution,
        top_offer_categories=top_offer_categories,
        ticket_volume_by_category=ticket_volume_by_category,
        signups_last_30_days=signups_last_30_days,
    )
