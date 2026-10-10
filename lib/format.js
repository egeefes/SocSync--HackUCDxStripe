// Instagram handle from whatever the society typed: "ucdjapsoc", "@ucdjapsoc" or an instagram.com link.
// Returns { handle: "@ucdjapsoc" }, { handle: null } for empty, or { error }.
export function normalizeInstagram(input) {
  let s = String(input ?? "").trim();
  if (!s) return { handle: null };
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) {
    return { error: "Instagram handle can only use letters, numbers, dots and underscores (max 30), e.g. @ucdjapsoc." };
  }
  return { handle: `@${s}` };
}

export function euro(cents) {
  if (!cents) return "Free";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

// '2026-10-14T18:00' -> 'Wed 14 Oct, 18:00'
export function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Current local time in the same 'YYYY-MM-DDTHH:mm' format the events table uses.
export function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Timestamp for created_at / updated_at columns: 'YYYY-MM-DD HH:mm:ss' (UTC), sorts correctly as text.
export function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

// One-click "Add to Google Calendar" link (Google's event template). Works without connecting anything.
export function googleCalendarLink(e, appUrl = "http://localhost:3000") {
  const compact = (local) => local.replace(/[-:]/g, "") + "00"; // '2026-10-31T19:30' -> '20261031T193000'
  let end = e.end;
  if (!end) {
    const d = new Date(e.start);
    d.setHours(d.getHours() + 2);
    const pad = (n) => String(n).padStart(2, "0");
    end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${e.title} (${e.society_name})`,
    dates: `${compact(e.start)}/${compact(end)}`,
    ctz: "Europe/Dublin",
    location: e.venue || "",
    details: `${e.description || ""}\n\nDetails: ${appUrl}/events/${e.id}`.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function stars(avg) {
  if (avg == null) return "No ratings yet";
  return `★ ${Number(avg).toFixed(1)}`;
}
