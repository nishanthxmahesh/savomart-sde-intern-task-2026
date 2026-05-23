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
        # ---- sitewide ----
        dict(
            title=f"Flat {INR}75 off on orders above {INR}750",
            description=f"Use code SAVO75 at checkout. Valid on all carts above {INR}750. Cannot be combined with other coupon codes.",
            discount_label=f"{INR}75 OFF",
            category="Sitewide",
            valid_from=now,
            valid_until=now + timedelta(days=10),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Double Points Saturdays",
            description="Earn 2x loyalty points on every weekend shop. Auto-applied to baskets above ₹300. Valid every Saturday and Sunday.",
            discount_label="2X POINTS",
            category="Loyalty",
            valid_from=now,
            valid_until=now + timedelta(days=60),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Free home delivery on app orders",
            description="Zero delivery fee on every order from the Savomart app, within a 5 km radius of any operational store. No minimum cart value.",
            discount_label="FREE DELIVERY",
            category="Delivery",
            valid_from=now,
            valid_until=now + timedelta(days=21),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Refer a friend — 200 pts each",
            description="You and your friend both earn 200 loyalty points when they make their first qualifying purchase of ₹250 or more.",
            discount_label="+200 PTS",
            category="Referral",
            valid_from=now,
            valid_until=now + timedelta(days=90),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        # ---- fresh / staples ----
        dict(
            title="10% off Fresh Produce",
            description="Discount auto-applied to fruits, vegetables, herbs, and salad greens at billing. Doesn't apply to exotic imports.",
            discount_label="10% OFF",
            category="Fresh Produce",
            valid_from=now,
            valid_until=now + timedelta(days=30),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Buy 2 Get 1 Free — Dairy",
            description="Mix and match across Amul, Mother Dairy, Heritage milk packets (500 ml / 1 L), curd cups, paneer blocks, and butter sticks.",
            discount_label="B2G1",
            category="Dairy & Eggs",
            valid_from=now,
            valid_until=now + timedelta(days=14),
            store_scope=StoreScope.SPECIFIC,
            store_id="indiranagar",
            store_name="Savomart Indiranagar",
            tier_required=None,
        ),
        dict(
            title="Atta & rice combo — ₹120 off",
            description="Buy any 5 kg or 10 kg pack of atta together with a 5 kg pack of basmati or sona masuri rice and save ₹120 instantly.",
            discount_label="₹120 OFF",
            category="Staples",
            valid_from=now,
            valid_until=now + timedelta(days=12),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        # ---- snacks / breakfast / beverages ----
        dict(
            title="15% off Breakfast Cereals & Oats",
            description="Discount on Kellogg's, Bagrry's, Quaker, Saffola muesli and oats packs above ₹150 MRP.",
            discount_label="15% OFF",
            category="Breakfast",
            valid_from=now,
            valid_until=now + timedelta(days=9),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Snacks fest — flat 20% off",
            description="Lay's, Kurkure, Haldiram's, Too Yumm, Bingo and Britannia snacks at flat 20% off when you buy any three packs.",
            discount_label="20% OFF",
            category="Snacks",
            valid_from=now,
            valid_until=now + timedelta(days=5),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Cold beverages — buy 1 get 1",
            description="On Coca-Cola, Pepsi, Sprite, Thums Up, Real fruit juices, and B Natural 1L packs. Stock varies by store.",
            discount_label="B1G1",
            category="Beverages",
            valid_from=now,
            valid_until=now + timedelta(days=7),
            store_scope=StoreScope.SPECIFIC,
            store_id="koramangala",
            store_name="Savomart Koramangala",
            tier_required=None,
        ),
        # ---- bakery / sweets ----
        dict(
            title="Fresh-baked daily — 25% off after 7 PM",
            description="Same-day bakery items (bread loaves, buns, cookies, brownies) at 25% off every evening after 7 PM. While stocks last.",
            discount_label="25% OFF",
            category="Bakery",
            valid_from=now,
            valid_until=now + timedelta(days=30),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        # ---- frozen ----
        dict(
            title="Frozen foods — flat ₹50 off",
            description="On McCain, Godrej Yummiez and ITC Master Chef ready-to-cook frozen snacks. Min purchase ₹400 from the frozen aisle.",
            discount_label="₹50 OFF",
            category="Frozen",
            valid_from=now,
            valid_until=now + timedelta(days=6),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        # ---- personal care / home ----
        dict(
            title="Personal care — buy 2 save 15%",
            description="On Dove, Nivea, Himalaya, Mamaearth and Biotique products. Discount applies on second item.",
            discount_label="15% OFF",
            category="Personal Care",
            valid_from=now,
            valid_until=now + timedelta(days=14),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Weekend Mega Sale — Home Essentials",
            description="Up to 30% off on cleaning supplies, kitchen tools, storage, mops, and detergents. Today through Sunday only.",
            discount_label="UP TO 30% OFF",
            category="Home Essentials",
            valid_from=now,
            valid_until=now + timedelta(days=3),
            store_scope=StoreScope.SPECIFIC,
            store_id="whitefield",
            store_name="Savomart Whitefield",
            tier_required=None,
        ),
        # ---- tier-locked ----
        dict(
            title="Gold member: extra 15% off Bakery",
            description="Stack on top of the daily bakery discount. Auto-applied for Gold-tier accounts at billing.",
            discount_label="+15% OFF",
            category="Bakery",
            valid_from=now,
            valid_until=now + timedelta(days=45),
            store_scope=StoreScope.ALL,
            tier_required=Tier.GOLD,
        ),
        dict(
            title="Silver & Gold: free reusable tote with ₹999+ shop",
            description="Show your Savomart app at the counter to claim. One tote per customer per week, while stocks last.",
            discount_label="FREE GIFT",
            category="Loyalty",
            valid_from=now,
            valid_until=now + timedelta(days=20),
            store_scope=StoreScope.ALL,
            tier_required=Tier.SILVER,
        ),
        # ---- expiring soon ----
        dict(
            title="Flash sale — 30% off Atta & Pulses",
            description="Today only! 30% off branded atta, dal, and pulses across all bin sizes. Limited to in-store purchases.",
            discount_label="30% OFF",
            category="Staples",
            valid_from=now,
            valid_until=now + timedelta(days=1),
            store_scope=StoreScope.ALL,
            tier_required=None,
        ),
        dict(
            title="Last-day combo — Tea & Biscuits",
            description="Pick any Tata Tea / Red Label / Tetley pack with any Britannia / Parle / Sunfeast biscuit for a flat ₹30 off.",
            discount_label="₹30 OFF",
            category="Beverages",
            valid_from=now,
            valid_until=now + timedelta(days=2),
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
