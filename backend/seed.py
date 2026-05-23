# -*- coding: utf-8 -*-
"""Idempotent seed: creates demo users, coupons, transactions, offers."""
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import (
    Coupon,
    DiscountType,
    Offer,
    PointsTransaction,
    StoreScope,
    Tier,
    User,
)

INR = "₹"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_user(db: Session, mobile: str, name: str, points: int, tier: Tier) -> User:
    user = db.query(User).filter(User.mobile_number == mobile).first()
    if user:
        return user
    user = User(name=name, mobile_number=mobile, points_balance=points, tier=tier)
    db.add(user)
    db.flush()
    return user


def _seed_transactions_for(db: Session, user: User) -> None:
    if db.query(PointsTransaction).filter(PointsTransaction.user_id == user.id).count() > 0:
        return
    history = [
        (180, f"Earned: grocery purchase {INR}720", 2),
        (250, f"Earned: weekend shop {INR}1,000", 8),
        (-100, f"Redeemed: {INR}25 off coupon", 14),
        (320, "Earned: Saturday double points", 21),
        (60, f"Earned: bakery purchase {INR}240", 29),
    ]
    for delta, desc, days_ago in history:
        db.add(
            PointsTransaction(
                user_id=user.id,
                delta=delta,
                description=desc,
                created_at=_now() - timedelta(days=days_ago),
            )
        )


def _seed_coupons_for(db: Session, user: User, count: int) -> None:
    if db.query(Coupon).filter(Coupon.user_id == user.id).count() > 0:
        return
    templates = [
        ("WELCOME50", 50, DiscountType.FLAT, f"{INR}50 off on orders above {INR}500", 25),
        ("FRESH10", 10, DiscountType.PERCENT, "10% off Fresh Produce", 14),
        ("DAIRY15", 15, DiscountType.PERCENT, "15% off Dairy & Eggs", 21),
        ("BAKERY20", 20, DiscountType.PERCENT, "20% off Bakery items", 10),
        ("GOLD100", 100, DiscountType.FLAT, f"Gold-tier {INR}100 off — sitewide", 30),
    ]
    for code, value, dtype, desc, days in templates[:count]:
        db.add(
            Coupon(
                user_id=user.id,
                code=f"{code}-{secrets.token_hex(2).upper()}",
                discount_value=value,
                discount_type=dtype,
                description=desc,
                expires_at=_now() + timedelta(days=days),
                is_used=False,
            )
        )


def _seed_offers(db: Session) -> None:
    if db.query(Offer).count() > 0:
        return
    now = _now()
    offers = [
        dict(
            title="10% off all Fresh Produce",
            description="Get 10% off on fruits, vegetables, and herbs. Auto-applied at checkout.",
            discount_label="10% OFF",
            category="Fresh Produce",
            valid_from=now,
            valid_until=now + timedelta(days=30),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Double Points Saturdays",
            description="Earn 2x loyalty points on every weekend shop. Every Saturday & Sunday.",
            discount_label="2X POINTS",
            category="Loyalty",
            valid_from=now,
            valid_until=now + timedelta(days=60),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Buy 2 Get 1 Free — Dairy",
            description="Mix and match across milk, curd, paneer, and butter.",
            discount_label="B2G1",
            category="Dairy",
            valid_from=now,
            valid_until=now + timedelta(days=14),
            store_scope=StoreScope.SPECIFIC,
            store_id="indiranagar",
            store_name="Savomart Indiranagar",
            tier_required=None,
        ),
        dict(
            title=f"{INR}50 off on {INR}500+ purchase",
            description=f"Use code SAVO50 at the counter. Min cart value {INR}500.",
            discount_label=f"{INR}50 OFF",
            category="Sitewide",
            valid_from=now,
            valid_until=now + timedelta(days=7),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Free Delivery on App Orders",
            description="No minimum order. Free home delivery within 5km radius.",
            discount_label="FREE DELIVERY",
            category="Delivery",
            valid_from=now,
            valid_until=now + timedelta(days=14),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Gold Member: 15% off Bakery",
            description="Exclusive for Gold-tier members. Auto-applied for eligible accounts.",
            discount_label="15% OFF",
            category="Bakery",
            valid_from=now,
            valid_until=now + timedelta(days=30),
            store_scope=StoreScope.ALL,
            tier_required=Tier.GOLD,
        ),
        dict(
            title="Weekend Mega Sale — Home Essentials",
            description="Up to 30% off cleaning supplies, kitchen tools, and storage.",
            discount_label="UP TO 30% OFF",
            category="Home Essentials",
            valid_from=now,
            valid_until=now + timedelta(days=3),
            store_scope=StoreScope.SPECIFIC,
            store_id="whitefield",
            store_name="Savomart Whitefield",
            tier_required=None,
        ),
        dict(
            title="New User Bonus — 100 pts",
            description="Sign up and earn 100 loyalty points after your first purchase.",
            discount_label="+100 PTS",
            category="Loyalty",
            valid_from=now,
            valid_until=now + timedelta(days=30),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Refer a Friend — 200 pts each",
            description="You and your friend both earn 200 points when they make their first purchase.",
            discount_label="+200 PTS",
            category="Referral",
            valid_from=now,
            valid_until=now + timedelta(days=90),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Festive Special — 20% off Sweets",
            description="Celebrate with us! 20% off all sweets and confectionery.",
            discount_label="20% OFF",
            category="Sweets",
            valid_from=now,
            valid_until=now + timedelta(days=7),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
    ]
    for o in offers:
        db.add(Offer(**o))


def run_seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        gold = _ensure_user(db, "9999999999", "Aanya Sharma", 5400, Tier.GOLD)
        silver = _ensure_user(db, "8888888888", "Rahul Mehta", 2750, Tier.SILVER)
        bronze = _ensure_user(db, "7777777777", "Priya Iyer", 420, Tier.BRONZE)
        db.flush()

        _seed_transactions_for(db, gold)
        _seed_transactions_for(db, silver)
        _seed_transactions_for(db, bronze)

        _seed_coupons_for(db, gold, 3)
        _seed_coupons_for(db, silver, 2)
        _seed_coupons_for(db, bronze, 2)

        _seed_offers(db)

        db.commit()
        print("[seed] demo data ready: 3 users, coupons, transactions, 10 offers", flush=True)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
