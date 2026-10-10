"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

export function CommitteeUnlock({ societies }: { societies: { id: string; name: string }[] }) {
  const router = useRouter();
  const [societyId, setSocietyId] = useState(societies[0]?.id ?? "");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await api("/api/auth/committee", "POST", { societyId, passcode }); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't unlock."); setBusy(false); }
  }

  return <form className="auth-form" onSubmit={submit}>
    <label>Society<select value={societyId} onChange={(e) => setSocietyId(e.target.value)}>{societies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Committee passcode<input type="password" required value={passcode} onChange={(e) => setPasscode(e.target.value)} autoComplete="off"/></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button full-button" disabled={busy}><ShieldCheck size={16}/> {busy ? "Checking…" : "Unlock committee tools"}</button>
    <p className="demo-disclaimer">Demo access: one shared passcode set by <code>COMMITTEE_PASSCODE</code>. Locally it defaults to "committee".</p>
  </form>;
}
