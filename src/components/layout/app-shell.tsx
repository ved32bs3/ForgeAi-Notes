import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  GitCompare,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Radar,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/repos", label: "Repos", icon: LayoutGrid },
  { to: "/evaluation", label: "Evaluation", icon: Radar },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/ask", label: "Ask", icon: MessageSquare },
  { to: "/recommend", label: "Recommend", icon: Users },
] as const;

const ADMIN_NAV = [
  { to: "/traces", label: "Traces", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAppStore((s) => s.user)!;
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const logout = useAppStore((s) => s.logout);
  const search = useAppStore((s) => s.search);
  const setSearch = useAppStore((s) => s.setSearch);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const items = user.role === "admin" ? [...NAV, ...ADMIN_NAV] : [...NAV];

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void navigate({ to: "/repos" });
    setOpen(false);
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex size-8 items-center justify-center rounded-sm bg-accent text-accent-fg font-semibold">
          C
        </span>
        <div>
          <div className="text-sm font-semibold tracking-tight">Codeval</div>
          <div className="text-[11px] text-subtle">acme org</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-10 items-center gap-2 rounded-sm px-3 text-sm transition-colors duration-150",
                active
                  ? "bg-bg-subtle text-fg"
                  : "text-muted hover:bg-bg-subtle hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-bg-subtle text-xs font-medium">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{user.name}</div>
            <div className="truncate text-[11px] text-subtle">@{user.githubLogin}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              logout();
              void navigate({ to: "/" });
            }}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-border bg-bg-elevated lg:block">
        {sidebar}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-bg/70"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-64 bg-bg-elevated shadow-lg">
            <button
              className="absolute right-3 top-3 size-10 text-muted"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-3 backdrop-blur-sm sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </Button>
          <form onSubmit={onSearch} className="relative min-w-0 flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repos, developers, files"
              className="h-9 pl-3"
            />
          </form>
          <Badge tone={user.role}>{user.role}</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>
        <main className="px-3 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
