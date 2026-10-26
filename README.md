# Nutritionist appointments — client app + dashboard

A small appointments product for a nutritionist's practice, built for the Kayro AI Product Intern assignment.

- **Client app** (`/`) — mobile-first booking: home screen with the next appointment, pick a day and time, upcoming/past visits, reschedule, cancel, confirm attendance, add to calendar.
- **Nutritionist dashboard** (`/dashboard`) — appointments with client, phone, date, time and status (`Booked` / `Done` / `No-show`, each its own colour), change status, add by hand, Today filter, summary figures, WhatsApp reminder links.
- Both sides use **one PostgreSQL database through one FastAPI backend**, so anything booked on either side shows up on the other.

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS v4 → Vercel |
| Backend | Python + FastAPI (psycopg 3) → Render |
| Database | Supabase PostgreSQL |

```
frontend/   React app (client app + dashboard)       database/   schema.sql, seed.sql, seed.py
backend/    FastAPI app + pytest suite               docs/       Part 1 answer, documentation, checklists
scripts/    end-to-end browser smoke test            render.yaml Render blueprint
```

## How it prevents double booking
`database/schema.sql` creates a **partial unique index** on `starts_at` for appointments that are not cancelled. PostgreSQL itself rejects a second active booking for the same slot, so two simultaneous requests cannot both succeed; the API turns the violation into `409 slot_taken`. Rescheduling is a single atomic `UPDATE`, so a failed move leaves the original appointment untouched. Cancelling sets `cancelled_at`, which removes the row from the index and frees the slot. The test suite fires 20 simultaneous requests at one slot and asserts exactly one wins.

Statuses are exactly `Booked`, `Done`, `No-show`. "Cancelled" is a separate flag, not a fourth status.

