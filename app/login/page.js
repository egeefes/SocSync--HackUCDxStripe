// The front door: the only page you see until you log in.
import { Zap } from "lucide-react";
import db from "@/lib/db";
import LoginPanel from "@/components/LoginPanel";

export const dynamic = "force-dynamic"; // reads the database on every request

export default function LoginPage() {
  const demoUsers = db.prepare("SELECT id, name, role, status FROM users WHERE is_demo = 1 ORDER BY id").all();

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div className="flex flex-col items-center text-center">
        <span className="brand !p-0">
          <span className="brand-mark"><Zap size={20} fill="currentColor" /></span>
          <span>soc<span className="brand-light">sync</span><small>UCD SOCIETIES</small></span>
        </span>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Find your <span className="text-accent">people.</span> Find your thing.</h1>
        <p className="mt-2 text-sm text-muted">Every society event on campus, in one calendar.</p>
      </div>
      <LoginPanel demoUsers={demoUsers} />
    </div>
  );
}
