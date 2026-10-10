import { HomeClient } from "@/components/HomeClient";
import { PageShell } from "@/components/PageShell";
import { allEvents, allSocieties, eventView, getCurrentUser, recommend, societyView } from "@/lib/domain";
import { nowDublin } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: { category?: string; view?: string } }) {
  const { db, user } = await getCurrentUser();
  const now = nowDublin();
  const events = allEvents(db)
    .sort((a, b) => (a.startsAt >= now) === (b.startsAt >= now) ? a.startsAt.localeCompare(b.startsAt) : a.startsAt >= now ? -1 : 1)
    .map((e) => eventView(db, e));
  const societies = allSocieties().map((s) => societyView(db, s, user?.id));
  const recs = user && user.interests.length ? recommend(db, user) : { events: [], societies: [] };
  const evById = new Map(events.map((e) => [e.id, e]));
  const socById = new Map(societies.map((s) => [s.id, s]));
  return <PageShell crumb={searchParams.view === "saved" ? "Saved" : "Discover"}>
    <HomeClient
      key={`${searchParams.category ?? ""}-${searchParams.view ?? ""}`}
      events={events} societies={societies} savedIds={user?.saved ?? []} signedIn={!!user} hasInterests={!!user?.interests.length}
      recEvents={recs.events.map((r) => ({ item: evById.get(r.id)!, reason: r.reason }))}
      recSocieties={recs.societies.map((r) => ({ item: socById.get(r.id)!, reason: r.reason }))}
      initialCategory={searchParams.category ?? ""} initialView={searchParams.view ?? ""}
    />
  </PageShell>;
}
