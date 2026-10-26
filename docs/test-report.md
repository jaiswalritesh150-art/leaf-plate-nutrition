# Test report (what was actually run)

Environment: Ubuntu sandbox, Python 3.12, Node 22, **local PostgreSQL 16.15** (not Supabase), headless Chromium via Playwright.

| # | Requirement | How verified | Result |
|---|---|---|---|
| 1 | Client can book an available slot | pytest `test_client_can_book_available_slot`; e2e step 1 | Passed |
| 2 | Invalid name/phone/date/time rejected | pytest (12 parametrised cases + phone normalisation); e2e validation messages | Passed |
| 3 | Duplicate booking rejected, incl. concurrent | pytest `test_duplicate_booking_is_rejected`, `test_concurrent_requests_cannot_double_book` (20 threads: 1 created, 19 rejected); e2e API duplicate | Passed |
| 4 | Cancellation releases the slot | pytest `test_cancel_releases_slot`, admin cancel; e2e cancel then rebook | Passed |
| 5 | Reschedule checks availability, no conflict | pytest reschedule move / conflict-keeps-original / invalid slot / admin conflict | Passed |
| 6 | Status can be Booked / Done / No-show | pytest `test_status_update_all_three_values`, invalid status rejected; e2e dashboard select | Passed |
| 7 | Manual dashboard booking | pytest manual booking tests; e2e "Walk In Wendy" | Passed |
| 8 | Today filter uses configured timezone | pytest `test_today_filter_uses_clinic_timezone`, `..._early_morning_ist`; e2e | Passed |
| 9 | Five sample appointments correct, seed idempotent | pytest `test_sample_data_is_correct`, `test_seed_is_idempotent`; `database/seed.py` run twice = 5 rows | Passed |
| 10 | Frontend and backend communicate | e2e through the frontend origin (browser → Vite proxy → FastAPI → PostgreSQL), 8 checks | Passed |
| 11 | Production build succeeds | `npm run build` (tsc + vite) | Passed |

Counts: backend **46 passed**; frontend unit tests **7 passed**; e2e **8 checks passed**.

## NOT verified (needs you / external setup)
- Anything against **Supabase** (connection string, pooler behaviour). The code is written for it (`prepare_threshold=None`, RLS enabled) but was only run against local PostgreSQL.
- **Render and Vercel deployments**, the deployed CORS configuration, and Render cold-start behaviour.
- GitHub Actions workflow (`.github/workflows/ci.yml`) has never been run.
- Real WhatsApp delivery (the app only opens a pre-filled click-to-chat link), and importing the `.ics` file into real calendar apps.
- Real phones / Safari / Firefox, screen-reader testing, and any formal accessibility audit. Only Chromium at 390 px and 1366 px was looked at.
- Load or abuse testing (no rate limiting exists).
