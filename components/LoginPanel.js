
"use client";

import { useState } from "react";
import Link from "next/link";
import JsonForm from "./JsonForm";
import { fullReload } from "@/lib/full-reload";

export default function LoginPanel({ demoUsers = [] }) {
  const [tab, setTab] = useState("student");
  const [demoBusy, setDemoBusy] = useState(null);
  const [demoError, setDemoError] = useState("");

  async function demoLogin(id) {
    if (demoBusy !== null) return;

    setDemoBusy(id);
    setDemoError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || `Login failed with status ${res.status}.`
        );
      }

      if (!data.redirect) {
        throw new Error("Login succeeded but no redirect was returned.");
      }

      fullReload(data.redirect);
    } catch (error) {
      console.error("Demo login error:", error);
      setDemoError(
        error?.message ||
          "Unable to log in. Please check your connection and try again."
      );
      setDemoBusy(null);
    }
  }

  const demos = demoUsers.filter((user) =>
    tab === "student"
      ? user.role === "student"
      : user.role === "admin"
  );

  const platform = demoUsers.find((user) => user.role === "platform");

  const tabClass = (value) =>
    `flex-1 rounded-lg py-2 text-sm font-medium ${
      tab === value
        ? "bg-accent text-white"
        : "hover:bg-accent-soft"
    }`;

  return (
    <div className="auth-card space-y-5 !my-0">
      <div className="flex gap-1 rounded-xl border border-border p-1">
        <button
          type="button"
          className={tabClass("student")}
          onClick={() => {
            setTab("student");
            setDemoError("");
          }}
        >
          🎓 Student
        </button>

        <button
          type="button"
          className={tabClass("society")}
          onClick={() => {
            setTab("society");
            setDemoError("");
          }}
        >
          🏛️ Society
        </button>
      </div>

      <JsonForm
        key={tab}
        endpoint="/api/auth/login"
        submitLabel={
          tab === "student"
            ? "Log in as student"
            : "Log in as society"
        }
      >
        <input type="hidden" name="as" value={tab} />

        <div>
          <span className="label">
            {tab === "student"
              ? "UCD student email"
              : "Email of the society admin"}
          </span>

          <input
            name="email"
            type="email"
            className="input"
            placeholder="firstname.lastname@ucdconnect.ie"
            required
          />
        </div>

        <div>
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            className="input"
            required
          />
        </div>
      </JsonForm>

      <p className="text-center text-sm text-muted">
        {tab === "student" ? (
          <>
            New to SocSync?{" "}
            <Link href="/signup" className="text-accent underline">
              Create a student account
            </Link>
          </>
        ) : (
          <>
            Society not on SocSync yet?{" "}
            <Link
              href="/register-society"
              className="text-accent underline"
            >
              Register your society
            </Link>
          </>
        )}
      </p>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="label">
          Demo {tab === "student" ? "students" : "societies"} (one click, no password)
        </p>

        <div className="flex flex-wrap gap-2">
          {demos.map((user) => (
            <button
              type="button"
              key={user.id}
              disabled={demoBusy !== null}
              onClick={() => demoLogin(user.id)}
              className="btn-secondary"
            >
              {demoBusy === user.id
                ? "Logging in…"
                : user.name}

              {user.status === "pending" && (
                <span className="text-xs text-amber-600">
                  {" "}(pending)
                </span>
              )}
            </button>
          ))}

          {demos.length === 0 && (
            <p className="text-sm text-muted">
              No demo accounts are available for this tab.
            </p>
          )}
        </div>

        {demoError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {demoError}
          </p>
        )}

        {platform && (
          <p className="pt-1 text-xs text-muted">
            Running SocSync?{" "}
            <button
              type="button"
              disabled={demoBusy !== null}
              onClick={() => demoLogin(platform.id)}
              className="text-accent underline"
            >
              {demoBusy === platform.id
                ? "Logging in…"
                : "Log in as the SocSync admin"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
