import secrets
from datetime import date, timedelta
from typing import Literal, Optional

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from .. import repo, serialize, service, timeutil
from ..config import get_settings
from ..db import connection
from ..errors import ApiError
from ..schemas import AdminCreate, AdminPatch, parse_date


def require_admin(x_admin_passcode: Optional[str] = Header(default=None)):
    """Optional shared passcode. If ADMIN_PASSCODE is unset the dashboard is open (demo mode)."""
    expected = get_settings().admin_passcode
    if expected and not secrets.compare_digest(x_admin_passcode or "", expected):
        raise ApiError(401, "unauthorized", "Enter the dashboard passcode to continue.")


router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])

NOT_FOUND = ApiError(404, "not_found", "Appointment not found (it may have been cancelled).")


@router.get("/session")
def session():
    return {"ok": True}


@router.get("/appointments")
def list_appointments(
    range: Literal["today", "upcoming", "past", "all"] = "all",
    status: Optional[Literal["Booked", "Done", "No-show"]] = None,
    q: Optional[str] = Query(None, max_length=80),
    include_cancelled: bool = False,
):
    with connection() as conn:
        rows = repo.admin_list(
            conn, range_=range, status=status, q=(q or "").strip() or None,
            include_cancelled=include_cancelled, now=timeutil.now(),
        )
    return {"appointments": [serialize.appointment(r, admin=True) for r in rows]}


@router.get("/summary")
def summary():
    with connection() as conn:
        return repo.summary(conn, timeutil.now())


@router.get("/availability")
def availability(date: str):
    """Which slots are taken on a given day. Admin view ignores opening days and lead time."""
    try:
        d = parse_date(date)
    except ValueError as e:
        raise ApiError(422, "validation_error", str(e), {"date": str(e)})
    lo, hi = timeutil.local_day_bounds(d)
    with connection() as conn:
        taken = repo.taken_starts(conn, lo, hi)
    return service.day_view(d, taken, for_client=False)


@router.post("/appointments", status_code=201)
def create(body: AdminCreate):
    start = service.resolve_slot(body.date, body.time, for_client=False)
    with connection() as conn:
        row = repo.insert(conn, name=body.name, phone=body.phone, starts_at=start, status=body.status, source="dashboard")
    return {"appointment": serialize.appointment(row, admin=True)}


@router.patch("/appointments/{appt_id}")
def update(appt_id: UUID, body: AdminPatch):
    if body.status is None and body.date is None and body.time is None:
        raise ApiError(422, "validation_error", "Nothing to update.", {"status": "Provide a status or a new date and time."})
    if (body.date is None) != (body.time is None):
        raise ApiError(422, "validation_error", "Provide both date and time to reschedule.", {"date": "Provide both date and time."})
    now = timeutil.now()
    with connection() as conn:
        row = repo.get(conn, appt_id)
        if row is None or row["cancelled_at"] is not None:
            raise NOT_FOUND
        if body.date and body.time:
            start = service.resolve_slot(body.date, body.time, for_client=False)
            if start != row["starts_at"]:
                if row["status"] != "Booked":
                    raise ApiError(409, "not_changeable", "Only Booked appointments can be moved.")
                row = repo.move(conn, appt_id, None, start, now, require_future=False)
        if body.status:
            row = repo.set_status(conn, appt_id, body.status, now)
    return {"appointment": serialize.appointment(row, admin=True)}


@router.post("/appointments/{appt_id}/cancel")
def cancel(appt_id: UUID):
    with connection() as conn:
        row = repo.cancel(conn, appt_id, None, timeutil.now(), require_future=False)
        if row is None:
            raise NOT_FOUND
    return {"appointment": serialize.appointment(row, admin=True)}


@router.post("/appointments/{appt_id}/reminder-sent")
def reminder_sent(appt_id: UUID):
    with connection() as conn:
        row = repo.mark_reminder(conn, appt_id, timeutil.now())
        if row is None:
            raise NOT_FOUND
    return {"appointment": serialize.appointment(row, admin=True)}
