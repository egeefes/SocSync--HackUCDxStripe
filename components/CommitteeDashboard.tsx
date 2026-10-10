"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Plus, Users } from "lucide-react";
import { INTERESTS } from "@/lib/data";
import { api } from "@/lib/api";
import { useToast } from "./Toast";

export type MemberRow = { id: string; name: string; email: string; studentNumber: string; paidAt: string; confirmedAt?: string };
export type EventRow = { id: number; title: string; when: string; startsAt: string; location: string; category: string; description: string; image: string; priceValue: number; going: number; capacity: number; tickets: number; price: string };

export function CommitteeDashboard({ societyId, societyName, pending, confirmed, events, profile }: {
  societyId: string; societyName: string; pending: MemberRow[]; confirmed: MemberRow[]; events: EventRow[];
  profile: { image?: string; avatar?: string; membershipCardBackground?: string; bio?: string; tagline?: string; committee?: { name: string; role: string; bio: string; image?: string }[]; socials?: { kind: string; url: string }[] };
}) {
  const router = useRouter();
  const { notify, toast } = useToast();
  const [busyId, setBusyId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    image: profile.image ?? "", avatar: profile.avatar ?? "", membershipCardBackground: profile.membershipCardBackground ?? "", tagline: profile.tagline ?? "", bio: profile.bio ?? "",
    committee: JSON.stringify(profile.committee ?? [], null, 2),
    socials: JSON.stringify(profile.socials ?? [], null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ title: "", date: "", time: "18:00", location: "UCD Campus", price: "0", capacity: "50", category: "Social", description: "", image: "", recurrence: "none", recurrenceCount: "4" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });

  async function confirm(id: string) {
    setBusyId(id);
    try { await api("/api/committee/confirm", "POST", { membershipId: id }); notify("Signup confirmed."); router.refresh(); }
    catch (e) { notify(e instanceof Error ? e.message : "Couldn't confirm."); }
    finally { setBusyId(""); }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/committee/events", "POST", { ...f, price: Number(f.price), capacity: Number(f.capacity) });
      notify("Event published."); setShowForm(false); router.refresh();
    } catch (err) { notify(err instanceof Error ? err.message : "Couldn't publish."); }
    finally { setSaving(false); }
  }

  async function leave() { await api("/api/auth/committee", "DELETE"); router.refresh(); }
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", timeZone: "Europe/Dublin" });

  return <div className="committee">
    <div className="stats-strip committee-stats">
      <div className="stat-item"><span className="stat-icon stat-coral"><Users size={17}/></span><div><strong>{pending.length}</strong><span>awaiting confirmation</span></div></div>
      <div className="stat-divider"/>
      <div className="stat-item"><span className="stat-icon stat-green"><Check size={17}/></span><div><strong>{confirmed.length}</strong><span>confirmed new members</span></div></div>
      <div className="stat-divider"/>
      <div className="stat-item"><span className="stat-icon stat-purple"><Plus size={17}/></span><div><strong>{events.length}</strong><span>your events</span></div></div>
      <button className="text-button" style={{ marginLeft: "auto" }} onClick={leave}>Leave committee mode</button>
    </div>

    <section className="panel">
      <div className="section-heading"><div><div className="eyebrow">SOCIETY PAGE</div><h2>Edit public profile</h2></div></div>
      <form className="event-form" onSubmit={async (e) => {
        e.preventDefault(); setProfileSaving(true);
        try {
          const committee = JSON.parse(profileForm.committee);
          const socials = JSON.parse(profileForm.socials);
          if (!Array.isArray(committee) || !Array.isArray(socials)) throw new Error("Committee and social links must be JSON arrays.");
          await api("/api/committee/profile", "POST", { ...profileForm, committee, socials });
          notify("Society page updated."); router.refresh();
        } catch (err) { notify(err instanceof Error ? err.message : "Couldn't update society page."); }
        finally { setProfileSaving(false); }
      }}>
        <label>Cover/banner image URL (https)<input type="url" value={profileForm.image} onChange={(e) => setProfileForm({ ...profileForm, image: e.target.value })} placeholder="https://…"/></label>
        <label>Society profile picture URL<input type="url" value={profileForm.avatar} onChange={(e) => setProfileForm({ ...profileForm, avatar: e.target.value })} placeholder="https://…"/></label>
        <label>Or upload society profile picture<input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 700_000) { notify("Please choose an image under 700 KB."); return; } const reader = new FileReader(); reader.onload = () => setProfileForm((v) => ({ ...v, avatar: String(reader.result ?? "") })); reader.readAsDataURL(file); }}/></label>
        <label>Membership card background image URL<input type="url" value={profileForm.membershipCardBackground} onChange={(e) => setProfileForm({ ...profileForm, membershipCardBackground: e.target.value })} placeholder="https://…"/></label>
        <label>Or upload membership card background<input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 700_000) { notify("Please choose an image under 700 KB."); return; } const reader = new FileReader(); reader.onload = () => setProfileForm((v) => ({ ...v, membershipCardBackground: String(reader.result ?? "") })); reader.readAsDataURL(file); }}/></label>
        <label>Tagline<input maxLength={180} value={profileForm.tagline} onChange={(e) => setProfileForm({ ...profileForm, tagline: e.target.value })} placeholder="A short line about your society"/></label>
        <label>Society bio<textarea rows={4} maxLength={2000} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Tell students about your society"/></label>
        <label>Committee members (JSON list; each member has name, role, bio and optional image URL)<textarea rows={6} value={profileForm.committee} onChange={(e) => setProfileForm({ ...profileForm, committee: e.target.value })} placeholder={'[{"name":"Alex Murphy","role":"Chair","bio":"About Alex"}]'}/></label>
        <label>Social links (JSON list; kind is instagram, discord, website or email)<textarea rows={4} value={profileForm.socials} onChange={(e) => setProfileForm({ ...profileForm, socials: e.target.value })} placeholder={'[{"kind":"instagram","url":"https://instagram.com/your-society"}]'}/></label>
        <button className="primary-button" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save society page"}</button>
      </form>
    </section>

    <section className="panel">
      <div className="section-heading"><div><div className="eyebrow">NEW SIGNUPS</div><h2>Confirm new members</h2></div></div>
      {pending.length === 0 ? <div className="empty-state"><strong>No signups waiting</strong><p>New paid members appear here for you to confirm.</p></div> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Student no.</th><th>Email</th><th>Paid</th><th/></tr></thead><tbody>
          {pending.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.studentNumber}</td><td>{m.email}</td><td>{fmt(m.paidAt)}</td>
            <td><button className="primary-button small" disabled={busyId === m.id} onClick={() => confirm(m.id)}>{busyId === m.id ? "…" : "Confirm"}</button></td></tr>)}
        </tbody></table></div>}
    </section>

    <section className="panel">
      <div className="section-heading"><div><div className="eyebrow">MEMBERS</div><h2>Confirmed members</h2></div></div>
      {confirmed.length === 0 ? <div className="empty-state"><strong>No confirmed members yet</strong></div> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Student no.</th><th>Email</th><th>Confirmed</th></tr></thead><tbody>
          {confirmed.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.studentNumber}</td><td>{m.email}</td><td>{m.confirmedAt ? fmt(m.confirmedAt) : "-"}</td></tr>)}
        </tbody></table></div>}
      <p className="demo-disclaimer">Only members who paid and joined {societyName} are listed. Student numbers are shown to committee only.</p>
    </section>

    <section className="panel">
      <div className="section-heading"><div><div className="eyebrow">EVENTS</div><h2>Your events</h2></div>
        <button className="primary-button small" onClick={() => { setShowForm(!showForm); setEditingEventId(null); setF({ title: "", date: "", time: "18:00", location: "UCD Campus", price: "0", capacity: "50", category: "Social", description: "", image: "", recurrence: "none", recurrenceCount: "4" }); }}><Plus size={14}/> {showForm ? "Close" : "Post an event"}</button></div>
      {showForm && <form className="event-form" onSubmit={createEvent}>
        <label>Event name<input required minLength={3} maxLength={100} value={f.title} onChange={set("title")} placeholder="e.g. Coffee & code"/></label>
        <div className="form-two"><label>Date<input required type="date" value={f.date} onChange={set("date")}/></label><label>Time<input required type="time" value={f.time} onChange={set("time")}/></label></div>
        <div className="form-two"><label>Location<input value={f.location} onChange={set("location")}/></label><label>Category<select value={f.category} onChange={set("category")}>{INTERESTS.map((c) => <option key={c}>{c}</option>)}</select></label></div>
        <div className="form-two"><label>Ticket price (€, 0 = free)<input type="number" min="0" step="0.01" value={f.price} onChange={set("price")}/></label><label>Capacity<input type="number" min="1" max="5000" value={f.capacity} onChange={set("capacity")}/></label></div>
        <div className="form-two"><label>Repeat event<select value={f.recurrence} onChange={set("recurrence")}><option value="none">Does not repeat</option><option value="weekly">Weekly</option><option value="fortnightly">Every 2 weeks</option><option value="monthly">Monthly</option></select></label>{f.recurrence !== "none" && <label>Number of occurrences<input type="number" min="2" max="12" value={f.recurrenceCount} onChange={set("recurrenceCount")}/></label>}</div>
        <label>Event banner image URL (optional)<input type="url" value={f.image} onChange={set("image")} placeholder="https://example.com/event-banner.jpg"/></label>
        <label>Description<textarea rows={3} maxLength={1000} value={f.description} onChange={set("description")} placeholder="What should people know?"/></label>
        <button className="primary-button" disabled={saving}>{saving ? "Saving…" : editingEventId !== null ? "Save changes" : "Publish event"}</button>
        {editingEventId !== null && <button type="button" className="text-button" onClick={() => { setShowForm(false); setEditingEventId(null); }}>Cancel editing</button>}
      </form>}
      {events.length === 0 ? <div className="empty-state"><strong>No events yet</strong></div> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Event</th><th>When</th><th>Price</th><th>Going</th><th>Tickets on SocSync</th><th>Actions</th></tr></thead><tbody>
          {events.map((e) => <tr key={e.id}><td><Link href={`/events/${e.id}`}>{e.title}</Link></td><td>{e.when}</td><td>{e.price}</td><td>{e.going}/{e.capacity}</td><td>{e.tickets}</td><td><button type="button" className="text-button" onClick={() => { const [date, time = "18:00"] = e.startsAt.split("T"); setF({ title: e.title, date, time: time.slice(0,5), location: e.location, price: String(e.priceValue), capacity: String(e.capacity), category: e.category, description: e.description, image: e.image, recurrence: "none", recurrenceCount: "4" }); setEditingEventId(e.id); setShowForm(true); }}>Edit</button> <button type="button" className="text-button" disabled={deletingEventId === e.id} onClick={async () => { if (!window.confirm(`Delete "${e.title}"? This cannot be undone.`)) return; setDeletingEventId(e.id); try { await api("/api/committee/events", "DELETE", { id: e.id }); notify("Event deleted."); router.refresh(); } catch (err) { notify(err instanceof Error ? err.message : "Couldn't delete event."); } finally { setDeletingEventId(null); } }}>{deletingEventId === e.id ? "Deleting…" : "Delete"}</button></td></tr>)}
        </tbody></table></div>}
    </section>
    {toast}
  </div>;
}
