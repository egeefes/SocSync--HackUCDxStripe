// The three AI features (all via OpenRouter):
//   1. extractEvent     - poster image / Instagram caption -> structured event (pre-fills the form)
//   2. moderateReview   - blocks abusive reviews but keeps honest criticism
//   3. summariseReviews - "what students say" summary for a society
import { askJson, askJsonWithMeta, AiError, generateImage } from "./openrouter";
import { nowLocal } from "./format";

const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const FREE_AI_IMPORTS = 3; // free plan: try AI import a few times, then upgrade to Pro
const nullable = (type) => ({ type: [type, "null"] });

// ---------- 1. Poster / caption -> event ----------

const EVENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_event", "title", "description", "start", "end", "venue", "price_eur", "capacity", "uncertain_fields", "other_events", "repeats"],
  properties: {
    is_event: { type: "boolean", description: "false if the input is not an event announcement" },
    title: nullable("string"),
    description: nullable("string"),
    start: { type: ["string", "null"], description: "YYYY-MM-DDTHH:mm local Dublin time" },
    end: { type: ["string", "null"], description: "YYYY-MM-DDTHH:mm local Dublin time" },
    venue: nullable("string"),
    price_eur: nullable("number"),
    capacity: nullable("integer"),
    uncertain_fields: { type: "array", items: { type: "string" }, description: "fields you guessed or could not find" },
    other_events: {
      type: "array",
      description: "if the input lists MORE than one event: the others (not the one extracted above)",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "when"],
        properties: { title: { type: "string" }, when: { type: "string", description: "date/time as written, e.g. 'Wed 21 Oct 17:00'" } },
      },
    },
    repeats: { type: ["string", "null"], description: "if the event recurs, how, in English (e.g. 'every Wednesday'); else null" },
  },
};

export async function extractEvent({ text = "", imageDataUrl = null }) {
  const today = new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const system = `You extract university society event details from posters and social media captions.
Today is ${today} (Europe/Dublin). Rules:
- Only use information that is in the input. Never invent a venue, time or price; use null and list the field in uncertain_fields.
- If the year is missing, assume the next upcoming occurrence of that date. If a weekday is given without a date, use the next one.
- If no end time is given, set end to null.
- "Free", "free entry" -> price_eur 0. A members/non-members price -> use the non-members price and mention both in the description.
- description: 1-3 sentences in English describing ONLY what the poster/caption says (activity, who it's for, what to bring).
  No filler or marketing phrases ("relaxing", "we look forward to seeing you"). If there's little info, one short sentence.
- If a weekday and a date are both given, pick the year where they match.
- If several events are listed, extract the FIRST one and list the rest in other_events.
- If it recurs ("every Wednesday", "jeden Mittwoch", "weekly"), set repeats and use the next occurrence as start.
- If the input is not an event (e.g. a meme or a random photo), set is_event=false and everything else null.`;

  const content = [{ type: "text", text: text ? `Caption / text:\n${text.slice(0, 4000)}` : "Extract the event from this poster." }];
  if (imageDataUrl) content.push({ type: "image_url", image_url: { url: imageDataUrl } });

  const { data: raw, model, ms, usedBackup } = await askJsonWithMeta({ system, content, schemaName: "event", schema: EVENT_SCHEMA });
  if (!raw.is_event) throw new AiError("This doesn't look like an event announcement. Try a clearer poster or paste the caption.", 422);

  // Never trust the model blindly: check its output and turn problems into warnings for the admin.
  const warnings = [];
  const event = {
    title: raw.title?.trim() || "",
    description: raw.description?.trim() || "",
    venue: raw.venue?.trim() || "",
    start: DATE_RE.test(raw.start ?? "") ? raw.start : "",
    end: DATE_RE.test(raw.end ?? "") ? raw.end : "",
    price_eur: typeof raw.price_eur === "number" && raw.price_eur >= 0 ? raw.price_eur : 0,
    capacity: Number.isInteger(raw.capacity) && raw.capacity > 0 ? raw.capacity : "",
  };
  if (!event.title) warnings.push("No title found.");
  if (!event.start) warnings.push("No date/time found. Please add it.");
  else if (event.start < nowLocal()) {
    const read = new Date(event.start).toLocaleString("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    warnings.push(`The AI read ${read}, which has already passed. If this is an old poster that's expected; otherwise fix the date.`);
  }
  if (event.end && event.start && event.end <= event.start) {
    warnings.push("End time was before start time, so it was cleared.");
    event.end = "";
  }
  if (!event.venue) warnings.push("No venue found.");
  const others = Array.isArray(raw.other_events) ? raw.other_events : [];
  if (others.length) {
    const list = others.map((o) => `${o.title} (${o.when})`).join(", ");
    warnings.push(`This poster lists ${others.length + 1} events. Imported the first one; import the others separately: ${list}.`);
  }
  if (raw.repeats) warnings.push(`This event repeats (${raw.repeats}). Only the next date was filled in; add the rest as separate events.`);
  for (const f of raw.uncertain_fields ?? []) warnings.push(`AI was unsure about: ${f}`);
  if (usedBackup) warnings.push(`The main AI model was slow, so a backup model (${model}) read this poster. Double-check the details.`);
  return { event, warnings, model, ms };
}

// ---------- 2. Review moderation ----------

const MODERATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["allowed", "reason", "suggested_rewrite"],
  properties: {
    allowed: { type: "boolean" },
    reason: { type: "string" },
    suggested_rewrite: nullable("string"),
  },
};

