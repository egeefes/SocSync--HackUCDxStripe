import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { eventView, findEvent, getCurrentUser } from "@/lib/domain";
import { nowDublin, parts } from "@/lib/format";

export const dynamic = "force-dynamic";
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shift(y: number, m: number, by: number) {
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const { db, user } = await getCurrentUser();
  if (!user) redirect("/signin?next=/calendar");
  const today = nowDublin().slice(0, 10);
  const key = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") ? searchParams.m! : today.slice(0, 7);
  const [y, m] = key.split("-").map(Number);
  const first = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mine = db.tickets.filter((t) => t.userId === user.id)
    .map((t) => findEvent(db, t.eventId)).filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => eventView(db, e)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const byDay = new Map<string, typeof mine>();
  for (const e of mine) { const k = e.startsAt.slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), e]); }
  const inMonth = mine.filter((e) => e.startsAt.startsWith(key));
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IE", { month: "long", year: "numeric", timeZone: "UTC" });
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i - first + 1);

  return <PageShell crumb="Calendar">
    <div className="section-heading"><div><div className="eyebrow">EVENTS YOU'RE GOING TO</div><h2>{title}</h2></div>
      <div className="heading-actions"><Link className="icon-button" href={`/calendar?m=${shift(y, m, -1)}`} aria-label="Previous month"><ChevronLeft size={18}/></Link>
        <Link className="filter-button" href="/calendar">Today</Link>
        <Link className="icon-button" href={`/calendar?m=${shift(y, m, 1)}`} aria-label="Next month"><ChevronRight size={18}/></Link></div></div>
    <div className="calendar">
      {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
      {cells.map((n, i) => {
        if (n < 1 || n > days) return <div className="cal-cell empty" key={i}/>;
        const iso = `${key}-${String(n).padStart(2, "0")}`;
        const es = byDay.get(iso) ?? [];
        return <div className={`cal-cell ${iso === today ? "today" : ""} ${es.length ? "has" : ""}`} key={i}>
          <span className="cal-num">{n}</span>
          {es.slice(0, 2).map((e) => <Link key={e.id} href={`/events/${e.id}`} className={`cal-event ${e.color}`} title={e.title}>{e.time} {e.title}</Link>)}
          {es.length > 2 && <span className="cal-more">+{es.length - 2} more</span>}
        </div>;
      })}
    </div>
    <section className="results-section">
      <div className="section-heading"><div><div className="eyebrow">THIS MONTH</div><h2>Your events <span className="result-count">{inMonth.length}</span></h2></div></div>
      {inMonth.length === 0 ? <div className="empty-state"><strong>Nothing planned for {title}</strong><p>Reserve a free ticket or buy one and it will show up here.</p><Link className="primary-button small" href="/">Find events</Link></div> :
        <ul className="agenda">{inMonth.map((e) => { const p = parts(e.startsAt); return <li key={e.id}>
          <div className="agenda-date"><strong>{p.day}</strong><span>{p.date}</span></div>
          <div className="agenda-body"><Link href={`/events/${e.id}`}>{e.title}</Link><span className="event-society">{e.societyName}</span>
            <div className="ticket-meta"><span><Clock3 size={13}/>{p.time}</span><span><MapPin size={13}/>{e.location}</span><span>{e.going} going</span></div></div></li>; })}</ul>}
    </section>
  </PageShell>;
}
