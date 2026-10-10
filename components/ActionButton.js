"use client";
// One reusable button for every "do something on the server" action:
// POSTs `body` to `endpoint`; if the server returns a `url` (e.g. Stripe Checkout) we go there,
// otherwise we refresh the page so it shows the new data. Errors are shown under the button.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActionButton({ endpoint, body = {}, children, variant = "primary", className = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className={className}>
      <button onClick={run} disabled={busy} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
        {busy ? "Working…" : children}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
