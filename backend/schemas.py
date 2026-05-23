from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------- Auth ----------

class SendOTPRequest(BaseModel):
    mobile_number: str = Field(..., min_length=10, max_length=15)

    @field_validator("mobile_number")
    @classmethod
    def clean_mobile(cls, v: str) -> str:
        v = v.strip().replace(" ", "").replace("-", "")
        if v.startswith("+91"):
            v = v[3:]
        if v.startswith("91") and len(v) == 12:
            v = v[2:]
        if not v.isdigit():
            raise ValueError("mobile_number must contain digits only")
        if len(v) != 10:
            raise ValueError("mobile_number must be 10 digits (Indian)")
        return v


class SendOTPResponse(BaseModel):
    message: str
    expires_in: int
    dev_otp: Optional[str] = None


class VerifyOTPRequest(BaseModel):
    mobile_number: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=6, max_length=6)

    @field_validator("mobile_number")
    @classmethod
    def clean_mobile(cls, v: str) -> str:
        v = v.strip().replace(" ", "").replace("-", "")
        if v.startswith("+91"):
            v = v[3:]
        if v.startswith("91") and len(v) == 12:
            v = v[2:]
        return v

    @field_validator("otp")
    @classmethod
    def otp_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("otp must be 6 digits")
        return v


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    mobile_number: str
    points_balance: int
    tier: str


class VerifyOTPResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary


# ---------- Profile ----------

class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    mobile_number: str
    points_balance: int
    tier: str
    member_since: datetime
    next_tier: Optional[str]
    points_to_next_tier: Optional[int]
    tier_progress_percent: int


class CouponResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    discount_value: int
    discount_type: str
    description: str
    expires_at: datetime
    applicable_store_id: Optional[str]
    days_remaining: int


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    delta: int
    description: str
    created_at: datetime


# ---------- Offers ----------

class OfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    discount_label: str
    category: str
    valid_from: datetime
    valid_until: datetime
    store_scope: str
    store_id: Optional[str]
    store_name: Optional[str]
    tier_required: Optional[str]
    days_remaining: int
    is_eligible: bool


class OffersListResponse(BaseModel):
    items: list[OfferResponse]
    total: int
    categories: list[str]
