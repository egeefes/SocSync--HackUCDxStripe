// Society card: cover banner, profile picture, category, Instagram, rating, members and status.
import Link from "next/link";
import { ArrowRight, Check, Users } from "lucide-react";
import { euro, when } from "@/lib/format";
import { societyCover } from "@/lib/ui";
import { RatingBadge } from "./Stars";
import InstagramTag from "./InstagramTag";
import SocietyAvatar from "./SocietyAvatar";

export default function SocietyCard({ society: s }) {
  return (
    <Link href={`/societies/${s.id}`} className="society-card">
      <div className="society-card-banner" style={{ backgroundImage: `url(${societyCover(s)})` }} />
      <SocietyAvatar society={s} />
      <div className="society-card-inner">
        <span className="society-category">{s.category}</span>
        <h3>{s.name}</h3>
        {/* The whole card is a link already, so the tag is plain text here. */}
        <InstagramTag handle={s.instagram} link={false} size={11} />
        {s.description && <p>{s.description}</p>}
        {s.next_title && <p className="next-up">Next: <b>{s.next_title}</b> · {when(s.next_start)}</p>}
        {s.avg_rating !== undefined && <div className="rating-wrap"><RatingBadge avg={s.avg_rating} count={s.review_count} /></div>}
        <div className="society-card-bottom">
          <span>
            <Users size={14} />
            {s.member_count !== undefined ? `${s.member_count} ${s.member_count === 1 ? "member" : "members"}` : s.category}
          </span>
          {s.is_member ? (
            <span className="joined-button"><Check size={14} /> Member</span>
          ) : s.is_following ? (
            <span className="join-button">Following</span>
          ) : (
            <span className="join-button">
              {s.membership_fee_cents ? `Join ${euro(s.membership_fee_cents)}` : "View"} <ArrowRight size={13} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
