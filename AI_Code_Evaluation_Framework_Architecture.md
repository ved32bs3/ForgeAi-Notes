# AI Code Evaluation Framework
## System Architecture — Complete Specification

### Product

A GitHub-authenticated employer/admin platform that ingests selected repositories, runs a 10-agent code evaluation, stores scores and embeddings, answers evidence-backed questions over the code, and recommends roles and hackathon teams.

### Identity model

Both Admin and Employer sign in with GitHub OAuth. The app is scoped to one GitHub organization (the "source org"). After login, the dashboard lists that org's repos the user is allowed to see. Every action (evaluate, ask, recommend) is bound to those repos.

GitHub is the only identity provider. There is no email/password. Session is an OAuth session mapped to an internal `users` row keyed by `github_user_id`.

---

## 1. System Context

### Actors

| Actor    | Identity | Responsibilities |
|----------|----------|-------------------|
| Admin    | GitHub identity | Connects the org, picks repos to ingest, triggers evaluations, tunes weights, inspects traces. |
| Employer | GitHub identity | Browses ingested repos, views scores, compares developers, asks RAG questions, gets recommendations. |

### Platform

- Employer / Admin Dashboard (React / Next.js + Tailwind + Charts)
- FastAPI API
- Core: Ingestion, Evaluation, RAG, Recommend, Orchestrator

### External

- GitHub — OAuth + REST + Git clone
- LLM Provider — OpenAI / Anthropic / Groq / xAI
- Embedding Model
- PostgreSQL + pgvector
- PRISM — live tracing of all LLM / agent calls

### Context flow

```
Admin / Employer --> Dashboard --> API --> Core
Core --> GitHub
Core --> LLM
Core --> Embeddings
Core --> Postgres + pgvector
Core --> PRISM
```

### 1.1 What each actor can do

**Admin**

- *How they get in:* GitHub OAuth. Mapped to `role=admin` if their GitHub user is in the configured admin allow-list (org owners, or a `CODEVAL_ADMINS` list).
- *What they do:* Connect the org, pick which repos to ingest, trigger / re-run evaluations, tune criterion weights, inspect PRISM traces, manage which employers can see which repos.

**Employer**

- *How they get in:* Same GitHub OAuth. Default `role=employer`.
- *What they do:* Browse ingested repos, view overall + per-criterion scores, compare developers, ask natural-language questions (RAG), get role / hackathon-team recommendations.

---

## 2. Logical Architecture (5 Layers)

### Layer 1 — Presentation

Employer / Admin Dashboard

- View evaluation scores (overall + category breakdown)
- Compare developers
- Ask natural language questions (RAG Q&A)
- See recommendations (roles / hackathon teams)
- Repository management

Tech: React / Next.js + Tailwind + Charts (Recharts)

### Layer 2 — API (FastAPI)

| Route        | Purpose |
|--------------|---------|
| `/auth`      | Authenticate with GitHub OAuth |
| `/repos`     | Authenticate and connect GitHub repos |
| `/evaluate`  | Trigger full evaluation of a repo |
| `/scores`    | Get scores of a developer / repo |
| `/ask`       | RAG Q&A endpoint |
| `/recommend` | Get role / team recommendations |
| `/traces`    | PRISM related (admin) |
| `/jobs`      | Poll long-running ingest / evaluate / embed jobs |
| `/me`        | Current user + role |
| `/developers`| Authors inferred from git history of connected repos |

### Layer 3 — Core application (backend logic)

- A. Ingestion module
- B. Evaluation engine (10 LangChain scoring agents)
- C. RAG module
- D. Recommendation module
- E. Orchestration (LangChain + PRISM on every model call)

### Layer 4 — Data (PostgreSQL + pgvector)

- users / developers
- repositories
- evaluations (scores for each criterion)
- document_chunks (code + internal docs)
- embeddings (vector column)
- conversations / qa_history
- jobs
- recommendations
- llm_traces (PRISM fallback)

### Layer 5 — External services

