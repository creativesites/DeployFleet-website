"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

interface NavItem {
  href: string;
  label: string;
  group: "Analytics" | "Marketing" | "Intelligence" | "Settings";
}

/**
 * Mobile-first, sidebar-navigated shell — replaces the old client-state
 * tab switcher (AdminDashboard.tsx) entirely, at the user's explicit
 * direction ("Vercel like ... not tabs"). Every former tab is now a real
 * route under /admin/*, so the URL reflects what's on screen
 * (bookmarkable, shareable, correct back-button behavior) — the
 * navigation pattern this replaces couldn't do any of that, since it was
 * one route with in-memory tab state.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", group: "Analytics" },
  { href: "/admin/leads", label: "Leads", group: "Analytics" },
  { href: "/admin/visitors", label: "Visitors", group: "Analytics" },
  { href: "/admin/geography", label: "Geography", group: "Analytics" },
  { href: "/admin/content", label: "Content", group: "Marketing" },
  { href: "/admin/campaigns", label: "Campaigns", group: "Marketing" },
  { href: "/admin/realtime", label: "Real-Time", group: "Intelligence" },
  { href: "/admin/insights", label: "Insights", group: "Intelligence" },
  { href: "/admin/diesel-prices", label: "Diesel Prices", group: "Settings" },
];

const GROUP_ORDER: NavItem["group"][] = ["Analytics", "Marketing", "Intelligence", "Settings"];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {GROUP_ORDER.map((group) => (
        <div key={group}>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">{group}</p>
          <div className="mt-1.5 space-y-0.5">
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center rounded-df-md border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-teal bg-teal/10 text-navy"
                      : "border-transparent text-muted hover:border-border hover:bg-canvas hover:text-navy"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer on route change — covers browser back/forward,
  // which doesn't go through NavList's own onNavigate onClick handler.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing UI state to the router's pathname, not a value derivable during render
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile top bar — the only chrome visible below md; the sidebar below is desktop-only. */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-df-md text-navy"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-navy">DeployFleet Admin</span>
        <UserButton />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-navy">DeployFleet Admin</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-df-md text-navy"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="md:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="border-b border-border px-4 py-4">
            <span className="text-sm font-semibold text-navy">DeployFleet Admin</span>
          </div>
          <NavList pathname={pathname} />
          <div className="border-t border-border px-4 py-3">
            <UserButton showName />
          </div>
        </aside>

        {/* Main content — each page handles its own "Firebase Admin not
            configured" state inline (with feature-specific guidance), so
            no redundant top-level banner here. */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
