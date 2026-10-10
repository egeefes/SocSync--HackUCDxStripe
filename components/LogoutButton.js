"use client";
import { fullReload } from "@/lib/full-reload";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    fullReload("/");
  }
  return (
    <button onClick={logout} className="btn-secondary">
      Log out
    </button>
  );
}
