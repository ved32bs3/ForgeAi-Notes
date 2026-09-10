# AI Code Evaluation Framework

A GitHub-authenticated platform that ingests an org's repos, runs a 10-agent LLM code evaluation, answers questions over the code via RAG, and recommends roles and hackathon teams based on the scores.

This repo currently holds two planning docs — read them in this order:

## `ai-code-evaluation-framework.md`
The full system architecture spec. Covers the actors (admin/employer), the 5-layer architecture, GitHub OAuth flow, the API contracts, how ingestion/evaluation/RAG/recommendation each work internally, the DB schema, deployment topology, and the invariants we must not break while building. Start here to understand **what we're building and how the pieces fit together**.

## `team-assignments.md`
The task breakdown across the 5 of us (BE-1, BE-2, BE-3, FE-1, FE-2). Each section is a goal, acceptance criteria, tasks, an estimate, dependencies on other members, and a handoff checklist. Read this to see **what you personally own and who you're blocked by/blocking**.

# Project Structure

```
ai-code-eval-framework/
├── README.md
├── backend/                          # BE-1, BE-3
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── auth.py               # /auth/github, /auth/github/callback
│   │   │   ├── repos.py              # /repos, /repos/{id}/connect
│   │   │   ├── evaluate.py           # /evaluate
│   │   │   ├── scores.py             # /scores, /scores/history
│   │   │   ├── ask.py                # /ask
│   │   │   ├── recommend.py          # /recommend
│   │   │   ├── traces.py             # /traces
│   │   │   ├── jobs.py               # /jobs/{job_id}
│   │   │   ├── developers.py         # /developers
│   │   │   └── me.py                 # /me
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── session.py
│   │   │   └── security.py           # token encryption
│   │   ├── models/                   # SQLAlchemy models
│   │   ├── schemas/                  # Pydantic schemas
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   └── migrations/           # Alembic
│   │   ├── evaluation/               # BE-3
│   │   │   ├── orchestrator.py
│   │   │   ├── aggregator.py
│   │   │   ├── agents/
│   │   │   │   ├── readability.py
│   │   │   │   ├── documentation.py
│   │   │   │   ├── modularity.py
│   │   │   │   ├── error_handling.py
│   │   │   │   ├── security.py
│   │   │   │   ├── test_coverage.py
│   │   │   │   ├── performance.py
│   │   │   │   ├── maintainability.py
│   │   │   │   ├── standards.py
│   │   │   │   └── innovation.py
│   │   │   └── tools/                # AST, linters, semgrep adapters
│   │   ├── recommend/                # BE-3
│   │   │   ├── role_fit.py
│   │   │   └── hackathon_team.py
│   │   ├── rag/                      # BE-3 / BE-1
│   │   │   ├── retriever.py
│   │   │   └── generate.py
│   │   └── tracing/
│   │       └── prism.py
│   ├── tests/
│   ├── alembic.ini
│   └── pyproject.toml
│
├── worker/                           # BE-2
│   ├── worker/
│   │   ├── main.py                   # Celery/ARQ/RQ entrypoint
│   │   ├── ingestion/
│   │   │   ├── clone.py
│   │   │   ├── file_filter.py
│   │   │   ├── authors.py
│   │   │   └── persist.py
│   │   ├── indexing/
│   │   │   ├── chunker.py
│   │   │   └── embed.py
│   │   └── scratch/                  # ephemeral clone workspace
│   ├── tests/
│   └── pyproject.toml
│
├── frontend/                         # FE-1, FE-2
│   ├── app/
│   │   ├── page.jsx                  # repo list (FE-1)
│   │   ├── layout.jsx
│   │   ├── repo/[id]/page.jsx        # evaluation view (FE-1)
│   │   ├── compare/page.jsx          # FE-2
│   │   ├── ask/page.jsx              # FE-2
│   │   ├── recommend/page.jsx        # FE-2
│   │   └── admin/traces/page.jsx     # FE-2
│   ├── components/
│   │   ├── charts/radar-bar.jsx
│   │   ├── evidence-snippet.jsx
│   │   ├── job-progress.jsx
│   │   └── file-viewer.jsx
│   ├── lib/
│   │   └── api-client.js
│   ├── public/
│   ├── jsconfig.json                 # path aliases, no TS needed
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
│
├── infra/
│   ├── docker-compose.yml
│   └── migrations-runner/
│
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

## Notes

- **backend/** — FastAPI service (BE-1, BE-3): auth, core API, evaluation engine, RAG, recommendations, PRISM tracing.
- **worker/** — async job runner (BE-2): repo cloning, ingestion, chunking, embeddings.
- **frontend/** — Next.js app in JSX (FE-1, FE-2): repo dashboard, evaluation views, compare, ask, recommend, admin traces.
- **infra/** — local dev orchestration (docker-compose) and migration runner config.
- **docs/** — architecture spec and team task breakdown.
## Quick orientation
- **BE-1**: API, auth, DB models
- **BE-2**: Worker — ingest, chunk, embed
- **BE-3**: Evaluation agents, orchestrator, recommendations, PRISM
- **FE-1**: Repo list + evaluation dashboard
- **FE-2**: Compare, Ask, Recommend, admin traces
