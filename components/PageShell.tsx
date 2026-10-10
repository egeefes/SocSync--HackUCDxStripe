import { Shell } from "./Shell";
import { getCurrentUser } from "@/lib/domain";

export async function PageShell({ crumb, children }: { crumb: string; children: React.ReactNode }) {
  const { user, committeeOf } = await getCurrentUser();
  return <Shell user={user ? { name: user.name } : null} committeeName={committeeOf?.name ?? null} crumb={crumb}>{children}</Shell>;
}
