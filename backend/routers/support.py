import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from excel_export import append_ticket_row
from models import SupportTicket, TicketSource, TicketStatus, User
from schemas import (
    SUPPORT_CATEGORIES,
    ChatRequest,
    ChatResponse,
    CreateTicketRequest,
    SupportInfoResponse,
    TicketCreatedResponse,
    TicketResponse,
)
from security import get_current_user

router = APIRouter(prefix="/api/support", tags=["support"])
log = logging.getLogger("savomart.support")

SUPPORT_PHONE = "1800-202-2026"
SUPPORT_EMAIL = "support@savomart.in"
SUPPORT_HOURS = "Mon–Sat · 9:00 AM – 7:00 PM IST"
RESPONSE_TIME_HOURS = 24


SAVO_SYSTEM_PROMPT = """You are Savo, Savomart's friendly in-app support assistant. Savomart is a grocery retail chain in India.

Your personality:
- Warm, helpful, slightly casual — like a knowledgeable store staff member, not a corporate bot
- Use Indian context naturally — say "rupees" not "dollars", reference Indian brands when relevant
- Keep responses short and conversational — max 2-3 sentences per message
- Never sound like you're reading from a script

What you know about Savomart:
- Loyalty tiers: Bronze (0–999 pts), Silver (1000–4999 pts), Gold (5000+ pts)
- 1 point = ₹0.25 redeemable in-store
- Points expire after 12 months of account inactivity
- Coupons cannot be combined with other offers
- Store hours: Mon–Sat 9am–9pm, Sun 10am–8pm
- Support email: support@savomart.in, Phone: 1800-202-2026 (toll free)
- App features: view points, browse offers, find nearest store, raise support tickets

Your job:
Conversationally collect these 4 things through natural chat — never ask all at once like a form:
1. Customer name (you may already know it from context)
2. Best contact — phone or email for follow-up
3. Issue category — one of: Points Issue, Coupon Problem, Store Complaint, Delivery Issue, App Feedback, Other
4. Clear description of the issue

Flow guidance:
- Start by acknowledging their issue warmly before asking anything
- Ask one question at a time
- If they mention their issue upfront, skip asking about it again — you already have it
- Use their name once you know it
- If their issue sounds like something you can answer (points balance query, tier question, store hours) — answer it first, then ask if they still need a ticket raised

Once you have all 4 pieces, end your message with exactly:
<ticket_ready>
{"name":"...","contact":"...","category":"...","description":"...","summary":"one sentence summary"}
</ticket_ready>

Never say:
- "As an AI language model..."
- "I don't have access to your account"
- "Please contact our support team" (you ARE the support)
"""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_public_id() -> str:
    return f"SAVO-{secrets.token_hex(2).upper()}"


def _export_ticket_to_excel(user: User, ticket: SupportTicket) -> None:
    append_ticket_row({
        "ticket_id": ticket.public_id,
        "timestamp": ticket.created_at,
        "user_id": user.id,
        "mobile": f"+91 {user.mobile_number}",
        "name": user.name,
        "category": ticket.category,
        "subject": ticket.subject,
        "description": ticket.description,
        "source": ticket.source.value if hasattr(ticket.source, "value") else str(ticket.source),
        "status": ticket.status.value if hasattr(ticket.status, "value") else str(ticket.status),
    })


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
    src = TicketSource.CHAT if payload.source == "chat" else TicketSource.FORM
    ticket = SupportTicket(
        public_id=_generate_public_id(),
        user_id=user.id,
        category=payload.category,
        subject=payload.subject,
        description=payload.description,
        status=TicketStatus.OPEN,
        source=src,
        chat_transcript=payload.chat_transcript,
        created_at=_now(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Excel append happens for every ticket (form or chat). The "Source"
    # column lets the support team filter chat-originated ones if needed.
    _export_ticket_to_excel(user, ticket)

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


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
):
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat assistant is not configured. Add GROQ_API_KEY to backend/.env to enable it.",
        )

    # Local import so the rest of the API still boots without groq being
    # configured (handy in dev / for evaluators who haven't set the key).
    from groq import Groq

    # Prepend the system prompt + a tiny user-context block so Savo can
    # greet the customer by name without re-asking.
    context_block = (
        f"\n\nCustomer context (already known — do not re-ask):\n"
        f"- Name: {user.name}\n"
        f"- Mobile: +91 {user.mobile_number}\n"
        f"- Tier: {user.tier.value if hasattr(user.tier, 'value') else user.tier}\n"
        f"- Points balance: {user.points_balance}"
    )
    system_prompt = SAVO_SYSTEM_PROMPT + context_block

    messages = [{"role": "system", "content": system_prompt}]
    for m in payload.messages:
        messages.append({"role": m.role, "content": m.content})

    try:
        client = Groq(api_key=settings.groq_api_key)
        completion = client.chat.completions.create(
            model=settings.ai_model,
            messages=messages,
            temperature=0.6,
            max_tokens=512,
        )
        content = completion.choices[0].message.content or ""
    except Exception as exc:
        log.warning("Groq call failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't reach the assistant right now. Please try again or use the form.",
        )

    return ChatResponse(role="assistant", content=content, model=settings.ai_model)
