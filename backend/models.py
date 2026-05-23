import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Tier(str, enum.Enum):
    BRONZE = "Bronze"
    SILVER = "Silver"
    GOLD = "Gold"


class DiscountType(str, enum.Enum):
    PERCENT = "percent"
    FLAT = "flat"


class StoreScope(str, enum.Enum):
    ALL = "all"
    SPECIFIC = "specific"


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in-progress"
    RESOLVED = "resolved"


class TicketSource(str, enum.Enum):
    FORM = "form"
    CHAT = "chat"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    mobile_number = Column(String(20), unique=True, nullable=False, index=True)
    points_balance = Column(Integer, nullable=False, default=0)
    tier = Column(Enum(Tier), nullable=False, default=Tier.BRONZE)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    transactions = relationship("PointsTransaction", back_populates="user", cascade="all, delete-orphan")
    coupons = relationship("Coupon", back_populates="user", cascade="all, delete-orphan")
    tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")


class OTPRecord(Base):
    __tablename__ = "otp_records"

    id = Column(Integer, primary_key=True, index=True)
    mobile_number = Column(String(20), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class PointsTransaction(Base):
    __tablename__ = "points_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    delta = Column(Integer, nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="transactions")


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    code = Column(String(40), nullable=False)
    discount_value = Column(Integer, nullable=False)
    discount_type = Column(Enum(DiscountType), nullable=False, default=DiscountType.PERCENT)
    description = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    applicable_store_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="coupons")


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)
    discount_label = Column(String(40), nullable=False)
    category = Column(String(60), nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    store_scope = Column(Enum(StoreScope), nullable=False, default=StoreScope.ALL)
    store_id = Column(String(64), nullable=True)
    store_name = Column(String(120), nullable=True)
    tier_required = Column(Enum(Tier), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(32), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(60), nullable=False)
    subject = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(TicketStatus), nullable=False, default=TicketStatus.OPEN)
    source = Column(Enum(TicketSource), nullable=False, default=TicketSource.FORM)
    chat_transcript = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    user = relationship("User", back_populates="tickets")