- GitHub API
- LLM Provider
- Embedding Model
- PRISM (prismtrace-sdk)

---

## 3. Container View (What Actually Runs)

**Web app**
React / Next.js + Tailwind + Recharts. Auth UI, dashboard, score viz, compare, Q&A, repo list, recs. Talks to FastAPI over HTTPS. GitHub only via the backend.

**API process**
FastAPI + Uvicorn. Auth, authorization, request validation, job enqueue, SSE/polling. Talks to Postgres, job queue, GitHub, LLM, PRISM.

**Worker process**
Same codebase, Celery / ARQ / RQ. Clone, extract, score, chunk, embed — never on the request thread. Talks to GitHub git, filesystem scratch, Postgres, LLM, embeddings, PRISM.

**PostgreSQL + pgvector**
Users, repos, scores, chunks, vectors, Q&A, jobs. Used by API + worker.

**Object / scratch store**
Cloned repo snapshots (ephemeral; deleted after ingest unless "keep snapshot" is on).

**PRISM collector**
Every LLM / agent span: prompt, tokens, latency, errors, parent run id.

> **Rule:** Long work (clone, 10-agent eval, embedding) is ALWAYS async. The HTTP call returns a `job_id`. The dashboard polls `/jobs/{id}` or listens on SSE.

---

## 4. Identity, Auth, and Authorization

### 4.1 Login sequence (employer and admin — same path)

1. User clicks "Continue with GitHub" on the dashboard.
2. Dashboard calls `GET /auth/github`.
3. API redirects to GitHub OAuth (scopes: `read:user`, `user:email`, `repo`).
4. User approves.
5. GitHub redirects to the API callback with a code.
6. API exchanges the code for `access_token` + `github_user`.
7. API upserts `users` (github_user_id, login, avatar, token encrypted at rest).
8. API resolves role:
   ```
   if github_login in ADMIN_ALLOWLIST
      or github_user is org owner:
        role = admin
   else:
        role = employer
   ```
9. API sets the session cookie.
10. Dashboard calls `GET /me` and `GET /repos`.
11. API lists org repos the token can see, upserts `repositories`, filters by org + visibility policy.
12. Dashboard renders repo cards.

### 4.2 OAuth scopes (minimum)

| Scope | Purpose |
|-------|---------|
| `read:user`, `user:email` | identity |
| `repo` | list and clone the configured org's repositories (or `read:org` + public repo if the org is public-only) |

### 4.3 Token handling

- GitHub access token is stored encrypted at rest (`users.github_token_enc`).
- Never sent to the browser.
- Used only by Ingestion to list/clone.
- Refresh / re-auth when GitHub returns 401.

### 4.4 Authorization matrix

| Action | Admin | Employer |
|--------|-------|----------|
| List org repos | all | repos marked `visible_to_employers` |
| Connect / disconnect a repo | yes | no |
| Trigger `/evaluate` | yes | no by default |
| Read `/scores` | all | visible repos only |
| `/ask` RAG | all visible | visible repos only |
| `/recommend` | all | visible developers / repos |
| `/traces` | yes | no |
| Change scoring weights | yes | no |

Every API handler loads `current_user` from the session, then scopes SQL by role + `repository_id IN allowed_ids`.

---

## 5. Dashboard Information Architecture

After login the employer/admin lands on a repo-centric dashboard.

**Primary surfaces**

1. **Repos** — Cards/table of the configured GitHub org's repositories (name, default branch, last commit, last evaluation status, overall score).
2. **Evaluation** — Overall score + 10-criterion radar/bar, evidence snippets, run history.
3. **Compare** — Pick 2–N developers or repos, overlay scores.
4. **Ask** — Natural language over one repo, one developer, or the whole ingested corpus. Answers cite file + line ranges.
5. **Recommend** — Role fit (backend, security, tech lead, ...) and hackathon team combinations.
6. **Traces (admin)** — PRISM waterfall for a given evaluation / Q&A run.

