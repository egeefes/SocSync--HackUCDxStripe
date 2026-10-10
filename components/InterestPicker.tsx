"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { INTERESTS } from "@/lib/data";
import { api, safeNext } from "@/lib/api";
import { INTEREST_ICON } from "./InterestIcons";

export function InterestPicker({ initial, next }: { initial: string[]; next?: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (i: string) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  async function save() {
    setBusy(true); setError("");
    try { await api("/api/interests", "POST", { interests: picked }); router.push(safeNext(next)); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); setBusy(false); }
  }

  return <div>
    <div className="interest-grid">
      {INTERESTS.map((i) => { const Icon = INTEREST_ICON[i]; const on = picked.includes(i);
        return <button key={i} type="button" className={`interest-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(i)}>
          <Icon size={20}/><span>{i}</span>{on && <Check size={16} className="chip-check"/>}
        </button>; })}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="interest-actions">
      <button className="primary-button" onClick={save} disabled={busy}>{busy ? "Saving…" : picked.length ? "Save interests" : "Skip for now"}</button>
    </div>
  </div>;
}
