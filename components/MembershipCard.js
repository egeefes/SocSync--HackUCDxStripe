// Digital membership card, shown after a student pays a society's fee (CampusLoop design).
import Link from "next/link";
import { Zap } from "lucide-react";
import { societyImage, styleFor } from "@/lib/ui";

// Academic year a payment belongs to: Sep 2026 -> "2026/27"
function academicYear(sqlDate) {
  const d = new Date(sqlDate.replace(" ", "T") + "Z");
  const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

export default function MembershipCard({ m }) {
  // A society can upload its own card background; a dark tint keeps the text readable on any picture.
  const bg = m.has_card_bg
    ? { backgroundImage: `linear-gradient(90deg, rgba(25,24,45,.62), rgba(25,24,45,.25)), url(${societyImage({ id: m.society_id, media_version: m.media_version }, "card")})` }
    : undefined;
  return (
    <div className={`membership-card ${styleFor(m.category).soc} active ${bg ? "has-custom-background" : ""}`} style={bg}>
      <div className="mc-top">
        <span className="mc-brand"><Zap size={14} fill="currentColor" /> socsync</span>
        <span className="mc-status">ACTIVE MEMBER</span>
      </div>
      <Link className="mc-society" href={`/societies/${m.society_id}`}>{m.society_name}</Link>
      <div className="mc-grid">
        <div><span>MEMBER</span><strong>{m.member_name}</strong></div>
        <div><span>STUDENT NO.</span><strong>{m.student_number}</strong></div>
        <div><span>MEMBER ID</span><strong>SS-{String(m.payment_id).padStart(5, "0")}</strong></div>
        <div><span>VALID</span><strong>{academicYear(m.created_at)}</strong></div>
      </div>
      <div className="mc-foot">Joined {new Date(m.created_at.replace(" ", "T") + "Z").toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })} · paid via Stripe</div>
    </div>
  );
}
