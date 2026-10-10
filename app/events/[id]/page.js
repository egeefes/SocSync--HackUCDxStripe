// One event (CampusLoop design): photo hero, details, capacity, RSVP (free) or buy ticket (paid, via
// Stripe) with QR ticket, Google Calendar, and attendee reviews + rating form.
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Check, Clock3, MapPin, Sparkles, Star, Ticket } from "lucide-react";
import ActionButton from "@/components/ActionButton";
import ReviewForm from "@/components/ReviewForm";
import Flash from "@/components/Flash";
import TicketCard from "@/components/TicketCard";
import { Stars } from "@/components/Stars";
import { pageUser } from "@/lib/session";
import { getEvent, eventReviews, reviewBlockReason, myTickets } from "@/lib/queries";
import { euro, when, nowLocal, googleCalendarLink } from "@/lib/format";
import { eventPhoto, styleFor } from "@/lib/ui";

export default async function EventPage({ params, searchParams }) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const user = await pageUser();
  const event = await getEvent(Number(id), user.id);
  if (!event) notFound();

  const reviews = await eventReviews(event.id);
  const isPast = event.start < nowLocal();
  const spotsTaken = event.price_cents ? event.tickets_sold : event.rsvp_count;
  const full = event.capacity != null && spotsTaken >= event.capacity;
  const blocked = reviewBlockReason(event, user);
  // Paid ticket, or (for free events) the reserved ticket that an RSVP gives you, each with a QR code.
  const ticket = event.has_ticket
    ? { ...(await myTickets(user.id)).find((t) => t.event_id === event.id), kind: "paid" }
    : event.has_rsvp && !event.price_cents
      ? { kind: "reserved", user_id: user.id, event_id: event.id, title: event.title, start: event.start, venue: event.venue, society_name: event.society_name }
      : null;
  const society = { category: event.category };

  return (
    <>
      <Flash checkout={checkout} />
      <div className="detail-hero" style={{ backgroundImage: `url(${eventPhoto({ ...event, category: society.category, has_poster: 0 }) /* full poster is shown in the side panel */})` }}>
        <span className={`category-chip ${styleFor(society.category).chip}`}>{society.category}</span>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section>
            <Link className="event-society linkish" href={`/societies/${event.society_id}`}>{event.society_name}</Link>
            <h1 className="detail-title">{event.title}</h1>
            <div className="modal-meta detail-meta">
              <span><CalendarDays size={15} />{when(event.start)}</span>
              <span><Clock3 size={15} />{event.end ? `until ${when(event.end)}` : "End time TBC"}</span>
              <span><MapPin size={15} />{event.venue}</span>
              <span><Ticket size={15} />{event.price_cents ? euro(event.price_cents) : "Free"}</span>
            </div>
            {event.description && <p className="modal-description">{event.description}</p>}
            {event.created_via === "ai" && <p className="event-reason"><Sparkles size={11} /> Imported from the society&apos;s poster with AI and checked by the society.</p>}
          </section>

          <div className="capacity">
            <div className="capacity-row">
              <strong>{spotsTaken} going</strong>
              <span>{event.capacity ? `${Math.max(event.capacity - spotsTaken, 0)} of ${event.capacity} spots left` : "No capacity limit"}</span>
            </div>
            {event.capacity && <div className="capacity-bar"><div style={{ width: `${Math.min(100, (spotsTaken / event.capacity) * 100)}%` }} /></div>}
          </div>

          {ticket && (
            <section id="your-ticket">
              <h2 className="sub-h">Your ticket</h2>
              <TicketCard t={ticket} />
            </section>
          )}

          <section className="reviews">
            <div className="section-heading">
              <div><div className="eyebrow">FROM PEOPLE WHO WENT</div><h2 className="sub-h !m-0">Reviews</h2></div>
              {event.avg_rating != null && (
                <div className="review-summary"><strong>{Number(event.avg_rating).toFixed(1)}</strong>
                  <div><Stars value={event.avg_rating} /><span>{reviews.length} verified reviews</span></div></div>
              )}
            </div>
            {user.role === "student" && (blocked ? <p className="review-signin">{blocked}</p> : <div className="mb-4"><ReviewForm eventId={event.id} /></div>)}
            {reviews.length === 0 ? (
              <div className="empty-state"><Star size={22} /><strong>No reviews yet</strong><p>Attendees can review after the event.</p></div>
            ) : (
              <ul className="review-list">
                {reviews.map((r) => (
                  <li key={r.id} className="review-item">
                    <div className="review-avatar">{r.user_name.charAt(0)}</div>
                    <div className="review-body">
                      <div className="review-meta"><Stars value={r.stars} size={13} /><span className="verified-badge"><BadgeCheck size={11} /> Verified attendee</span></div>
                      <p>{r.comment}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------- Action panel ---------- */}
        <aside className="detail-side">
          {event.has_poster ? (
            <a href={`/api/events/${event.id}/poster`} target="_blank" rel="noopener noreferrer" className="mb-4 block">
              {/* eslint-disable-next-line @next/next/no-img-element -- served from our own API route */}
              <img src={`/api/events/${event.id}/poster`} alt={`Poster for ${event.title}`} className="w-full rounded-2xl border border-[#efedf3] shadow-sm" />
            </a>
          ) : null}
          <div className="action-panel">
            <span className="price-label">{event.price_cents ? "TICKET PRICE" : "ENTRY"}</span>
            <div className="action-price">{event.price_cents ? euro(event.price_cents) : "Free"}</div>
            {isPast ? (
              <p className="text-sm text-muted">This event has already happened.</p>
            ) : user.role !== "student" ? (
              <p className="text-sm text-muted">Students RSVP or buy tickets here.</p>
            ) : (
              <>
                {event.price_cents > 0 ? (
                  event.has_ticket ? (
                    <div className="going-note"><Check size={16} /> You have a ticket</div>
                  ) : full ? (
                    <div className="pending-note">Sold out</div>
                  ) : (
                    <ActionButton endpoint="/api/stripe/checkout" body={{ kind: "ticket", eventId: event.id }} className="[&>button]:w-full">
                      Buy ticket · {euro(event.price_cents)}
                    </ActionButton>
                  )
                ) : (
                  <>
                    {event.has_rsvp && <div className="going-note"><Check size={16} /> You&apos;re going · free ticket reserved</div>}
                    {event.has_rsvp && <a className="primary-button" href="#your-ticket">View my ticket &amp; QR code</a>}
                    <ActionButton endpoint="/api/rsvp" body={{ eventId: event.id }} variant={event.has_rsvp ? "secondary" : "primary"} className="[&>button]:w-full">
                      {event.has_rsvp ? "Cancel reservation" : full ? "Full" : "Reserve free ticket"}
                    </ActionButton>
                  </>
                )}
                {event.in_google ? (
                  <span className="btn-secondary w-full">📅 In your Google Calendar ✓</span>
                ) : (
                  <a href={googleCalendarLink(event)} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">📅 Add to Google Calendar</a>
                )}
                {event.price_cents > 0 && !event.has_ticket && <p className="demo-disclaimer">Secure card payment via Stripe (sandbox). Your ticket and QR code appear here and under My societies.</p>}
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
