from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, aliased

from admin_security import get_current_admin
from audit import audit_log
from database import get_db
from models import AdminUser, PointsSource, PointsTransaction, Tier, User
from schemas import (
    AdminPointsAdjustRequest,
    AdminPointsBulkRequest,
    AdminPointsLedgerEntry,
)
from loyalty import tier_for_balance

router = APIRouter(prefix="/api/admin/points", tags=["admin-points"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _apply_adjustment(
    db: Session, admin: AdminUser, user: User, delta: int, reason: str
) -> PointsTransaction:
    new_balance = user.points_balance + delta
    if new_balance < 0:
        raise HTTPException(
            status_code=422,
            detail=f"Adjustment would leave {user.name} at {new_balance} points (below zero).",
        )
    user.points_balance = new_balance
    user.tier = tier_for_balance(new_balance)

    sign = "+" if delta > 0 else "-"
    desc = f"{sign}{abs(delta)} pts (admin) — {reason}"
    txn = PointsTransaction(
        user_id=user.id,
        delta=delta,
        description=desc,
        source=PointsSource.ADMIN_ADJUSTMENT,
        admin_id=admin.id,
    )
    db.add(txn)
    return txn


@router.post("/adjust", response_model=AdminPointsLedgerEntry)
def adjust_points(
    payload: AdminPointsAdjustRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Customer not found.")

    txn = _apply_adjustment(db, admin, user, payload.delta, payload.reason)
    try:
        db.commit()
        db.refresh(txn)
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't apply the adjustment.") from exc

    audit_log(
        db, admin, "points.adjust",
        target_type="user", target_id=user.id,
        details={"delta": payload.delta, "reason": payload.reason, "new_balance": user.points_balance},
    )

    return AdminPointsLedgerEntry(
        id=txn.id,
        user_id=user.id,
        customer_name=user.name,
        customer_mobile=user.mobile_number,
        delta=txn.delta,
        description=txn.description,
        source=txn.source.value,
        admin_email=admin.email,
        created_at=txn.created_at,
    )


@router.post("/bulk")
def bulk_adjust(
    payload: AdminPointsBulkRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    applied = 0
    failed: list[dict] = []
    for entry in payload.entries:
        mobile = entry.mobile_number.strip().replace(" ", "").replace("-", "").lstrip("+")
        if mobile.startswith("91") and len(mobile) == 12:
            mobile = mobile[2:]
        user = db.query(User).filter(User.mobile_number == mobile).first()
        if user is None:
            failed.append({"mobile": entry.mobile_number, "error": "not found"})
            continue
        if entry.delta == 0:
            failed.append({"mobile": entry.mobile_number, "error": "delta=0"})
            continue
        if user.points_balance + entry.delta < 0:
            failed.append({"mobile": entry.mobile_number, "error": "would go below zero"})
            continue
        _apply_adjustment(db, admin, user, entry.delta, entry.reason)
        applied += 1

    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't apply bulk adjustments.") from exc

    audit_log(
        db, admin, "points.bulk_adjust",
        details={"applied": applied, "failed_count": len(failed), "first_failures": failed[:10]},
    )
    return {"applied": applied, "failed": failed, "total": len(payload.entries)}


@router.get("/ledger", response_model=list[AdminPointsLedgerEntry])
def list_ledger(
    _admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
    user_id: Optional[int] = None,
    source: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
):
    AdminAlias = aliased(AdminUser)
    q = (
        db.query(PointsTransaction, User, AdminAlias)
        .join(User, PointsTransaction.user_id == User.id)
        .outerjoin(AdminAlias, PointsTransaction.admin_id == AdminAlias.id)
        .order_by(PointsTransaction.created_at.desc())
    )
    if user_id is not None:
        q = q.filter(PointsTransaction.user_id == user_id)
    if source:
        try:
            q = q.filter(PointsTransaction.source == PointsSource(source))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid source.")
    rows = q.limit(limit).all()
    return [
        AdminPointsLedgerEntry(
            id=t.id,
            user_id=u.id,
            customer_name=u.name,
            customer_mobile=u.mobile_number,
            delta=t.delta,
            description=t.description,
            source=t.source.value,
            admin_email=a.email if a else None,
            created_at=t.created_at,
        )
        for (t, u, a) in rows
    ]
