"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Bookmark, CalendarDays, Compass, IdCard, LogIn, Menu, ShieldCheck, Sparkles, Users, X, Zap, Heart } from "lucide-react";
import { INTERESTS } from "@/lib/data";
import { INTEREST_ICON } from "./InterestIcons";

type Props = { user: { name: string } | null; committeeName: string | null; crumb: string; children: React.ReactNode };

export function Shell({ user, committeeName, crumb, children }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const onHome = pathname === "/";
  const view = params.get("view");
  const category = params.get("category");

  const nav = [
    { href: "/", label: "Discover", icon: Compass, active: onHome && view !== "saved" },
    { href: "/societies", label: "Societies", icon: Users, active: pathname.startsWith("/societies") },
    { href: "/my-societies", label: "My societies", icon: IdCard, active: pathname.startsWith("/my-societies") },
    { href: "/calendar", label: "Calendar", icon: CalendarDays, active: pathname.startsWith("/calendar") },
    { href: "/?view=saved", label: "Saved", icon: Bookmark, active: onHome && view === "saved" },
  ];

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMenu(false);
    router.push("/");
    router.refresh();
  }

  return <main className="app-shell">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <Link className="brand" href="/" onClick={() => setOpen(false)}>
        <span className="brand-mark"><Zap size={20} fill="currentColor"/></span>
        <span>Soc<span className="brand-light">Sync</span><small>UCD STUDENT LIFE</small></span>
      </Link>
      <button className="mobile-close icon-button" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18}/></button>
      <div className="sidebar-label">YOUR CAMPUS</div>
      <nav className="side-nav">
        {nav.map((n) => { const Icon = n.icon; return <Link key={n.label} href={n.href} onClick={() => setOpen(false)} className={`nav-link ${n.active ? "active" : ""}`}><Icon size={18}/><span>{n.label}</span></Link>; })}
      </nav>
      <div className="sidebar-label category-label">EXPLORE BY INTEREST</div>
      <nav className="side-nav category-nav">
        {INTERESTS.map((name) => { const Icon = INTEREST_ICON[name] ?? Heart; return <Link key={name} href={`/?category=${name}`} onClick={() => setOpen(false)} className={`nav-link ${onHome && category === name ? "active" : ""}`}><Icon size={17}/><span>{name}</span></Link>; })}
      </nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-cta">
        <div className="cta-spark"><Sparkles size={17}/></div>
        <strong>Your next favourite thing is out there.</strong>
        <p>Let AI find events that feel like you.</p>
        <Link className="cta-link" href="/#ai-finder" onClick={() => setOpen(false)}>Try AI finder <ArrowUpRight size={15}/></Link>
      </div>
      <div className="sidebar-footer"><span className="online-dot"/> Made for UCD, by students <span className="footer-heart">♥</span></div>
    </aside>
    {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation"/>}

    <section className="main-panel">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20}/></button>
        <div className="breadcrumb"><span>Campus</span><span className="crumb-slash">/</span><strong>{crumb}</strong></div>
        <div className="topbar-actions">
          <span className="term-chip"><span className="online-dot"/> Autumn term</span>
          {user ? <div className="user-menu">
            <button className="avatar" onClick={() => setMenu(!menu)} aria-label="Account menu" aria-expanded={menu}>{user.name.charAt(0).toUpperCase()}</button>
            {menu && <div className="user-dropdown" onClick={() => setMenu(false)}>
              <div className="user-dropdown-name">{user.name}{committeeName && <small>Committee · {committeeName}</small>}</div>
              <Link href="/interests">My interests</Link>
              <Link href="/committee"><ShieldCheck size={14}/>{committeeName ? "Committee dashboard" : "Committee access"}</Link>
              <button onClick={signOut}>Sign out</button>
            </div>}
          </div> : <Link className="signin-link" href="/signin"><LogIn size={15}/> Sign in</Link>}
        </div>
      </header>
      <div className="content">
        {children}
        <footer className="site-footer"><Link className="footer-brand" href="/"><Zap size={16} fill="currentColor"/> socsync</Link><span>A student-life concept for UCD · Demo content only</span><span>Made for finding your people <Heart size={13}/></span></footer>
      </div>
    </section>
  </main>;
}
