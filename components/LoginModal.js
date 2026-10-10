"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole, X, ArrowRight } from "lucide-react";
import { fullReload } from "@/lib/full-reload";

/**
 * Reusable sign-in modal. Authentication remains server-validated by /api/auth/login.
 * Can be opened from account menus and registration pages.
 */
export default function LoginModal({ triggerLabel = "Log in", triggerClassName = "text-accent underline", onClose }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    setBusy(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: email.trim(), password, as: role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't log in. Check your details and try again.");
      fullReload(data.redirect || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log in. Please try again.");
      setBusy(false);
    }
  }

  return <>
    <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>{triggerLabel}</button>
    {open && <div className="login-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
        <button className="login-modal-close" type="button" onClick={close} aria-label="Close login dialog"><X size={19}/></button>
        <div className="login-modal-icon"><LockKeyhole size={21}/></div>
        <p className="login-modal-eyebrow">WELCOME BACK</p>
        <h2 id="login-modal-title">Log in to SocSync</h2>
        <p className="login-modal-subtitle">Pick up where you left off and find your people.</p>
        <div className="login-modal-tabs" role="tablist" aria-label="Account type">
          <button type="button" role="tab" aria-selected={role === "student"} className={role === "student" ? "active" : ""} onClick={() => { setRole("student"); setError(""); }}>🎓 Student</button>
          <button type="button" role="tab" aria-selected={role === "society"} className={role === "society" ? "active" : ""} onClick={() => { setRole("society"); setError(""); }}>🏛️ Society</button>
        </div>
        <form onSubmit={submit} className="login-modal-form">
          <label htmlFor="socsync-modal-email">{role === "student" ? "UCD student email" : "Society admin email"}</label>
          <input id="socsync-modal-email" name="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@ucdconnect.ie" required />
          <label htmlFor="socsync-modal-password">Password</label>
          <input id="socsync-modal-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="login-modal-error" role="alert" aria-live="polite">{error}</p>}
          <button className="login-modal-submit" type="submit" disabled={busy}>{busy ? "Logging in…" : <>Log in <ArrowRight size={16}/></>}</button>
        </form>
        <p className="login-modal-register">New to SocSync? <Link href="/signup" onClick={close}>Create a student account</Link></p>
        <p className="login-modal-register">Running a society? <Link href="/register-society" onClick={close}>Register your society</Link></p>
      </section>
    </div>}
  </>;
}
