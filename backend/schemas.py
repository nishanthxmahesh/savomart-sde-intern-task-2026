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
