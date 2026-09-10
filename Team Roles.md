# Team Assignments — AI Code Evaluation Framework

### Team assumption and scope

**Assumption:** 5 people — **BE-1, BE-2, BE-3** (backend) and **FE-1, FE-2** (frontend).

Each assignment below is a single GitHub issue style card: **goal, acceptance criteria, tasks, estimates, dependencies, and handoff checklist**.

---

## BE-1 — Core API, Auth, Data Models (Primary API owner)

**Goal**
Ship the FastAPI surface and DB schema that other teams use: OAuth login, session handling, repo listing, jobs, scores, ask, recommend endpoints.

**Acceptance criteria**
- GitHub OAuth flow works end-to-end in staging; session cookie set and `/me` returns `{id, github_login, role, avatar}`.
- OpenAPI spec published and stable for frontend use.
- DB migrations created for `users`, `repositories`, `developers`, `jobs`, `evaluations`, `criterion_scores`, `evidence_items`, `document_chunks`, `recommendations`, `llm_traces`.
- Authorization enforced: admin vs employer scoping works for `/repos`, `/evaluate`, `/traces`.

**Tasks**
1. Implement `/auth/github` and `/auth/github/callback` with token encryption at rest.
2. Implement `/me`, `/repos`, `/developers`, `/jobs/{job_id}`, `/scores`, `/ask` (stub), `/recommend` (stub).
3. Create SQLAlchemy models + Alembic migrations for core tables.
4. Implement session middleware and role resolution (`ADMIN_ALLOWLIST` + org owner check).
5. Add unit tests for auth, role resolution, and repo scoping.
6. Publish OpenAPI and example request/response payloads.

**Estimate**
3 sprints (setup + auth + core endpoints) — split into 2-week milestones.

**Dependencies**
- GitHub OAuth app credentials (from infra).
- DB instance and migration runner.
- BE-2 worker contract for job enqueueing.

**Handoff checklist**
- Commit OpenAPI spec and example payloads.
- Provide sample admin and employer test accounts.
- Document token encryption approach and rotation steps.

---

## BE-2 — Worker, Ingestion, Chunking, Embeddings (Primary ingest/index owner)

**Goal**
Implement the asynchronous worker that clones repos, extracts files, builds chunk metadata, and writes embeddings into `document_chunks`.

**Acceptance criteria**
- Worker accepts ingest job and produces `repository_files` and `document_chunks` rows for a sample repo.
- Chunking respects include/exclude rules and file caps; snapshot `head_sha` persisted.
- Embedding calls succeed and vectors are stored in `document_chunks.embedding`.
- Worker updates `jobs` table with stage and progress; scratch cleaned up or tarballed when requested.

**Tasks**
1. Implement worker skeleton (Celery/ARQ/RQ) and job consumer.
2. Implement shallow clone, ref resolution, and file filter (include/exclude + caps).
3. Extract authors from git log and persist `developers` + `repository_contributors`.
4. Implement chunker (800-token chunks, 120 overlap) and metadata fields.
5. Integrate embedding model client and write vectors to `document_chunks`.
6. Add retry and failure handling for embedding and clone steps.
7. Integration tests: ingest a small public repo and assert DB rows.

**Estimate**
3 sprints (worker infra + clone + chunking + embeddings).

**Dependencies**
- BE-1 for job enqueue API and `jobs` table schema.
- Embedding model credentials and client library.
- Storage for scratch workspace.

**Handoff checklist**
- Provide chunk schema and sample chunk payloads.
- Document embedding model config and error codes.
- Provide a small sample repo and test data for FE dev.

---

## BE-3 — Evaluation Engine, Orchestrator, Recommendation, PRISM

**Goal**
Deliver the 10-agent evaluation orchestration, PRISM tracing integration, aggregator, and recommendation logic.

**Acceptance criteria**
- Orchestrator runs evaluation job stages and emits job progress (clone → score:* → embed → finalize).
- At least 3 deterministic tools (AST checks, linter, regex) integrated and used as facts for agents.
- 10 agent scaffolding implemented; one full agent (e.g., Security) end-to-end producing `criterion_scores` + `evidence_items`.
- PRISM spans emitted for model calls; fallback `llm_traces` written when PRISM unavailable.
- Recommendation endpoint computes deterministic role fit and returns rationale.

