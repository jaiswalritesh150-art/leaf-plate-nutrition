"""All SQL lives here. Slot conflicts are decided by PostgreSQL's partial unique index,
never by a read-then-write check, so two simultaneous requests cannot both win."""
from datetime import date, datetime, time, timedelta

from psycopg import errors as pg_errors

from . import timeutil
from .errors import ApiError

SLOT_INDEX = "appointments_one_active_per_slot"


def _slot_taken() -> ApiError:
    return ApiError(409, "slot_taken", "Sorry, that time was just booked by someone else. Please pick another time.")


def taken_starts(conn, start: datetime, end: datetime) -> set[datetime]:
    rows = conn.execute(
        "select starts_at from appointments where cancelled_at is null and starts_at >= %s and starts_at < %s",
        (start, end),
    ).fetchall()
    return {r["starts_at"] for r in rows}


def insert(conn, *, name: str, phone: str | None, starts_at: datetime, status: str, source: str) -> dict:
    try:
        return conn.execute(
            """insert into appointments (client_name, phone, starts_at, status, source)
               values (%s, %s, %s, %s, %s) returning *""",
            (name, phone, starts_at, status, source),
        ).fetchone()
    except pg_errors.UniqueViolation as e:
        if e.diag.constraint_name == SLOT_INDEX:
            raise _slot_taken()
        raise


def get(conn, appt_id: str) -> dict | None:
    try:
        return conn.execute("select * from appointments where id = %s", (appt_id,)).fetchone()
    except pg_errors.InvalidTextRepresentation:
        conn.rollback()
        return None


def list_for_phone(conn, phone: str) -> list[dict]:
    return conn.execute(
        "select * from appointments where phone = %s order by starts_at desc", (phone,)
    ).fetchall()


def cancel(conn, appt_id: str, phone: str | None, now: datetime, *, require_future: bool) -> dict | None:
    sql = """update appointments set cancelled_at = %s, updated_at = %s
             where id = %s and cancelled_at is null and status = 'Booked'"""
    params: list = [now, now, appt_id]
    if phone is not None:
        sql += " and phone = %s"
        params.append(phone)
    if require_future:
        sql += " and starts_at > %s"
        params.append(now)
    return conn.execute(sql + " returning *", params).fetchone()


def move(conn, appt_id: str, phone: str | None, new_start: datetime, now: datetime, *, require_future: bool) -> dict | None:
    """Reschedule = one atomic UPDATE. If the new slot is taken, the unique index rejects it
    and the original appointment is left untouched."""
    sql = """update appointments
             set starts_at = %s, confirmed_at = null, reminder_sent_at = null, updated_at = %s
             where id = %s and cancelled_at is null and status = 'Booked'"""
    params: list = [new_start, now, appt_id]
    if phone is not None:
        sql += " and phone = %s"
        params.append(phone)
    if require_future:
        sql += " and starts_at > %s"
        params.append(now)
    try:
        return conn.execute(sql + " returning *", params).fetchone()
    except pg_errors.UniqueViolation as e:
        if e.diag.constraint_name == SLOT_INDEX:
            conn.rollback()
            raise _slot_taken()
        raise


def confirm(conn, appt_id: str, phone: str, now: datetime) -> dict | None:
    return conn.execute(
        """update appointments set confirmed_at = coalesce(confirmed_at, %s), updated_at = %s
           where id = %s and phone = %s and cancelled_at is null and status = 'Booked' and starts_at > %s
           returning *""",
        (now, now, appt_id, phone, now),
    ).fetchone()


def set_status(conn, appt_id: str, status: str, now: datetime) -> dict | None:
    return conn.execute(
        "update appointments set status = %s, updated_at = %s where id = %s and cancelled_at is null returning *",
        (status, now, appt_id),
    ).fetchone()


def mark_reminder(conn, appt_id: str, now: datetime) -> dict | None:
    return conn.execute(
        """update appointments set reminder_sent_at = %s, updated_at = %s
           where id = %s and cancelled_at is null returning *""",
        (now, now, appt_id),
    ).fetchone()


def admin_list(conn, *, range_: str, status: str | None, q: str | None, include_cancelled: bool, now: datetime) -> list[dict]:
    where, params, order = [], [], "asc"
    if range_ == "today":
        start, end = timeutil.local_day_bounds(timeutil.today_local())
        where.append("starts_at >= %s and starts_at < %s")
        params += [start, end]
    elif range_ == "upcoming":
        where.append("starts_at >= %s")
        params.append(now)
    elif range_ == "past":
        where.append("starts_at < %s")
        params.append(now)
        order = "desc"
    else:
        order = "desc"
    if status:
        where.append("status = %s")
        params.append(status)
    if q:
        digits = "".join(ch for ch in q if ch.isdigit())
        if digits:
            where.append("(client_name ilike %s or phone like %s)")
            params += [f"%{q}%", f"%{digits}%"]
        else:
            where.append("client_name ilike %s")
            params.append(f"%{q}%")
    if not include_cancelled:
        where.append("cancelled_at is null")
    sql = "select * from appointments" + (" where " + " and ".join(where) if where else "")
    return conn.execute(f"{sql} order by starts_at {order}", params).fetchall()


def summary(conn, now: datetime) -> dict:
    t0, t1 = timeutil.local_day_bounds(timeutil.today_local())
    row = conn.execute(
        """select
             count(*) filter (where starts_at >= %(t0)s and starts_at < %(t1)s) as today_total,
             count(*) filter (where starts_at >= %(now)s and starts_at < %(t1)s and status = 'Booked') as today_remaining,
             count(*) filter (where starts_at >= %(now)s and status = 'Booked') as upcoming,
             count(*) filter (where starts_at >= %(now)s and starts_at < %(soon)s and status = 'Booked' and confirmed_at is null) as needs_confirmation,
             count(*) filter (where starts_at >= %(now)s and starts_at < %(soon)s and status = 'Booked' and reminder_sent_at is null and phone is not null) as reminders_due,
             count(*) filter (where status = 'Done') as done,
             count(*) filter (where status = 'No-show') as no_show
           from appointments where cancelled_at is null""",
        {"t0": t0, "t1": t1, "now": now, "soon": now + timedelta(hours=24)},
    ).fetchone()
    finished = row["done"] + row["no_show"]
    row["no_show_rate"] = round(100 * row["no_show"] / finished) if finished else None
    return row
