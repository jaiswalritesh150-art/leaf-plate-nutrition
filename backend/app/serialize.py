from datetime import datetime, timedelta
from urllib.parse import quote

from . import timeutil
from .config import get_settings


def fmt_phone(p: str | None) -> str | None:
    return f"{p[:5]} {p[5:]}" if p else None


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def whatsapp_url(row: dict) -> str | None:
    s = get_settings()
    if not row["phone"]:
        return None
    local = timeutil.to_local(row["starts_at"])
    when = f"{local:%A, %d %b} at {local:%I:%M %p}".replace(" 0", " ")
    first = row["client_name"].split()[0]
    text = (
        f"Hi {first}, a reminder from {s.clinic_name}: your nutrition consultation is on {when}. "
        "Please reply YES to confirm you're coming, or tell us if you need to reschedule."
    )
    if s.client_app_url:
        text += f" You can also manage it here: {s.client_app_url.rstrip('/')}/appointments"
    return f"https://wa.me/{s.whatsapp_country_code}{row['phone']}?text={quote(text)}"


def appointment(row: dict, *, admin: bool = False) -> dict:
    now = timeutil.now()
    local = timeutil.to_local(row["starts_at"])
    cancelled = row["cancelled_at"] is not None
    upcoming = (not cancelled) and row["status"] == "Booked" and row["starts_at"] > now
    soon = upcoming and row["starts_at"] <= now + timedelta(hours=24)
    out = {
        "id": str(row["id"]),
        "client_name": row["client_name"],
        "phone": row["phone"],
        "phone_display": fmt_phone(row["phone"]),
        "date": local.date().isoformat(),
        "time": local.strftime("%H:%M"),
        "starts_at": local.isoformat(),
        "duration_minutes": row["duration_minutes"],
        "status": row["status"],
        "cancelled": cancelled,
        "is_upcoming": upcoming,
        "confirmed": row["confirmed_at"] is not None,
        "confirmed_at": iso(row["confirmed_at"]),
        "reminder_sent_at": iso(row["reminder_sent_at"]),
        "within_24h": soon,
        "needs_confirmation": soon and row["confirmed_at"] is None,
    }
    if admin:
        out["source"] = row["source"]
        out["whatsapp_url"] = whatsapp_url(row)
    return out
