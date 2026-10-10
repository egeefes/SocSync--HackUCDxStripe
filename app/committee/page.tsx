import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { CommitteeDashboard, type MemberRow } from "@/components/CommitteeDashboard";
import { CommitteeUnlock } from "@/components/CommitteeUnlock";
import { PageShell } from "@/components/PageShell";
import { allEvents, allSocieties, getCurrentUser, goingCount } from "@/lib/domain";
import { eur, parts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CommitteePage() {
  const { db, user, committeeOf } = await getCurrentUser();
  if (!user) redirect("/signin?next=/committee");
  if (!committeeOf) return <PageShell crumb="Committee">
    <div className="auth-card"><div className="eyebrow"><ShieldCheck size={13}/> SOCIETY TOOLS</div><h1>Committee access</h1>
      <p className="auth-sub">Confirm new members and post events for your society.</p>
      <CommitteeUnlock societies={allSocieties().map((s) => ({ id: s.id, name: s.name }))}/></div>
  </PageShell>;

  const rows = (status: "pending" | "confirmed"): MemberRow[] => db.memberships
    .filter((m) => m.societyId === committeeOf.id && m.status === status)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map((m) => { const u = db.users[m.userId]; return { id: m.id, name: u?.name ?? "Unknown", email: u?.email ?? "", studentNumber: u?.studentNumber ?? "", paidAt: m.paidAt, confirmedAt: m.confirmedAt }; });
  const events = allEvents(db).filter((e) => e.societyId === committeeOf.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, location: e.location, category: e.category, description: e.description, image: e.image, priceValue: e.price, when: `${parts(e.startsAt).date} · ${parts(e.startsAt).time}`, going: goingCount(db, e), capacity: e.capacity, tickets: db.tickets.filter((t) => t.eventId === e.id).length, price: eur(e.price) }));

  return <PageShell crumb="Committee">
    <div className="section-heading"><div><div className="eyebrow"><ShieldCheck size={13}/> COMMITTEE DASHBOARD</div><h2>{committeeOf.name}</h2></div></div>
    <CommitteeDashboard societyId={committeeOf.id} societyName={committeeOf.name} pending={rows("pending")} confirmed={rows("confirmed")} events={events} profile={db.societyProfiles?.[committeeOf.id] ?? {}}/>
  </PageShell>;
}
