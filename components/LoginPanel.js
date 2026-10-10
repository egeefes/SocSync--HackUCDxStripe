"use client";
// Login card with two tabs: Student / Society. Each tab has its own form, sign-up link and demo accounts.
import { useState } from "react";
import Link from "next/link";
import JsonForm from "./JsonForm";
import { fullReload } from "@/lib/full-reload";

export default function LoginPanel({ demoUsers }) {
  const [tab, setTab] = useState("student");
  const [demoError, setDemoError] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);

  async function demoLogin(id) {
    if (demoBusy) return;
    setDemoBusy(true);
    setDemoError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Login failed (${res.status}).`);
      fullReload(data.redirect || "/");
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setDemoBusy(false);
    }
  }

  const demos = demoUsers.filter((u) => (tab === "student" ? u.role === "student" : u.role === "admin"));
  const platform = demoUsers.find((u) => u.role === "platform");
  const tabClass = (t) => `flex-1 rounded-lg py-2 text-sm font-medium ${tab === t ? "bg-accent text-white" : "hover:bg-accent-soft"}`;

  return (
    <div className="auth-card space-y-5 !my-0">
      <div className="flex gap-1 rounded-xl border border-border p-1">
        <button type="button" className={tabClass("student")} onClick={() => { setDemoError(""); setTab("student"); }}>🎓 Student</button>
        <button type="button" className={tabClass("society")} onClick={() => { setDemoError(""); setTab("society"); }}>🏛️ Society</button>
      </div>

      {/* key={tab} resets the form (and any error) when switching tabs */}
      <JsonForm key={tab} endpoint="/api/auth/login" submitLabel={tab === "student" ? "Log in as student" : "Log in as society"}>
        <input type="hidden" name="as" value={tab} />
        <div>
          <span className="label">{tab === "student" ? "UCD student email" : "Email of the society admin"}</span>
          <input name="email" type="email" className="input" placeholder="firstname.lastname@ucdconnect.ie" required />
        </div>
        <div><span className="label">Password</span><input name="password" type="password" className="input" required /></div>
      </JsonForm>

      <p className="text-center text-sm text-muted">
        {tab === "student" ? (
          <>New to SocSync? <Link href="/signup" className="text-accent underline">Create a student account</Link></>
        ) : (
          <>Society not on SocSync yet? <Link href="/register-society" className="text-accent underline">Register your society</Link></>
        )}
      </p>

      {demoError && <p role="alert" aria-live="polite" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{demoError}</p>}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="label">Demo {tab === "student" ? "students" : "societies"} (one click, no password)</p>
        <div className="flex flex-wrap gap-2">
          {demos.map((u) => (
            <button type="button" key={u.id} disabled={demoBusy} onClick={() => demoLogin(u.id)} className="btn-secondary">
              {u.name}{u.status === "pending" && <span className="text-xs text-amber-600"> (pending)</span>}
            </button>
          ))}
        </div>
        {platform && (
          <p className="pt-1 text-xs text-muted">
            Running SocSync?{" "}
            <button type="button" disabled={demoBusy} onClick={() => demoLogin(platform.id)} className="text-accent underline">Log in as the SocSync admin</button>
          </p>
        )}
      </div>
    </div>
  );
}
