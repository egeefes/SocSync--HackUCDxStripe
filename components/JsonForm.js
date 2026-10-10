"use client";
// Generic form: collects every named input, POSTs it as JSON to `endpoint`,
// shows the server's error message, and on success does a full page load of `redirectTo`.
import { useState } from "react";
import { fullReload } from "@/lib/full-reload";

export default function JsonForm({ endpoint, redirectTo = "/", submitLabel, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
      fullReload(data.redirect || redirectTo); // the server may say where to go (e.g. login -> dashboard)
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : submitLabel}</button>
    </form>
  );
}
