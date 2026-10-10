"use client";
// Generic JSON form. Keep failures visible (including Vercel 500s and non-JSON responses)
// rather than leaving users with a button that appears to do nothing.
import { useState } from "react";
import { fullReload } from "@/lib/full-reload";

export default function JsonForm({ endpoint, redirectTo = "/", submitLabel, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* show a useful fallback below */ }

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status}). Check the Vercel function logs for this endpoint.`);
      }
      if (data.redirect) {
        fullReload(data.redirect);
        return;
      }
      if (endpoint.includes("/signup")) {
        // Signup accounts are pending verification. Send the user to the login page with a clear message.
        fullReload("/login?signup=pending");
        return;
      }
      fullReload(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {children}
      {error && <p role="alert" aria-live="polite" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
