# Part 1: Solving the no-show problem

**The problem.** About 1 in 4 clients don't turn up, and the nutritionist only finds out while sitting there waiting. Everything lives in WhatsApp chats and an Excel sheet.

**What I would do.** Make a likely no-show visible *before* the slot, while there is still time to act, and make it easier to cancel than to ghost.

1. **One shared booking record instead of chats and a spreadsheet.** Clients book a real slot (no double booking) and immediately see a clear summary: who, when, how to change it.
2. **A reminder ladder with a one-tap confirmation.** About 24 hours before: a WhatsApp message asking the client to confirm ("Reply YES" or tap Confirm in the app). About 2 hours before: a short nudge to anyone still unconfirmed. Clients can also add the visit to their own calendar with alerts.
3. **An "at risk" list for the nutritionist.** Anyone unconfirmed close to the appointment shows up in one place. She can call or message them, or release the slot and offer it to someone else, instead of discovering the gap in the room.
4. **Cancelling and rescheduling take two taps.** Most no-shows are forgetfulness or awkwardness, not a firm decision. If changing plans is easy, a free slot is released early rather than wasted.
5. **Track what happens.** Each visit ends as Done or No-show, giving a real no-show rate and showing repeat no-show clients (who can get earlier reminders or a firmer booking rule).

**Why this works.** It does not try to force people to show up; it turns a *silent* no-show found at the last minute into a *known* gap found early enough to act on. The reminders ask for a tiny action (confirm) that also keeps the appointment top of mind.

**How I'd know it worked.** Compare the no-show rate before and after (starting from the current ~25%), and how many "at risk" slots were refilled or released in time.

*Honest note on the build:* the prototype ships the confirmation tap, calendar alerts, the at-risk indicators and one-click WhatsApp reminder messages that the nutritionist sends herself. Fully automatic reminders need a messaging provider and credentials, which are not set up.
