import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  User,
  Users,
  Package,
  Repeat,
  Gift,
  Trophy,
  Gem,
  Shirt,
  PersonStanding,
  Settings,
  Search,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RawbuxIcon } from "@/components/RawbuxIcon";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/avatar", label: "Avatar", icon: PersonStanding },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/trade", label: "Trade", icon: Repeat },
  { to: "/promocodes", label: "Promocodes", icon: Gift },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/values", label: "Values", icon: Gem },
  { to: "/create", label: "Create", icon: Shirt },
] as const;

function BanScreen({
  reason,
  until,
}: {
  reason: string | null;
  until: string | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="rb-card w-full max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive">Your account has been banned</h1>
        <p className="mt-4 text-sm text-muted-foreground">Reason</p>
        <p className="text-base font-medium">{reason || "No reason provided."}</p>
        <p className="mt-4 text-sm text-muted-foreground">Duration</p>
        <p className="text-base font-medium">
          {until
            ? `Your ban ends on ${new Date(until).toLocaleString()}`
            : "This ban is permanent."}
        </p>
        <button
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/auth";
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

function SearchBar() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", `%${q.trim()}%`)
        .eq("is_banned", false)
        .limit(8);
      setResults(data ?? []);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={box} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users"
        className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm outline-none focus:border-primary"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-9 z-50 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {results.map((r) => (
            <Link
              key={r.id}
              to="/users/$username"
              params={{ username: r.username }}
              onClick={() => {
                setOpen(false);
                setQ("");
              }}
              className="block px-3 py-2 text-sm hover:bg-accent"
            >
              {r.username}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-nav-foreground hover:bg-accent md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 animate-in fade-in"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px] animate-in slide-in-from-left border-r border-border bg-card shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-lg font-extrabold tracking-tight">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col py-2">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 border-l-4 px-4 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary bg-sidebar-accent text-foreground"
                        : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.is_banned && (!profile.ban_until || new Date(profile.ban_until) > new Date())) {
    return <BanScreen reason={profile.ban_reason} until={profile.ban_until} />;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-nav text-nav-foreground">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 md:gap-6">
          <MobileNav pathname={pathname} />
          <Link to="/" className="flex shrink-0 items-center">
  <img src="/logo.png" alt="RECS" className="h-8 w-auto" />
</Link>
          <Link
            to="/catalog"
            className="hidden text-sm font-semibold text-muted-foreground hover:text-foreground md:block"
          >
            Catalog
          </Link>
          <div className="flex-1">
            <SearchBar />
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              <RawbuxIcon className="h-4 w-4" />
              {(profile?.rawbux ?? 0).toLocaleString("en-US")}
            </span>
            <Link
              to="/settings"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px] gap-4 px-4 py-4">
        <aside className="hidden w-44 shrink-0 md:block">
          <nav className="rb-card sticky top-[4.5rem] overflow-hidden">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2.5 border-l-4 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-primary bg-sidebar-accent text-foreground"
                      : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
