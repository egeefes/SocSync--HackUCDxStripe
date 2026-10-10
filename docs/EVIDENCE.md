# Evidence, assumptions & testing

> Fill this in during the hackathon. The judges score "Users first" and "Stay curious" from what's here,
> so **keep evidence (things we observed) separate from assumptions (things we believe)**.

## 1. First users

| | |
|---|---|
| **Who** | UCD students curious about societies they're not in (esp. 1st years, international students), plus society committees who promote events. |
| **Problem** | No single place to see society events. Info is scattered across Instagram, mailing lists and posters. No way to judge a society's event quality before joining. |
| **Current workaround** | Scroll each society's Instagram, rely on friends, join mailing lists for every society. Committees post on Instagram + email + paper posters. |
| **Why switch** | Students: one calendar, filters, verified ratings. Committees: post once (or paste their Instagram caption and let AI do it), sell tickets and memberships online. |
| **How we reach them** | Committee network (one of us sits on a society committee). Pilot with auditors → their members get the link via the weekly society email. Freshers' Week stand. |

## 2. Evidence (observed)

### Society commitments (Google Form sent to auditors)
Questions: society name · how do you promote events now? · would you post events on SocSync? · would you pay €5/month for AI poster import? · OK to name your society in our demo?

| Society | Promotes via | Would post? | Would pay €5/mo? | OK to name? |
|---|---|---|---|---|
| _(fill in)_ | | | | |

**Claim we can make:** "_N_ societies committed to pilot, _M_ said they'd pay." (Say "committed", not "joined".)

### Student quick survey (asked in person at the hackathon)
"How do you find out about events from societies you're NOT a member of?"

| Answer | Count |
|---|---|
| Instagram | |
| Friends / word of mouth | |
| Posters on campus | |
| I don't | |

### Instagram check
Of _10_ society accounts checked, _X_ posted their events for this week, _Y_ had posted nothing in the last 2 weeks, _Z_ had no account.

## 3. Assumptions (not yet verified)

- Societies will keep the calendar up to date. (Mitigation: AI import makes posting take ~10 s.)
- Students trust attendee-only ratings more than Instagram likes.
- Societies would pay €5/month. (Partly tested by the form above.)
- UCD/SU would allow a student-run platform. (Not tested. Needs SU conversation before launch.)

## 4. Testing: ordinary, boundary and failure inputs

Automated: `npm run test:api` → 48 cases (see `scripts/api-tests.mjs`), all passing.

### Trust: is it really that student / that society?

Ratings are only worth something if they come from real students, and societies must be real.

**What we built:**
- Students sign up with an 8-digit student number and an `@ucdconnect.ie` email, and start as *pending*.
- Pending students can browse and follow, but can't RSVP, buy tickets or review until the SocSync admin verifies them.
- Societies apply through a student account, giving their committee role and evidence. They stay hidden until the SocSync admin checks them against the Students' Union list.

**Tests (all pass):**
- Wrong student number length, non-UCD email, short password, duplicate account and wrong password are all rejected.
- A pending student can't RSVP. A guest can't follow.
- A student can't approve anyone.
- Demo one-click login is refused for real accounts.
- A pending society is hidden. Rejecting without a reason is refused.
- After approval: the society is visible, and the applicant can publish events.

**Limitation:** manual student checks don't scale to thousands of students. At launch, "Sign in with Google" limited to @ucdconnect.ie accounts (UCD student accounts are Google accounts) would verify students automatically, and the SocSync admin would review only society applications, a few dozen a year.

| What we tested | What happened | What we changed / learned |
|---|---|---|
| 1–2 star review with no comment | Accepted at first | Now requires a 10+ character explanation, so societies get actionable feedback, not just a low score |
| RSVP when event is at capacity | | Returns "event is full" (409) |
| Paid event priced €0.20 | Stripe minimum is €0.50 | Validation rejects < €0.50 |
| Review an event before it happens / twice / without attending | | All rejected with a clear reason |
| Payment redirect + webhook both arrive | Would double-record | UNIQUE `stripe_session_id` makes it idempotent |
| AI import with no API key / timeout | | Clear error; admin can still fill the form manually |

### AI quality

Live check: `npm run check:ai`, model `google/gemini-2.5-flash` via OpenRouter, run on 10 Oct 2026.

| Input | Result | Notes / what we learned |
|---|---|---|
| Instagram caption "This Thursday at 6pm in Newman J204… Free for members, €2 non-members… limited to 30" | ✅ Start 15 Oct 18:00 (correct Thursday), venue, €2, capacity 30 extracted in 2.8 s | No end time given → AI left it empty and flagged it, rather than inventing one. It added "UCD" to the society name from the #UCD hashtag, so the human review step matters. |
| "lol look at this cat 😂" (not an event) | ✅ Rejected with a clear message (422) | |
| Harsh but fair review: "Badly organised: started 30 minutes late…" | ✅ Allowed | Criticism must get through, or ratings become useless |
| Personal attack: "The auditor Mark is a complete idiot…" | ✅ Blocked + rewrite offered | The rewrite ("should be replaced") is still a bit pointed. The student can edit it before posting. |
| Review summary, Investment Society (3 reviews: 2★, 2★, 3★) | ✅ Balanced: lateness, unclear slides, "sales pitch" | Only uses what's in the reviews. Needs ≥ 3 reviews or it refuses. |
| Real Japanese Society poster image "Tea Afternoon · Wednesday 7th October · 15:30–17:30 · Meeting Rooms, Student Centre" (stylised pink poster, no year) + short caption | ✅ Title, date, start/end time and venue all correct. Picked 2026 (7 Oct 2026 is a Wednesday, matching the poster). Price & capacity not on poster → left empty and flagged, not invented. | The event was 3 days before the test, so the app warned "date is in the past" and the server refuses to publish it: correct. The description was padded with friendly filler not on the poster, so a human must review. We changed the past-date warning to show the date it read, so admins can see why, and tightened the prompt: descriptions use only poster facts (no filler), and the weekday + date pick the year. **Re-test on the same poster:** description went from 3 sentences of filler to "Join the UCD Japanese Society for a tea afternoon."; warning now reads "The AI read Wednesday 7 October 2026 at 15:30, which has already passed…"; all facts still correct. |
### Poster test set: 8 fictional posters with known answers

