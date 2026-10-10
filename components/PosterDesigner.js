"use client";
// "Design poster with AI": the society fills the form, the AI designs a poster, the app draws it.
// The poster's date/time/venue/price always come from the form and update live as it's edited.
import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { drawPoster } from "@/lib/poster-canvas";

export default function PosterDesigner({ form, onPoster }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { design, background, society, models, warnings }
  const [dataUrl, setDataUrl] = useState("");
  const [attach, setAttach] = useState(true);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  // Redraw (no AI call) whenever the details printed on the poster change in the form.
  useEffect(() => {
    if (!result || !canvasRef.current || !form.start) return;
    let cancelled = false;
    drawPoster(canvasRef.current, { ...result, event: form })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch((err) => setError(`The AI design arrived, but this browser couldn't draw the poster (${err.message}). Try Chrome or Edge.`));
    return () => { cancelled = true; };
  }, [result, form]);

  // Tell the form which poster (if any) to publish with the event.
  useEffect(() => {
    onPoster(dataUrl && attach ? { dataUrl, design: result?.design } : null);
  }, [dataUrl, attach, result, onPoster]);

  // What's still missing before the AI can design (a datetime box with only a date counts as empty).
  const missing = [
    form.title.trim().length < 3 && "a title",
    !form.start && "a start date AND time",
  ].filter(Boolean);
  const ready = missing.length === 0;

  async function generate() {
    if (!ready) return setError(`Add ${missing.join(" and ")} in the event form first.`);
    setSeconds(0);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/design-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: AbortSignal.timeout(120000), // never spin forever
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't design a poster right now.");
      setResult(data);
    } catch (err) {
      setError(err.name === "TimeoutError" ? "The AI took too long. Please try again." : err.message);
    }
    setBusy(false);
  }

  return (
    <div className="card space-y-3 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold"><Wand2 size={16} className="mr-1 inline" /> Design a poster with AI</h3>
          <p className="text-xs text-muted">
            Fill in the event details, then let the AI write the headline, pick the colours and paint the picture.
            Dates, venue and price are printed exactly as you typed them.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={generate} disabled={busy}>
          {busy ? `Designing… ${seconds}s` : result ? <><RefreshCw size={15} /> Regenerate</> : <><Sparkles size={15} /> Design poster with AI</>}
        </button>
      </div>
      {!ready && !result && !error && <p className="text-xs text-muted">Needs {missing.join(" and ")} in the form above.</p>}
      {busy && <p className="text-xs text-muted">Writing the copy and painting the background usually takes 5–15 seconds…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <canvas ref={canvasRef} className="hidden" />
      {dataUrl && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,340px)_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- poster drawn locally on a canvas */}
          <img src={dataUrl} alt="AI-designed event poster" className="w-full rounded-xl border border-border shadow-sm" />
          <div className="space-y-3 text-sm">
            {result.warnings?.map((w) => <p key={w} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{w}</p>)}
            <div className="rounded-lg bg-accent-soft p-3 text-xs">
              <p><b>AI headline:</b> {result.design.headline}</p>
              {result.design.tagline && <p><b>Tagline:</b> {result.design.tagline}</p>}
              <p><b>Look:</b> {result.design.palette} · {result.design.layout}</p>
              <p className="text-muted">Copy by {result.models.text}{result.models.image ? `, picture by ${result.models.image}` : ""}.</p>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
              Use as this event&apos;s poster when I publish
            </label>
            <a className="btn-secondary" href={dataUrl} download={`${(form.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-poster.jpg`}>
              <Download size={15} /> Download for Instagram
            </a>
            <p className="text-xs text-muted">Edit the date, venue or price in the form and the poster updates instantly. No new AI call needed.</p>
          </div>
        </div>
      )}
    </div>
  );
}
