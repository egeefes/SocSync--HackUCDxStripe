import Link from "next/link";
import { ArrowUpRight, Bookmark, Clock3, MapPin, Sparkles, Star, Users } from "lucide-react";
import type { EventView } from "@/lib/types";
import { eur } from "@/lib/format";

export function EventCard({ event, saved, onSave, reason }: { event: EventView; saved?: boolean; onSave?: () => void; reason?: string }) {
  const href = `/events/${event.id}`;
  return <article className="event-card">
    <Link className="event-image-button" href={href} aria-label={`View ${event.title}`}>
      <div className="event-image" style={{ backgroundImage: `url(${event.image})` }}>
        <span className={`category-chip ${event.color}`}>{event.category}</span>
        <span className="event-date"><strong>{event.day}</strong><span>{event.date}</span></span>
      </div>
    </Link>
    {onSave && <button className={`save-button ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={saved ? "Unsave event" : "Save event"}><Bookmark size={16} fill={saved ? "currentColor" : "none"}/></button>}
    <div className="event-card-content">
      <span className="event-society">{event.societyAvatar ? <img className="event-society-avatar" src={event.societyAvatar} alt="" /> : null}{event.societyName}{event.rating && <span className="mini-rating"><Star size={10} fill="currentColor"/>{event.rating.avg.toFixed(1)}</span>}</span>
      <Link className="event-title-button" href={href}><h3>{event.title}</h3></Link>
      <div className="event-time"><Clock3 size={14}/>{event.time}<span>·</span><MapPin size={14}/><span className="location-text">{event.location}</span></div>
      {reason && <p className="event-reason"><Sparkles size={11}/>{reason}</p>}
      <div className="event-card-bottom">
        <span className="attendee-count"><Users size={15}/><strong>{event.going}</strong> going{event.spotsLeft === 0 && <em className="full-tag">FULL</em>}</span>
        <div className="event-price">{event.price === 0 ? <span className="free-tag">FREE</span> : eur(event.price)}
          <Link className="round-arrow" href={href} aria-label={`Open ${event.title}`}><ArrowUpRight size={17}/></Link>
        </div>
      </div>
    </div>
  </article>;
}