**Tasks**
1. Implement orchestrator that coordinates ingest → evaluate → index and updates `jobs`.
2. Build deterministic tool adapters (AST parser, linter runner, semgrep optional).
3. Implement LangChain agent wrapper pattern and parallel execution with bounded concurrency.
4. Implement aggregator using scoring profiles and write `evaluations` + `criterion_scores`.
5. Integrate PRISM SDK for spans; implement local fallback table `llm_traces`.
6. Implement recommendation logic (role matrix + hackathon team greedy search + local swap).
7. Add integration tests: run evaluation on sample snapshot and assert DB writes.

**Estimate**
4 sprints (orchestrator + deterministic tools + agents + PRISM + recommendations).

**Dependencies**
- BE-2 for snapshot and chunk availability.
- BE-1 for job lifecycle and API hooks.
- LLM provider credentials and PRISM access.

**Handoff checklist**
- Provide evaluation result JSON schema and evidence item examples.
- Document PRISM attributes emitted per span.
- Provide scoring profile examples (default + security-heavy).

---

## FE-1 — Dashboard Core: Repos and Evaluation Views

**Goal**
Ship the repo list and evaluation view with charts and evidence snippets; implement job polling/SSE.

**Acceptance criteria**
- Repo list shows name, default branch, last commit, last evaluation status, overall score.
- Evaluation page shows overall score and 10-criterion radar/bar chart, evidence snippets with file/line links, and run history.
- Job progress UI polls `/jobs/{id}` or listens to SSE and shows stage/progress.
- Auth flow triggers backend OAuth start and handles session cookie.

**Tasks**
1. Implement Next.js pages: `/` (repos), `/repo/[id]` (evaluation).
2. Implement Recharts radar/bar components for 10 criteria.
3. Implement evidence snippet component that opens file viewer at line range.
4. Implement job polling/SSE component and progress UI.
5. Wire auth button to `/auth/github` and call `/me` on load.
6. Add unit tests and Cypress smoke tests for main flows.

**Estimate**
2 sprints (scaffold + repo list + evaluation page + polling).

**Dependencies**
- BE-1 OpenAPI and auth endpoints.
- BE-3 evaluation result schema and evidence payloads.
- FE-2 for shared components (file viewer, modals).

**Handoff checklist**
- Share component props and expected API responses.
- Provide sample evaluation payloads and evidence items.
- Provide test admin/employer accounts.

---

## FE-2 — Compare, Ask (RAG UI), Recommend, Admin Traces

**Goal**
Deliver Compare view, Ask conversational UI with citations, Recommend UI, and admin traces visualization.

**Acceptance criteria**
- Compare view overlays 2–N developers/repos with selectable criteria and export option.
- Ask UI posts question to `/ask`, displays answer with numbered citations linking to file/line snippets, and stores conversation history.
- Recommend UI shows role fit cards and hackathon team builder with constraints UI.
- Admin traces UI renders PRISM waterfall for a run (admin only).

**Tasks**
1. Implement Compare page with multi-select and overlay charts.
2. Implement Ask conversation UI: question input, scope selector, answer display with citations and follow-ups.
3. Implement Recommend UI: role fit cards (numbers + rationale) and hackathon team builder.
4. Implement Admin Traces page that fetches `/traces?run_id=` and renders spans waterfall.
5. Add accessibility and responsive behavior; unit and integration tests.

**Estimate**
3 sprints (ask + compare + recommend + traces).

**Dependencies**
- BE-1 `/ask` and `/recommend` endpoints.
- BE-2 chunk snippets or endpoint to fetch snippet content.
- BE-3 PRISM traces or `llm_traces` fallback.

**Handoff checklist**
- Provide API examples for `/ask` responses (answer + citations array).
- Provide trace span schema and sample data.
- Provide file viewer component or API to fetch file content by path+lines.

---

## Cross-team acceptance and release checklist

- **OpenAPI** committed and versioned.
- **DB migrations** applied in staging and smoke tests pass.
- **End-to-end smoke test**: admin connects a repo → ingest job runs → evaluation completes → repo shows scores → ask returns a cited answer.
- **Secrets**: GitHub tokens encrypted; LLM/embedding keys never exposed to browser.
- **Observability**: PRISM spans visible in admin traces or `llm_traces` fallback populated.
- **Docs**: README with runbook for common failures (clone, embedding, LLM timeout).
