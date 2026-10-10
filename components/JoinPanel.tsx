"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { api } from "@/lib/api";
import { MEMBERSHIP_PRICE, eur } from "@/lib/format";
import { useToast } from "./Toast";

type Props = { societyId: string; status: "pending" | "confirmed" | null; signedIn: boolean; nextPath: string };

export function JoinPanel({ societyId, status, signedIn, nextPath }: Props) {
  const [busy, setBusy] = useState(false);
  const { notify, toast } = useToast();

  async function join() {
    setBusy(true);
    try { const d = await api("/api/checkout", "POST", { kind: "membership", societyId }); if (d.url) window.location.href = d.url; }
    catch (e) { notify(e instanceof Error ? e.message : "Couldn't start checkout."); setBusy(false); }
  }

  if (status === "confirmed") return <div className="join-panel is-member"><div className="going-note"><Check size={16}/> You're a member</div><Link className="primary-button" href="/my-societies">View membership card</Link></div>;
  if (status === "pending") return <div className="join-panel"><div className="pending-note"><Clock3 size={16}/> Payment received. Waiting for the committee to confirm your signup.</div><Link className="text-button" href="/my-societies">View status</Link></div>;
  return <div className="join-panel">
    <span className="price-label">MEMBERSHIP</span><strong className="action-price">{eur(MEMBERSHIP_PRICE)}</strong>
    {signedIn
      ? <button className="primary-button" onClick={join} disabled={busy}>{busy ? "Opening checkout…" : <>Join society <ArrowRight size={16}/></>}</button>
      : <Link className="primary-button" href={`/signin?next=${encodeURIComponent(nextPath)}`}>Sign in to join</Link>}
    <p className="demo-disclaimer">One-off demo membership fee. The committee confirms your signup after payment. Stripe test mode only.</p>
    {toast}
  </div>;
}
