"""End-to-end smoke test through the real frontend (browser) -> FastAPI -> PostgreSQL.

Prereqs: backend running, frontend running (npm run dev or npm run preview), seeded database.
Run:  pip install playwright && playwright install chromium
      BASE_URL=http://localhost:5173 python scripts/e2e_smoke.py
WARNING: creates and modifies appointments in the database the backend points at. Use a dev database.
"""
import os
import sys

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:5173")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        client = browser.new_context(viewport={"width": 390, "height": 844})
        page = client.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1. Client books a new slot (first available day, 3:30 PM). Time-independent on purpose:
        #    the sample appointments are in the past once the real date moves on.
        page.goto(BASE + "/book")
        page.get_by_role("radio", name="3:30 PM").click()
        page.get_by_label("Full name").fill("Tess Tester")
        page.get_by_label("Mobile number").fill("9876500123")
        page.get_by_role("button", name="Confirm booking").click()
        expect(page.get_by_role("heading", name="You're booked, Tess.")).to_be_visible()
        print("PASS client booked a slot")

        # 2. Home shows it as the next appointment; client confirms attendance
        page.goto(BASE + "/")
        expect(page.get_by_text("Next appointment")).to_be_visible()
        page.get_by_role("button", name="Confirm I'll be there").click()
        expect(page.get_by_text("You're confirmed. See you then.")).to_be_visible()
        print("PASS home shows next appointment; confirmation works")

        # 2b. Sample client can be found and has history
        page.evaluate("localStorage.clear()")
        page.goto(BASE)
        page.get_by_role("button", name="Riya Shah (98200 11111)").click()
        page.get_by_role("button", name="Find my appointments").click()
        page.get_by_role("link", name="Reschedule or cancel").or_(page.get_by_text("You have nothing booked right now.")).first.wait_for()
        page.goto(BASE + "/appointments")
        page.get_by_role("tab", name="Past").click()
        expect(page.get_by_text("Booked", exact=True).first).to_be_visible()
        print("PASS sample client found by phone")
        page.evaluate("localStorage.clear()")
        page.goto(BASE + "/appointments")
        page.get_by_label("Mobile number").fill("9876500123")
        page.get_by_role("button", name="Show my visits").click()
        expect(page.get_by_text("Confirmed", exact=True).first).to_be_visible()

        # 3. Validation feedback
        page.goto(BASE + "/book")
        page.get_by_label("Full name").fill("X")
        page.get_by_label("Mobile number").fill("123")
        page.get_by_role("button", name="Confirm booking").click()
        expect(page.get_by_text("Enter your full name")).to_be_visible()
        expect(page.get_by_text("Enter a valid 10-digit mobile number, e.g. 98200 11111.")).to_be_visible()
        print("PASS validation messages shown")

        # 4. Same slot again via the API (as another client) is rejected
        mine = page.request.get(BASE + "/api/appointments?phone=9876500123").json()["upcoming"][0]
        r = page.request.post(BASE + "/api/appointments", data={"name": "Second Person", "phone": "9876500124", "date": mine["date"], "time": mine["time"]})
        assert r.status == 409, r.status
        print("PASS double booking rejected through the frontend origin")

        # 5. Dashboard shows the client's booking, status change flows back to the client
        dash = browser.new_context(viewport={"width": 1366, "height": 850}).new_page()
        dash.goto(BASE + "/dashboard")
        dash.get_by_role("tab", name="All").click()
        row = dash.get_by_role("row").filter(has_text="Tess Tester")
        expect(row).to_be_visible()
        row.get_by_label("Status for Tess Tester").select_option("Done")
        expect(dash.get_by_text("Marked Done.")).to_be_visible()
        page.goto(BASE + "/appointments")
        page.get_by_role("tab", name="Past").click()
        expect(page.get_by_text("Done", exact=True).first).to_be_visible()
        print("PASS dashboard sees client booking; status change visible to client")

        # 6. Manual booking for today + Today filter
        dash.get_by_role("tab", name="Today").click()
        dash.get_by_role("button", name="+ Add appointment").click()
        dash.get_by_label("Client name").fill("Walk In Wendy")
        dash.get_by_role("radio", name="9:00 AM").click()
        dash.get_by_role("button", name="Add appointment").last.click()
        expect(dash.get_by_text("Appointment added.")).to_be_visible()
        expect(dash.get_by_role("row").filter(has_text="Walk In Wendy")).to_be_visible()
        expect(dash.get_by_role("row").filter(has_text="Tess Tester")).to_have_count(0)  # booked for a later day
        print("PASS today filter and manual appointment")

        # 7. Client cancels; slot is released and can be rebooked
        r = page.request.post(BASE + "/api/appointments", data={"name": "Cancel Me", "phone": "9876500125", "date": mine["date"], "time": "16:00"})
        assert r.status == 201, r.text()
        page.evaluate("localStorage.clear()")
        page.goto(BASE + "/appointments")
        page.get_by_label("Mobile number").fill("98765 00125")
        page.get_by_role("button", name="Show my visits").click()
        page.get_by_role("button", name="Cancel", exact=True).first.click()
        page.get_by_role("button", name="Yes, cancel").click()
        expect(page.get_by_text("Appointment cancelled")).to_be_visible()
        r = page.request.post(BASE + "/api/appointments", data={"name": "Rebook", "phone": "9876500126", "date": mine["date"], "time": "16:00"})
        assert r.status == 201, r.text()
        print("PASS client cancellation frees the slot")

        browser.close()
        if errors:
            print("Browser errors:", errors)
            return 1
    print("ALL E2E CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
