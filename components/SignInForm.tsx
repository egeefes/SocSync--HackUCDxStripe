"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, safeNext } from "@/lib/api";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", studentNumber: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/api/auth/login", "POST", form);
      const target = safeNext(next);
      router.push(d.isNew ? `/interests?next=${encodeURIComponent(target)}` : target);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't sign in."); setBusy(false); }
  }

  return <form className="auth-form" onSubmit={submit}>
    <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@ucdconnect.ie"/></label>
    <label>Student number<input required inputMode="numeric" pattern="\d{8}" maxLength={8} value={form.studentNumber} onChange={set("studentNumber")} placeholder="8 digits, e.g. 12345678"/></label>
    <label>Your name <small>(new accounts only)</small><input autoComplete="name" value={form.name} onChange={set("name")} placeholder="Alex Murphy"/></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button full-button" disabled={busy}>{busy ? "Signing in…" : <>Continue <ArrowRight size={16}/></>}</button>
    <p className="demo-disclaimer">Demo sign-in: no password. Don't use a real student number. Use any 8 digits you can remember.</p>
  </form>;
}
