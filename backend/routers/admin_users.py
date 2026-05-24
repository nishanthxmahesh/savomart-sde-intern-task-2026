from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from admin_security import get_current_admin, require_superadmin
from audit import audit_log
from database import get_db
from models import (
    AdminUser,
    Coupon,
    PointsTransaction,
    SupportTicket,
    Tier,
    User,
)
from schemas import (
    AdminTicketOut,
    AdminUserDetail,
    AdminUserOut,
    AdminUserTierChange,
    CouponResponse,
    TransactionResponse,
)

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_summary(u: User) -> AdminUserOut:
    return AdminUserOut(
        id=u.id,
        name=u.name,
        mobile_number=u.mobile_number,
        points_balance=u.points_balance,
        tier=u.tier.value,
        is_active=u.is_active,
        created_at=u.created_at,
    )


@router.get("", response_model=list[AdminUserOut])
def list_users(
    _admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=500),
):
    query = db.query(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.name.ilike(like), User.mobile_number.ilike(like)))
    return [_to_summary(u) for u in query.limit(limit).all()]


@router.get("/{user_id}", response_model=AdminUserDetail)
def get_user_detail(
    user_id: int,
    _admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Customer not found.")

    now = _now()

    txns = (
        db.query(PointsTransaction)
        .filter(PointsTransaction.user_id == user_id)
        .order_by(PointsTransaction.created_at.desc())
        .limit(50)
        .all()
    )

    coupons = (
        db.query(Coupon)
        .filter(Coupon.user_id == user_id, Coupon.is_used == False, Coupon.expires_at > now)  # noqa: E712
        .order_by(Coupon.expires_at.asc())
        .all()
    )

    tickets = (
        db.query(SupportTicket)
        .options(joinedload(SupportTicket.user), joinedload(SupportTicket.assigned_admin))
        .filter(SupportTicket.user_id == user_id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )

    coupon_outs = []
    for c in coupons:
        exp = c.expires_at if c.expires_at.tzinfo else c.expires_at.replace(tzinfo=timezone.utc)
        days = max(0, (exp - now).days)
        coupon_outs.append(
            CouponResponse(
                id=c.id, code=c.code, discount_value=c.discount_value,
                discount_type=c.discount_type.value, description=c.description,
                expires_at=c.expires_at, applicable_store_id=c.applicable_store_id,
                days_remaining=days,
            )
        )

    txn_outs = [
        TransactionResponse(
            id=t.id, delta=t.delta, description=t.description, created_at=t.created_at
        )
        for t in txns
    ]

    ticket_outs = [
        AdminTicketOut(
            id=t.id, public_id=t.public_id, user_id=t.user_id,
            customer_name=user.name, customer_mobile=user.mobile_number,
            customer_tier=user.tier.value, customer_points=user.points_balance,
            category=t.category, subject=t.subject, description=t.description,
            status=t.status.value, source=t.source.value, chat_transcript=t.chat_transcript,
            assigned_to_admin_id=t.assigned_to_admin_id,
            assigned_to_admin_email=t.assigned_admin.email if t.assigned_admin else None,
            internal_notes=t.internal_notes, response_sent=t.response_sent,
            resolved_at=t.resolved_at, created_at=t.created_at,
        )
        for t in tickets
    ]

    return AdminUserDetail(
        id=user.id, name=user.name, mobile_number=user.mobile_number,
        points_balance=user.points_balance, tier=user.tier.value,
        is_active=user.is_active, created_at=user.created_at,
        transactions=txn_outs, coupons=coupon_outs, tickets=ticket_outs,
    )


@router.patch("/{user_id}/tier", response_model=AdminUserOut)
def change_tier(
    user_id: int,
    payload: AdminUserTierChange,
    admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Customer not found.")
    new_tier = Tier(payload.tier)
    if new_tier == user.tier:
        return _to_summary(user)

    old = user.tier.value
    user.tier = new_tier
    try:
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't change tier.") from exc

    audit_log(
        db, admin, "user.tier_change",
        target_type="user", target_id=user.id,
        details={"from": old, "to": new_tier.value, "reason": payload.reason},
    )
    return _to_summary(user)


@router.patch("/{user_id}/deactivate", response_model=AdminUserOut)
def deactivate_user(
    user_id: int,
    admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Customer not found.")
    user.is_active = False
    try:
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't deactivate user.") from exc
    audit_log(db, admin, "user.deactivate", target_type="user", target_id=user.id)
    return _to_summary(user)


@router.patch("/{user_id}/reactivate", response_model=AdminUserOut)
def reactivate_user(
    user_id: int,
    admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Customer not found.")
    user.is_active = True
    try:
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't reactivate user.") from exc
    audit_log(db, admin, "user.reactivate", target_type="user", target_id=user.id)
    return _to_summary(user)
