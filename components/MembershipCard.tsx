import Link from "next/link";
import { Clock3, Zap } from "lucide-react";
import { memberCardId, shortDate } from "@/lib/format";

type Props = {
  societyId: string; societyName: string; color: string; status: "pending" | "confirmed";
  memberName: string; studentNumber: string; membershipId: string; paidAt: string; backgroundImage?: string;
};

function academicYear(iso: string) {
  const d = new Date(iso); const y = d.getFullYear();
  const start = d.getMonth() >= 7 ? y : y - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

export function MembershipCard(p: Props) {
  const active = p.status === "confirmed";
  return <div className={`membership-card ${p.color} ${active ? "active" : "pending"} ${p.backgroundImage ? "has-custom-background" : ""}`} style={p.backgroundImage ? { backgroundImage: `linear-gradient(90deg, rgba(25,24,45,.58), rgba(25,24,45,.25)), url("${p.backgroundImage}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
    <div className="mc-top"><span className="mc-brand"><Zap size={14} fill="currentColor"/> socsync</span>
      <span className="mc-status">{active ? "ACTIVE MEMBER" : <><Clock3 size={11}/> PENDING CONFIRMATION</>}</span></div>
    <Link className="mc-society" href={`/societies/${p.societyId}`}>{p.societyName}</Link>
    <div className="mc-grid">
      <div><span>MEMBER</span><strong>{p.memberName}</strong></div>
      <div><span>STUDENT NO.</span><strong>{p.studentNumber}</strong></div>
      <div><span>MEMBER ID</span><strong>{memberCardId(p.membershipId)}</strong></div>
      <div><span>VALID</span><strong>{academicYear(p.paidAt)}</strong></div>
    </div>
    <div className="mc-foot">{active ? `Joined ${shortDate(p.paidAt)}` : "Your payment is in. The committee will confirm your signup."}</div>
  </div>;
}
