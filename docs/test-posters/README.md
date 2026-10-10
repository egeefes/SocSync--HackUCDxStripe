# Test posters (fictional)

Eight made-up society posters, each testing one thing that makes AI extraction hard.

- Edit the HTML in `src/`.
- The PNGs are rendered from it with headless Chrome at 800×1100.

| Poster | What it tests |
|---|---|
| 1-mountaineering-hike | Easy: date, times, meeting point, price, places all clearly stated |
| 2-french-crepes | "Ce jeudi · 19h" (relative date, French), free for members / €2 non-members |
| 3-engineering-ball | Script font, "31.10" date format, ends 01:00 the next day |
| 4-compsoc-hacknight | Venue "TBA", end time "late", terminal-style design |
| 5-german-stammtisch | All in German, repeats weekly ("Jeden Mittwoch") |
| 6-drama-welcome-week | Three events on one poster |
| 7-boardgames-committee | Not an event at all (should be rejected) |
| 8-japanese-calligraphy | Japanese date 10月22日（木）, mixed languages, capacity 定員20名 |

**Score them:**
```bash
npm run eval:posters
```
Results go to `RESULTS.md`.

**Use them in the demo:** in the society dashboard, choose one of these PNGs under "Poster image".