export async function moderateReview(comment) {
  return askJson({
    schemaName: "moderation",
    schema: MODERATION_SCHEMA,
    timeoutMs: 8000, // a student is waiting to post; if the AI is slow we accept the review as 'unchecked'
    system: `You moderate student reviews of university society events.
ALLOW honest feedback, including harsh criticism of the event, organisation, venue or society ("badly organised", "started late", "boring").
BLOCK only: insults or attacks on named/identifiable individuals, hate speech, harassment, threats, sexual content, personal data (phone numbers, emails), spam/ads.
If blocked: give a short reason and a suggested_rewrite that keeps the useful feedback. If allowed: reason "ok", suggested_rewrite null.`,
    content: comment,
  });
}

// ---------- 3. Review summary ----------

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "strengths", "improvements"],
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
  },
};

export const MIN_REVIEWS_FOR_SUMMARY = 3;

export async function summariseReviews(societyName, reviews) {
  if (reviews.length < MIN_REVIEWS_FOR_SUMMARY) {
    throw new AiError(`Need at least ${MIN_REVIEWS_FOR_SUMMARY} reviews for a fair summary (this society has ${reviews.length}).`, 422);
  }
  const lines = reviews.map((r) => `- [${r.stars}/5] (${r.event_title}) ${r.comment || "(no comment)"}`).join("\n");
  return askJson({
    schemaName: "review_summary",
    schema: SUMMARY_SCHEMA,
    system: `You summarise student reviews of a university society for other students deciding whether to join.
Be balanced and specific. Only use what the reviews say; do not invent facts. 2 sentences max for summary,
up to 3 short bullet points each for strengths and improvements (empty array if none). Mention if opinions are mixed.`,
    content: `Society: ${societyName}\n${reviews.length} reviews:\n${lines}`,
  });
}

// ---------- 4. "What's your kind of thing?" event finder ----------

const FINDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "reason"],
        properties: { id: { type: "integer" }, reason: { type: "string" } },
      },
    },
  },
};

// Picks up to 6 events from `events` that match what the student typed. Never invents events:
// the model only sees our list, and we drop any id that isn't in it.
export async function findEvents(prompt, events) {
  const today = new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const list = events
    .map((e) => `#${e.id} | ${e.title} | ${e.society_name} (${e.category}) | ${e.start.replace("T", " ")} | ${e.venue} | ${e.price_cents ? "€" + (e.price_cents / 100).toFixed(2) : "free"} | ${(e.description || "").slice(0, 140)}`)
    .join("\n");
  const { data } = await askJsonWithMeta({
    schemaName: "event_finder",
    schema: FINDER_SCHEMA,
    timeoutMs: 15000,
    system: `You help a university student find society events. Today is ${today} (Europe/Dublin).
Choose up to 6 events from the list that best match what the student asks for, best match first.
Respect explicit constraints (price, day/time, "free", "this week", topics). Only use ids from the list.
reason: max 12 words, friendly and SPECIFIC to that event (mention what happens there, e.g. "Crêpes and French chat, free for everyone").
Never give two events the same reason.
If nothing fits, return an empty array.`,
    content: `Student asks: ${prompt}\n\nEvents (id | title | society (category) | start | venue | price | description):\n${list}`,
  });
  const byId = new Map(events.map((e) => [e.id, e]));
  return (data.recommendations || []).filter((r) => byId.has(r.id)).slice(0, 6).map((r) => ({ event: byId.get(r.id), reason: r.reason }));
}

