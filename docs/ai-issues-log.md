# Issues the AI introduced during the build (real, observed in the build session)

Source for the "What the AI got wrong" section of the documentation PDF. Each entry was actually
observed while building; none are invented. Ritesh: add your own findings from manual testing below.

1. **Search filter crashed with a 500 (NUL byte).** The first dashboard search used a sentinel string
   containing `\u0000` for "no digits in query". PostgreSQL rejects NUL bytes. *Caught by:* the automated
   test `test_summary_and_filters`. *Fix:* build the SQL condition properly (name-only search when the
   query has no digits).
2. **Malformed appointment id caused a 500.** Cancel/reschedule/confirm took the id as a plain string,
   so `/api/appointments/not-a-uuid/cancel` reached PostgreSQL and raised "invalid input syntax for type
   uuid". *Caught by:* a test that accidentally posted `/x/cancel`. *Fix:* path parameters are typed `UUID`
   so FastAPI returns a clean 422; regression test added (`test_malformed_appointment_id_is_a_clean_422`).
3. **Wrong test assumption about "today".** A test expected a "too soon" error for 25 Oct, but 25 Oct 2026
   is a Sunday and the practice is closed on Sundays, so the API correctly said "closed day". The *test*
   was wrong, not the API. *Fix:* test now freezes the clock to a Monday, and a separate test covers Sunday.
4. **Invisible text on the "Next appointment" card.** A global `h1,h2,h3 { color }` rule sat outside
   Tailwind's cascade layers and beat utility classes like `text-white`, so a heading on the dark card
   was dark-on-dark. *Caught by:* reviewing a real browser screenshot. *Fix:* base styles moved into
   `@layer base`.
5. **TypeScript build error.** The AI wrote a constructor with parameter properties, which the project's
   strict `erasableSyntaxOnly` setting rejects. *Caught by:* `tsc -b`. *Fix:* explicit fields.

## Add your own (from manual testing)

- _[Placeholder: describe anything else you find, how you noticed it, and how it was fixed.]_

## Also observed (test-side mistakes by the AI, not app bugs)
- The first end-to-end script used the test client name "E2E Tester". The app (correctly) rejects names containing digits, so the booking never submitted. The script was wrong; the name was changed.
- The first end-to-end script assumed the sample appointment on 25 Oct would still be upcoming. Real time moved past 16:00 IST while building, so the app correctly showed it as past. The script was rewritten to not depend on the real date.
