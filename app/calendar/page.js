// Calendar view: my societies' events (or everyone's) in week / month / list form.
import Link from "next/link";
import Calendar from "@/components/Calendar";
import FilterBar from "@/components/FilterBar";
import { pageUser } from "@/lib/session";
import { listEvents } from "@/lib/queries";

export default async function CalendarPage({ searchParams }) {
  const user = await pageUser({ role: "student" });
  const { view = "mine", q = "", category = "" } = await searchParams;
  const mine = view !== "all";
  const events = await listEvents({ search: q, category, followedBy: mine ? user.id : null });

  const tab = (v, label) => (
    <Link href={`/calendar?view=${v}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${(v === "mine") === mine ? "bg-accent text-white" : "hover:bg-accent-soft"}`}>
      {label}
    </Link>
  );

  return (
    <section className="space-y-4">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{mine ? "FROM SOCIETIES YOU FOLLOW" : "EVERY SOCIETY ON CAMPUS"}</div>
          <h2>{mine ? "My calendar" : "All society events"}</h2>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {tab("mine", "My societies")}
          {tab("all", "All societies")}
        </div>
      </div>
      <FilterBar q={q} category={category} hidden={{ view }} placeholder="Search events…" />
      <p className="text-xs text-muted">{events.length} events · click one for details</p>
      <div className="calendar-wrap"><Calendar events={events} /></div>
    </section>
  );
}
