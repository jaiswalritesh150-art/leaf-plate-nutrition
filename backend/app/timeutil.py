"""All date/time logic lives here.

Rules: the database stores UTC instants (timestamptz). The API speaks in the clinic's local
date ("YYYY-MM-DD") and time ("HH:MM", 24h) so the browser's timezone never matters.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from .config import get_settings


def tz() -> ZoneInfo:
    return ZoneInfo(get_settings().clinic_timezone)


def now() -> datetime:
    """Current instant (aware, UTC). Tests monkeypatch this to freeze the clock."""
    return datetime.now(timezone.utc)


def local_now() -> datetime:
    return now().astimezone(tz())


def today_local() -> date:
    return local_now().date()


def to_utc(d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=tz()).astimezone(timezone.utc)


def local_day_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, time(0, 0), tzinfo=tz()).astimezone(timezone.utc)
    end = datetime.combine(d + timedelta(days=1), time(0, 0), tzinfo=tz()).astimezone(timezone.utc)
    return start, end


def parse_hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


def day_slot_times() -> list[time]:
    """All slot start times in a working day, e.g. 09:00, 09:30 ... 16:30."""
    s = get_settings()
    cur = datetime.combine(date(2000, 1, 1), parse_hhmm(s.day_start))
    end = datetime.combine(date(2000, 1, 1), parse_hhmm(s.day_end))
    step = timedelta(minutes=s.slot_minutes)
    out: list[time] = []
    while cur + step <= end:
        out.append(cur.time())
        cur += step
    return out


def is_on_grid(t: time) -> bool:
    return t in set(day_slot_times())


def is_working_day(d: date) -> bool:
    return d.weekday() in get_settings().working_day_set


def to_local(dt: datetime) -> datetime:
    return dt.astimezone(tz())