`docs/test-posters/` holds 8 posters, each built to test one difficulty:
- easy
- relative date in French
- script font with a "31.10" date and a past-midnight end
- venue "TBA"
- all in German, recurring weekly
- three events on one poster
- not an event at all
- Japanese date format

`npm run eval:posters` sends each one through the real import and scores every field against the correct answer. Full output: [test-posters/RESULTS.md](test-posters/RESULTS.md).

| Round | Score | What we found | What we changed |
|---|---|---|---|
| 1 | 33/33 fields correct | The field score hid two problems. (1) The 3-event poster: the AI imported the first event and **silently dropped the other two**. (2) "Jeden Mittwoch" (every Wednesday): imported as one date, **with no mention that it repeats**. | Added `other_events` and `repeats` to the AI's output schema, shown to the admin as warnings. Added checks for those warnings to the eval. |
| 2 | **35/35** | The admin now sees "This poster lists 3 events… import the others separately: Auditions: Twelfth Night (Wed 21 Oct 17:00–20:00), Opening Night Social (Fri 23 Oct 20:00)" and "This event repeats (every Wednesday)…" | |

### AI posters: event form → poster

**The reverse of poster import:** the society fills in the form, and the AI designs an Instagram poster. We split the work on purpose:
- **Image models often misspell text** (dates, room numbers). So the image AI only paints a background, with "no text" in the prompt.
- The **text AI** writes the headline, tagline and up to 3 highlights (only facts from the description), and picks a palette and layout from a fixed list.
- The **app draws** the society name, date, time, venue and price from the form. Those can never be wrong, and they update live if the form is edited, without a new AI call.

| Test | Result |
|---|---|
| "Robot Wars: Build Night", Engineering Society, Wed 21 Oct 18:00–21:00, Engineering Building Atrium, free | Poster ready in **7 s**. Robot-arena illustration with no text in it. Headline "Robot Wars: Build Night!", tagline and 3 highlights all taken from the description. Date, time, venue and "Free entry" correct. |
| Both image models broken (forced) | `generateImage` returns null in 0.4 s. The poster falls back to a colour gradient with an emoji, and the admin sees a "try Regenerate" note. |
| Student calls the poster API / no title / no start time / non-image "poster" on publish | 403 / 400 / 400 / 400 (automated tests) |

**Fix after first look:** the headline sat too close to the colour band, so we moved it down.

**Limits:**
- Posters are 360 KB JPEGs stored in SQLite, which is fine for a prototype.
- A real launch would store them in object storage.

### Reliability: the AI is sometimes slow

**What we observed:**
- During a manual test, the Masquerade Ball import failed: *"The operation was aborted due to timeout"* (a raw, unfriendly error).
- Server logs showed the same request taking **2 s, 15.6 s and over 30 s** at different times, with the same model and the same poster.

**What we ruled out:** it isn't the model "thinking". We measured 0 reasoning tokens, and direct calls took 2.4–6 s. The cause is variable delay at the AI provider.

**What we changed:**
1. Each AI attempt now has a 20 s limit (8 s for review moderation, where a student is waiting).
2. If the main model (`google/gemini-2.5-flash`) is slow or down, the app automatically retries with a **backup from a different provider** (`openai/gpt-4.1-mini`).
3. While it works, the button shows a live seconds counter. After 20 s it says a backup is being tried.
4. If both fail, the admin gets a plain message and can fill in the form by hand.
5. After a successful read, the app shows which model read the poster and how long it took.

**How we picked the backup:** we tried 3 candidates on the Ball poster.
- `gpt-4.1-mini` got everything right in 2.7 s.
- `gpt-4o-mini` got the past-midnight end date wrong.
- `gemini-2.0-flash-001` no longer exists on OpenRouter.

**How we verified it:**
- Normal: 1.3 s via the main model.
- Main model forced to a broken ID: the backup answered in 1.9 s total.
- Both forced to time out: friendly 504 message in 0.6 s.

**Lesson:** a perfect accuracy score can still hide missing information. We had to test for what the AI *didn't* say.

**Limits of this evidence:**
- The posters are clean, rendered images.
- Real phone photos (blur, angles, glare) are likely harder.
- Next step: test 10+ real society posters from Instagram.

**Known AI limitations:**
- It can misread dates on stylised posters.
- It may guess a year.
- It can't know room names that aren't written on the poster.

**How we handle them:**
- The AI only **pre-fills** the form, and a human always reviews it.
- Past dates and missing fields are flagged as warnings.
- The model is told to return null rather than invent values.
- The output is validated on the server.