// Fallback when the AI is unavailable: simple keyword overlap, so the finder still answers.
export function keywordMatch(prompt, events) {
  const words = prompt.toLowerCase().split(/[^a-z0-9€]+/).filter((w) => w.length > 2);
  const wantsFree = /\bfree\b/i.test(prompt);
  return events
    .map((e) => {
      const text = `${e.title} ${e.society_name} ${e.category} ${e.description}`.toLowerCase();
      let score = words.filter((w) => text.includes(w)).length;
      if (wantsFree && !e.price_cents) score += 2;
      return { event: e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => ({ event: x.event, reason: "Keyword match" }));
}

// ---------- 5. Event details -> AI-designed poster ----------
// The text AI writes the copy and picks a look; the image AI paints a background WITHOUT text.
// Dates, times, venue and price are NOT written by the AI: the app draws them from the form,
// so they are always exactly right (image models often misspell text).

export const POSTER_PALETTES = ["midnight", "coral", "forest", "sunset", "ocean", "paper"];
export const POSTER_LAYOUTS = ["bottom-panel", "full-bleed"];

const POSTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "tagline", "highlights", "emoji", "palette", "layout", "art_prompt"],
  properties: {
    headline: { type: "string", description: "2-6 punchy words, may differ from the event title" },
    tagline: { type: "string", description: "max 12 words" },
    highlights: { type: "array", items: { type: "string" }, description: "0-3 items, max 6 words each, ONLY facts from the description" },
    emoji: { type: "string", description: "one emoji" },
    palette: { type: "string", enum: POSTER_PALETTES },
    layout: { type: "string", enum: POSTER_LAYOUTS },
    art_prompt: { type: "string", description: "scene for an illustration, no text in it" },
  },
};

export async function designPoster(e) {
  const { data, model } = await askJsonWithMeta({
    schemaName: "poster_design",
    schema: POSTER_SCHEMA,
    timeoutMs: 15000,
    system: `You design Instagram-style posters for university society events.
Write a short, energetic headline (2-6 words) and a tagline (max 12 words) for students.
highlights: up to 3 very short points taken ONLY from the event description (never invent prices, food, prizes or guests).
Never put dates, times, venues or prices in headline/tagline/highlights: the app adds those itself.
palette: midnight (dark purple), coral (white + coral), forest (dark green), sunset (warm dark), ocean (navy), paper (cream + red).
layout: "bottom-panel" (picture on top, details below) or "full-bleed" (picture fills the poster).
art_prompt: one sentence describing an illustration that fits the event (style, objects, mood). It must contain NO words, letters or numbers.`,
    content: `Society: ${e.society_name}\nEvent: ${e.title}\nDescription: ${e.description || "(none)"}\nVenue: ${e.venue || "TBC"}\nPrice: ${e.price_eur ? "€" + e.price_eur : "free"}`,
  });

  // Clean up anything the model got wrong instead of trusting it.
  const clip = (s, n) => String(s || "").trim().slice(0, n);
  const design = {
    headline: clip(data.headline, 60) || e.title,
    tagline: clip(data.tagline, 110),
    highlights: (data.highlights || []).map((h) => clip(h, 50)).filter(Boolean).slice(0, 3),
    emoji: clip(data.emoji, 8) || "✳",
    palette: POSTER_PALETTES.includes(data.palette) ? data.palette : "midnight",
    layout: POSTER_LAYOUTS.includes(data.layout) ? data.layout : "bottom-panel",
    art_prompt: clip(data.art_prompt, 400),
  };
  return { design, textModel: model };
}

export async function paintPosterBackground(artPrompt) {
  return generateImage(
    `${artPrompt}\nStyle: vibrant, modern poster illustration, portrait 3:4 composition, plenty of calm space.\n` +
      `IMPORTANT: absolutely no text, letters, numbers, logos or signs anywhere in the image.`
  );
}
