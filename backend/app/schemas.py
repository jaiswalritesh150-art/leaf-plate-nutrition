import re
from datetime import date as date_type
from datetime import time as time_type
from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel

Status = Literal["Booked", "Done", "No-show"]


def clean_phone(raw: str) -> str:
    """Accepts '98200 11111', '+91 98200-11111', '09820011111' ... returns 10 digits."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number, e.g. 98200 11111.")
    return digits


def clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip())
    if len(name) < 2:
        raise ValueError("Please enter your full name (at least 2 characters).")
    if len(name) > 80:
        raise ValueError("Name is too long (80 characters max).")
    if not re.fullmatch(r"[^\W\d_][\w .'\-]*", name, flags=re.UNICODE) or re.search(r"\d", name):
        raise ValueError("Name can only contain letters, spaces, dots, apostrophes and hyphens.")
    return name


def parse_date(raw: str) -> date_type:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw or ""):
        raise ValueError("Use the date format YYYY-MM-DD.")
    try:
        return date_type.fromisoformat(raw)
    except ValueError:
        raise ValueError("That date does not exist.")


def parse_time(raw: str) -> time_type:
    if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", raw or ""):
        raise ValueError("Use the 24-hour time format HH:MM.")
    return time_type.fromisoformat(raw)


def _date_str(v: str) -> str:
    parse_date(v)
    return v


def _time_str(v: str) -> str:
    parse_time(v)
    return v


def _optional_phone(v: Optional[str]) -> Optional[str]:
    return clean_phone(v) if v not in (None, "") else None


Name = Annotated[str, AfterValidator(clean_name)]
Phone = Annotated[str, AfterValidator(clean_phone)]
DateStr = Annotated[str, AfterValidator(_date_str)]
TimeStr = Annotated[str, AfterValidator(_time_str)]
OptionalPhone = Annotated[Optional[str], AfterValidator(_optional_phone)]


class _Base(BaseModel):
    model_config = {"str_strip_whitespace": True, "extra": "forbid"}


class ClientBooking(_Base):
    name: Name
    phone: Phone
    date: DateStr
    time: TimeStr


class PhoneOnly(_Base):
    phone: Phone


class Reschedule(_Base):
    phone: Phone
    date: DateStr
    time: TimeStr


class AdminCreate(_Base):
    name: Name
    phone: OptionalPhone = None
    date: DateStr
    time: TimeStr
    status: Status = "Booked"


class AdminPatch(_Base):
    status: Optional[Status] = None
    date: Optional[DateStr] = None
    time: Optional[TimeStr] = None
