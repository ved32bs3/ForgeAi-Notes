import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ADMIN_USER,
  CONVERSATIONS,
  CRITERIA,
  DEVELOPERS,
  EMPLOYER_USER,
  REPOS,
} from "./mock-data";
import type {
  Conversation,
  CriterionId,
  QaCitation,
  Repository,
  Role,
  SessionUser,
} from "./types";

type Theme = "dark" | "light";

type Weights = Record<CriterionId, number>;

function defaultWeights(): Weights {
  return Object.fromEntries(CRITERIA.map((c) => [c.id, c.defaultWeight])) as Weights;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

type AppState = {
  hydrated: boolean;
  user: SessionUser | null;
  theme: Theme;
  repos: Repository[];
  conversations: Conversation[];
  activeConversationId: string;
  weights: Weights;
  search: string;
  setHydrated: () => void;
  login: (role: Role) => void;
  logout: () => void;
  setTheme: (theme: Theme) => void;
  setSearch: (q: string) => void;
  connectRepo: (id: string) => void;
  disconnectRepo: (id: string) => void;
  toggleVisibility: (id: string) => void;
  triggerEvaluate: (id: string) => void;
  setWeights: (w: Weights) => void;
  resetWeights: () => void;
  setActiveConversation: (id: string) => void;
  startConversation: (title: string, scope: string) => string;
  appendMessage: (
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    citations?: QaCitation[],
  ) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      user: null,
      theme: "dark",
      repos: REPOS,
      conversations: CONVERSATIONS,
      activeConversationId: CONVERSATIONS[0]?.id ?? "",
      weights: defaultWeights(),
      search: "",
      setHydrated: () => {
        applyTheme(get().theme);
        set({ hydrated: true });
      },
      login: (role) =>
        set({ user: role === "admin" ? ADMIN_USER : EMPLOYER_USER }),
      logout: () => set({ user: null }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setSearch: (search) => set({ search }),
      connectRepo: (id) =>
        set({
          repos: get().repos.map((r) =>
            r.id === id
              ? { ...r, connected: true, status: "ingesting", visibleToEmployers: true }
              : r,
          ),
        }),
      disconnectRepo: (id) =>
        set({
          repos: get().repos.map((r) =>
            r.id === id
              ? {
                  ...r,
                  connected: false,
                  status: "not_connected",
                  overall: null,
                  scores: null,
                  lastEvaluatedAt: null,
                }
              : r,
          ),
        }),
      toggleVisibility: (id) =>
        set({
          repos: get().repos.map((r) =>
            r.id === id ? { ...r, visibleToEmployers: !r.visibleToEmployers } : r,
          ),
        }),
      triggerEvaluate: (id) =>
        set({
          repos: get().repos.map((r) =>
            r.id === id ? { ...r, status: "evaluating" } : r,
          ),
        }),
      setWeights: (weights) => set({ weights }),
      resetWeights: () => set({ weights: defaultWeights() }),
      setActiveConversation: (id) => set({ activeConversationId: id }),
      startConversation: (title, scope) => {
        const id = `c-${Date.now()}`;
        const next: Conversation = {
          id,
          title,
          scope,
          updatedAt: new Date().toISOString(),
          messages: [],
        };
        set({
          conversations: [next, ...get().conversations],
          activeConversationId: id,
        });
        return id;
      },
      appendMessage: (conversationId, role, content, citations) =>
        set({
          conversations: get().conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: new Date().toISOString(),
                  title:
                    role === "user" && c.messages.length === 0
                      ? content.slice(0, 48)
                      : c.title,
                  messages: [
                    ...c.messages,
                    {
                      id: `m-${Date.now()}-${role}`,
                      role,
                      content,
                      citations,
                    },
                  ],
                }
              : c,
          ),
        }),
    }),
    {
      name: "codeval-session",
      partialize: (s) => ({
        user: s.user,
        theme: s.theme,
        weights: s.weights,
        repos: s.repos,
        conversations: s.conversations,
        activeConversationId: s.activeConversationId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export function visibleRepos(user: SessionUser | null, repos: Repository[]) {
  if (!user) return [];
  if (user.role === "admin") return repos;
  return repos.filter((r) => r.connected && r.visibleToEmployers);
}

export const developers = DEVELOPERS;
