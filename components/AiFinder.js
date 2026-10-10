"use client";
// "What's your kind of thing?" AI event finder (CampusLoop design, SocSync backend).
import { useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import EventCard from "./EventCard";

const SUGGESTIONS = ["Free things this week", "Meet new people", "Something outdoorsy", "Learn a language"];

export default function AiFinder() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { mode, results }

  async function ask(text = prompt) {
    setPrompt(text);
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/find-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The finder is unavailable right now.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <section className="ai-panel" id="ai-finder">
        <div className="ai-topline">
          <div className="ai-icon"><Sparkles size={18} /></div>
          <div><span className="ai-kicker">YOUR PERSONAL EVENT FINDER</span><h2>What&apos;s your kind of thing?</h2></div>
          <span className="ai-pill">AI POWERED</span>
        </div>
        <div className="ai-input-row">
          <input value={prompt} maxLength={300} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="e.g. Something social under €5 where I can meet new people…" aria-label="Describe the events you're looking for" />
          <button onClick={() => ask()} disabled={busy}>
            {busy ? <span className="spinner" /> : <><span>Find my events</span><ArrowRight size={16} /></>}
          </button>
        </div>
        <div className="prompt-suggestions">
          <span>TRY</span>
          {SUGGESTIONS.map((p) => <button key={p} onClick={() => ask(p)} disabled={busy}>{p}</button>)}
        </div>
        {error && <p className="ai-results-note">⚠ {error}</p>}
        {result?.mode === "keyword" && <p className="ai-results-note">The AI is busy right now, so these are simple keyword matches.</p>}
      </section>

      {result && (
        <section className="results-section">
          <div className="section-heading">
            <div><div className="eyebrow">MADE FOR YOU</div><h2>Your matches <span className="result-count">{result.results.length}</span></h2></div>
            <button className="text-button" onClick={() => setResult(null)}>Clear results <X size={14} /></button>
          </div>
          {result.results.length ? (
            <div className="event-grid">
              {result.results.map(({ event, reason }) => <EventCard key={event.id} event={event} reason={reason} />)}
            </div>
          ) : (
            <div className="empty-state"><Sparkles size={22} /><strong>No close matches yet</strong><p>Try a broader interest or a different budget.</p></div>
          )}
        </section>
      )}
    </>
  );
}
