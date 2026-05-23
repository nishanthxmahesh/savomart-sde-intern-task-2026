import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import SupportTicket, TicketSource, TicketStatus, User
from schemas import (
    SUPPORT_CATEGORIES,
    CreateTicketRequest,
    SupportInfoResponse,
    TicketCreatedResponse,
    TicketResponse,
)
from security import get_current_user

router = APIRouter(prefix="/api/support", tags=["support"])

SUPPORT_PHONE = "1800-202-2026"
SUPPORT_EMAIL = "support@savomart.in"
SUPPORT_HOURS = "Mon–Sat · 9:00 AM – 7:00 PM IST"
RESPONSE_TIME_HOURS = 24


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_public_id() -> str:
    # SAVO-XXXX where XXXX is 4 hex chars uppercase. ~65k space —
    # collisions are technically possible but extraordinarily rare for a
    # take-home demo, and the column is unique-indexed (would 500 on a
    # collision rather than silently mismatch).
    return f"SAVO-{secrets.token_hex(2).upper()}"


@router.get("/info", response_model=SupportInfoResponse)
def get_support_info():
    return SupportInfoResponse(
        phone=SUPPORT_PHONE,
        email=SUPPORT_EMAIL,
        hours=SUPPORT_HOURS,
        response_time_hours=RESPONSE_TIME_HOURS,
        categories=SUPPORT_CATEGORIES,
    )


@router.post("/ticket", response_model=TicketCreatedResponse)
def create_ticket(
    payload: CreateTicketRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = SupportTicket(
        public_id=_generate_public_id(),
        user_id=user.id,
        category=payload.category,
        subject=payload.subject,
        description=payload.description,
        status=TicketStatus.OPEN,
        source=TicketSource.FORM,
        created_at=_now(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return TicketCreatedResponse(
        ticket=TicketResponse(
            public_id=ticket.public_id,
            category=ticket.category,
            subject=ticket.subject,
            description=ticket.description,
            status=ticket.status.value,
            source=ticket.source.value,
            created_at=ticket.created_at,
        ),
        message=f"We've got it, {user.name.split()[0]}. Our team will reach out within {RESPONSE_TIME_HOURS} hours.",
        response_time_hours=RESPONSE_TIME_HOURS,
    )


@router.get("/my-tickets", response_model=list[TicketResponse])
def list_my_tickets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [
        TicketResponse(
            public_id=t.public_id,
            category=t.category,
            subject=t.subject,
            description=t.description,
            status=t.status.value,
            source=t.source.value,
            created_at=t.created_at,
        )
        for t in tickets
    ]
