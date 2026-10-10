import { notFound } from "next/navigation";
import { Globe2, Instagram, Mail, MessageCircle, Users } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { JoinPanel } from "@/components/JoinPanel";
import { PageShell } from "@/components/PageShell";
import { Reviews } from "@/components/Reviews";
import { RatingBadge } from "@/components/Stars";
import { allEvents, eventView, findSociety, getCurrentUser, reviewsFor, societyView } from "@/lib/domain";
import { formatCount, nowDublin } from "@/lib/format";

export const dynamic = "force-dynamic";
const SOCIAL_ICON = { instagram: Instagram, discord: MessageCircle, website: Globe2, email: Mail };
const SOCIAL_LABEL = { instagram: "Instagram", discord: "Discord", website: "Website", email: "Email" };

export default async function SocietyPage({ params }: { params: { id: string } }) {
  const { db, user } = await getCurrentUser();
  const base = findSociety(params.id);
  if (!base) notFound();
  const s = societyView(db, base, user?.id);
  const now = nowDublin();
  const events = allEvents(db).filter((e) => e.societyId === s.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((e) => eventView(db, e));
  const upcoming = events.filter((e) => e.startsAt >= now), past = events.filter((e) => e.startsAt < now);
  const reviews = reviewsFor(db, "society", s.id, user?.id);
  return <PageShell crumb={s.name}>
    <div className="detail-hero society-hero" style={{ backgroundImage: `url(${s.image})` }}/>
    <div className="society-head">
      <div className={`society-avatar big ${s.color}`} style={s.avatar ? { backgroundImage: `url(${s.avatar})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" } : undefined}>{s.avatar ? <span className="sr-only">{s.name}</span> : s.initials}</div>
      <div><span className="society-category">{s.category}</span><h1 className="detail-title">{s.name}</h1><p className="society-tagline">{s.tagline}</p>
        <div className="society-head-meta"><span><Users size={14}/>{formatCount(s.memberCount)} members</span><RatingBadge rating={s.rating} empty="Not reviewed yet"/></div></div>
    </div>
    <div className="detail-grid">
      <div className="detail-main">
        <section><div className="eyebrow">ABOUT</div><h2 className="sub-h">Who we are</h2><p className="modal-description">{s.bio}</p>
          <div className="social-links">{s.socials.map((l) => { const Icon = SOCIAL_ICON[l.kind]; return <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"><Icon size={15}/>{SOCIAL_LABEL[l.kind]}</a>; })}</div>
          <p className="demo-disclaimer">Demo society: committee members and social links are fictional placeholders.</p></section>

        <section><div className="eyebrow">COMMITTEE</div><h2 className="sub-h">Meet the committee</h2>
          <div className="committee-grid">{s.committee.map((m) => <div className="member-card" key={m.name}><div className={`member-avatar ${s.color}`} style={m.image ? { backgroundImage: `url(${m.image})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" } : undefined}>{m.image ? <span className="sr-only">{m.name}</span> : m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div><strong>{m.name}</strong><span className="member-role">{m.role}</span><p>{m.bio}</p></div>)}</div></section>

        <section><div className="eyebrow">EVENTS</div><h2 className="sub-h">What's on</h2>
          {upcoming.length ? <div className="event-grid two">{upcoming.map((e) => <EventCard key={e.id} event={e}/>)}</div> : <div className="empty-state"><strong>No upcoming events</strong><p>Check back soon.</p></div>}
          {past.length > 0 && <><h3 className="sub-h small">Past events</h3><div className="event-grid two">{past.map((e) => <EventCard key={e.id} event={e}/>)}</div></>}</section>

        <Reviews targetType="society" targetId={s.id} targetName={s.name} reviews={reviews} rating={s.rating} signedIn={!!user} nextPath={`/societies/${s.id}`}/>
      </div>
      <aside className="detail-side"><JoinPanel societyId={s.id} status={s.status} signedIn={!!user} nextPath={`/societies/${s.id}`}/></aside>
    </div>
  </PageShell>;
}
