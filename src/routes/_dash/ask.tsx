import { createFileRoute } from "@tanstack/react-router";
import { Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CONVERSATIONS } from "@/lib/mock-data";
import { useAppStore, visibleRepos } from "@/lib/store";
import type { QaCitation } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dash/ask")({ component: AskPage });

function answerFor(question: string, scope: string): { content: string; citations: QaCitation[] } {
  const q = question.toLowerCase();
  if (q.includes("auth") || q.includes("session")) {
    return CONVERSATIONS[0].messages[1] as { content: string; citations: QaCitation[] };
  }
  if (q.includes("webhook") || q.includes("retry")) {
    return CONVERSATIONS[1].messages[1] as { content: string; citations: QaCitation[] };
  }
  return {
    content: `Nothing in the ingested ${scope} snapshot answers that directly. The index only contains connected source and docs — I will not fill gaps from general knowledge.`,
    citations: [],
  };
}

function AskPage() {
  const user = useAppStore((s) => s.user)!;
  const repos = visibleRepos(user, useAppStore((s) => s.repos));
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeConversationId);
  const setActive = useAppStore((s) => s.setActiveConversation);
  const start = useAppStore((s) => s.startConversation);
  const append = useAppStore((s) => s.appendMessage);
  const [scope, setScope] = useState(repos[0]?.fullName ?? "all ingested");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [cite, setCite] = useState<QaCitation | null>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0],
    [conversations, activeId],
  );

  async function send() {
    const q = draft.trim();
    if (!q || busy) return;
    let id = active?.id;
    if (!id) {
      id = start(q, scope);
    }
    append(id, "user", q);
    setDraft("");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    const a = answerFor(q, scope);
    append(id, "assistant", a.content, a.citations);
    setBusy(false);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-sm font-medium">Conversations</h1>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => start("New question", scope)}
            aria-label="New conversation"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActive(c.id)}
                className={cn(
                  "w-full rounded-sm px-3 py-2 text-left text-sm",
                  c.id === active?.id ? "bg-bg-subtle" : "text-muted hover:bg-bg-subtle",
                )}
              >
                <div className="truncate">{c.title}</div>
                <div className="truncate text-[11px] text-subtle">{c.scope}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-subtle">Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-9 rounded-sm border border-border bg-bg-elevated px-2 text-sm"
          >
            <option value="all ingested">All ingested</option>
            {repos.map((r) => (
              <option key={r.id} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>
        </div>
        <Card className="flex min-h-[420px] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {active?.messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
                <div
                  className={cn(
                    "inline-block max-w-[92%] rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-accent text-accent-fg"
                      : "bg-bg-subtle text-fg",
                  )}
                >
                  {m.content}
                </div>
                {m.citations?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.citations.map((c) => (
                      <button
                        key={c.n}
                        onClick={() => setCite(c)}
                        className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:text-fg"
                      >
                        [{c.n}] {c.path}:{c.startLine}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <p className="text-xs text-subtle shimmer rounded-sm px-2 py-1">Retrieving evidence…</p>
            ) : null}
          </div>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about ingested code"
            />
            <Button type="submit" size="icon" disabled={busy} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </Card>
        {cite ? (
          <Card className="mt-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-subtle">
                  {cite.repo} · {cite.path}:{cite.startLine}–{cite.endLine}
                </p>
                <pre className="mt-2 overflow-x-auto font-mono text-xs leading-relaxed text-muted">
                  {cite.snippet}
                </pre>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCite(null)}>
                Close
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
