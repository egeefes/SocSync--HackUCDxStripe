import Link from "next/link";
import { ArrowRight, Check, Clock3, Sparkles, Users } from "lucide-react";
import type { SocietyView } from "@/lib/types";
import { formatCount } from "@/lib/format";
import { RatingBadge } from "./Stars";

export function SocietyCard({ society, reason }: { society: SocietyView; reason?: string }) {
  const href = `/societies/${society.id}`;
  return <article className="society-card">
    <div className={`society-avatar ${society.color}`} style={society.avatar ? { backgroundImage: `url(${society.avatar})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" } : undefined}>{society.avatar ? <span className="sr-only">{society.name}</span> : society.initials}</div>
    <div className="society-card-body">
      <span className="society-category">{society.category}</span>
      <h3><Link href={href}>{society.name}</Link></h3>
      <p>{society.tagline}</p>
      {reason && <p className="event-reason"><Sparkles size={11}/>{reason}</p>}
      <RatingBadge rating={society.rating} empty="No reviews yet"/>
      <div className="society-card-bottom">
        <span><Users size={14}/>{formatCount(society.memberCount)} members</span>
        {society.status === "confirmed" ? <Link className="joined-button" href={href}><Check size={14}/> Member</Link>
          : society.status === "pending" ? <Link className="pending-button" href={href}><Clock3 size={13}/> Pending</Link>
          : <Link className="join-button" href={href}>View <ArrowRight size={13}/></Link>}
      </div>
    </div>
  </article>;
}
