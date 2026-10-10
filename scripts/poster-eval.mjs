// Scores the AI poster import against posters whose correct answers we know.
// Posters: docs/test-posters/*.png (fictional; HTML sources in docs/test-posters/src).
// Run with the dev server running: npm run eval:posters   -> also writes docs/test-posters/RESULTS.md
// Uses real OpenRouter credits (~8 calls). Uses the society admins' free AI imports, so run
// `npm run reset-db` afterwards for a clean demo.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.APP_URL || "http://localhost:3000";

// Log in as a seeded demo account and return its session cookie (cached per user).
const sessions = {};
async function demoCookie(userId) {
  if (!sessions[userId]) {
    const res = await fetch(BASE + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    sessions[userId] = (res.headers.getSetCookie().find((c) => c.startsWith("sid=")) || "").split(";")[0];
  }
  return sessions[userId];
}
const DIR = path.join(process.cwd(), "docs", "test-posters");
const ADMINS = [5, 6, 7]; // each free-plan society has 3 imports; rotate when one runs out

// ----- expected dates, relative to today (the posters have no year / say "this Thursday") -----
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d, hh, mm = 0) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`;
function next(month, day) {
  const now = new Date();
  const d = new Date(now.getFullYear(), month - 1, day);
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1);
  return d;
}
function nextWeekday(dow) { // 0 = Sunday ... 4 = Thursday
  const d = new Date();
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7));
  return d;
}
const plusDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

// ----- the test set: what each poster tests + the correct answer -----
const eq = (want) => (got) => got === want;
const has = (re) => (got) => re.test(got || "");
const empty = (got) => !got;
// Checks on the warnings shown to the admin (field names starting with "warning:").
const warns = (re) => ({ warns: re });

const POSTERS = [
  { file: "1-mountaineering-hike.png", tests: "Easy: everything clearly stated",
    expect: { title: has(/glendalough/i), start: eq(fmt(next(10, 24), 9)), end: eq(fmt(next(10, 24), 18)), venue: has(/main entrance/i), price_eur: eq(15), capacity: eq(40) } },
  { file: "2-french-crepes.png", tests: "Relative date ('ce jeudi'), French, members-free / €2 non-members",
    expect: { title: has(/cr[eê]pe/i), start: eq(fmt(nextWeekday(4), 19)), venue: has(/global lounge/i), price_eur: eq(2) } },
  { file: "3-engineering-ball.png", tests: "Script font, '31.10' date format, ends after midnight",
    expect: { title: has(/masquerade|ball/i), start: eq(fmt(next(10, 31), 19, 30)), end: eq(fmt(plusDay(next(10, 31)), 1)), venue: has(/clayton/i), price_eur: eq(35) } },
  { file: "4-compsoc-hacknight.png", tests: "Venue 'TBA', end time 'late', terminal styling",
    expect: { title: has(/hack/i), start: eq(fmt(next(10, 21), 19)), end: empty, venue: (v) => !v || /tba/i.test(v), price_eur: eq(0) } },
  { file: "5-german-stammtisch.png", tests: "All in German, weekly recurring ('jeden Mittwoch')",
    expect: { title: has(/stammtisch/i), start: eq(fmt(nextWeekday(3), 19)), venue: has(/student bar/i), price_eur: eq(0), description: (d) => !/\b(jeden|willkommen|wir sprechen)\b/i.test(d || ""),
      "warning: says it repeats": warns(/repeat|weekly|every/i) } },
  { file: "6-drama-welcome-week.png", tests: "THREE events on one poster (app imports one at a time)",
    expect: { title: has(/improv|audition|social/i), "warning: lists the 2 other events": warns(/audition[\s\S]*social|social[\s\S]*audition/i) }, note: "Limitation test: which event does it pick, and does it warn about the others?" },
  { file: "7-boardgames-committee.png", tests: "NOT an event (committee announcement)", expectReject: true },
  { file: "8-japanese-calligraphy.png", tests: "Japanese date format 10月22日（木）, mixed languages, capacity 定員20名",
    expect: { title: has(/calligraphy|shod/i), start: eq(fmt(next(10, 22), 18)), end: eq(fmt(next(10, 22), 20)), venue: has(/J204/i), price_eur: eq(3), capacity: eq(20) } },
];

// ----- run -----
async function importPoster(file) {
  const dataUrl = "data:image/png;base64," + fs.readFileSync(path.join(DIR, file)).toString("base64");
  for (const admin of ADMINS) {
    const t = Date.now();
    const res = await fetch(BASE + "/api/ai/import-event", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: await demoCookie(admin) },
      body: JSON.stringify({ imageDataUrl: dataUrl }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 402) continue; // this society is out of free imports, try the next admin
    return { status: res.status, ms: Date.now() - t, json };
  }
  throw new Error("All demo societies are out of free AI imports. Run `npm run reset-db` (server stopped) and try again.");
}

const rows = [];
let correct = 0, total = 0;
for (const p of POSTERS) {
  process.stdout.write(`${p.file} … `);
  const r = await importPoster(p.file);
  const row = { ...p, status: r.status, ms: r.ms, event: r.json.event, warnings: r.json.warnings || [], error: r.json.error, checks: [] };
  if (p.expectReject) {
    const ok = r.status === 422;
    row.checks.push({ field: "rejected as not-an-event", ok, got: r.status === 422 ? "rejected" : `accepted: ${r.json.event?.title}` });
  } else if (r.status !== 200) {
    for (const field of Object.keys(p.expect)) row.checks.push({ field, ok: false, got: `HTTP ${r.status}: ${r.json.error}` });
  } else {
    for (const [field, check] of Object.entries(p.expect)) {
      if (check.warns) {
        const hit = row.warnings.find((w) => check.warns.test(w));
        row.checks.push({ field, ok: !!hit, got: hit || "(no such warning)" });
        continue;
      }
      const got = r.json.event[field];
      row.checks.push({ field, ok: check(got), got: got === "" ? "(empty)" : String(got) });
    }
  }
  for (const c of row.checks) { total++; if (c.ok) correct++; }
  console.log(`${row.checks.filter((c) => c.ok).length}/${row.checks.length} fields correct (${r.ms} ms)`);
  rows.push(row);
}

// ----- report -----
const model = (fs.readFileSync(".env.local", "utf8").match(/^OPENROUTER_MODEL=(.*)$/m)?.[1] || "google/gemini-2.5-flash").trim();
const pct = Math.round((correct / total) * 100);
let md = `# AI poster import: evaluation results\n\n`;
md += `Run ${new Date().toLocaleString("en-IE")} · model \`${model}\` via OpenRouter · ${POSTERS.length} fictional posters · `;
md += `**${correct}/${total} fields correct (${pct}%)**\n\n`;
md += `Regenerate with \`npm run eval:posters\`. Expected dates are computed relative to the run date.\n\n`;
for (const r of rows) {
  md += `## ${r.file}\n_Tests: ${r.tests}_ · ${r.ms} ms\n\n![${r.file}](${r.file})\n\n`;
  md += `| Field | Result | AI output |\n|---|---|---|\n`;
  for (const c of r.checks) md += `| ${c.field} | ${c.ok ? "✅" : "❌"} | ${String(c.got).replace(/\|/g, "\\|")} |\n`;
  if (r.event?.description) md += `\n**Description:** ${r.event.description}\n`;
  if (r.warnings.length) md += `\n**Warnings shown to admin:** ${r.warnings.join(" · ")}\n`;
  if (r.note) md += `\n_${r.note}_\n`;
  md += `\n`;
}
fs.writeFileSync(path.join(DIR, "RESULTS.md"), md);
console.log(`\n${correct}/${total} fields correct (${pct}%). Report: docs/test-posters/RESULTS.md`);
