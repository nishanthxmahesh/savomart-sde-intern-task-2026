from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from admin_security import get_current_admin
from audit import audit_log
from database import get_db
from models import (
    AdminRole,
    AdminUser,
    SupportTicket,
    TicketStatus,
    User,
)
from schemas import AdminTicketOut, AdminTicketUpdate

router = APIRouter(prefix="/api/admin/tickets", tags=["admin-tickets"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_out(t: SupportTicket) -> AdminTicketOut:
    return AdminTicketOut(
        id=t.id,
        public_id=t.public_id,
        user_id=t.user_id,
        customer_name=t.user.name if t.user else "—",
        customer_mobile=t.user.mobile_number if t.user else "—",
        customer_tier=t.user.tier.value if t.user else "Bronze",
        customer_points=t.user.points_balance if t.user else 0,
        category=t.category,
        subject=t.subject,
        description=t.description,
        status=t.status.value,
        source=t.source.value,
        chat_transcript=t.chat_transcript,
        assigned_to_admin_id=t.assigned_to_admin_id,
        assigned_to_admin_email=t.assigned_admin.email if t.assigned_admin else None,
        internal_notes=t.internal_notes,
        response_sent=t.response_sent,
        resolved_at=t.resolved_at,
        created_at=t.created_at,
    )


def _scope(query, admin: AdminUser):
    """Store manager only sees tickets assigned to them.
    Superadmin sees everything."""
    if admin.role == AdminRole.SUPERADMIN:
        return query
    return query.filter(SupportTicket.assigned_to_admin_id == admin.id)


@router.get("", response_model=list[AdminTicketOut])
def list_tickets(
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
    status_filter: Optional[str] = Query(default=None, alias="status", pattern="^(open|in-progress|resolved)$"),
    category: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = Query(default=200, ge=1, le=1000),
):
    q = (
        db.query(SupportTicket)
        .options(joinedload(SupportTicket.user), joinedload(SupportTicket.assigned_admin))
        .order_by(SupportTicket.created_at.desc())
    )
    q = _scope(q, admin)

    if status_filter:
        q = q.filter(SupportTicket.status == TicketStatus(status_filter))
    if category:
        q = q.filter(SupportTicket.category == category)
    if from_date:
        q = q.filter(SupportTicket.created_at >= from_date)
    if to_date:
        q = q.filter(SupportTicket.created_at <= to_date)

    return [_to_out(t) for t in q.limit(limit).all()]


@router.get("/{public_id}", response_model=AdminTicketOut)
def get_ticket(
    public_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    t = (
        db.query(SupportTicket)
        .options(joinedload(SupportTicket.user), joinedload(SupportTicket.assigned_admin))
        .filter(SupportTicket.public_id == public_id)
        .first()
    )
    if t is None:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if admin.role != AdminRole.SUPERADMIN and t.assigned_to_admin_id != admin.id:
        raise HTTPException(status_code=403, detail="You don't have access to this ticket.")
    return _to_out(t)


@router.patch("/{public_id}", response_model=AdminTicketOut)
def update_ticket(
    public_id: str,
    payload: AdminTicketUpdate,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    t = (
        db.query(SupportTicket)
        .options(joinedload(SupportTicket.user))
        .filter(SupportTicket.public_id == public_id)
        .first()
    )
    if t is None:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if admin.role != AdminRole.SUPERADMIN and t.assigned_to_admin_id != admin.id:
        raise HTTPException(status_code=403, detail="You don't have access to this ticket.")

    changes: dict = {}

    if payload.status is not None:
        new_status = TicketStatus(payload.status)
        if new_status != t.status:
            changes["status"] = {"from": t.status.value, "to": new_status.value}
            t.status = new_status
            t.resolved_at = _now() if new_status == TicketStatus.RESOLVED else None

    if payload.internal_notes is not None:
        if payload.internal_notes != (t.internal_notes or ""):
            changes["internal_notes_updated"] = True
            t.internal_notes = payload.internal_notes.strip() or None

    if payload.response_sent is not None:
        if payload.response_sent != (t.response_sent or ""):
            changes["response_sent_updated"] = True
            t.response_sent = payload.response_sent.strip() or None

    # Only superadmin can re-assign tickets
    if payload.assigned_to_admin_id is not None:
        if admin.role != AdminRole.SUPERADMIN:
            raise HTTPException(status_code=403, detail="Only superadmin can re-assign tickets.")
        if payload.assigned_to_admin_id != t.assigned_to_admin_id:
            target = db.query(AdminUser).filter(AdminUser.id == payload.assigned_to_admin_id).first()
            if target is None:
                raise HTTPException(status_code=404, detail="Target admin not found.")
            changes["assigned_to"] = {"from": t.assigned_to_admin_id, "to": payload.assigned_to_admin_id}
            t.assigned_to_admin_id = payload.assigned_to_admin_id

    try:
        db.commit()
        db.refresh(t)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Couldn't update the ticket.") from exc

    if changes:
        audit_log(
            db, admin, "ticket.update",
            target_type="ticket", target_id=t.public_id,
            details=changes,
        )

    # Reload with admin join for response
    t = (
        db.query(SupportTicket)
        .options(joinedload(SupportTicket.user), joinedload(SupportTicket.assigned_admin))
        .filter(SupportTicket.id == t.id)
        .first()
    )
    return _to_out(t)
