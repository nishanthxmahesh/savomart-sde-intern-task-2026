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


# ---------- Stores ----------

class StoreResponse(BaseModel):
    id: str
    name: str
    address: str
    area: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    phone: Optional[str] = None
    hours: Optional[str] = None
    is_operational: bool = True


class StoresListResponse(BaseModel):
    items: list[StoreResponse]
    total: int
    source: str  # "live" | "fallback"
    fetched_at: datetime


# ---------- Support ----------

SUPPORT_CATEGORIES = [
    "Points Issue",
    "Coupon Problem",
    "Store Complaint",
    "Delivery Issue",
    "App Feedback",
    "Other",
]


class SupportInfoResponse(BaseModel):
    phone: str
    email: str
    hours: str
    response_time_hours: int
    categories: list[str]


class CreateTicketRequest(BaseModel):
    category: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=20, max_length=4000)
    source: Optional[str] = Field(default="form", pattern="^(form|chat)$")
    chat_transcript: Optional[str] = Field(default=None, max_length=20000)

    @field_validator("category")
    @classmethod
    def category_in_list(cls, v: str) -> str:
        v = v.strip()
        if v not in SUPPORT_CATEGORIES:
            raise ValueError(f"category must be one of {SUPPORT_CATEGORIES}")
        return v

    @field_validator("subject", "description")
    @classmethod
    def trim(cls, v: str) -> str:
        return v.strip()


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=40)


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    model: str


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    category: str
    subject: str
    description: str
    status: str
    source: str
    created_at: datetime


class TicketCreatedResponse(BaseModel):
    ticket: TicketResponse
    message: str
    response_time_hours: int
