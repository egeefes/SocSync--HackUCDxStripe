// Society profile picture: the uploaded logo, or coloured initials if there isn't one.
import { initials, societyImage, styleFor } from "@/lib/ui";

export default function SocietyAvatar({ society: s, big = false }) {
  const cls = `society-avatar ${big ? "big" : ""} ${styleFor(s.category).soc}`;
  if (s.has_avatar) {
    return (
      <div className={`${cls} has-logo`} role="img" aria-label={`${s.name} logo`}
        style={{ backgroundImage: `url(${societyImage(s, "avatar")})` }} />
    );
  }
  return <div className={cls}>{initials(s.name)}</div>;
}
