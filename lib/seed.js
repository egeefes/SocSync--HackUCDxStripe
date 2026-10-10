// First-run demo data (all SYNTHETIC). Called once by lib/db.js when the Redis database is empty.
// Row ids are assigned 1..n in insertion order, exactly like the old SQLite seed, so the demo accounts
// keep the ids the test script expects (students 1-4, society admins 5-7, pending student 8, SocSync admin 9).
// It is safe to run twice (e.g. a crash half-way): the same ids are simply written again.
import { nowStamp } from "./format";

// Local 'YYYY-MM-DDTHH:mm' string, `days` from today at hh:mm.
function at(days, hh, mm = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`;
}

export async function seedDatabase(redis, keys) {
  const now = nowStamp();
  const tables = {}; // table -> { field: row }
  const counters = {}; // table -> last id used
  const indexes = { users_email: {}, users_student_number: {} };

  // Add a row with the next id (id tables) or at an explicit composite key (keyed tables).
  const add = (table, row, field) => {
    const t = (tables[table] ??= {});
    if (field !== undefined) {
      if (t[field]) return t[field];
      counters[table] = (counters[table] ?? 0) + 1;
      return (t[field] = { id: counters[table], ...row });
    }
    const id = (counters[table] = (counters[table] ?? 0) + 1);
    return (t[id] = { id, ...row });
  };
  const addKeyed = (table, row, field) => {
    const t = (tables[table] ??= {});
    if (!t[field]) t[field] = row;
  };

  const addUser = (u) => {
    const row = add("users", {
      name: u.name, student_number: u.student_number, email: u.email ?? null, password_hash: null,
      role: u.role ?? "student", status: u.status ?? "verified", review_note: null, is_demo: 1,
      society_id: u.society_id ?? null, created_at: now, google_refresh_token: null, google_email: null,
    });
    indexes.users_student_number[row.student_number] = row.id;
    if (row.email) indexes.users_email[row.email] = row.id;
    return row;
  };

  // ---------- societies ----------
  const societies = [
    // [name, category, description, instagram, membership fee cents]
    ["Japanese Society", "Languages & Culture", "Language exchange, anime nights, calligraphy and the yearly cultural festival.", null, 200],
    ["French Society", "Languages & Culture", "Conversation tables for all levels, film nights and crêpe days.", null, 200],
    ["German Society", "Languages & Culture", "Stammtisch every week, Oktoberfest social and exam-prep sessions.", null, 200],
    ["Entrepreneurs Society", "Business", "Founder talks, pitch nights and a startup weekend every spring.", null, 200],
    ["Investment Society", "Business", "Markets workshops, stock-pitch competition and industry panels.", null, 200],
    ["Mountaineering Club", "Sport & Outdoors", "Weekly climbing walls and weekend hiking trips around Wicklow and the West.", null, 500],
    ["Engineering Society", "Academic & Tech", "Industry nights, study sessions and the Engineering Ball.", null, 200],
    ["Computer Science Society", "Academic & Tech", "Hack nights, coding interview prep and tech talks.", null, 200],
    ["Drama Society", "Arts & Performance", "Two big productions a year plus improv workshops open to everyone.", null, 200],
    ["Board Games Society", "Social & Hobbies", "Relaxed games nights with a 300+ game library. Newcomers welcome.", null, 200],
  ];
  const newSociety = (s) => add("societies", {
    name: s.name, category: s.category, description: s.description, instagram: s.instagram ?? null,
    membership_fee_cents: s.fee, plan: "free", ai_imports_used: 0, stripe_subscription_id: null, stripe_account_id: null,
    status: s.status ?? "approved", applicant_user_id: s.applicant_user_id ?? null, applicant_role: s.applicant_role ?? null,
    evidence: s.evidence ?? null, review_note: null, applied_at: s.applied_at ?? null, bio: null, committee_json: null,
  });
  for (const [name, category, description, instagram, fee] of societies) newSociety({ name, category, description, instagram, fee });

  // ---------- users ----------
  const users = [
    // [name, student number, role, society_id]
    ["Aoife Murphy", "21345678", "student", null],
    ["Cian O'Brien", "22456789", "student", null],
    ["Priya Sharma", "23567890", "student", null],
    ["Tomás Byrne", "21987654", "student", null],
    ["Japanese Society (admin)", "20111111", "admin", 1],
    ["Mountaineering Club (admin)", "20222222", "admin", 6],
    ["Engineering Society (admin)", "20333333", "admin", 7],
  ];
  for (const [name, student_number, role, society_id] of users) addUser({ name, student_number, role, society_id });

  // ---------- events ----------
  const events = [
    // [society, title, description, venue, start, end, price cents, capacity]
    // --- past events (can be reviewed) ---
    [1, "Japanese Language Exchange", "Practise Japanese and English with native speakers. All levels.", "Global Lounge", at(-8, 18), at(-8, 20), 0, null],
    [1, "Anime Night: Spirited Away", "Screening with snacks and a short discussion after.", "Newman Building G20", at(-5, 19), at(-5, 22), 0, 80],
    [10, "Games Night", "Bring friends or come alone, we'll find you a table.", "Student Centre, Room 2", at(-6, 18), at(-6, 22), 0, null],
    [5, "Intro to Investing Workshop", "How the stock market works, ETFs, and how to start small.", "Quinn School Q0.12", at(-7, 17), at(-7, 18, 30), 0, 60],
    [8, "Hack Night", "Bring a project or join one. Pizza at 8pm.", "Computer Science Building, Lab 1", at(-4, 18), at(-4, 23), 0, 50],
    [6, "Climbing Wall Session", "Indoor bouldering, gear provided. Beginners very welcome.", "UCD Sport Centre", at(-3, 19), at(-3, 21), 0, 25],
    // --- upcoming events ---
    [1, "Calligraphy Workshop", "Learn the basics of shodō. Materials provided.", "Newman Building J204", at(1, 17), at(1, 19), 0, 30],
    [1, "Japanese Language Exchange", "Weekly exchange, all levels welcome.", "Global Lounge", at(3, 18), at(3, 20), 0, null],
    [2, "Table de Conversation", "French conversation, beginner and intermediate tables.", "Newman Building G15", at(2, 13), at(2, 14), 0, null],
    [2, "Crêpe Day", "Free crêpes for members, €1 for everyone else.", "Student Centre Foyer", at(4, 12), at(4, 14), 0, null],
    [3, "Stammtisch", "Relaxed German conversation over drinks.", "Student Bar", at(2, 19), at(2, 21), 0, null],
    [4, "Founder Fireside Chat", "A UCD alumnus on building their first startup.", "O'Reilly Hall", at(3, 18, 30), at(3, 20), 0, 200],
    [4, "Pitch Night", "Pitch your idea in 3 minutes, get feedback from founders.", "Quinn School Q0.18", at(9, 18), at(9, 20), 0, 40],
    [5, "Stock Pitch Competition Info Session", "Teams, rules and prizes for this year's competition.", "Quinn School Q0.12", at(5, 17), at(5, 18), 0, null],
    [6, "Wicklow Way Weekend Trip", "Two days hiking the Wicklow Way. Price includes bus, hostel and dinner.", "Departs from UCD main entrance", at(7, 8), at(8, 18), 2000, 30],
    [6, "Climbing Wall Session", "Indoor bouldering, gear provided.", "UCD Sport Centre", at(4, 19), at(4, 21), 0, 25],
    [7, "Engineering Ball", "Black-tie ball with dinner, band and DJ. Ticket includes a three-course meal.", "Clayton Hotel Burlington Road", at(12, 19), at(13, 1), 3000, 250],
    [7, "Industry Night", "Meet engineering employers hiring interns and graduates.", "Engineering Building Atrium", at(6, 18), at(6, 21), 0, null],
    [8, "Coding Interview Prep", "Mock interviews and LeetCode practice in pairs.", "Computer Science Building, Lab 2", at(2, 18), at(2, 20), 0, 40],
    [9, "Improv Workshop", "No experience needed. Wear comfy clothes.", "Dramsoc Theatre", at(1, 18), at(1, 20), 0, 25],
    [9, "Autumn Production: Twelfth Night", "Our first production of the year.", "Astra Hall", at(10, 19, 30), at(10, 22), 800, 150],
    [10, "Games Night", "Weekly games night. New games just arrived!", "Student Centre, Room 2", at(1, 18), at(1, 22), 0, null],
  ];
  for (const [society_id, title, description, venue, start, end, price_cents, capacity] of events) {
    add("events", { society_id, title, description, venue, start, end, price_cents, capacity, created_via: "manual" });
  }

  // ---------- follows ----------
  for (const [u, s] of [[1, 1], [1, 6], [1, 8], [2, 4], [2, 5], [3, 2], [3, 10], [4, 7]]) {
    addKeyed("follows", { user_id: u, society_id: s }, `${u}:${s}`);
  }

  // ---------- RSVPs + reviews (only RSVP'd students can review) ----------
  const reviews = [
    // [user, event, stars, comment]
    [1, 1, 5, "Really welcoming, paired me with a native speaker straight away."],
    [2, 1, 4, "Good event, a bit crowded towards the end."],
    [3, 1, 5, "Best language exchange on campus."],
    [1, 2, 5, "Great film choice and the discussion after was fun."],
    [4, 2, 4, "Nice night, projector was a bit dim."],
    [2, 3, 4, "Loads of games and the committee explained the rules well."],
    [3, 3, 3, "Fun but hard to find a table, it was packed."],
    [1, 4, 2, "Started 25 minutes late and the slides were hard to follow."],
    [2, 4, 2, "Felt like a sales pitch for a bank, not a workshop."],
    [4, 4, 3, "Some useful bits on ETFs but too rushed."],
    [1, 5, 5, "Super chill, got help with my project from a final-year."],
    [3, 5, 4, "Good vibes, pizza ran out quickly though."],
    [1, 6, 5, "Instructors were great with beginners."],
    [4, 6, 4, "Good session, would like longer slots."],
  ];
  const rsvp = (u, e) => addKeyed("rsvps", { user_id: u, event_id: e }, `${u}:${e}`);
  for (const [u, e, stars, comment] of reviews) {
    rsvp(u, e);
    add("reviews", { user_id: u, event_id: e, stars, comment, moderation: "ok", created_at: now }, `${u}:${e}`);
  }
  // Attended but not reviewed yet, so the demo can show leaving a review live.
  for (const [u, e] of [[1, 3], [4, 5], [2, 6], [3, 2]]) rsvp(u, e);
  // Upcoming RSVPs so attendance numbers aren't all zero.
  for (const [u, e] of [[1, 7], [2, 7], [3, 9], [1, 19], [4, 18]]) rsvp(u, e);

  // ---------- society profiles + a few reviews of societies as a whole ----------
  tables.societies[1].bio =
    "We're a friendly mix of Japanese and Irish students. Every week we run a language exchange, and every month something bigger: anime screenings, calligraphy, a sushi night or the cultural festival in spring. No Japanese needed to join!";
  tables.societies[1].committee_json = JSON.stringify([
    { name: "Hana S.", role: "Auditor", bio: "Final-year Commerce, runs the language exchange." },
    { name: "Conor D.", role: "Treasurer", bio: "Learning Japanese for three years and counting." },
    { name: "Yuki T.", role: "Events Officer", bio: "Organises the anime nights and the festival." },
  ]);
  tables.societies[6].bio =
    "From Tuesday climbing-wall sessions to weekend trips in Wicklow, Connemara and the Mournes. Gear is provided for beginners and every trip has a qualified leader.";
  tables.societies[6].committee_json = JSON.stringify([
    { name: "Aisling R.", role: "Captain", bio: "Mountain leader, loves a wet day in Glendalough." },
    { name: "Tom B.", role: "Safety Officer", bio: "First-aid trained, checks every route twice." },
  ]);
  for (const [u, s, stars, comment] of [
    [1, 1, 5, "The most welcoming society I've joined. The committee remembers your name after one event."],
    [3, 1, 4, "Great mix of events every week. The festival is the highlight."],
    [4, 6, 5, "Really well organised trips, and they look after beginners properly."],
  ]) {
    add("society_reviews", { user_id: u, society_id: s, stars, comment, moderation: "ok", created_at: now, updated_at: now }, `${u}:${s}`);
  }

  // ---------- something waiting in the SocSync admin's review queue, to demo verification live ----------
  const liam = addUser({ name: "Liam Kelly (new signup)", student_number: "24112233", email: "liam.kelly@ucdconnect.ie", status: "pending" });
  newSociety({
    name: "Anime & Manga Society", category: "Arts & Performance", fee: 300, status: "pending",
    description: "Weekly screenings, manga library and a yearly convention trip.",
    applicant_user_id: liam.id, applicant_role: "Auditor", applied_at: now,
    evidence: "Listed on the Students' Union societies page. I was elected auditor at our AGM on 2 October.",
  });

  // The SocSync (platform) admin. Always exists.
  addUser({ name: "SocSync Admin (you)", student_number: "00000000", role: "platform" });

  // ---------- write everything in one batch ----------
  const p = redis.pipeline();
  for (const [table, rows] of Object.entries(tables)) p.hset(keys.table(table), rows);
  for (const [table, last] of Object.entries(counters)) p.set(keys.seq(table), last);
  p.hset(keys.index("users_email"), indexes.users_email);
  p.hset(keys.index("users_student_number"), indexes.users_student_number);
  await p.exec();
}
