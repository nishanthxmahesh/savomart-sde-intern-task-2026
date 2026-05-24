from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------- Auth (Firebase Phone) ----------


def _clean_mobile_value(v: str) -> str:
    """Normalize an Indian mobile to 10 bare digits (no +91, no spaces)."""
    v = (v or "").strip().replace(" ", "").replace("-", "")
    if v.startswith("+91"):
        v = v[3:]
    if v.startswith("91") and len(v) == 12:
        v = v[2:]
    return v


class VerifyFirebaseTokenRequest(BaseModel):
    firebase_token: str = Field(..., min_length=20, max_length=4096)
    mobile_number: str = Field(..., min_length=10, max_length=15)

    @field_validator("mobile_number")
    @classmethod
    def clean_mobile(cls, v: str) -> str:
        cleaned = _clean_mobile_value(v)
        if not cleaned.isdigit():
            raise ValueError("mobile_number must contain digits only")
        if len(cleaned) != 10:
            raise ValueError("mobile_number must be 10 digits (Indian)")
        return cleaned


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    mobile_number: str
    points_balance: int
    tier: str


class VerifyFirebaseTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: UserSummary


class NotEnrolledResponse(BaseModel):
    enrolled: bool = False
    message: str


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


# ============================================================
# ADMIN
# ============================================================

class AdminLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=160)
    password: str = Field(..., min_length=1, max_length=200)


class AdminSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: str
    store_id: Optional[str]


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int
    admin: AdminSummary


# --- Dashboard ---

class AdminDashboardSignup(BaseModel):
    id: int
    name: str
    mobile_number: str
    tier: str
    created_at: datetime
    points_balance: int


class AdminDashboardTicket(BaseModel):
    public_id: str
    customer_name: str
    customer_mobile: str
    category: str
    status: str
    source: str
    created_at: datetime


class AdminDashboardResponse(BaseModel):
    total_customers: int
    total_points_issued: int
    active_offers: int
    open_tickets: int
    recent_signups: list[AdminDashboardSignup]
    recent_tickets: list[AdminDashboardTicket]


# --- Offers (admin) ---

class AdminOfferIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=160)
    description: str = Field(..., min_length=3, max_length=2000)
    discount_label: str = Field(..., min_length=1, max_length=40)
    category: str = Field(..., min_length=1, max_length=60)
    valid_from: datetime
    valid_until: datetime
    store_scope: str = Field(..., pattern="^(all|specific)$")
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    tier_required: Optional[str] = Field(default=None, pattern="^(Bronze|Silver|Gold)$")

    @field_validator("title", "description", "discount_label", "category")
    @classmethod
    def trim(cls, v: str) -> str:
        return v.strip()


class AdminOfferOut(BaseModel):
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
    created_at: datetime


# --- Coupons (admin) ---

class AdminIssueCouponRequest(BaseModel):
    user_id: int
    code: Optional[str] = Field(default=None, max_length=40)
    discount_value: int = Field(..., ge=1, le=10000)
    discount_type: str = Field(..., pattern="^(percent|flat)$")
    description: str = Field(..., min_length=3, max_length=255)
    expires_in_days: int = Field(default=30, ge=1, le=365)
    applicable_store_id: Optional[str] = None


class AdminBulkCouponRequest(BaseModel):
    mobile_numbers: list[str] = Field(..., min_length=1, max_length=1000)
    code_prefix: str = Field(default="BULK", max_length=20)
    discount_value: int = Field(..., ge=1, le=10000)
    discount_type: str = Field(..., pattern="^(percent|flat)$")
    description: str = Field(..., min_length=3, max_length=255)
    expires_in_days: int = Field(default=30, ge=1, le=365)
    applicable_store_id: Optional[str] = None


class AdminCouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    customer_name: str
    customer_mobile: str
    code: str
    discount_value: int
    discount_type: str
    description: str
    expires_at: datetime
    is_used: bool
    applicable_store_id: Optional[str]
    created_at: datetime


# --- Points (admin) ---

class AdminPointsAdjustRequest(BaseModel):
    user_id: int
    delta: int = Field(..., description="Positive to add, negative to deduct")
    reason: str = Field(..., min_length=5, max_length=255)

    @field_validator("delta")
    @classmethod
    def nonzero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("delta must be non-zero")
        return v


class AdminPointsBulkEntry(BaseModel):
    mobile_number: str = Field(..., min_length=10, max_length=15)
    delta: int
    reason: str = Field(..., min_length=5, max_length=255)


class AdminPointsBulkRequest(BaseModel):
    entries: list[AdminPointsBulkEntry] = Field(..., min_length=1, max_length=500)


class AdminPointsLedgerEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    customer_name: str
    customer_mobile: str
    delta: int
    description: str
    source: str
    admin_email: Optional[str]
    created_at: datetime


# --- Tickets (admin) ---

class AdminTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    public_id: str
    user_id: int
    customer_name: str
    customer_mobile: str
    customer_tier: str
    customer_points: int
    category: str
    subject: str
    description: str
    status: str
    source: str
    chat_transcript: Optional[str]
    assigned_to_admin_id: Optional[int]
    assigned_to_admin_email: Optional[str]
    internal_notes: Optional[str]
    response_sent: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime


class AdminTicketUpdate(BaseModel):
    status: Optional[str] = Field(default=None, pattern="^(open|in-progress|resolved)$")
    internal_notes: Optional[str] = Field(default=None, max_length=4000)
    response_sent: Optional[str] = Field(default=None, max_length=4000)
    assigned_to_admin_id: Optional[int] = None


# --- Users (admin) ---

class AdminCreateCustomerRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    mobile_number: str = Field(..., min_length=10, max_length=15)
    initial_points: int = Field(default=0, ge=0, le=100000)
    tier: Optional[str] = Field(default=None, pattern="^(Bronze|Silver|Gold)$")

    @field_validator("mobile_number")
    @classmethod
    def clean(cls, v: str) -> str:
        cleaned = _clean_mobile_value(v)
        if not cleaned.isdigit():
            raise ValueError("mobile_number must contain digits only")
        if len(cleaned) != 10:
            raise ValueError("mobile_number must be 10 digits (Indian)")
        return cleaned

    @field_validator("name")
    @classmethod
    def trim_name(cls, v: str) -> str:
        return v.strip()


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    mobile_number: str
    points_balance: int
    tier: str
    is_active: bool
    created_at: datetime


class AdminUserDetail(AdminUserOut):
    transactions: list[TransactionResponse]
    coupons: list[CouponResponse]
    tickets: list[AdminTicketOut]


class AdminUserTierChange(BaseModel):
    tier: str = Field(..., pattern="^(Bronze|Silver|Gold)$")
    reason: str = Field(..., min_length=5, max_length=255)


# --- Analytics ---

class AnalyticsBar(BaseModel):
    label: str
    value: int


class AnalyticsTimeseriesPoint(BaseModel):
    date: str  # YYYY-MM-DD
    value: int


class AdminAnalyticsResponse(BaseModel):
    points_issued_vs_redeemed: list[AnalyticsBar]  # 2 entries
    tier_distribution: list[AnalyticsBar]          # 3 entries
    top_offer_categories: list[AnalyticsBar]
    ticket_volume_by_category: list[AnalyticsBar]
    signups_last_30_days: list[AnalyticsTimeseriesPoint]


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
