// Find societies: every society on SocSync, searchable by name and filterable by interest.
import Link from "next/link";
import { Search } from "lucide-react";
import SocietyCard from "@/components/SocietyCard";
import { CATEGORIES } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { listSocieties } from "@/lib/queries";

export default async function SocietiesPage({ searchParams }) {
  const { q = "", category = "" } = await searchParams;
  const user = await pageUser();
  const societies = listSocieties({ search: q, category, userId: user.id });
  const href = (c) => `/societies?${new URLSearchParams({ ...(q && { q }), ...(c && { category: c }) })}`;

  return (
    <section className="results-section !pt-0">
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR PEOPLE ARE HERE</div>
          <h2>Find societies <span className="result-count">{societies.length}</span></h2>
        </div>
      </div>
      <form className="search-filter-row" action="/societies">
        {category && <input type="hidden" name="category" value={category} />}
        <label className="search-box"><Search size={17} /><input name="q" defaultValue={q} placeholder="e.g. Japanese, climbing, startups…" aria-label="Search societies" /></label>
      </form>
      <div className="interest-filter">
        <Link className={!category ? "on" : ""} href={href("")}>All societies</Link>
        {CATEGORIES.map((c) => <Link key={c} className={category === c ? "on" : ""} href={href(c)}>{c}</Link>)}
      </div>
      {societies.length ? (
        <div className="society-grid">{societies.map((s) => <SocietyCard key={s.id} society={s} />)}</div>
      ) : (
        <div className="empty-state"><Search size={24} /><strong>No societies match</strong><p>Try a different search or interest.</p>
          <Link className="text-button" href="/societies">Clear filters</Link></div>
      )}
    </section>
  );
}
