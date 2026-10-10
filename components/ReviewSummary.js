"use client";
// "What students say": AI summary of a society's reviews, generated on demand.
import { useState } from "react";

export default function ReviewSummary({ societyId, reviewCount }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/ai/review-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ societyId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not summarise reviews.");
    setData(json);
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">✨ What students say</h3>
        {!data && (
          <button className="btn-secondary" onClick={load} disabled={busy || reviewCount === 0}>
            {busy ? "Summarising…" : `Summarise ${reviewCount} reviews`}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <div className="space-y-2 text-sm">
          <p>{data.summary}</p>
          {data.strengths.length > 0 && (
            <ul className="list-disc pl-5 text-green-700 dark:text-green-400">
              {data.strengths.map((s) => <li key={s}>{s}</li>)}
            </ul>
          )}
          {data.improvements.length > 0 && (
            <ul className="list-disc pl-5 text-amber-700 dark:text-amber-400">
              {data.improvements.map((s) => <li key={s}>{s}</li>)}
            </ul>
          )}
          <p className="text-xs text-muted">
            AI-generated from {data.review_count} verified-attendee reviews{data.cached ? " (cached)" : ""}. May miss nuance, so read the reviews below too.
          </p>
        </div>
      )}
    </div>
  );
}
