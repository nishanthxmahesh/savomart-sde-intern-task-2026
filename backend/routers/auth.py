"""Customer auth — Firebase Phone Authentication.

Firebase handles the OTP delivery + verification on the client. The client
hands us the resulting ID token; we verify it server-side, confirm the
phone number it certifies matches the mobile the client claims, then
issue our own application JWT.

Only registered Savomart customers can log in. A Firebase-verified
mobile that isn't in our `users` table gets a clear enrollment message —
admins create new accounts via the admin panel.
"""
import logging
from datetime import datetime, timezone

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from firebase_admin import auth as firebase_auth
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import firebase_init  # noqa: F401 — side-effect: initialize on import
from database import get_db
from models import User
from schemas import (
    UserSummary,
    VerifyFirebaseTokenRequest,
    VerifyFirebaseTokenResponse,
)
from security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("savomart.auth")


def _firebase_ready() -> bool:
    return bool(firebase_admin._apps)


def _normalize_phone(claim: str) -> str:
    """Pull a 10-digit Indian mobile out of whatever Firebase returns
    in the `phone_number` claim (e.g. '+919999999999')."""
    v = (claim or "").strip()
    if v.startswith("+91"):
        v = v[3:]
    if v.startswith("91") and len(v) == 12:
        v = v[2:]
    return v


@router.post(
    "/verify-firebase-token",
    response_model=VerifyFirebaseTokenResponse,
    responses={
        401: {"description": "Invalid Firebase token or mobile mismatch"},
        403: {"description": "Customer not enrolled or account deactivated"},
        503: {"description": "Firebase admin not configured on this server"},
    },
)
def verify_firebase_token(payload: VerifyFirebaseTokenRequest, db: Session = Depends(get_db)):
    if not _firebase_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Customer login is not configured on this server. "
                "Set FIREBASE_SERVICE_ACCOUNT_JSON and restart."
            ),
        )

    # 1. Verify the Firebase ID token signature + expiry
    try:
        decoded = firebase_auth.verify_id_token(payload.firebase_token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your verification expired. Please request a new OTP.",
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This sign-in was revoked. Please sign in again.",
        )
    except (
        firebase_auth.InvalidIdTokenError,
        firebase_auth.CertificateFetchError,
        ValueError,
    ) as exc:
        log.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification token.",
        )

    # 2. Confirm the phone the Firebase token certifies matches the one
    #    the client claims. Without this an attacker who steals a Firebase
    #    token from another mobile could try to log in as someone else.
    fb_phone = _normalize_phone(decoded.get("phone_number", ""))
    if not fb_phone or fb_phone != payload.mobile_number:
        log.warning(
            "Firebase token mobile mismatch: token=%s claimed=%s",
            fb_phone, payload.mobile_number,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not match the mobile number you entered.",
        )

    # 3. Look up the customer. Only enrolled (in DB) + active customers can
    #    log in — anyone else gets the friendly "visit any store" message.
    user = db.query(User).filter(User.mobile_number == payload.mobile_number).first()
    if user is None:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "enrolled": False,
                "message": (
                    "This mobile is not registered with Savomart. "
                    "Visit any store to enroll."
                ),
            },
        )
    if not user.is_active:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "enrolled": True,
                "message": "This account is deactivated. Please reach out to support.",
            },
        )

    # 4. Record the login + issue our application JWT
    user.last_login_at = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        log.exception("verify_firebase_token DB write failed: %s", exc)
        # Non-fatal — we can still hand back a token even if last_login update fails.

    token = create_access_token(user.id)
    return VerifyFirebaseTokenResponse(
        access_token=token,
        token_type="bearer",
        customer=UserSummary.model_validate(user),
    )
