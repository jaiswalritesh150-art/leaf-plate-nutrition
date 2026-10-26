# Manual test checklist (do this on the deployed URLs before submitting)

Client app (on your phone and on a desktop)
- [ ] `/` loads with no login; the "waking up" notice appears only if Render was asleep.
- [ ] "Riya Shah (98200 11111)" lookup shows her visits (sample appointments are in the past once 25 Oct 2026 has passed).
- [ ] Book a slot: invalid name/phone show clear messages; valid booking shows the confirmation screen.
- [ ] Add to calendar downloads an .ics that opens in your calendar with two alerts.
- [ ] Home shows the new appointment as "Next appointment"; "Confirm I'll be there" works.
- [ ] My visits: Reschedule moves it; Cancel releases it; Past tab shows history.
- [ ] Try booking the same slot from a second browser/incognito window: rejected with a friendly message.

Dashboard (`/dashboard`)
- [ ] All five sample rows are present with correct dates/times; Meera Iyer's phone shows "Not provided".
- [ ] Booked / Done / No-show are visibly different colours and each has an icon.
- [ ] Changing a status updates the row and the summary; the client app reflects it.
- [ ] Today tab lists only today's appointments (IST).
- [ ] "+ Add appointment" creates one; a taken time is disabled in the picker.
- [ ] WhatsApp reminder opens WhatsApp with a pre-filled message and marks the row "Reminded".

Deployment
- [ ] No secrets in GitHub (`git log -p | grep -i password` finds nothing; `.env` not committed).
- [ ] `ALLOWED_ORIGINS` on Render equals the Vercel URL exactly; no CORS errors in the browser console.
