// Search + category filter. A plain GET form: submitting it just changes the URL (?q=...&category=...),
// and the page re-renders on the server with the filtered data. No client JavaScript needed.
import { CATEGORIES } from "@/lib/db";

// `action` sends the search to another page (e.g. the home page's "Find societies" box -> /societies).
export default function FilterBar({ q = "", category = "", hidden = {}, placeholder = "Search…", action, button = "Filter" }) {
  return (
    <form action={action} className="flex flex-wrap gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input name="q" defaultValue={q} placeholder={placeholder} className="input max-w-xs" />
      <select name="category" defaultValue={category} className="input w-auto">
        <option value="">All categories</option>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <button className="btn-secondary">{button}</button>
    </form>
  );
}
