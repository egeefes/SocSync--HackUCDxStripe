// Visual helpers shared by pages and components: colours, photos and icons per category.
// (Design adapted from teammate Ege's CampusLoop frontend.)
import { BriefcaseBusiness, Code2, Dices, Globe2, Mountain, Palette } from "lucide-react";

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

// Category -> chip colour, society avatar colour, photo, icon.
export const CATEGORY_STYLE = {
  "Languages & Culture": { chip: "blue", soc: "soc-coral", photo: img("photo-1528605248644-14dd04022da1"), icon: Globe2 },
  Business: { chip: "yellow", soc: "soc-yellow", photo: img("photo-1517245386807-bb43f82c33c4"), icon: BriefcaseBusiness },
  "Sport & Outdoors": { chip: "green", soc: "soc-green", photo: img("photo-1552674605-db6ffd4facb5"), icon: Mountain },
  "Arts & Performance": { chip: "pink", soc: "soc-coral", photo: img("photo-1503095396549-807759245b35"), icon: Palette },
  "Academic & Tech": { chip: "lavender", soc: "soc-purple", photo: img("photo-1519389950473-47ba0277781c"), icon: Code2 },
  "Social & Hobbies": { chip: "coral", soc: "soc-yellow", photo: img("photo-1610890716171-6b1bb98ffd09"), icon: Dices },
};
const FALLBACK = { chip: "lavender", soc: "soc-purple", photo: img("photo-1528605248644-14dd04022da1"), icon: Globe2 };
const BALL_PHOTO = img("photo-1511795409834-ef04bbd61622");

export const styleFor = (category) => CATEGORY_STYLE[category] ?? FALLBACK;

// An AI-designed poster wins; otherwise balls get the ball photo, everything else its category photo.
export const eventPhoto = (e) =>
  e.has_poster ? `/api/events/${e.id}/poster` : /\bball\b/i.test(e.title) ? BALL_PHOTO : styleFor(e.category).photo;

// "Japanese Society" -> "JS", "Computer Science Society" -> "CS"
// ("Society"/"Club" are skipped only when two other words remain, so "Japanese Society" -> "JS")
export function initials(name) {
  const all = name.replace(/&/g, " ").split(/\s+/).filter(Boolean);
  const core = all.filter((w) => !/^(society|club|soc)$/i.test(w));
  const words = core.length >= 2 ? core : all;
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// '2026-10-14T18:00' -> { day: 'WED', date: '14 Oct', time: '18:00' }
export function dateParts(local) {
  const d = new Date(local);
  return {
    day: d.toLocaleDateString("en-IE", { weekday: "short" }).toUpperCase(),
    date: d.toLocaleDateString("en-IE", { day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

// URL of an uploaded society picture (kind: avatar | cover | card). `?v=` changes on every upload,
// so browsers can cache it safely.
export const societyImage = (s, kind) => `/api/societies/${s.id}/image/${kind}?v=${encodeURIComponent(s.media_version ?? "")}`;

// Cover banner: the society's own upload, otherwise its category photo.
export const societyCover = (s) => (s.has_cover ? societyImage(s, "cover") : styleFor(s.category).photo);
