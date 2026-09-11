export type Role = "admin" | "employer";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "idle";

export type EvalStatus =
  | "not_connected"
  | "connected"
  | "ingesting"
  | "evaluating"
  | "indexed"
  | "failed";

export type CriterionId =
  | "readability"
  | "documentation"
  | "modularity"
  | "error_handling"
  | "security"
  | "test_coverage"
  | "performance"
  | "maintainability"
  | "standards"
  | "innovation";

export type SessionUser = {
  id: string;
  githubLogin: string;
  name: string;
  initials: string;
  role: Role;
};

export type CriterionDef = {
  id: CriterionId;
  label: string;
  defaultWeight: number;
  signals: string;
};

export type EvidenceItem = {
  id: string;
  severity: "high" | "medium" | "low" | "info";
  path: string;
  startLine: number;
  endLine: number;
  message: string;
  suggestion: string;
};

export type CriterionScore = {
  criterion: CriterionId;
  score: number;
  confidence: number;
  summary: string;
  findings: EvidenceItem[];
};

export type Developer = {
  id: string;
  githubLogin: string;
  displayName: string;
  initials: string;
  title: string;
  commitCount: number;
  linesAdded: number;
  lastCommitAt: string;
  repoIds: string[];
  scores: Record<CriterionId, number>;
  overall: number;
};

export type Repository = {
  id: string;
  githubId: number;
  org: string;
  name: string;
  fullName: string;
  description: string;
  language: string;
  defaultBranch: string;
  headSha: string;
  lastCommitAt: string;
  connected: boolean;
  visibleToEmployers: boolean;
  status: EvalStatus;
  overall: number | null;
  lastEvaluatedAt: string | null;
  fileCount: number;
  contributorIds: string[];
  scores: Record<CriterionId, number> | null;
  evidence: CriterionScore[];
};

export type QaCitation = {
  n: number;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  repo: string;
};

export type QaMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: QaCitation[];
};

export type Conversation = {
  id: string;
  title: string;
  scope: string;
  updatedAt: string;
  messages: QaMessage[];
};

export type TraceSpan = {
  id: string;
  parentId: string | null;
  name: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  status: "ok" | "error";
  startedOffsetMs: number;
};

export type TraceRun = {
  id: string;
  kind: "evaluate" | "ask" | "recommend";
  label: string;
  createdAt: string;
  durationMs: number;
  spans: TraceSpan[];
};
