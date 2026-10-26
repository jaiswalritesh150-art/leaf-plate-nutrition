"""Business rules shared by the client and dashboard routers."""
from datetime import date, datetime, time, timedelta

from . import timeutil
from .config import get_settings
from .errors import ApiError

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def resolve_slot(d_str: str, t_str: str, *, for_client: bool) -> datetime:
    """Validate a requested slot and return it as a UTC instant. Raises ApiError."""
    s = get_settings()
    d, t = date.fromisoformat(d_str), time.fromisoformat(t_str)
    if not timeutil.is_on_grid(t):
        raise ApiError(422, "invalid_time", "Please choose one of the available times.", {"time": "Not an available appointment time."})
    start = timeutil.to_utc(d, t)
    if for_client:
        if not timeutil.is_working_day(d):
            raise ApiError(422, "closed_day", "The practice is closed on that day. Please pick another date.", {"date": "Closed on this day."})
        now = timeutil.now()
        if start < now + timedelta(minutes=s.min_lead_minutes):
            raise ApiError(422, "too_soon", "That time has passed or is too soon to book. Please pick a later time.", {"time": "Pick a later time."})
        if d > timeutil.today_local() + timedelta(days=s.booking_horizon_days):
            raise ApiError(422, "too_far", f"You can book up to {s.booking_horizon_days} days ahead.", {"date": "Too far ahead."})
    return start


def day_view(d: date, taken: set[datetime], *, for_client: bool) -> dict:
    now = timeutil.now()
    s = get_settings()
    closed = for_client and not timeutil.is_working_day(d)
    slots = []
    for t in timeutil.day_slot_times():
        start = timeutil.to_utc(d, t)
        free = start not in taken
        if for_client and start < now + timedelta(minutes=s.min_lead_minutes):
            free = False
        if closed:
            free = False
        slots.append({"time": t.strftime("%H:%M"), "available": free})
    return {
        "date": d.isoformat(),
        "weekday": WEEKDAYS[d.weekday()],
        "closed": closed,
        "available_count": sum(1 for x in slots if x["available"]),
        "slots": slots,
    }
