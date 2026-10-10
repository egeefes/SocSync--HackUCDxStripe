// Event card with photo, date badge, category chip, price and attendance (CampusLoop design).
import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, Sparkles, Users } from "lucide-react";
import { euro } from "@/lib/format";
import { dateParts, eventPhoto, styleFor } from "@/lib/ui";

export default function EventCard({ event, reason, going = false }) {
  const { day, date, time } = dateParts(event.start);
  const full = event.capacity != null && event.going >= event.capacity;
  return (
    <Link href={`/events/${event.id}`} className="event-card">
      <div className="event-image" style={{ backgroundImage: `url(${eventPhoto(event)})`, backgroundColor: "#ece8f7", backgroundPosition: event.has_poster ? "center 12%" : undefined }}>
        <span className={`category-chip ${styleFor(event.category).chip}`}>{event.category}</span>
        <span className="event-date"><strong>{day}</strong><span>{date}</span></span>
        {going && <span className="going-badge">✓ YOU&apos;RE GOING</span>}
      </div>
      <div className="event-card-content">
        <span className="event-society">
          {event.society_has_avatar ? (
            <span className="event-society-logo" aria-hidden="true"
              style={{ backgroundImage: `url(/api/societies/${event.society_id}/image/avatar?v=${encodeURIComponent(event.society_media_version ?? "")})` }} />
          ) : null}
          {event.society_name}
        </span>
        <h3 className="event-title">{event.title}</h3>
        <div className="event-time">
          <Clock3 size={14} />{time}<span>·</span><MapPin size={14} /><span className="location-text">{event.venue}</span>
        </div>
        {reason && <p className="event-reason"><Sparkles size={11} />{reason}</p>}
        <div className="event-card-bottom">
          <span className="attendee-count">
            <Users size={15} /><strong>{event.going ?? 0}</strong> going{full && <em className="full-tag">FULL</em>}
          </span>
          <div className="event-price">
            {event.price_cents ? euro(event.price_cents) : <span className="free-tag">FREE</span>}
            <span className="round-arrow"><ArrowUpRight size={17} /></span>
          </div>
        </div>
      </div>
    </Link>
  );
}
