import { createFileRoute, Link } from "@tanstack/react-router";
import { GitBranch, Plug, PlugZap } from "lucide-react";
import { useEffect } from "react";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore, visibleRepos } from "@/lib/store";
import { formatRelative, scoreTone } from "@/lib/utils";

export const Route = createFileRoute("/_dash/repos")({ component: ReposPage });

const statusLabel: Record<string, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  ingesting: "Ingesting",
  evaluating: "Evaluating",
  indexed: "Indexed",
  failed: "Failed",
};

function ReposPage() {
  const user = useAppStore((s) => s.user)!;
  const repos = useAppStore((s) => s.repos);
  const search = useAppStore((s) => s.search);
  const connectRepo = useAppStore((s) => s.connectRepo);
  const disconnectRepo = useAppStore((s) => s.disconnectRepo);
  const triggerEvaluate = useAppStore((s) => s.triggerEvaluate);
  const list = visibleRepos(user, repos).filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.fullName.toLowerCase().includes(q) ||
      r.language.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const ticking = repos.filter((r) => r.status === "ingesting" || r.status === "evaluating");
    if (!ticking.length) return;
    const t = setTimeout(() => {
      useAppStore.setState({
        repos: useAppStore.getState().repos.map((r) =>
          r.status === "ingesting" || r.status === "evaluating"
            ? {
                ...r,
                status: "indexed",
                connected: true,
                lastEvaluatedAt: new Date().toISOString(),
                overall: r.overall ?? 74,
              }
            : r,
        ),
      });
    }, 1600);
    return () => clearTimeout(t);
  }, [repos]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>
          <p className="mt-1 text-sm text-muted">
            {user.role === "admin"
              ? "Org repos you can connect, ingest, and score."
              : "Connected repos visible to employers."}
          </p>
        </div>
        <p className="text-xs text-subtle tabular">{list.length} shown</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((repo) => (
          <Card key={repo.id} className="flex flex-col gap-4 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to="/evaluation"
                  search={{ repo: repo.id }}
                  className="block truncate text-sm font-medium hover:text-accent"
                >
                  {repo.fullName}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{repo.description}</p>
              </div>
              <ScoreRing score={repo.overall} size={56} stroke={5} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-subtle">
              <span className="rounded-full border border-border px-2 py-0.5">{repo.language}</span>
              <span className="inline-flex items-center gap-1">
                <GitBranch className="size-3" />
                {repo.defaultBranch}
              </span>
              <span className="font-mono">{repo.headSha}</span>
              <span>{formatRelative(repo.lastCommitAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Badge
                tone={
                  repo.status === "indexed"
                    ? scoreTone(repo.overall)
                    : repo.status === "failed"
                      ? "low"
                      : "muted"
                }
              >
                {statusLabel[repo.status]}
              </Badge>
              <div className="flex gap-1">
                {repo.connected && repo.overall != null ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/evaluation" search={{ repo: repo.id }}>
                      Scores
                    </Link>
                  </Button>
                ) : null}
                {user.role === "admin" && !repo.connected ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      connectRepo(repo.id);
                      triggerEvaluate(repo.id);
                    }}
                  >
                    <PlugZap className="size-3.5" />
                    Connect
                  </Button>
                ) : null}
                {user.role === "admin" && repo.connected ? (
                  <Button variant="ghost" size="sm" onClick={() => disconnectRepo(repo.id)}>
                    <Plug className="size-3.5" />
                    Disconnect
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted">No repositories match that search.</p>
      ) : null}
    </div>
  );
}
