from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from admin_security import get_current_admin
from database import get_db
from models import AdminUser, Offer, PointsTransaction, SupportTicket, TicketStatus, User
from schemas import (
    AdminDashboardResponse,
    AdminDashboardSignup,
    AdminDashboardTicket,
)

router = APIRouter(prefix="/api/admin/dashboard", tags=["admin-dashboard"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=AdminDashboardResponse)
def admin_dashboard(
    _admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    now = _now()

    total_customers = db.query(func.count(User.id)).scalar() or 0
    total_points_issued = (
        db.query(func.coalesce(func.sum(PointsTransaction.delta), 0))
        .filter(PointsTransaction.delta > 0)
        .scalar()
        or 0
    )
    active_offers = (
        db.query(func.count(Offer.id))
        .filter(Offer.valid_until > now, Offer.valid_from <= now)
        .scalar()
        or 0
    )
    open_tickets = (
        db.query(func.count(SupportTicket.id))
        .filter(SupportTicket.status != TicketStatus.RESOLVED)
        .scalar()
        or 0
    )

    recent_signup_rows = (
        db.query(User).order_by(User.created_at.desc()).limit(8).all()
    )
    recent_signups = [
        AdminDashboardSignup(
            id=u.id,
            name=u.name,
            mobile_number=u.mobile_number,
            tier=u.tier.value,
            points_balance=u.points_balance,
            created_at=u.created_at,
        )
        for u in recent_signup_rows
    ]

    recent_ticket_rows = (
        db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(8).all()
    )
    recent_tickets = [
        AdminDashboardTicket(
            public_id=t.public_id,
            customer_name=t.user.name if t.user else "—",
            customer_mobile=t.user.mobile_number if t.user else "—",
            category=t.category,
            status=t.status.value,
            source=t.source.value,
            created_at=t.created_at,
        )
        for t in recent_ticket_rows
    ]

    return AdminDashboardResponse(
        total_customers=total_customers,
        total_points_issued=int(total_points_issued),
        active_offers=active_offers,
        open_tickets=open_tickets,
        recent_signups=recent_signups,
        recent_tickets=recent_tickets,
    )
