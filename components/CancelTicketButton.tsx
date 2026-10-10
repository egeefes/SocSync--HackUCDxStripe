"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export function CancelTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="text-button danger" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await api("/api/tickets", "DELETE", { ticketId }); router.refresh(); } finally { setBusy(false); }
  }}>{busy ? "Cancelling…" : "Cancel reservation"}</button>;
}
