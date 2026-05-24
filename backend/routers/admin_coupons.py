import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from admin_security import get_current_admin
from audit import audit_log
from database import get_db
from models import AdminUser, Coupon, DiscountType, User
from schemas import (
    AdminBulkCouponRequest,
    AdminCouponOut,
    AdminIssueCouponRequest,
)

router = APIRouter(prefix="/api/admin/coupons", tags=["admin-coupons"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _gen_code(prefix: str = "SAVO") -> str:
    return f"{prefix.upper().strip()}-{secrets.token_hex(2).upper()}"


def _to_out(c: Coupon, user: User) -> AdminCouponOut:
    return AdminCouponOut(
        id=c.id,
        user_id=c.user_id,
        customer_name=user.name,
        customer_mobile=user.mobile_number,
        code=c.code,
        discount_value=c.discount_value,
        discount_type=c.discount_type.value,
        description=c.description,
        expires_at=c.expires_at,
        is_used=c.is_used,
        applicable_store_id=c.applicable_store_id,
        created_at=c.created_at,
    )


@router.get("", response_model=list[AdminCouponOut])
def list_coupons(
    _admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
    used: Optional[bool] = None,
    expired: Optional[bool] = None,
    store_id: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=1000),
):
    now = _now()
    q = db.query(Coupon, User).join(User, Coupon.user_id == User.id).order_by(Coupon.created_at.desc())
    if used is not None:
        q = q.filter(Coupon.is_used == used)
    if expired is True:
        q = q.filter(Coupon.expires_at <= now)
    elif expired is False:
        q = q.filter(Coupon.expires_at > now)
    if store_id:
        q = q.filter(Coupon.applicable_store_id == store_id)
    rows = q.limit(limit).all()
    return [_to_out(c, u) for c, u in rows]


@router.post("/issue", response_model=AdminCouponOut, status_code=status.HTTP_201_CREATED)
def issue_coupon(
    payload: AdminIssueCouponRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Customer not found.")

    code = (payload.code or "").strip().upper() or _gen_code()

    coupon = Coupon(
        user_id=user.id,
        code=code,
        discount_value=payload.discount_value,
        discount_type=DiscountType(payload.discount_type),
        description=payload.description,
        expires_at=_now() + timedelta(days=payload.expires_in_days),
        is_used=False,
        applicable_store_id=payload.applicable_store_id,
    )
    try:
        db.add(coupon)
        db.commit()
        db.refresh(coupon)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't issue the coupon.") from exc

    audit_log(
        db, admin, "coupon.issue",
        target_type="coupon", target_id=coupon.id,
        details={"user_id": user.id, "code": coupon.code, "value": coupon.discount_value},
    )
    return _to_out(coupon, user)


@router.post("/bulk-issue")
def bulk_issue_coupons(
    payload: AdminBulkCouponRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # Normalize mobile numbers
    mobiles = [m.strip().replace(" ", "").replace("-", "").lstrip("+") for m in payload.mobile_numbers]
    mobiles = [m[2:] if m.startswith("91") and len(m) == 12 else m for m in mobiles]
    mobiles = list({m for m in mobiles if len(m) == 10 and m.isdigit()})

    if not mobiles:
        raise HTTPException(status_code=422, detail="No valid 10-digit mobile numbers in the list.")

    users = db.query(User).filter(User.mobile_number.in_(mobiles)).all()
    found_mobiles = {u.mobile_number for u in users}
    missing = [m for m in mobiles if m not in found_mobiles]

    issued = 0
    now = _now()
    for u in users:
        coupon = Coupon(
            user_id=u.id,
            code=_gen_code(payload.code_prefix),
            discount_value=payload.discount_value,
            discount_type=DiscountType(payload.discount_type),
            description=payload.description,
            expires_at=now + timedelta(days=payload.expires_in_days),
            is_used=False,
            applicable_store_id=payload.applicable_store_id,
        )
        db.add(coupon)
        issued += 1
    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't issue coupons in bulk.") from exc

    audit_log(
        db, admin, "coupon.bulk_issue",
        details={"issued": issued, "missing_mobiles": missing[:20]},
    )

    return {
        "issued": issued,
        "missing_mobiles": missing,
        "total_requested": len(mobiles),
    }
