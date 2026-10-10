import { PageShell } from "@/components/PageShell";
import { SocietyCard } from "@/components/SocietyCard";
import { allSocieties, getCurrentUser, recommend, societyView } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function SocietiesPage() {
  const { db, user } = await getCurrentUser();
  const all = allSocieties().map((s) => societyView(db, s, user?.id));
  const recs = user?.interests.length ? recommend(db, user).societies : [];
  const recIds = new Set(recs.map((r) => r.id));
  return <PageShell crumb="Societies">
    {recs.length > 0 && <section className="results-section"><div className="section-heading"><div><div className="eyebrow">BASED ON YOUR INTERESTS</div><h2>Recommended for you</h2></div></div>
      <div className="society-grid">{recs.map((r) => <SocietyCard key={r.id} society={all.find((s) => s.id === r.id)!} reason={r.reason}/>)}</div></section>}
    <section className="societies-section" style={{ borderTop: recs.length ? undefined : "none", marginTop: recs.length ? undefined : 0 }}>
      <div className="section-heading"><div><div className="eyebrow">YOUR PEOPLE ARE HERE</div><h2>All societies</h2></div></div>
      <div className="society-grid">{all.filter((s) => !recIds.has(s.id)).map((s) => <SocietyCard key={s.id} society={s}/>)}</div>
    </section>
  </PageShell>;
}
