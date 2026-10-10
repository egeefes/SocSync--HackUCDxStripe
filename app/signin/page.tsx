import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { SignInForm } from "@/components/SignInForm";
import { getCurrentUser } from "@/lib/domain";
import { safeNext } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: { next?: string } }) {
  const { user } = await getCurrentUser();
  if (user) redirect(safeNext(searchParams.next));
  return <PageShell crumb="Sign in">
    <div className="auth-card"><div className="eyebrow">WELCOME</div><h1>Sign in to SocSync</h1><p className="auth-sub">Join societies, reserve tickets and keep track of your plans.</p><SignInForm next={searchParams.next}/></div>
  </PageShell>;
}
