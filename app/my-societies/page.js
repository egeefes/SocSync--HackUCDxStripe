// My societies: digital membership cards, all tickets (paid + free reserved, each with a QR code)
// and the societies the student follows.
import Link from "next/link";
import { ArrowRight, IdCard, Ticket } from "lucide-react";
import MembershipCard from "@/components/MembershipCard";
import TicketCard from "@/components/TicketCard";
import SocietyCard from "@/components/SocietyCard";
import { pageUser } from "@/lib/session";
import { myMemberships, myTickets, myReservations, mySocieties } from "@/lib/queries";
import { nowLocal } from "@/lib/format";

export default async function MySocietiesPage() {
  const user = await pageUser({ role: "student" });
  const [memberships, tickets, reservations, followed] = await Promise.all([
    myMemberships(user.id),
    myTickets(user.id),
    myReservations(user.id),
    mySocieties(user.id),
  ]);
  const now = nowLocal();
  // Paid tickets + free reservations, upcoming first (soonest first), then past ones.
  const all = [...tickets.map((t) => ({ ...t, kind: "paid" })), ...reservations];
  const upcoming = all.filter((t) => t.start >= now).sort((a, b) => a.start.localeCompare(b.start));
  const past = all.filter((t) => t.start < now).sort((a, b) => b.start.localeCompare(a.start));
  const following = followed.filter((s) => !s.is_member).map((s) => ({ ...s, is_following: 1 }));

  return (
    <>
      <section className="results-section !pt-0">
        <div className="section-heading">
          <div><div className="eyebrow">PAID MEMBERSHIPS</div><h2>Membership cards</h2></div>
          <Link className="view-all" href="/societies">Join another society <ArrowRight size={15} /></Link>
        </div>
        {memberships.length ? (
          <div className="card-grid">{memberships.map((m) => <MembershipCard key={m.payment_id} m={m} />)}</div>
        ) : (
          <div className="empty-state"><IdCard size={22} /><strong>No memberships yet</strong>
            <p>Open a society and tap &quot;Join&quot; to pay its membership fee. Your card appears here.</p></div>
        )}
      </section>

      <section className="results-section" id="tickets">
        <div className="section-heading">
          <div><div className="eyebrow">FREE &amp; PAID EVENTS</div><h2>My tickets <span className="result-count">{upcoming.length}</span></h2></div>
          <Link className="view-all" href="/calendar">Open calendar <ArrowRight size={15} /></Link>
        </div>
        {upcoming.length ? (
          <div className="ticket-list">{upcoming.map((t) => <TicketCard key={`${t.kind}-${t.payment_id ?? t.event_id}`} t={t} />)}</div>
        ) : (
          <div className="empty-state"><Ticket size={22} /><strong>No upcoming tickets</strong>
            <p>Reserve a free spot or buy a ticket and it shows up here with a QR code.</p>
            <Link className="primary-button small" href="/#events">Find events</Link></div>
        )}
        {past.length > 0 && (
          <>
            <h3 className="sub-h small">Past events</h3>
            <div className="ticket-list">{past.map((t) => <TicketCard key={`${t.kind}-${t.payment_id ?? t.event_id}`} t={t} />)}</div>
          </>
        )}
      </section>

      {following.length > 0 && (
        <section className="societies-section">
          <div className="section-heading"><div><div className="eyebrow">NOT A MEMBER YET</div><h2>Following</h2></div></div>
          <div className="society-grid">{following.map((s) => <SocietyCard key={s.id} society={s} />)}</div>
        </section>
      )}
    </>
  );
}
