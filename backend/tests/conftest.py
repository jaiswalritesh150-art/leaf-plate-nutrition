import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/kayro_test")
os.environ["DATABASE_URL"] = TEST_DB  # the app never touches any other database during tests
os.environ["ADMIN_PASSCODE"] = ""
os.environ["CLINIC_TIMEZONE"] = "Asia/Kolkata"

import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db, timeutil  # noqa: E402
from app.main import app  # noqa: E402

# Frozen "now": Sunday 25 Oct 2026, 12:00 IST (06:30 UTC). Sample data straddles this moment.
FROZEN_NOW = datetime(2026, 10, 25, 6, 30, tzinfo=timezone.utc)


@pytest.fixture(scope="session", autouse=True)
def _schema():
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute((ROOT / "database" / "schema.sql").read_text())
    yield


@pytest.fixture(autouse=True)
def _freeze_clock(monkeypatch):
    monkeypatch.setattr(timeutil, "now", lambda: FROZEN_NOW)


@pytest.fixture(autouse=True)
def _clean_tables():
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute("truncate appointments")
    yield


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # runs lifespan: opens the connection pool
        yield c


@pytest.fixture
def seeded():
    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute((ROOT / "database" / "seed.sql").read_text())


def book(client, **over):
    payload = {"name": "Test Client", "phone": "9876500001", "date": "2026-10-26", "time": "10:00"}
    payload.update(over)
    return client.post("/api/appointments", json=payload)
