"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Heart, Music2, Search, SlidersHorizontal, Sparkles, Users, X } from "lucide-react";
import type { EventView, SocietyView } from "@/lib/types";
import { INTERESTS } from "@/lib/data";
import { api } from "@/lib/api";
import { EventCard } from "./EventCard";
import { SocietyCard } from "./SocietyCard";
import { useToast } from "./Toast";

type Pick<T> = { item: T; reason: string };
type Props = {
  events: EventView[]; societies: SocietyView[]; savedIds: number[]; signedIn: boolean; hasInterests: boolean;
  recEvents: Pick<EventView>[]; recSocieties: Pick<SocietyView>[]; initialCategory: string; initialView: string;
};

export function HomeClient({ events, societies, savedIds, signedIn, hasInterests, recEvents, recSocieties, initialCategory, initialView }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(INTERESTS.includes(initialCategory) ? initialCategory : "All events");
  const [freeOnly, setFreeOnly] = useState(false);
  const [saved, setSaved] = useState<number[]>(savedIds);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResults, setAiResults] = useState<Pick<EventView>[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { notify, toast } = useToast();
  const savedView = initialView === "saved";
  // A category landing page should focus on matching events, not personalized recommendations.
  const categoryLanding = Boolean(initialCategory);

  const filtered = useMemo(() => events.filter((e) => {
    if (savedView && !saved.includes(e.id)) return false;
    if (category !== "All events" && e.category !== category) return false;
    if (freeOnly && e.price !== 0) return false;
    const text = `${e.title} ${e.societyName} ${e.category} ${e.tags.join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [events, savedView, saved, category, freeOnly, query]);

  async function toggleSaved(id: number) {
    if (!signedIn) { notify("Sign in to save events."); return; }
    try { const d = await api("/api/saved", "POST", { eventId: id }); setSaved(d.saved); notify(d.saved.includes(id) ? "Event saved for later." : "Removed from saved events."); }
    catch (e) { notify(e instanceof Error ? e.message : "Couldn't save."); }
  }

  async function askAI() {
    if (!aiPrompt.trim()) { notify("Tell us a little about what you're looking for first."); return; }
    setAiLoading(true); setAiResults(null);
    try {
      const d = await api("/api/recommend", "POST", { prompt: aiPrompt });
      const byId = new Map(events.map((e) => [e.id, e]));
      const picks = (d.recommendations as { id: number; reason?: string }[])
        .filter((r) => byId.has(r.id))
        .map((r) => ({ item: byId.get(r.id)!, reason: r.reason && r.reason !== "Keyword match" ? r.reason : d.mode === "keyword-fallback" ? "Keyword match" : "" }));
      setAiResults(picks);
      if (d.mode === "keyword-fallback") notify("Showing keyword matches. Add an OpenRouter key to enable AI picks.");
      else if (!picks.length) notify("No close matches. Try a broader description.");
    } catch (e) { notify(e instanceof Error ? e.message : "The finder is unavailable right now."); }
    finally { setAiLoading(false); }
  }

  const totalGoing = events.reduce((a, e) => a + e.going, 0);
  const heading = savedView ? { eyebrow: "BOOKMARKED FOR LATER", title: "Saved for later" } : { eyebrow: "OUT THERE THIS WEEK", title: "Find something good" };

  return <>
    <section className="welcome-row">
      <div>
        <div className="eyebrow"><span className="eyebrow-line"/> YOUR CAMPUS, MORE YOU</div>
        <h1>Find your <em>people.</em><br/>Find your thing.</h1>
        <p className="welcome-copy">The best bits of UCD happen when you show up.<br className="desktop-break"/> Find the events, societies and people that make it yours.</p>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <div className="art-sun"/><div className="art-ring ring-one"/><div className="art-ring ring-two"/>
        <div className="art-card art-card-one"><Music2 size={18}/><span>Good people</span></div>
        <div className="art-card art-card-two"><Sparkles size={17}/><span>New things</span></div>
        <div className="art-orb">✳︎</div><div className="art-note">YOUR NEXT CHAPTER ↗</div>
      </div>
    </section>

    <section className="ai-panel" id="ai-finder">
      <div className="ai-topline"><div className="ai-icon"><Sparkles size={18}/></div><div><span className="ai-kicker">YOUR PERSONAL EVENT FINDER</span><h2>What's your kind of thing?</h2></div><span className="ai-pill">AI POWERED</span></div>
      <div className="ai-input-row">
        <input value={aiPrompt} maxLength={500} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askAI(); }} placeholder="e.g. Something social under €5 where I can meet new people..." aria-label="Describe the events you're looking for"/>
        <button onClick={askAI} disabled={aiLoading}>{aiLoading ? <span className="spinner"/> : <><span>Find my events</span><ArrowRight size={16}/></>}</button>
      </div>
      <div className="prompt-suggestions"><span>TRY</span>{["Free things this week", "Meet new people", "Tech & creativity"].map((p) => <button key={p} onClick={() => setAiPrompt(p)}>{p}</button>)}</div>
    </section>

    {!savedView && aiResults && <section className="results-section"><div className="section-heading"><div><div className="eyebrow">MADE FOR YOU</div><h2>Your matches <span className="result-count">{aiResults.length}</span></h2></div><button className="text-button" onClick={() => setAiResults(null)}>Clear results <X size={14}/></button></div>
      {aiResults.length ? <div className="event-grid">{aiResults.map(({ item, reason }) => <EventCard key={item.id} event={item} reason={reason || undefined} saved={saved.includes(item.id)} onSave={() => toggleSaved(item.id)}/>)}</div>
        : <div className="empty-state"><Sparkles size={22}/><strong>No close matches yet</strong><p>Try a broader interest or a different budget.</p></div>}</section>}

    {!savedView && signedIn && !hasInterests && <div className="banner"><Heart size={18}/><div><strong>Tell us what you're into</strong><span>Pick a few interests and we'll recommend events and societies.</span></div><Link className="primary-button small" href="/interests">Pick interests</Link></div>}

    {!savedView && !categoryLanding && recEvents.length > 0 && <section className="results-section"><div className="section-heading"><div><div className="eyebrow">BASED ON YOUR INTERESTS</div><h2>Recommended events</h2></div><Link className="view-all" href="/interests">Edit interests <ArrowRight size={15}/></Link></div>
      <div className="event-grid">{recEvents.map(({ item, reason }) => <EventCard key={item.id} event={item} reason={reason} saved={saved.includes(item.id)} onSave={() => toggleSaved(item.id)}/>)}</div></section>}

    {!savedView && !categoryLanding && recSocieties.length > 0 && <section className="results-section"><div className="section-heading"><div><div className="eyebrow">YOUR PEOPLE MIGHT BE HERE</div><h2>Societies to join</h2></div><Link className="view-all" href="/societies">All societies <ArrowRight size={15}/></Link></div>
      <div className="society-grid">{recSocieties.map(({ item, reason }) => <SocietyCard key={item.id} society={item} reason={reason}/>)}</div></section>}

    <section className="stats-strip">
      <div className="stat-item"><span className="stat-icon stat-purple"><Users size={17}/></span><div><strong>{societies.length} societies</strong><span>in this demo</span></div></div><div className="stat-divider"/>
      <div className="stat-item"><span className="stat-icon stat-coral"><CalendarDays size={17}/></span><div><strong>{events.length} events</strong><span>in this demo feed</span></div></div><div className="stat-divider"/>
      <div className="stat-item"><span className="stat-icon stat-green"><Heart size={17}/></span><div><strong>{totalGoing} going</strong><span>across all events</span></div></div>
    </section>

    <section className="events-section">
      <div className="section-heading">
        <div><div className="eyebrow">{heading.eyebrow}</div><h2>{heading.title} <span className="heading-spark">✳︎</span></h2></div>
        <div className="heading-actions"><button className="filter-button" onClick={() => { setCategory("All events"); setQuery(""); setFreeOnly(false); }}><SlidersHorizontal size={15}/> Reset filters</button></div>
      </div>
      <div className="search-filter-row">
        <label className="search-box"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, societies, interests..." aria-label="Search events"/></label>
        <select className="filter-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">{["All events", ...INTERESTS].map((c) => <option key={c}>{c}</option>)}</select>
        <button className={`free-filter ${freeOnly ? "selected" : ""}`} aria-pressed={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>Free only</button>
      </div>
      <div className="event-grid">{filtered.map((e) => <EventCard key={e.id} event={e} saved={saved.includes(e.id)} onSave={() => toggleSaved(e.id)}/>)}</div>
      {filtered.length === 0 && <div className="empty-state"><Search size={24}/><strong>{savedView ? "Nothing saved yet" : "No events found"}</strong><p>{savedView ? "Tap the bookmark on any event to save it here." : "Try another search or clear your filters."}</p>
        <button className="text-button" onClick={() => { setQuery(""); setCategory("All events"); setFreeOnly(false); }}>Clear filters</button></div>}
    </section>

    {toast}
  </>;
}
