"use client";
// Society dashboard: list of the society's events with Edit (inline form) and Delete.
// Only upcoming events can be changed; the server also blocks deleting events with paid tickets.
import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

const when = (iso) =>
  new Date(iso).toLocaleString("en-IE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function EventsManager({ events, now }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null); // event id
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function startEdit(e) {
    setEditing(e.id);
    setError("");
    setForm({ title: e.title, description: e.description, venue: e.venue, start: e.start, end: e.end ?? "", price_eur: e.price_cents / 100, capacity: e.capacity ?? "" });
  }
  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }));

  async function call(method, id, body) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/events/${id}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || "Something went wrong."); return false; }
    router.refresh();
    return true;
  }

  async function remove(e) {
    if (!window.confirm(`Delete "${e.title}"? Students who reserved a spot lose it. This can't be undone.`)) return;
    setEditing(e.id); // show any error under this row
    if (await call("DELETE", e.id)) setEditing(null);
  }

  return (
    <div className="card overflow-x-auto">
      <h3 className="mb-2 font-semibold">Your events</h3>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr><th className="py-1">Event</th><th>When</th><th>Going</th><th>Rating</th><th /></tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const upcoming = e.start >= now;
            return (
              <Fragment key={e.id}>
                <tr className="border-t border-border">
                  <td className="py-1.5"><Link href={`/events/${e.id}`} className="hover:text-accent">{e.title}</Link>{e.created_via === "ai" && " ✨"}</td>
                  <td className="whitespace-nowrap text-xs">{when(e.start)}</td>
                  <td>{e.price_cents ? `${e.tickets_sold} 🎟️` : e.rsvp_count}</td>
                  <td>{e.avg_rating ?? "–"}</td>
                  <td className="whitespace-nowrap text-right">
                    {upcoming && (
                      <>
                        <button className="text-button inline-flex" onClick={() => (editing === e.id ? setEditing(null) : startEdit(e))} aria-label={`Edit ${e.title}`}><Pencil size={13} /></button>{" "}
                        <button className="text-button danger inline-flex" onClick={() => remove(e)} disabled={busy} aria-label={`Delete ${e.title}`}><Trash2 size={13} /></button>
                      </>
                    )}
                  </td>
                </tr>
                {editing === e.id && (
                  <tr>
                    <td colSpan={5} className="pb-3">
                      {form.title !== undefined && upcoming && (
                        <form className="event-form !mb-0 mt-2" onSubmit={async (ev) => { ev.preventDefault(); if (await call("PATCH", e.id, form)) setEditing(null); }}>
                          <label>Title<input value={form.title} onChange={set("title")} required /></label>
                          <label>Description<textarea rows={2} value={form.description} onChange={set("description")} /></label>
                          <label>Venue<input value={form.venue} onChange={set("venue")} /></label>
                          <div className="form-two">
                            <label>Starts<input type="datetime-local" value={form.start} onChange={set("start")} required /></label>
                            <label>Ends (optional)<input type="datetime-local" value={form.end} onChange={set("end")} /></label>
                          </div>
                          <div className="form-two">
                            <label>Price € (0 = free)<input type="number" min="0" step="0.5" value={form.price_eur} onChange={set("price_eur")} /></label>
                            <label>Capacity (optional)<input type="number" min="1" value={form.capacity} onChange={set("capacity")} /></label>
                          </div>
                          <div className="flex gap-2">
                            <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                            <button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                          <p className="demo-disclaimer">Attendees who connected Google Calendar get the change automatically.</p>
                        </form>
                      )}
                      {error && <p className="form-error mt-2">{error}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
