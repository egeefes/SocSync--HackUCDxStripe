// Student home (CampusLoop design): hero, Google Calendar, AI finder, stats, my societies,
// upcoming events (search / interest / free filters) and societies worth a look.
import Link from "next/link";
import { ArrowRight, CalendarDays, Heart, Music2, Search, Sparkles, Users } from "lucide-react";
import Flash from "@/components/Flash";
import GoogleCalendarCard from "@/components/GoogleCalendarCard";
import AiFinder from "@/components/AiFinder";
import EventCard from "@/components/EventCard";
import SocietyCard from "@/components/SocietyCard";
import { googleConfigured } from "@/lib/google";
import db, { CATEGORIES } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { listEvents, listSocieties, mySocieties } from "@/lib/queries";
import { nowLocal } from "@/lib/format";

export default async function Home({ searchParams }) {
  const user = await pageUser({ role: "student" }); // society / SocSync admins are sent to their own home
  const { q = "", category = "", free = "", checkout, google, reason, added } = await searchParams;
  const now = nowLocal();

  const mine = mySocieties(user.id).map((s) => ({ ...s, is_following: 1 }));
  const goingIds = new Set(db.prepare("SELECT event_id FROM rsvps WHERE user_id = ?").all(user.id).map((r) => r.event_id));
  const upcoming = listEvents({ search: q, category: CATEGORIES.includes(category) ? category : "" })
    .filter((e) => e.start >= now)
    .filter((e) => !free || !e.price_cents);
  const allUpcoming = listEvents().filter((e) => e.start >= now);
  const others = listSocieties({ userId: user.id }).filter((s) => !s.is_member && !s.is_following).slice(0, 4);
  const { n: syncedCount } = db
    .prepare("SELECT COUNT(*) AS n FROM google_events g JOIN events e ON e.id = g.event_id WHERE g.user_id = ? AND e.start >= ?")
    .get(user.id, now);
  const firstName = user.name.split(" ")[0];

  // Keep the other filters when changing one.
  const href = (changes) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...(free && { free }), ...changes });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/?${p}#events`;
  };

  return (
    <>
      <Flash checkout={checkout} google={google} reason={reason} added={added} />

      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> HI {firstName.toUpperCase()}, YOUR CAMPUS, MORE YOU</div>
          <h1>Find your <em>people.</em><br />Find your thing.</h1>
          <p className="welcome-copy">
            Every society event at UCD in one place.<br className="desktop-break" /> Follow, join and rate the ones that make it yours.
          </p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-sun" /><div className="art-ring ring-one" /><div className="art-ring ring-two" />
          <div className="art-card art-card-one"><Music2 size={18} /><span>Good people</span></div>
          <div className="art-card art-card-two"><Sparkles size={17} /><span>New things</span></div>
          <div className="art-orb">✳</div><div className="art-note">YOUR NEXT CHAPTER ↗</div>
        </div>
      </section>

      <div className="mb-5">
        <GoogleCalendarCard configured={googleConfigured()} email={user.google_email} syncedCount={syncedCount} ucdEmail={user.email} />
      </div>

      <AiFinder />

      <section className="stats-strip">
        <div className="stat-item"><span className="stat-icon stat-purple"><Users size={17} /></span><div><strong>{mine.length} societies</strong><span>you follow or joined</span></div></div>
        <div className="stat-divider" />
        <div className="stat-item"><span className="stat-icon stat-coral"><CalendarDays size={17} /></span><div><strong>{allUpcoming.length} events</strong><span>coming up on campus</span></div></div>
        <div className="stat-divider" />
        <div className="stat-item"><span className="stat-icon stat-green"><Heart size={17} /></span><div><strong>{allUpcoming.filter((e) => goingIds.has(e.id)).length} going</strong><span>events you RSVP&apos;d to</span></div></div>
      </section>

      {/* ---------- My societies ---------- */}
      <section className="societies-section !mt-0 !border-t-0">
        <div className="section-heading">
          <div><div className="eyebrow">YOUR PEOPLE</div><h2>My societies</h2></div>
          <Link className="view-all" href="/my-societies">Membership cards &amp; tickets <ArrowRight size={15} /></Link>
        </div>
        {mine.length ? (
          <div className="society-grid">{mine.map((s) => <SocietyCard key={s.id} society={s} />)}</div>
        ) : (
          <div className="empty-state"><Users size={22} /><strong>No societies yet</strong><p>Follow or join a few and their events land in your calendar.</p>
            <Link className="primary-button small" href="/societies">Find societies</Link></div>
        )}
      </section>

      {/* ---------- Upcoming events ---------- */}
      <section className="events-section" id="events">
        <div className="section-heading">
          <div><div className="eyebrow">OUT THERE SOON</div><h2>Find something good <span className="heading-spark">✳</span></h2></div>
          <div className="heading-actions">
            <Link className="view-all" href="/calendar">Calendar view <ArrowRight size={15} /></Link>
          </div>
        </div>
        <form className="search-filter-row" action="/#events">
          {category && <input type="hidden" name="category" value={category} />}
          {free && <input type="hidden" name="free" value={free} />}
          <label className="search-box"><Search size={17} /><input name="q" defaultValue={q} placeholder="Search events, societies, interests…" aria-label="Search events" /></label>
          <Link className={`free-filter ${free ? "selected" : ""}`} href={href({ free: free ? "" : "1" })}>Free only</Link>
        </form>
        <div className="interest-filter">
          <Link className={!category ? "on" : ""} href={href({ category: "" })}>All events</Link>
          {CATEGORIES.map((c) => <Link key={c} className={category === c ? "on" : ""} href={href({ category: c })}>{c}</Link>)}
        </div>
        {upcoming.length ? (
          <div className="event-grid">{upcoming.map((e) => <EventCard key={e.id} event={e} going={goingIds.has(e.id)} />)}</div>
        ) : (
          <div className="empty-state"><Search size={24} /><strong>No events found</strong><p>Try another search or clear your filters.</p>
            <Link className="text-button" href="/#events">Clear filters</Link></div>
        )}
      </section>

      {others.length > 0 && (
        <section className="societies-section">
          <div className="section-heading">
            <div><div className="eyebrow">YOUR PEOPLE MIGHT BE HERE</div><h2>Societies worth a look</h2></div>
            <Link className="view-all" href="/societies">Explore societies <ArrowRight size={15} /></Link>
          </div>
          <div className="society-grid">{others.map((s) => <SocietyCard key={s.id} society={s} />)}</div>
        </section>
      )}
    </>
  );
}
