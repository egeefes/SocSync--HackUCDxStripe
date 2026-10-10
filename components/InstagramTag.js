// "@handle" tag for a society's Instagram. Renders nothing when the society hasn't added one.
// `link={false}` for places that are already inside a link (e.g. society cards).

function CameraIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

export default function InstagramTag({ handle, link = true, size = 14 }) {
  if (!handle) return null;
  const content = <><CameraIcon size={size} /><span>{handle}</span></>;
  return link ? (
    <a className="insta-tag" href={`https://www.instagram.com/${handle.replace(/^@/, "")}/`} target="_blank" rel="noopener noreferrer"
      title={`${handle} on Instagram`}>
      {content}
    </a>
  ) : (
    <span className="insta-tag">{content}</span>
  );
}
