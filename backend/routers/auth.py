import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import OTPRecord, Tier, User
from schemas import (
    SendOTPRequest,
    SendOTPResponse,
    UserSummary,
    VerifyOTPRequest,
    VerifyOTPResponse,
)
from security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/send-otp", response_model=SendOTPResponse)
def send_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    mobile = payload.mobile_number

    user = db.query(User).filter(User.mobile_number == mobile).first()
    if user is None:
        user = User(
            name=f"Savo Shopper {mobile[-4:]}",
            mobile_number=mobile,
            points_balance=0,
            tier=Tier.BRONZE,
        )
        db.add(user)
        db.flush()

    otp_code = _generate_otp()
    expires_at = _now() + timedelta(seconds=settings.otp_expire_seconds)

    db.query(OTPRecord).filter(
        OTPRecord.mobile_number == mobile,
        OTPRecord.is_used == False,  # noqa: E712
    ).update({"is_used": True})

    record = OTPRecord(
        mobile_number=mobile,
        otp_code=otp_code,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(record)
    db.commit()

    print(f"\n[SAVOMART OTP] mobile=+91{mobile}  code={otp_code}  expires_in={settings.otp_expire_seconds}s\n", flush=True)

    return SendOTPResponse(
        message="OTP sent. Check your backend console (mock SMS).",
        expires_in=settings.otp_expire_seconds,
        dev_otp=otp_code,
    )


@router.post("/verify-otp", response_model=VerifyOTPResponse)
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    mobile = payload.mobile_number

    record = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.mobile_number == mobile,
            OTPRecord.otp_code == payload.otp,
            OTPRecord.is_used == False,  # noqa: E712
        )
        .order_by(OTPRecord.id.desc())
        .first()
    )

    if record is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    record.is_used = True

    user = db.query(User).filter(User.mobile_number == mobile).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return VerifyOTPResponse(
        access_token=token,
        token_type="bearer",
        user=UserSummary.model_validate(user),
    )
