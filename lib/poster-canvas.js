// Draws the final poster in the browser (1080x1440, Instagram portrait).
// The AI supplies the look (headline, tagline, palette, layout, background picture);
// the date, time, venue and price come straight from the event form, so they are always exact.

export const W = 1080;
export const H = 1440;

const PALETTES = {
  midnight: { panel: "#292443", text: "#ffffff", soft: "#c8bfff", accent: "#a998ff", g1: "#3a2f7a", g2: "#6f55e8" },
  coral: { panel: "#ffffff", text: "#27243f", soft: "#85839a", accent: "#ff6f58", g1: "#ffb4a3", g2: "#ff836f" },
  forest: { panel: "#183d2f", text: "#ffffff", soft: "#a7e3c3", accent: "#74c5a3", g1: "#1f5a43", g2: "#58a98a" },
  sunset: { panel: "#3b1f2b", text: "#ffffff", soft: "#ffcfb5", accent: "#ffb38a", g1: "#7a2e44", g2: "#ff836f" },
  ocean: { panel: "#10314f", text: "#ffffff", soft: "#bfe6ff", accent: "#8fd3ff", g1: "#14507d", g2: "#4b9fd6" },
  paper: { panel: "#faf6ee", text: "#2b2118", soft: "#7d6b5c", accent: "#c8102e", g1: "#f2e3c9", g2: "#e9c79a" },
};

function fontFamilies() {
  const css = getComputedStyle(document.documentElement);
  return {
    display: css.getPropertyValue("--font-manrope").trim() || "sans-serif",
    body: css.getPropertyValue("--font-dm-sans").trim() || "sans-serif",
  };
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Draw an image so it fills the box (like CSS background-size: cover).
function cover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

// Word-wrap text into at most `maxLines` lines; returns the y after the last line.
function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(/\s+/);
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(lines === maxLines - 1 ? `${line}…` : line, x, y);
      y += lineHeight;
      line = words[i];
      if (++lines === maxLines) return y;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

function whenText(start, end) {
  const s = new Date(start);
  const day = s.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" });
  const t = (d) => d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return end ? `${day} · ${t(s)}–${t(new Date(end))}` : `${day} · ${t(s)}`;
}

export async function drawPoster(canvas, { design, background, society, event }) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  const p = PALETTES[design.palette] ?? PALETTES.midnight;
  const f = fontFamilies();
  await Promise.all([document.fonts.load(`800 80px ${f.display}`), document.fonts.load(`600 30px ${f.body}`)]).catch(() => {});
  const img = await loadImage(background);

  // ----- picture area -----
  const full = design.layout === "full-bleed";
  const picH = full ? H : 830;
  if (img) {
    cover(ctx, img, 0, 0, W, picH);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, picH);
    g.addColorStop(0, p.g1);
    g.addColorStop(1, p.g2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, picH);
    ctx.font = `260px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillText(design.emoji || "✳", W / 2, picH / 2 + 90);
    ctx.textAlign = "left";
  }

  // ----- text panel -----
  let top;
  if (full) {
    const g = ctx.createLinearGradient(0, H * 0.38, 0, H);
    g.addColorStop(0, p.panel + "00");
    g.addColorStop(0.45, p.panel + "e6");
    g.addColorStop(1, p.panel);
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.38, W, H * 0.62);
    top = 890;
  } else {
    ctx.fillStyle = p.panel;
    ctx.fillRect(0, 790, W, H - 790);
    ctx.fillStyle = p.accent;
    ctx.fillRect(0, 790, W, 10);
    top = 905; // first headline baseline: leave room under the accent line
  }

  // society badge (top-left, on the picture)
  ctx.font = `700 26px ${f.body}`;
  const badge = society.toUpperCase();
  const bw = ctx.measureText(badge).width + 48;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(48, 48, bw, 58, 29); // older browsers: plain rectangle
  else ctx.rect(48, 48, bw, 58);
  ctx.fill();
  ctx.fillStyle = "#27243f";
  ctx.fillText(badge, 72, 87);

  const x = 72, maxW = W - 144;
  ctx.fillStyle = p.text;
  ctx.font = `800 ${design.headline.length > 22 ? 76 : 92}px ${f.display}`;
  let y = wrap(ctx, design.headline, x, top, maxW, design.headline.length > 22 ? 84 : 98, 2);

  if (design.tagline) {
    ctx.fillStyle = p.soft;
    ctx.font = `500 34px ${f.body}`;
    y = wrap(ctx, design.tagline, x, y + 8, maxW, 44, 2);
  }

  // exact details from the form
  y += 22;
  ctx.font = `700 34px ${f.body}`;
  ctx.fillStyle = p.text;
  for (const line of [
    `📅  ${whenText(event.start, event.end)}`,
    `📍  ${event.venue || "Venue TBC"}`,
    `🎟️  ${Number(event.price_eur) > 0 ? `€${Number(event.price_eur).toFixed(2)}` : "Free entry"}`,
  ]) {
    y = wrap(ctx, line, x, y, maxW, 50, 1);
  }

  // highlights (only if there's room)
  ctx.font = `500 28px ${f.body}`;
  for (const h of design.highlights || []) {
    if (y > H - 110) break;
    ctx.fillStyle = p.accent;
    ctx.fillText("✓", x, y + 4);
    ctx.fillStyle = p.soft;
    y = wrap(ctx, h, x + 40, y + 4, maxW - 40, 40, 1);
  }

  // footer
  ctx.font = `800 28px ${f.display}`;
  ctx.fillStyle = p.accent;
  ctx.textAlign = "right";
  ctx.fillText("socsync · RSVP on SocSync", W - 60, H - 48);
  ctx.textAlign = "left";
  return canvas.toDataURL("image/jpeg", 0.88);
}
