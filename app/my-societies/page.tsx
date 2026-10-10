import Link from "next/link";
import { redirect } from "next/navigation";
import { IdCard, Ticket } from "lucide-react";
import { MembershipCard } from "@/components/MembershipCard";
import { PageShell } from "@/components/PageShell";
import { TicketCard } from "@/components/TicketCard";
import { eventView, findEvent, findSociety, getCurrentUser } from "@/lib/domain";
import { nowDublin } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MySocieties() {
  const { db, user } = await getCurrentUser();
  if (!user) redirect("/signin?next=/my-societies");
  const now = nowDublin();
  const memberships = db.memberships.filter((m) => m.userId === user.id)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const tickets = db.tickets.filter((t) => t.userId === user.id)
    .map((t) => ({ t, e: findEvent(db, t.eventId) })).filter((x): x is { t: typeof x.t; e: NonNullable<typeof x.e> } => !!x.e)
    .sort((a, b) => a.e.startsAt.localeCompare(b.e.startsAt));
  const upcoming = tickets.filter((x) => x.e.startsAt >= now), past = tickets.filter((x) => x.e.startsAt < now);

  return <PageShell crumb="My societies">
    <section className="results-section" style={{ paddingTop: 0 }}>
      <div className="section-heading"><div><div className="eyebrow">YOUR MEMBERSHIPS</div><h2>My societies</h2></div><Link className="view-all" href="/societies">Find societies</Link></div>
      {memberships.length === 0 ? <div className="empty-state"><IdCard size={24}/><strong>You haven't joined a society yet</strong><p>Membership is €2 per society and gives you a digital membership card.</p><Link className="primary-button small" href="/societies">Browse societies</Link></div> :
        <div className="card-grid">{memberships.map((m) => { const s = findSociety(m.societyId); if (!s) return null; const profile = db.societyProfiles?.[s.id];
          return <MembershipCard key={m.id} societyId={s.id} societyName={s.name} color={s.color} status={m.status} memberName={user.name} studentNumber={user.studentNumber} membershipId={m.id} paidAt={m.paidAt} backgroundImage={profile?.membershipCardBackground}/>; })}</div>}
    </section>

    <section className="results-section" id="tickets">
      <div className="section-heading"><div><div className="eyebrow">YOUR PLANS</div><h2>My tickets</h2></div><Link className="view-all" href="/calendar">Open calendar</Link></div>
      {tickets.length === 0 ? <div className="empty-state"><Ticket size={24}/><strong>No tickets yet</strong><p>Reserve a free spot or buy a ticket to see it here with its QR code.</p><Link className="primary-button small" href="/">Find events</Link></div> :
        <div className="ticket-list">
          {await Promise.all(upcoming.map(({ t, e }) => <TicketCard key={t.id} ticket={t} event={eventView(db, e)} past={false}/>))}
          {await Promise.all(past.map(({ t, e }) => <TicketCard key={t.id} ticket={t} event={eventView(db, e)} past/>))}
        </div>}
    </section>
  </PageShell>;
}
