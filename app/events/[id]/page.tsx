import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Reviews } from "@/components/Reviews";
import { TicketPanel } from "@/components/TicketPanel";
import { RatingBadge } from "@/components/Stars";
import { eventView, findEvent, getCurrentUser, reviewsFor } from "@/lib/domain";
import { nowDublin, parts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { id: string } }) {
  const { db, user } = await getCurrentUser();
  const raw = findEvent(db, Number(params.id));
  if (!raw) notFound();
  const e = eventView(db, raw);
  const ticket = user ? db.tickets.find((t) => t.userId === user.id && t.eventId === e.id) : undefined;
  const societyMembership = user ? db.memberships.find((m) => m.userId === user.id && m.societyId === e.societyId && m.status === "confirmed") : undefined;
  const reviews = reviewsFor(db, "event", String(e.id), user?.id);
  const p = parts(e.startsAt);
  const pct = Math.min(100, Math.round((e.going / e.capacity) * 100));
  return <PageShell crumb="Event">
    <div className="detail-hero" style={{ backgroundImage: `url(${e.image})` }}><span className={`category-chip ${e.color}`}>{e.category}</span></div>
    <div className="detail-grid">
      <div className="detail-main">
        <Link className="event-society linkish" href={`/societies/${e.societyId}`}>{e.societyName}</Link>
        <h1 className="detail-title">{e.title}</h1>
        <RatingBadge rating={e.rating} empty="Not reviewed yet"/>
        <p className="modal-description">{e.description}</p>
        <div className="modal-meta detail-meta">
          <span><CalendarDays size={16}/>{p.long}</span>
          <span><Clock3 size={16}/>{p.time}</span>
          <span><MapPin size={16}/>{e.location}</span>
          <span><Users size={16}/>{e.going} going</span>
        </div>
        <div className="capacity">
          <div className="capacity-row"><strong>{e.going} going</strong><span>{e.spotsLeft === 0 ? "Full" : `${e.spotsLeft} of ${e.capacity} spots left`}</span></div>
          <div className="capacity-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }}/></div>
          <p className="demo-disclaimer">Going count = free reservations + paid tickets on SocSync, plus illustrative demo attendance for seeded events.</p>
        </div>
        <Reviews targetType="event" targetId={String(e.id)} targetName={e.title} reviews={reviews} rating={e.rating} signedIn={!!user} nextPath={`/events/${e.id}`}/>
      </div>
      <aside className="detail-side">
        <TicketPanel eventId={e.id} price={e.price} status={ticket ? ticket.kind : "none"} ticketId={ticket?.id}
          spotsLeft={e.spotsLeft} started={e.startsAt < nowDublin()} signedIn={!!user} societyMember={!!societyMembership} societyId={e.societyId} nextPath={`/events/${e.id}`}/>
      </aside>
    </div>
  </PageShell>;
}