## 1. Prerequisites
Python 3.11+ (tested on 3.12), Node.js 20+ (tested on 22), Git, a free [Supabase](https://supabase.com) account. For local tests: a local PostgreSQL 14+ (or any Postgres you can create a throwaway database in).

## 2. Create the Supabase database
1. Supabase → **New project**. Save the database password.
2. Open **Connect** (or Project Settings → Database) and copy a connection string. Prefer the **Session pooler** URI: Render's free tier may not reach Supabase's direct connection (IPv6). Labels in the Supabase UI change over time, so use whichever string works from your host.
3. You never need Supabase's `service_role` key — the backend uses the database connection string only, and nothing secret goes in the frontend.

## 3. Configure environment variables
```bash
cp .env.example .env                       # backend settings (repo root or backend/)
cp frontend/.env.example frontend/.env     # leave VITE_API_BASE_URL empty for local dev
```
Edit `.env`: set `DATABASE_URL` to your Supabase string (replace the password placeholder). All variables are documented in `.env.example`.

## 4. Create tables and load the sample data
```bash
python3 -m venv backend/.venv && source backend/.venv/bin/activate
pip install -r backend/requirements-dev.txt
python database/seed.py
```
This applies `database/schema.sql` and `database/seed.sql`. It is safe to run repeatedly (each sample row has a unique `seed_key`; reruns insert nothing new). You can alternatively paste both SQL files into the Supabase **SQL Editor**.

## 5. Run the backend
```bash
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000        # API docs: http://localhost:8000/docs
```

## 6. Run the frontend
```bash
cd frontend && npm install && npm run dev        # http://localhost:5173 (client)  /dashboard (nutritionist)
```
Vite proxies `/api` to `localhost:8000`, so no CORS setup is needed locally.

## 7. Run the tests
```bash
# Backend: needs a THROWAWAY Postgres database (tests truncate the appointments table!)
createdb kayro_test
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kayro_test
cd backend && python -m pytest -q                # 46 tests, including a 20-way concurrent booking race

# Frontend
cd frontend && npm test && npm run build         # unit tests + type-check + production build

# End to end (backend + frontend running, DEV database only; it creates appointments)
pip install playwright && playwright install chromium
BASE_URL=http://localhost:5173 python scripts/e2e_smoke.py
```
The tests freeze the clock at Sun 25 Oct 2026, 12:00 IST, so results do not depend on the real date.

## 8. Deploy the backend to Render
1. Push the repo to GitHub.
2. Render → **New → Blueprint** → select the repo (uses `render.yaml`), or create a Web Service manually: root directory `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/api/health`.
3. Set environment variables: `DATABASE_URL` (Supabase pooler string), `ALLOWED_ORIGINS` (your Vercel URL, see step 10), optionally `CLIENT_APP_URL`.
4. Open `https://<your-service>.onrender.com/api/health` → `{"ok":true}`.

## 9. Deploy the frontend to Vercel
1. Vercel → **Add New Project** → import the repo, set **Root Directory** to `frontend` (framework: Vite).
2. Environment variable: `VITE_API_BASE_URL` = your Render URL, no trailing slash (e.g. `https://kayro-appointments-api.onrender.com`).
3. Deploy. `frontend/vercel.json` makes deep links such as `/dashboard` work.

## 10. CORS and production variables
`ALLOWED_ORIGINS` on Render must contain the exact Vercel origin (scheme + host, no trailing slash, no path), e.g. `https://my-app.vercel.app`. Comma-separate multiple origins (add your custom domain too). If the browser console shows a CORS error, this value is the first thing to check. Changing `VITE_API_BASE_URL` requires a Vercel redeploy because Vite bakes it in at build time.

## 11. How the no-show prevention works (and what needs external setup)
| Feature | Status |
|---|---|
| Booking confirmation screen with clear summary | Works now |
| Client taps **"Confirm I'll be there"**; dashboard shows Confirmed / Unconfirmed | Works now |
| Calendar file (`.ics`) with alerts 1 day and 2 hours before | Works now (generated in the browser; the client's calendar app fires the alerts) |
| Dashboard summary "need a reminder or confirmation" (next 24 h, unconfirmed) and per-row indicators | Works now |
| **WhatsApp reminder**: one click opens WhatsApp with a ready-made message to the client and logs "Reminded" | Works now, **but sent by the nutritionist tapping Send** (WhatsApp click-to-chat). Nothing is sent automatically |
| Past visits still marked Booked are flagged "Record outcome" | Works now |
| **Automatic** SMS/WhatsApp reminders | **Not built.** Needs a provider (e.g. Twilio or WhatsApp Business API), approved templates, credentials and a scheduler. No message is ever claimed as sent unless the nutritionist clicked it |
| Easy cancel / reschedule (frees slots for others) | Works now |

## Known limitations
- **Client identification is by phone number only** (remembered in the browser). It is *not* authentication: anyone who knows a client's number can view or change that client's appointments. Acceptable for a no-login demo; real use needs OTP verification or a signed link.
- **The dashboard is open to anyone with the URL** (required: reviewers must not log in). Set `ADMIN_PASSCODE` on the backend to require a shared passcode; this is still only a shared secret, not user accounts.
- No rate limiting or CAPTCHA on booking.
- Render's free tier sleeps when idle: the first request can take up to ~1 minute (the UI shows a "waking up" notice).
- Single practitioner, 30-minute slots, 09:00–17:00 Mon–Sat in `Asia/Kolkata` (all configurable via env). The assignment's sample data includes a Sunday appointment; it is kept as-is and the dashboard can create Sunday appointments, but clients cannot book Sundays.
- Phone numbers are validated as 10-digit Indian mobiles (6–9 prefix).
- **Sample data is dated 22–25 Oct 2026.** Once that date has passed, all five sample appointments are in the past (nothing is silently re-dated). To see the "next appointment" screen, book a new slot.
- GitHub Actions workflow (`.github/workflows/ci.yml`) is provided but has not been run.

## API overview
Client: `GET /api/config`, `GET /api/availability`, `POST /api/appointments`, `GET /api/appointments?phone=`, `POST /api/appointments/{id}/cancel|reschedule|confirm`.
Dashboard: `GET /api/admin/appointments?range=today|upcoming|past|all`, `GET /api/admin/summary`, `POST /api/admin/appointments`, `PATCH /api/admin/appointments/{id}`, `POST …/cancel`, `POST …/reminder-sent`. Errors are always `{"error": {"code", "message", "fields"}}`. Interactive docs at `/docs`.
