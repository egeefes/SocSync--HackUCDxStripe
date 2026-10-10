"use client";
// Society admin: create an event. The AI panel reads a poster/caption and PRE-FILLS the form;
// the admin always reviews before publishing (the AI can be wrong).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PosterDesigner from "./PosterDesigner";

const EMPTY = { title: "", description: "", venue: "", start: "", end: "", price_eur: 0, capacity: "", repeat: "none", repeat_count: 4 };

// Shrink big phone photos before sending them to the AI (faster + cheaper).
function fileToDataUrl(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("That file isn't an image we can read."));
    img.src = URL.createObjectURL(file);
  });
}

export default function EventForm({ aiImportsLeft }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [createdVia, setCreatedVia] = useState("manual");
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [aiInfo, setAiInfo] = useState("");
  const [poster, setPoster] = useState(null); // AI-designed poster to publish with the event
  const [designerKey, setDesignerKey] = useState(0); // bump to reset the designer after publishing

  // Count seconds while the AI works, so a slow reply doesn't look like a frozen page.
  useEffect(() => {
    if (!aiBusy) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [aiBusy]);
  const [aiError, setAiError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function pickImage(e) {
    const file = e.target.files?.[0];
    setAiError("");
    if (!file) return setImage(null);
    try {
      setImage(await fileToDataUrl(file));
    } catch (err) {
      setAiError(err.message);
    }
  }

  async function runAi() {
    setSeconds(0);
    setAiBusy(true);
    setAiError("");
    setAiInfo("");
    setWarnings([]);
    let res, data;
    try {
      res = await fetch("/api/ai/import-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: caption, imageDataUrl: image }),
      });
      data = await res.json().catch(() => ({}));
    } catch {
      res = { ok: false };
      data = { error: "Couldn't reach the server. Check the app is running, then try again." };
    }
    setAiBusy(false);
    if (!res.ok) return setAiError(data.error || "AI import failed. You can still fill in the form manually.");
    setForm({ ...EMPTY, ...data.event });
    setWarnings(data.warnings);
    setAiInfo(`Read by ${data.model} in ${(data.ms / 1000).toFixed(1)} s.`);
    setCreatedVia("ai");
    router.refresh(); // updates "imports left"
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, created_via: createdVia, poster: poster?.dataUrl, poster_design: poster?.design }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "Could not save the event.");
    setSaved(data.ids?.length > 1 ? `Published "${form.title}" ${data.ids.length} times.` : `Published "${form.title}".`);
    setForm(EMPTY);
    setWarnings([]);
    setCaption("");
    setImage(null);
    setCreatedVia("manual");
    setPoster(null);
    setDesignerKey((k) => k + 1);
    router.refresh();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-3">
        <div>
          <h3 className="font-semibold">✨ Import from poster or Instagram caption</h3>
          <p className="text-xs text-muted">
            {aiImportsLeft == null ? "Pro plan: unlimited AI imports and posters." : `${aiImportsLeft} free AI uses left (poster imports or AI posters).`}
          </p>
        </div>
        <div>
          <span className="label">Poster image</span>
          <input type="file" accept="image/*" onChange={pickImage} className="text-sm" />
          {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview, nothing to optimise */}
          {image && <img src={image} alt="Poster preview" className="mt-2 max-h-48 rounded-lg border border-border" />}
        </div>
        <div>
          <span className="label">…and/or paste the caption / newsletter text</span>
          <textarea className="input" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder="🎌 Calligraphy workshop this Thursday 6pm in Newman J204! Free for members, €2 non-members…" />
        </div>
        <button className="btn-primary" onClick={runAi} disabled={aiBusy || (!caption.trim() && !image)}>
          {aiBusy ? `Reading poster… ${seconds}s` : "Fill form with AI"}
        </button>
        {aiBusy && seconds >= 20 && (
          <p className="text-xs text-muted">The main AI model is slow right now, so we&apos;re trying a backup model…</p>
        )}
        {aiError && <p className="text-sm text-red-600">{aiError}</p>}
        {aiInfo && !aiBusy && <p className="text-xs text-muted">{aiInfo}</p>}
      </div>

      <form onSubmit={save} className="card space-y-3">
        <h3 className="font-semibold">Event details</h3>
        {warnings.length > 0 && (
          <ul className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <li className="font-semibold">AI filled this in. Please check:</li>
            {warnings.map((w) => <li key={w}>• {w}</li>)}
          </ul>
        )}
        <div><span className="label">Title</span><input className="input" value={form.title} onChange={set("title")} required /></div>
        <div><span className="label">Description</span><textarea className="input" rows={3} value={form.description} onChange={set("description")} /></div>
        <div><span className="label">Venue</span><input className="input" value={form.venue} onChange={set("venue")} placeholder="e.g. Newman Building J204" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Starts</span><input type="datetime-local" className="input" value={form.start} onChange={set("start")} required /></div>
          <div><span className="label">Ends (optional)</span><input type="datetime-local" className="input" value={form.end} onChange={set("end")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="label">Ticket price € (0 = free)</span><input type="number" min="0" step="0.5" className="input" value={form.price_eur} onChange={set("price_eur")} /></div>
          <div><span className="label">Capacity (optional)</span><input type="number" min="1" className="input" value={form.capacity} onChange={set("capacity")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="label">Repeat</span>
            <select className="input" value={form.repeat} onChange={set("repeat")}>
              <option value="none">Doesn&apos;t repeat</option>
              <option value="weekly">Every week</option>
              <option value="fortnightly">Every 2 weeks</option>
              <option value="monthly">Every month</option>
            </select>
          </div>
          {form.repeat !== "none" && (
            <div><span className="label">How many times (2–12)</span><input type="number" min="2" max="12" className="input" value={form.repeat_count} onChange={set("repeat_count")} /></div>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">{saved}</p>}
        {poster && <p className="text-xs text-muted">✨ Your AI poster will be published with this event.</p>}
        <button className="btn-primary" disabled={saving}>{saving ? "Publishing…" : "Publish event"}</button>
      </form>

      <PosterDesigner key={designerKey} form={form} onPoster={setPoster} />
    </div>
  );
}
