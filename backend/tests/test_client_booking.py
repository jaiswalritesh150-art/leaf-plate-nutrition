from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import book


def test_client_can_book_available_slot(client):
    r = book(client)
    assert r.status_code == 201
    a = r.json()["appointment"]
    assert (a["date"], a["time"], a["status"], a["phone"]) == ("2026-10-26", "10:00", "Booked", "9876500001")
    assert a["starts_at"].endswith("+05:30")


def test_booked_slot_is_shown_as_unavailable(client):
    book(client)
    day = client.get("/api/availability?start=2026-10-26&days=1").json()["days"][0]
    slot = next(s for s in day["slots"] if s["time"] == "10:00")
    assert slot["available"] is False
    assert next(s for s in day["slots"] if s["time"] == "10:30")["available"] is True


@pytest.mark.parametrize(
    "over,field",
    [
        ({"name": ""}, "name"),
        ({"name": "A"}, "name"),
        ({"name": "R2D2"}, "name"),
        ({"phone": "12345"}, "phone"),
        ({"phone": "abcdefghij"}, "phone"),
        ({"phone": "5820011111"}, "phone"),  # Indian mobiles start 6-9
        ({"date": "26/10/2026"}, "date"),
        ({"date": "2026-02-31"}, "date"),
        ({"time": "25:00"}, "time"),
        ({"time": "10:15"}, "time"),   # not on the 30-minute grid
        ({"time": "08:00"}, "time"),   # before opening
        ({"time": "17:00"}, "time"),   # last slot ends at 17:00
    ],
)
def test_invalid_input_is_rejected(client, over, field):
    r = book(client, **over)
    assert r.status_code == 422
    assert field in r.json()["error"]["fields"]


def test_phone_formats_are_normalised(client):
    r = book(client, phone="+91 98765 00001")
    assert r.json()["appointment"]["phone"] == "9876500001"
    assert r.json()["appointment"]["phone_display"] == "98765 00001"


def test_cannot_book_in_the_past_or_too_soon(client, monkeypatch):
    from datetime import datetime, timezone
    from app import timeutil
    # Monday 26 Oct 2026, 12:00 IST (a working day)
    monkeypatch.setattr(timeutil, "now", lambda: datetime(2026, 10, 26, 6, 30, tzinfo=timezone.utc))
    assert book(client, date="2026-10-26", time="10:00").json()["error"]["code"] == "too_soon"   # earlier today
    assert book(client, date="2026-10-26", time="12:30").json()["error"]["code"] == "too_soon"   # < 60 min ahead
    assert book(client, date="2026-10-26", time="14:00").status_code == 201                      # fine
    assert book(client, date="2026-10-25", time="14:00", phone="9876500002").status_code == 422  # yesterday


def test_sunday_is_closed_even_though_it_is_today(client):
    assert book(client, date="2026-10-25", time="14:00").json()["error"]["code"] == "closed_day"


def test_malformed_appointment_id_is_a_clean_422(client):
    r = client.post("/api/appointments/not-a-uuid/cancel", json={"phone": "9876500001"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_closed_day_and_horizon(client):
    assert book(client, date="2026-11-01").json()["error"]["code"] == "closed_day"  # Sunday
    assert book(client, date="2026-12-31").json()["error"]["code"] == "too_far"


def test_unknown_fields_rejected(client):
    r = client.post("/api/appointments", json={"name": "Test", "phone": "9876500001", "date": "2026-10-26", "time": "10:00", "status": "Done"})
    assert r.status_code == 422


def test_duplicate_booking_is_rejected(client):
    assert book(client).status_code == 201
    r = book(client, name="Someone Else", phone="9876500002")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "slot_taken"


def test_concurrent_requests_cannot_double_book(client):
    """20 simultaneous requests for the same slot: PostgreSQL's unique index lets exactly one win."""
    def attempt(i: int):
        c = TestClient(app)  # separate client per thread
        return c.post("/api/appointments", json={"name": f"Racer {chr(65 + i)}", "phone": f"98765000{i:02d}", "date": "2026-10-27", "time": "11:00"}).status_code

    with ThreadPoolExecutor(max_workers=20) as pool:
        codes = list(pool.map(attempt, range(20)))
    assert codes.count(201) == 1, codes
    assert codes.count(409) == 19, codes
    rows = client.get("/api/admin/appointments?range=all").json()["appointments"]
    assert len([a for a in rows if a["date"] == "2026-10-27" and a["time"] == "11:00"]) == 1


def test_cancel_releases_slot(client):
    a = book(client).json()["appointment"]
    r = client.post(f"/api/appointments/{a['id']}/cancel", json={"phone": "9876500001"})
    assert r.status_code == 200 and r.json()["appointment"]["cancelled"] is True
    assert book(client, name="Next Person", phone="9876500002").status_code == 201  # slot is free again


def test_cancel_requires_matching_phone(client):
    a = book(client).json()["appointment"]
    r = client.post(f"/api/appointments/{a['id']}/cancel", json={"phone": "9999999999"})
    assert r.status_code == 404
    assert client.get("/api/availability?start=2026-10-26&days=1").json()["days"][0]["slots"][2]["available"] is False


def test_cannot_cancel_twice_or_a_past_appointment(client, seeded):
    a = book(client).json()["appointment"]
    client.post(f"/api/appointments/{a['id']}/cancel", json={"phone": "9876500001"})
    assert client.post(f"/api/appointments/{a['id']}/cancel", json={"phone": "9876500001"}).json()["error"]["code"] == "already_cancelled"
    past = client.get("/api/appointments?phone=9820011111").json()["past"][0]  # Riya, 24 Oct (already happened)
    assert client.post(f"/api/appointments/{past['id']}/cancel", json={"phone": "9820011111"}).status_code == 409


def test_reschedule_moves_and_frees_old_slot(client):
    a = book(client).json()["appointment"]
    r = client.post(f"/api/appointments/{a['id']}/reschedule", json={"phone": "9876500001", "date": "2026-10-28", "time": "15:30"})
    assert r.status_code == 200
    assert (r.json()["appointment"]["date"], r.json()["appointment"]["time"]) == ("2026-10-28", "15:30")
    assert book(client, name="Next Person", phone="9876500002").status_code == 201  # old 26 Oct 10:00 slot freed


def test_reschedule_to_taken_slot_conflicts_and_keeps_original(client):
    a = book(client).json()["appointment"]
    book(client, name="Other Person", phone="9876500002", time="11:00")
    r = client.post(f"/api/appointments/{a['id']}/reschedule", json={"phone": "9876500001", "date": "2026-10-26", "time": "11:00"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "slot_taken"
    mine = client.get("/api/appointments?phone=9876500001").json()
    assert mine["next"]["time"] == "10:00"  # unchanged


def test_reschedule_validates_new_slot(client):
    a = book(client).json()["appointment"]
    r = client.post(f"/api/appointments/{a['id']}/reschedule", json={"phone": "9876500001", "date": "2026-10-24", "time": "10:00"})
    assert r.status_code == 422


def test_confirm_attendance(client):
    a = book(client).json()["appointment"]
    assert a["confirmed"] is False
    r = client.post(f"/api/appointments/{a['id']}/confirm", json={"phone": "9876500001"})
    assert r.json()["appointment"]["confirmed"] is True
    # moving the appointment clears the confirmation: she must re-confirm the new time
    r = client.post(f"/api/appointments/{a['id']}/reschedule", json={"phone": "9876500001", "date": "2026-10-28", "time": "09:00"})
    assert r.json()["appointment"]["confirmed"] is False
