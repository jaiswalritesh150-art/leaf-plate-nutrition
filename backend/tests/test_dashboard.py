import pytest

from tests.conftest import book


def rows(client, **params):
    q = "&".join(f"{k}={v}" for k, v in params.items())
    return client.get(f"/api/admin/appointments?{q}").json()["appointments"]


def test_sample_data_is_correct(client, seeded):
    got = {(a["client_name"], a["phone"], a["date"], a["time"], a["status"]) for a in rows(client, range="all")}
    assert got == {
        ("Riya Shah", "9820011111", "2026-10-24", "10:00", "Booked"),
        ("Arjun Mehta", "9820022222", "2026-10-24", "11:30", "Booked"),
        ("Riya Shah", "9820011111", "2026-10-25", "16:00", "Booked"),
        ("Meera Iyer", None, "2026-10-23", "09:00", "Done"),   # missing phone stays missing
        ("Kabir Rao", "9820033333", "2026-10-22", "14:00", "No-show"),
    }


def test_seed_is_idempotent(client, seeded):
    import psycopg
    from tests.conftest import ROOT, TEST_DB
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute((ROOT / "database" / "seed.sql").read_text())
        conn.execute((ROOT / "database" / "seed.sql").read_text())
    assert len(rows(client, range="all")) == 5


def test_today_filter_uses_clinic_timezone(client, seeded):
    today = rows(client, range="today")
    assert [(a["client_name"], a["time"]) for a in today] == [("Riya Shah", "16:00")]
    # 24 Oct late evening IST is still 24 Oct, even though it is 25 Oct in some other timezones
    client.post("/api/admin/appointments", json={"name": "Late Tester", "date": "2026-10-24", "time": "16:30"})
    assert all(a["date"] == "2026-10-25" for a in rows(client, range="today"))


def test_today_filter_catches_early_morning_ist(client):
    # 09:00 IST on 25 Oct = 03:30 UTC (still 25 Oct). 09:00 IST on 26 Oct must not appear in today.
    client.post("/api/admin/appointments", json={"name": "Early Bird", "date": "2026-10-25", "time": "09:00"})
    client.post("/api/admin/appointments", json={"name": "Tomorrow Person", "date": "2026-10-26", "time": "09:00"})
    assert [a["client_name"] for a in rows(client, range="today")] == ["Early Bird"]


def test_status_update_all_three_values(client, seeded):
    target = rows(client, range="today")[0]
    for status in ("Done", "No-show", "Booked"):
        r = client.patch(f"/api/admin/appointments/{target['id']}", json={"status": status})
        assert r.status_code == 200 and r.json()["appointment"]["status"] == status


def test_invalid_status_rejected(client, seeded):
    target = rows(client, range="today")[0]
    assert client.patch(f"/api/admin/appointments/{target['id']}", json={"status": "Cancelled"}).status_code == 422
    assert client.patch(f"/api/admin/appointments/{target['id']}", json={"status": "Pending"}).status_code == 422


def test_manual_booking_appears_for_client(client):
    r = client.post("/api/admin/appointments", json={"name": "Walk In", "phone": "98765 00009", "date": "2026-10-27", "time": "09:30"})
    assert r.status_code == 201 and r.json()["appointment"]["source"] == "dashboard"
    mine = client.get("/api/appointments?phone=9876500009").json()
    assert mine["next"]["time"] == "09:30"          # dashboard -> client
    assert book(client, date="2026-10-27", time="09:30").status_code == 409  # and it blocks double booking


def test_manual_booking_without_phone_and_validation(client):
    assert client.post("/api/admin/appointments", json={"name": "No Phone", "date": "2026-10-27", "time": "10:00"}).status_code == 201
    assert client.post("/api/admin/appointments", json={"name": "Bad", "phone": "123", "date": "2026-10-27", "time": "10:30"}).status_code == 422
    assert client.post("/api/admin/appointments", json={"name": "Off Grid", "date": "2026-10-27", "time": "10:10"}).status_code == 422


def test_manual_booking_conflict(client):
    book(client)
    r = client.post("/api/admin/appointments", json={"name": "Clash", "date": "2026-10-26", "time": "10:00"})
    assert r.status_code == 409


def test_client_booking_shows_in_dashboard(client):
    book(client, name="Client Side", phone="9876500003", date="2026-10-28", time="12:00")
    found = [a for a in rows(client, range="upcoming") if a["client_name"] == "Client Side"]
    assert found and found[0]["source"] == "client" and found[0]["whatsapp_url"].startswith("https://wa.me/919876500003")


def test_dashboard_status_visible_to_client(client, seeded):
    target = rows(client, range="today")[0]
    client.patch(f"/api/admin/appointments/{target['id']}", json={"status": "No-show"})
    mine = client.get("/api/appointments?phone=9820011111").json()
    assert mine["next"] is None  # a no-show is no longer "upcoming"
    assert any(a["status"] == "No-show" for a in mine["past"])


def test_admin_cancel_frees_slot_and_hides_row(client):
    a = book(client).json()["appointment"]
    assert client.post(f"/api/admin/appointments/{a['id']}/cancel").status_code == 200
    assert rows(client, range="all") == []
    assert len(rows(client, range="all", include_cancelled="true")) == 1
    assert book(client, name="Next", phone="9876500002").status_code == 201


def test_admin_reschedule_conflict(client):
    a = book(client).json()["appointment"]
    book(client, name="Other", phone="9876500002", time="11:00")
    r = client.patch(f"/api/admin/appointments/{a['id']}", json={"date": "2026-10-26", "time": "11:00"})
    assert r.status_code == 409


def test_summary_and_filters(client, seeded):
    s = client.get("/api/admin/summary").json()
    assert s["today_total"] == 1 and s["today_remaining"] == 1 and s["upcoming"] == 1
    assert s["done"] == 1 and s["no_show"] == 1 and s["no_show_rate"] == 50
    assert len(rows(client, range="all", status="Booked")) == 3
    assert [a["client_name"] for a in rows(client, range="all", q="meera")] == ["Meera Iyer"]
    assert [a["client_name"] for a in rows(client, range="all", q="98200%2033333")] == ["Kabir Rao"]


def test_reminder_flow(client, seeded):
    target = rows(client, range="today")[0]
    assert target["reminder_sent_at"] is None and target["needs_confirmation"] is True
    assert "wa.me/919820011111" in target["whatsapp_url"]
    r = client.post(f"/api/admin/appointments/{target['id']}/reminder-sent")
    assert r.json()["appointment"]["reminder_sent_at"] is not None
    # Meera has no phone: no WhatsApp link is offered
    meera = [a for a in rows(client, range="all") if a["client_name"] == "Meera Iyer"][0]
    assert meera["whatsapp_url"] is None


def test_admin_availability_shows_taken_slots(client):
    book(client)
    day = client.get("/api/admin/availability?date=2026-10-26").json()
    assert next(s for s in day["slots"] if s["time"] == "10:00")["available"] is False


def test_passcode_protection(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "admin_passcode", "letmein")
    assert client.get("/api/admin/summary").status_code == 401
    assert client.get("/api/admin/summary", headers={"X-Admin-Passcode": "wrong"}).status_code == 401
    assert client.get("/api/admin/summary", headers={"X-Admin-Passcode": "letmein"}).status_code == 200
    assert client.get("/api/availability").status_code == 200  # client side stays open
