"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, Ticket } from "lucide-react";
import { api } from "@/lib/api";
import { eur } from "@/lib/format";
import { useToast } from "./Toast";

type Props = {
  eventId: number; price: number; status: "none" | "reserved" | "paid"; ticketId?: string;
  spotsLeft: number; started: boolean; signedIn: boolean; societyMember: boolean; societyId: string; nextPath: string;
};

export function TicketPanel({ eventId, price, status, ticketId, spotsLeft, started, signedIn, societyMember, societyId, nextPath }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { notify, toast } = useToast();

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { notify(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  const reserve = () => act(async () => { await api("/api/tickets", "POST", { eventId }); notify("Ticket reserved. See you there!"); router.refresh(); });
  const buy = () => act(async () => { const d = await api("/api/checkout", "POST", { kind: "ticket", eventId }); if (d.url) window.location.href = d.url; });
  const cancel = () => act(async () => { await api("/api/tickets", "DELETE", { ticketId }); notify("Reservation cancelled."); router.refresh(); });

  let action: React.ReactNode;
  if (status !== "none") {
    action = <>
      <div className="going-note"><Check size={16}/> You're going{status === "paid" ? " · ticket paid" : " · free ticket reserved"}</div>
      <Link className="primary-button" href="/my-societies#tickets"><Ticket size={16}/> View my ticket</Link>
      {status === "reserved" && !started && <button className="text-button" onClick={cancel} disabled={busy}>Cancel reservation</button>}
    </>;
  } else if (started) action = <button className="primary-button" disabled>Event has started</button>;
  else if (spotsLeft === 0) action = <button className="primary-button" disabled>Sold out</button>;
  else if (!signedIn) action = <Link className="primary-button" href={`/signin?next=${encodeURIComponent(nextPath)}`}>Sign in to get a ticket</Link>;
  else if (!societyMember) action = <><div className="pending-note">Join this society before reserving your place at its events.</div><Link className="primary-button" href={`/societies/${societyId}`}>Sign up for society <ArrowRight size={16}/></Link></>;
  else if (price === 0) action = <button className="primary-button" onClick={reserve} disabled={busy}>{busy ? "Reserving…" : <>Reserve free ticket <ArrowRight size={16}/></>}</button>;
  else action = <button className="primary-button" onClick={buy} disabled={busy}>{busy ? "Opening checkout…" : <>Buy ticket · {eur(price)} <ArrowRight size={16}/></>}</button>;

  return <div className="action-panel">
    <span className="price-label">TICKET PRICE</span>
    <strong className="action-price">{eur(price)}</strong>
    {action}
    {price > 0 && status === "none" && <p className="demo-disclaimer">Stripe test mode: use card 4242 4242 4242 4242. No real money is charged.</p>}
    {toast}
  </div>;
}
