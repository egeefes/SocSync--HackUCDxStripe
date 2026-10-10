export const MEMBERSHIP_PRICE = 2;

export function eur(n: number) {
  if (n === 0) return "Free";
  return `€${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

/** Current wall-clock time in Dublin as "YYYY-MM-DDTHH:mm:ss". */
export function nowDublin() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Europe/Dublin" }).replace(" ", "T");
}

export function parts(startsAt: string) {
  const [d, t] = startsAt.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return {
    y, m, d: day, iso: d, time: (t || "00:00").slice(0, 5),
    day: dt.toLocaleDateString("en-IE", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    date: dt.toLocaleDateString("en-IE", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase(),
    long: dt.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
  };
}

export function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Dublin" });
}

export const memberCardId = (id: string) => `CL-${id.slice(0, 8).toUpperCase()}`;
