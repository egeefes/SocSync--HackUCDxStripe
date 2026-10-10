"use client";
// Society dashboard: edit the public profile - pictures, Instagram, about us and committee.
// Pictures are shrunk in the browser before upload, so phone photos are fine.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Trash2 } from "lucide-react";

const PICTURES = [
  { kind: "avatar", label: "Profile picture / logo", hint: "Square works best", maxSide: 400, round: true },
  { kind: "cover", label: "Cover banner", hint: "Wide photo, e.g. from an event", maxSide: 1600 },
  { kind: "card", label: "Membership card background", hint: "Shown behind members' digital cards", maxSide: 1200 },
];

function shrink(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("That file isn't an image we can read."));
    img.src = URL.createObjectURL(file);
  });
}

export default function SocietyProfileEditor({ society }) {
  const router = useRouter();
  const [instagram, setInstagram] = useState(society.instagram ?? "");
  const [bio, setBio] = useState(society.bio ?? "");
  const [committee, setCommittee] = useState(society.committee?.length ? society.committee : []);
  const [pics, setPics] = useState({}); // kind -> dataUrl (new) | "" (remove); missing = unchanged
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const current = (kind) =>
    kind in pics ? pics[kind] || null : society[`has_${kind === "card" ? "card_bg" : kind}`]
      ? `/api/societies/${society.id}/image/${kind}?v=${encodeURIComponent(society.media_version ?? "")}` : null;

  async function pick(kind, maxSide, file) {
    if (!file) return;
    try {
      const dataUrl = await shrink(file, maxSide);
      setPics((p) => ({ ...p, [kind]: dataUrl }));
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  }

  const setMember = (i, key) => (e) => setCommittee((list) => list.map((m, j) => (j === i ? { ...m, [key]: e.target.value } : m)));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/societies/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagram, bio, committee, ...pics }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error || "Couldn't save the profile." });
    setPics({});
    setInstagram(data.instagram ?? "");
    setMsg({ ok: true, text: "Saved. Your public page is updated." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card profile-editor space-y-4" id="profile">
      <div>
        <h3 className="font-semibold">Society page</h3>
        <p className="text-xs text-muted">What students see on your public page and society cards.</p>
      </div>

      <div className="media-row">
        {PICTURES.map(({ kind, label, hint, maxSide, round }) => {
          const src = current(kind);
          return (
            <div key={kind} className="space-y-2">
              <span className="label !mb-0">{label}</span>
              <div className={`media-preview ${round ? "round" : ""}`} style={src ? { backgroundImage: `url(${src})`, borderStyle: "solid" } : undefined}>
                {!src && <span>{hint}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="btn-secondary cursor-pointer !px-3 !py-1.5 text-xs">
                  <ImagePlus size={13} /> {src ? "Change" : "Upload"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(kind, maxSide, e.target.files?.[0])} />
                </label>
                {src && (
                  <button type="button" className="text-button danger" onClick={() => setPics((p) => ({ ...p, [kind]: "" }))}>
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <div>
          <span className="label">Instagram (optional)</span>
          <input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yoursociety" />
        </div>
        <div>
          <span className="label">About us (optional)</span>
          <textarea className="input" rows={3} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="Who you are, what you do every week, why someone should come along…" />
        </div>
      </div>

      <div className="space-y-2">
        <span className="label !mb-0">Committee (optional)</span>
        {committee.map((m, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
            <input className="input" placeholder="Name" value={m.name} onChange={setMember(i, "name")} />
            <input className="input" placeholder="Role, e.g. Auditor" value={m.role} onChange={setMember(i, "role")} />
            <input className="input" placeholder="One line about them (optional)" value={m.bio ?? ""} onChange={setMember(i, "bio")} />
            <button type="button" className="text-button danger" onClick={() => setCommittee((list) => list.filter((_, j) => j !== i))} aria-label="Remove committee member">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {committee.length < 20 && (
          <button type="button" className="text-button" onClick={() => setCommittee((list) => [...list, { name: "", role: "", bio: "" }])}>
            <Plus size={13} /> Add committee member
          </button>
        )}
      </div>

      {msg && <p className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save society page"}</button>
    </form>
  );
}