Frontend talks ONLY to the FastAPI layer. No GitHub token, no LLM key in the browser.

---

## 6. API Layer — Contracts

Base path: `/api/v1`
All routes except OAuth callbacks require a session.

| Method | Path | Who | What |
|--------|------|-----|------|
| GET | `/auth/github` | public | Start OAuth |
| GET | `/auth/github/callback` | public | Finish OAuth, set session |
| POST | `/auth/logout` | any | Destroy session |
| GET | `/me` | any | `{ id, github_login, role, avatar }` |
| GET | `/repos` | any | List allowed repos (live GitHub merge + DB state) |
| POST | `/repos/{id}/connect` | admin | Mark repo connected; enqueue ingest |
| DELETE | `/repos/{id}/connect` | admin | Disconnect; optionally purge |
| POST | `/evaluate` | admin | Body `{ repository_id, ref? }` → `{ job_id }` |
| GET | `/jobs/{job_id}` | owner | `{ status, progress, stage, error }` |
| GET | `/scores` | any scoped | Latest evaluation + breakdown `?repository_id=&developer_id=` |
| GET | `/scores/history` | any | Previous runs for trend |
| POST | `/ask` | any | `{ question, repository_id?, developer_id? }` → answer + citations |
| POST | `/recommend` | any | `{ goal: "roles" \| "hackathon_team", constraints }` |
| GET | `/traces?run_id=` | admin | PRISM spans for a run |
| GET | `/developers` | any | Distinct authors from git history |

**Job envelope (evaluate / ingest / embed)**

```json
{
  "job_id": "uuid",
  "type": "evaluate",
  "status": "queued | running | succeeded | failed",
  "stage": "clone | extract | score:security | embed | finalize",
  "progress": 0.0,
  "result_ref": { "evaluation_id": "uuid" },
  "error": null
}
```

---

## 7. Core Modules — Detailed Behavior

### A. Ingestion Module

**Purpose:** Turn a GitHub repo the admin connected into a structured, queryable snapshot.

**Pipeline**

```
Admin connects repo
  → Enqueue ingest job
  → Clone / fetch at SHA
  → Walk tree, apply include/exclude
  → Parse structure (langs, dirs, tests, CI, docs)
  → Extract authors from git log
  → Persist snapshot metadata
  → Hand off to Evaluation + RAG
```

**Steps**

1. **Authenticate** — Decrypt the connecting admin's GitHub token (or a dedicated GitHub App installation token — preferred in production so it is not tied to one human).
2. **Resolve ref** — Default branch, or explicit sha / tag. Store `head_sha` so scores are reproducible.
3. **Clone** — Shallow clone (`--depth 1`) into ephemeral workspace `scratch/{job_id}`.
4. **File filter**
   - Include: source + docs — `*.py, *.ts, *.tsx, *.go, *.rs, *.java, *.md, *.sql, Docker*, CI configs`
   - Exclude: `node_modules, dist, build, vendor, .git, lockfiles, binaries, generated protobufs`
   - Hard cap (example): 8 MB per file, 4000 files, 40 MB total text. Oversized repos are sampled by language + directory importance.
5. **Structure graph** — Directories, entrypoints, test trees, CI, README, license.
6. **Developer identity** — `git log --format` → authors. Map `author.email` / GitHub login into `developers`. A "developer" in this product is a git author who contributed to a connected repo, not necessarily a logged-in user.
7. **Persist**
   - `repositories` (github_id, full_name, default_branch, head_sha, visibility, connected_at)
   - `repository_files` (path, language, size, sha)
8. **Cleanup** — Scratch dir after Evaluation + RAG finish (or keep a tarball if `keep_snapshot=true`).

**GitHub App vs user token**

- *User OAuth token:* Tied to the admin who clicked connect. If that admin leaves, ingest breaks. Permissions are broad (`repo`).
- *GitHub App (recommended later):* Tied to the org installation. Survives personnel change. Least-privilege: contents read, metadata.

