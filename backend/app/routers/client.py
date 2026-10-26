from datetime import date, timedelta

from uuid import UUID

from fastapi import APIRouter, Query

from .. import repo, serialize, service, timeutil
from ..config import get_settings
from ..db import connection
from ..errors import ApiError
from ..schemas import ClientBooking, PhoneOnly, Reschedule, clean_phone, parse_date

router = APIRouter(prefix="/api")

NOT_FOUND = ApiError(404, "not_found", "We couldn't find that appointment for this phone number.")


@router.get("/health")
def health():
    with connection() as conn:
        conn.execute("select 1")
    return {"ok": True}


@router.get("/config")
def config():
    s = get_settings()
    return {
        "clinic_name": s.clinic_name,
        "timezone": s.clinic_timezone,
        "slot_minutes": s.slot_minutes,
        "booking_horizon_days": s.booking_horizon_days,
        "today": timeutil.today_local().isoformat(),
        "now": timeutil.local_now().isoformat(),
        "admin_protected": bool(s.admin_passcode),
    }


@router.get("/availability")
def availability(start: str | None = Query(None), days: int = Query(14, ge=1, le=31)):
    try:
        first = parse_date(start) if start else timeutil.today_local()
    except ValueError as e:
        raise ApiError(422, "validation_error", str(e), {"start": str(e)})
    lo, _ = timeutil.local_day_bounds(first)
    _, hi = timeutil.local_day_bounds(first + timedelta(days=days - 1))
    with connection() as conn:
        taken = repo.taken_starts(conn, lo, hi)
    return {"days": [service.day_view(first + timedelta(days=i), taken, for_client=True) for i in range(days)]}


@router.post("/appointments", status_code=201)
def book(body: ClientBooking):
    start = service.resolve_slot(body.date, body.time, for_client=True)
    with connection() as conn:
        row = repo.insert(conn, name=body.name, phone=body.phone, starts_at=start, status="Booked", source="client")
    return {"appointment": serialize.appointment(row)}


@router.get("/appointments")
def my_appointments(phone: str):
    try:
        p = clean_phone(phone)
    except ValueError as e:
        raise ApiError(422, "validation_error", str(e), {"phone": str(e)})
    with connection() as conn:
        rows = repo.list_for_phone(conn, p)
    items = [serialize.appointment(r) for r in rows]
    upcoming = sorted([i for i in items if i["is_upcoming"]], key=lambda i: i["starts_at"])
    past = [i for i in items if not i["is_upcoming"]]  # already newest first
    return {
        "name": rows[0]["client_name"] if rows else None,
        "phone": p,
        "next": upcoming[0] if upcoming else None,
        "upcoming": upcoming,
        "past": past,
    }


@router.post("/appointments/{appt_id}/cancel")
def cancel(appt_id: UUID, body: PhoneOnly):
    with connection() as conn:
        row = repo.cancel(conn, appt_id, body.phone, timeutil.now(), require_future=True)
        if row is None:
            _explain_failure(conn, appt_id, body.phone)
    return {"appointment": serialize.appointment(row)}


@router.post("/appointments/{appt_id}/reschedule")
def reschedule(appt_id: UUID, body: Reschedule):
    start = service.resolve_slot(body.date, body.time, for_client=True)
    with connection() as conn:
        row = repo.move(conn, appt_id, body.phone, start, timeutil.now(), require_future=True)
        if row is None:
            _explain_failure(conn, appt_id, body.phone)
    return {"appointment": serialize.appointment(row)}


@router.post("/appointments/{appt_id}/confirm")
def confirm(appt_id: UUID, body: PhoneOnly):
    with connection() as conn:
        row = repo.confirm(conn, appt_id, body.phone, timeutil.now())
        if row is None:
            _explain_failure(conn, appt_id, body.phone)
    return {"appointment": serialize.appointment(row)}


def _explain_failure(conn, appt_id: UUID, phone: str):
    """A guarded UPDATE matched nothing: say why, without leaking other people's data."""
    row = repo.get(conn, appt_id)
    if row is None or row["phone"] != phone:
        raise NOT_FOUND
    if row["cancelled_at"] is not None:
        raise ApiError(409, "already_cancelled", "This appointment was already cancelled.")
    raise ApiError(409, "not_changeable", "Only upcoming booked appointments can be changed.")
