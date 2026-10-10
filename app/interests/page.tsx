import { redirect } from "next/navigation";
import { InterestPicker } from "@/components/InterestPicker";
import { PageShell } from "@/components/PageShell";
import { getCurrentUser } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function InterestsPage({ searchParams }: { searchParams: { next?: string } }) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/signin?next=/interests");
  return <PageShell crumb="Interests">
    <div className="auth-card wide"><div className="eyebrow">PERSONALISE</div><h1>What are you into?</h1><p className="auth-sub">Pick as many as you like. We'll recommend events and societies to match, and you can change this any time.</p>
      <InterestPicker initial={user.interests} next={searchParams.next}/></div>
  </PageShell>;
}