v1 can use the admin OAuth token. Architecture leaves a `github_installations` table so you can switch without rewriting ingest.

### B. Evaluation Engine — 10 Scoring Agents (LangChain)

**Purpose:** Produce a reproducible, evidence-backed scorecard for a repo (and optionally per-developer, by attributing files/hunks to authors).

**Orchestration**

```
Repo snapshot + file index
  → Orchestrator fans out 10 agents in parallel
       Readability
       Documentation
       Modularity
       Error Handling
       Security
       Test Coverage
       Performance
       Maintainability
       Standards Compliance
       Innovation
  → Weighted aggregator
  → Save evaluations + criterion_scores + evidence
```

Agents run in parallel (bounded semaphore, e.g. 5 concurrent LLM calls).

Each agent is a LangChain chain with:

- Deterministic tools first (AST, linters, regex, coverage files, semgrep, complexity) so the LLM is a judge over facts, not a hallucinated auditor.
- Sampled file pack — ranked by centrality (README, src entry, tests, recently changed). Never dump the whole repo into one prompt.
- Structured output (Pydantic / Zod schema):

```json
{
  "criterion": "security",
  "score": 78,
  "confidence": 0.71,
  "summary": "...",
  "findings": [
    {
      "severity": "high",
      "path": "api/auth.py",
      "start_line": 41,
      "end_line": 58,
      "message": "SQL interpolated from request query",
      "suggestion": "Use parameterized queries"
    }
  ]
}
```

**The 10 agents — what they actually look at**

| # | Criterion | Signals | Weight |
|---|-----------|---------|--------|
| 1 | Readability | naming, function length, nesting depth, comment density, consistent style | 0.10 |
| 2 | Documentation | README quality, API docs, docstrings/JSDoc, architecture md | 0.08 |
| 3 | Modularity | cyclic imports, file size, cohesion, layering (ui/api/domain), duplication | 0.12 |
| 4 | Error Handling | bare excepts, swallowed errors, missing timeouts, unvalidated HTTP | 0.10 |
| 5 | Security | secrets in repo, injection, authz gaps, dangerous APIs, dependency CVEs | 0.15 |
| 6 | Test Coverage | presence of tests, assertions vs mocks, CI test job, coverage.xml if present | 0.12 |
| 7 | Performance | N+1 patterns, unbounded loops, missing pagination, sync I/O in hot paths | 0.08 |
| 8 | Maintainability | cyclomatic complexity, TODOs, dead code, churn hotspots, typing | 0.10 |
| 9 | Standards Compliance | formatter/linter config, CI, conventional commits, license, .editorconfig | 0.08 |
| 10 | Innovation | non-trivial architecture, novel algorithms, strong DX, unusual but sound patterns | 0.07 |

Weights sum to 1.00. Stored in `scoring_profiles` so an admin can create "security-heavy" vs "hackathon" profiles.

**Final score**

```
overall = SUM ( w_c * score_c )   for all criteria c
```

Each `score_c` is 0–100. Overall is 0–100, stored as `numeric(5,2)`.

**Per-developer scores (optional second pass)**

If `evaluate_developers=true`:

- Blame/ownership: files with >= N lines by author A.
- Re-run a thin agent pack on that file subset (or attribute existing findings to owners).
- Write `evaluations.subject_type = 'developer'`.

**Idempotency**

`(repository_id, head_sha, profile_id)` is unique for `subject_type='repository'`. Re-evaluating the same SHA is a no-op unless `force=true`.

### C. RAG Module

**Purpose:** Answer employer questions with citations into the ingested code and internal docs, not generic LLM knowledge.

**Ask flow**

1. Employer POSTs `/ask` with question + optional repo/developer scope.
2. Retriever embeds the question.
3. pgvector similarity search, filtered by `repo_ids` / language.
4. Top-k chunks returned; rerank / MMR diversity.
5. LLM receives system prompt + question + packed evidence (PRISM-traced).
6. Answer + citation ids stored in `qa_history`.
7. Client receives answer, `citations[{path, lines, snippet}]`, `run_id`.

