"use client";
// App frame for logged-in users: left sidebar + sticky top bar (design adapted from Ege's CampusLoop).
// Menus differ for students, society admins and the SocSync admin. Logged-out users never see this.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight, CalendarDays, Compass, IdCard, LayoutDashboard, LogOut, Menu, PlusCircle,
  ShieldCheck, Sparkles, Users, X, Zap, Eye,
} from "lucide-react";
import { CATEGORY_STYLE } from "@/lib/ui";
import { fullReload } from "@/lib/full-reload";

const ROLE_LABEL = { student: "Student", admin: "Society admin", platform: "SocSync admin" };

function crumbFor(path) {
  if (path === "/") return "Home";
  if (path.startsWith("/societies/")) return "Society";
  if (path.startsWith("/societies")) return "Find societies";
  if (path.startsWith("/events/")) return "Event";
  if (path.startsWith("/calendar")) return "Calendar";
  if (path.startsWith("/my-societies")) return "My societies";
  if (path.startsWith("/admin")) return "Dashboard";
  if (path.startsWith("/platform")) return "Verification";
  if (path.startsWith("/register-society")) return "Register a society";
  return "SocSync";
}

export default function Shell({ user, pendingCount = 0, children }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false); // mobile sidebar
  const [menu, setMenu] = useState(false); // avatar dropdown
  const category = params.get("category");
  const close = () => setOpen(false);

  const nav =
    user.role === "student"
      ? [
          { href: "/", label: "Home", icon: Compass, active: pathname === "/" && !category },
          { href: "/societies", label: "Find societies", icon: Users, active: pathname.startsWith("/societies") },
          { href: "/my-societies", label: "My societies", icon: IdCard, active: pathname.startsWith("/my-societies") },
          { href: "/calendar", label: "Calendar", icon: CalendarDays, active: pathname.startsWith("/calendar") },
        ]
      : user.role === "admin"
        ? [
            { href: "/admin", label: "Dashboard", icon: LayoutDashboard, active: pathname.startsWith("/admin") },
            { href: `/societies/${user.society_id}`, label: "Our public page", icon: Eye, active: pathname === `/societies/${user.society_id}` },
            { href: "/societies", label: "All societies", icon: Users, active: pathname === "/societies" },
          ]
        : [
            { href: "/platform", label: "Verification", icon: ShieldCheck, active: pathname.startsWith("/platform"), count: pendingCount },
            { href: "/societies", label: "All societies", icon: Users, active: pathname.startsWith("/societies") },
          ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    fullReload("/");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link className="brand" href={nav[0].href} onClick={close}>
          <span className="brand-mark"><Zap size={20} fill="currentColor" /></span>
          <span>soc<span className="brand-light">sync</span><small>UCD SOCIETIES</small></span>
        </Link>
        <button className="mobile-close icon-button" onClick={close} aria-label="Close menu"><X size={18} /></button>

        <div className="sidebar-label">{user.role === "student" ? "YOUR CAMPUS" : user.role === "admin" ? "YOUR SOCIETY" : "SOCSYNC ADMIN"}</div>
        <nav className="side-nav">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.label} href={n.href} onClick={close} className={`nav-link ${n.active ? "active" : ""}`}>
                <Icon size={18} /><span>{n.label}</span>
                {n.count > 0 && <span className="nav-count">{n.count}</span>}
              </Link>
            );
          })}
        </nav>

        {user.role === "student" && (
          <>
            <div className="sidebar-label category-label">EXPLORE BY INTEREST</div>
            <nav className="side-nav category-nav">
              {Object.entries(CATEGORY_STYLE).map(([name, s]) => {
                const Icon = s.icon;
                return (
                  <Link key={name} href={`/?category=${encodeURIComponent(name)}#events`} onClick={close}
                    className={`nav-link ${pathname === "/" && category === name ? "active" : ""}`}>
                    <Icon size={17} /><span>{name}</span>
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        <div className="sidebar-spacer" />
        {user.role === "student" && (
          <div className="sidebar-cta">
            <div className="cta-spark"><Sparkles size={17} /></div>
            <strong>Your next favourite thing is out there.</strong>
            <p>Tell the AI what you&apos;re into and it picks events for you.</p>
            <Link className="cta-link" href="/#ai-finder" onClick={close}>Try AI finder <ArrowUpRight size={15} /></Link>
          </div>
        )}
        {user.role === "admin" && (
          <div className="sidebar-cta">
            <div className="cta-spark"><Sparkles size={17} /></div>
            <strong>Got a poster? Let AI post it.</strong>
            <p>Upload it on your dashboard and the event form fills itself.</p>
            <Link className="cta-link" href="/admin" onClick={close}>Add an event <PlusCircle size={15} /></Link>
          </div>
        )}
        <div className="sidebar-footer"><span className="online-dot" /> Made for UCD, by students <span className="footer-heart">♥</span></div>
      </aside>
      {open && <button className="sidebar-scrim" onClick={close} aria-label="Close navigation" />}

      <section className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Campus</span><span className="crumb-slash">/</span><strong>{crumbFor(pathname)}</strong></div>
          <div className="topbar-actions">
            {user.status === "pending" ? (
              <span className="term-chip pending-chip">Pending verification</span>
            ) : (
              <span className="term-chip"><span className="online-dot" /> Demo data · Stripe sandbox</span>
            )}
            <div className="user-menu">
              <button className="avatar" onClick={() => setMenu(!menu)} aria-label="Account menu" aria-expanded={menu}>
                {user.name.charAt(0).toUpperCase()}
              </button>
              {menu && (
                <div className="user-dropdown" onClick={() => setMenu(false)}>
                  <div className="user-dropdown-name">{user.name}<small>{ROLE_LABEL[user.role]}</small></div>
                  {user.role === "student" && <Link href="/my-societies"><IdCard size={14} /> My societies</Link>}
                  {user.role === "student" && <Link href="/register-society"><PlusCircle size={14} /> Register a society</Link>}
                  <button onClick={logout}><LogOut size={14} /> Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">
          {children}
          <footer className="site-footer">
            <Link className="footer-brand" href={nav[0].href}><Zap size={16} fill="currentColor" /> socsync</Link>
            <span>A student-society concept for UCD · Synthetic demo data · Stripe sandbox</span>
            <span>Made for finding your people ♥</span>
          </footer>
        </div>
      </section>
    </div>
  );
}