**Indexing pipeline** (runs after ingest, can overlap scoring)

1. Split files into chunks (~800 tokens, 120-token overlap).
2. Keep structure metadata: `repo_id, path, language, start_line, end_line, symbol_name, chunk_type (code | doc | config | test)`.
3. Embed with the configured embedding model.
4. INSERT into `document_chunks` + `embedding vector(dim)`.
5. On re-ingest of a new SHA: delete old chunks for that repo, rewrite (or version with `snapshot_sha`).

**Retrieval**

- Filter: `repository_id IN scope` (always). Optional `chunk_type`, `language`, `developer_id` (via ownership table).
- Search: cosine / inner-product on pgvector HNSW index.
- k = 12, then rerank to 6–8 for the prompt.
- Prompt contract: Only answer from evidence. If missing, say so. Every claim tagged `[n]` matching a citation.

**Conversations**

`conversations` + `qa_messages` so follow-ups ("what about the auth module?") reuse the last repo scope and prior citations.

### D. Recommendation Module

**Purpose:** Turn scorecards into actionable staffing.

**Two modes**

**1. Role fit (`goal = roles`)**

Input: one developer (or one repo as proxy for a solo author).

Map criteria → roles with a role matrix (data, not hardcoded in prompts):

| Role | High-weight criteria |
|------|----------------------|
| Backend engineer | Modularity, Error Handling, Performance, Security |
| Frontend engineer | Readability, Standards, Documentation, Innovation |
| Security engineer | Security, Error Handling, Standards |
| Tech lead | Maintainability, Documentation, Modularity, Standards |
| QA / SET | Test Coverage, Error Handling, Standards |

Compute:

```
fit[role] = weighted average of that developer's criterion scores
            using the role matrix.
```

LLM only writes the rationale from the numeric fits + top evidence. Numbers stay deterministic.

**2. Hackathon team (`goal = hackathon_team`)**

Input: pool of developers, team size (default 4), constraints (must-include, avoid pairing, skill coverage).

Logic:

- Maximize coverage across the 10 criteria (a team of 4 "innovation-only" people is a bad team).
- Complementarity: pick people whose strongest criteria cover different axes (security + tests + product/innovation + architecture).
- Search: greedy + local swap (deterministic), then LLM names the team and explains why using the score gaps.

Output stored in `recommendations` so the dashboard can show history.

### E. Orchestration + PRISM

The Orchestrator is the only module that knows the pipeline DAG:

```
connect repo
  → ingest (clone, extract, authors)
      → parallel:
          → evaluate (10 agents → aggregate → save scores)
          → rag_index (chunk → embed → pgvector)
      → job = succeeded
```

Every model call (scoring agent, RAG answer, recommendation rationale) is wrapped with PRISM:

- `run_id` = job id or ask id
- `span name` = `agent.security` / `rag.generate` / `recommend.roles`
- `parent` = orchestrator span
- `attributes` = repository_id, head_sha, model, token_in/out, latency_ms, error

Admin UI `/traces` reads PRISM's API/SDK, not a second logging system.

If PRISM is down, evaluation still completes. Traces are best-effort with a local fallback span table `llm_traces`.

---

## 8. End-to-End Runtime Flows

### Flow 1 — First-time admin: connect org and evaluate

```
Admin GitHub login (role=admin)
  → Open Repos
  → GET /repos  (API lists org repos from GitHub, upserts DB)
  → Connect "acme/payments-api" + Evaluate
  → POST /repos/{id}/connect
  → POST /evaluate { repository_id }  → job_id
  → Worker shallow-clones SHA
  → Worker persists files + developers
  → PARALLEL
       Scoring: 10 agents (PRISM-traced) → evaluations + evidence
       Indexing: embeddings → document_chunks + vectors
  → job succeeded
  → GET /scores → overall + radar of 10
```

### Flow 2 — Employer: inspect, compare, ask, recommend

```
GitHub login → role=employer
  → Dashboard: visible connected repos
       → Open a repo → scores + evidence
       → Compare 2 developers / repos
       → Ask: "Where is auth enforced?"
            → RAG retrieves chunks → cited answer
       → Recommend hackathon team of 4
            → Deterministic coverage search + LLM rationale

Nothing in this flow clones GitHub again.
Employers only read already ingested data.
```

### Flow 3 — Re-evaluation after new commits

```
Admin (or a webhook push on the default branch)
  → if head_sha changed
  → new ingest job
  → new evaluation row (history preserved)
  → chunk table replaced for that repo
  → old Q&A still in history
  → new asks use the new index
```

### High-level data flow (summary)

```
Admin connects a GitHub repo
  → System ingests the code
  → Evaluation Engine runs all 10 scoring agents → scores saved in PostgreSQL
  → Code + internal docs are chunked → embedded → stored in pgvector
  → Admin / Employer asks a question
      → RAG retrieves relevant code/docs → generates answer
  → Dashboard shows scores + Q&A results + recommendations
  → Everything that calls an LLM is traced by PRISM
```

---

## 9. Data Layer

### 9.1 Entity relationships

```
users 1──* sessions
users 1──* repositories          (connects)
users 1──* conversations
repositories 1──* evaluations
repositories 1──* document_chunks
repositories 1──* jobs
developers 1──* evaluations
developers *──* repository_contributors
evaluations 1──* criterion_scores
criterion_scores 1──* evidence_items
document_chunks 1──1 embeddings (vector column on the chunk row)
conversations 1──* qa_messages
scoring_profiles 1──* evaluations
jobs 1──* llm_traces
```

### 9.2 Core tables (v1)

**users** — GitHub identities using the product.
`id, github_user_id UNIQUE, github_login, avatar_url, role ('admin' | 'employer'), github_token_enc, created_at`

**repositories** — Org repos the system knows.
`id, github_id UNIQUE, org, name, full_name, default_branch, head_sha, connected, visible_to_employers, connected_by, last_ingested_at, last_evaluated_at`

**developers** — Git authors.
`id, github_login, display_name, email_hash, avatar_url`

**repository_contributors**
`repository_id, developer_id, commit_count, lines_added, last_commit_at`

**scoring_profiles**
`id, name, weights jsonb`
Example: `{"security": 0.15, "modularity": 0.12, ...}`

**evaluations**
`id, repository_id, developer_id NULL, subject_type, head_sha, profile_id, overall_score, status, job_id, created_at`

**criterion_scores**
`id, evaluation_id, criterion, score, confidence, summary`

**evidence_items**
`id, criterion_score_id, severity, path, start_line, end_line, message, suggestion`

**document_chunks**
`id, repository_id, snapshot_sha, path, language, chunk_type, start_line, end_line, symbol_name, content, embedding vector(1536), tsv tsvector`

**jobs**
`id, type, status, stage, progress, payload jsonb, error, created_by, created_at, finished_at`

**conversations / qa_messages**
scope (repository_id, optional developer_id), role, content, citation jsonb, prism_run_id

**recommendations**
`id, goal, payload jsonb, result jsonb, created_by, created_at`

**llm_traces** (PRISM fallback)
`id, run_id, parent_id, name, model, tokens_in, tokens_out, latency_ms, error, created_at`

### 9.3 Indexes

| Table | Index |
|-------|-------|
| document_chunks | HNSW on `embedding` (vector_cosine_ops) |
| evaluations | `(repository_id, created_at DESC)` |
| repositories | `(org, connected)` |
| users | `(github_user_id)` UNIQUE |

---

## 10. External Services

| Service | Used for | Failure policy |
|---------|----------|-----------------|
| GitHub OAuth + API | login, list repos, clone | if list fails, serve last-known DB repos + banner |
| Git clone | snapshot | job failed, retry 3x |
| LLM | 10 judges, RAG generate, rec rationale | per-agent timeout; missing agent → score null + overall on remaining with renormalized weights OR fail the job (config) |
| Embedding model | chunk + query vectors | ingest job retry; `/ask` returns 503 |
| PRISM | traces | swallow errors; write `llm_traces` |
| Optional Semgrep / linters | deterministic security/style facts | skip that tool; agent still runs on samples |

LLM provider is swappable behind an `LLMClient` interface (`complete_structured`, `embed`). Env selects OpenAI / Anthropic / Groq / xAI. One provider per deployment in v1.

---

## 11. Security, Tenancy, and Secrets

- Single-tenant per deployment (one GitHub org). No cross-org data.
- Row-level scoping for employers (`visible_to_employers` + contributor membership if tightened later).
- No LLM keys or GitHub tokens in the frontend.
- Tokens encrypted at rest (AGE / pgsodium / app-level AES-GCM with `TOKEN_ENCRYPTION_KEY`).
- Prompts must not include `.env`, `*.pem`, `id_rsa`. Ingestion redacts secret-looking files BEFORE they reach agents or the vector store.
- RAG answers are not a side channel for private files employers should not see — retrieval filter is the same as dashboard visibility.
- Audit log: `audit_events (actor_id, action, entity, at)` for connect, evaluate, ask.

---

## 12. Deployment Topology

```
Browser
  → Web (Vercel / Node)
  → FastAPI API
       → Job queue → Eval / ingest workers
       → Postgres + pgvector
       → LLM + embeddings
       → PRISM
  Workers also talk to GitHub, Postgres, LLM, PRISM.
```

- API is horizontally scalable (stateless).
- Workers scale on queue depth; clone disk is ephemeral.
- Postgres is the source of truth; pgvector lives in the same instance for v1.
- Scratch clones never go to the web container.

---

## 13. Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React / Next.js + Tailwind |
| Backend API | FastAPI |
| Orchestration | LangChain |
| Database | PostgreSQL + pgvector |
| Vector search | pgvector |
| Tracing | PRISM (prismtrace-sdk) |
| LLM | OpenAI / Anthropic / Groq / xAI |
| GitHub integration | PyGithub / GitHub API |
| Workers | Celery / ARQ / RQ |
| Charts | Recharts |

---

## 14. Module Build Order

Build in this order. Each step is demoable.

| Step | Module | You can show |
|------|--------|---------------|
| 1 | Auth + `/me` + role mapping | GitHub login as employer vs admin |
| 2 | `/repos` list from the configured org | Dashboard of real repos |
| 3 | Connect + ingest (clone, file index, authors) | Repo detail with file tree + contributors |
| 4 | Jobs + `/evaluate` with 1 agent (e.g. Documentation) | A real score + evidence |
| 5 | Remaining 9 agents + weights + overall | Full radar chart |
| 6 | Chunk + embed + `/ask` | Cited Q&A |
| 7 | `/recommend` roles then teams | Recommendation panel |
| 8 | Compare view + history | Employer comparison |
| 9 | PRISM + `/traces` | Admin tracing |
| 10 | Webhook re-eval + scoring profiles | Production loop |

First slice to implement: GitHub OAuth + repo list on the dashboard (steps 1–2).

---

## 15. Invariants (Do Not Violate While Building)

1. **GitHub is identity.** Admin and employer both OAuth. Roles are not a second login.
2. **The dashboard only shows org repos the policy allows** — not the user's entire personal GitHub.
3. **Evaluate and embed are jobs, never request-scoped LLM loops.**
4. **Scores are evidence-backed and SHA-pinned.** Same SHA + same profile ⇒ same overall (non-LLM tools are deterministic; LLM judges may jitter — store model + prompt_version and allow force).
5. **RAG never answers off-corpus as if it were evidence.** No citation → "not in the ingested code."
6. **Recommendations are numeric-first.** The LLM explains; it does not invent the ranking.
7. **Every LLM call has a PRISM run id** (or `llm_traces` fallback).
8. **Employers cannot widen visibility.** Admin connects; employer reads.
