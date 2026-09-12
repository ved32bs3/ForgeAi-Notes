from datetime import datetime
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# Embedding dimension for CodeChunk.embedding — matches OpenAI
# text-embedding-3-small / ada-002 output size. Change here if the
# embedding model changes; a migration will be required either way
# since pgvector column dimensions are fixed at the DB level.
EMBEDDING_DIM = 1536


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    github_username: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    repos: Mapped[List["Repo"]] = relationship(
        "Repo",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} github_username={self.github_username!r}>"


class Repo(Base):
    __tablename__ = "repos"
    __table_args__ = (
        UniqueConstraint("github_repo_id", name="uq_repos_github_repo_id"),
        Index("ix_repos_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    github_repo_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    clone_url: Mapped[str] = mapped_column(String(512), nullable=False)
    default_branch: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="main"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="repos")
    jobs: Mapped[List["Job"]] = relationship(
        "Job",
        back_populates="repo",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    code_chunks: Mapped[List["CodeChunk"]] = relationship(
        "CodeChunk",
        back_populates="repo",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Repo id={self.id} repo_name={self.repo_name!r}>"


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("ix_jobs_repo_id_status", "repo_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repo_id: Mapped[int] = mapped_column(
        ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    # e.g. "pending" | "running" | "completed" | "failed"
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="pending", index=True
    )
    # e.g. "manual" | "push" | "scheduled"
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    repo: Mapped["Repo"] = relationship("Repo", back_populates="jobs")
    evaluations: Mapped[List["Evaluation"]] = relationship(
        "Evaluation",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Job id={self.id} status={self.status!r}>"


class CodeChunk(Base):
    __tablename__ = "code_chunks"
    __table_args__ = (
        Index("ix_code_chunks_repo_id_file_path", "repo_id", "file_path"),
        # NOTE: the pgvector ANN index (ivfflat/hnsw) on `embedding` is
        # intentionally NOT declared here. ivfflat indexes need representative
        # data present at CREATE INDEX time to build good clusters, and hnsw
        # build parameters (m, ef_construction) are tuning decisions better
        # made explicitly in an Alembic migration, e.g.:
        #   CREATE INDEX ix_code_chunks_embedding
        #   ON code_chunks USING ivfflat (embedding vector_cosine_ops)
        #   WITH (lists = 100);
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repo_id: Mapped[int] = mapped_column(
        ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[List[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    repo: Mapped["Repo"] = relationship("Repo", back_populates="code_chunks")

    def __repr__(self) -> str:
        return f"<CodeChunk id={self.id} file_path={self.file_path!r} lines={self.start_line}-{self.end_line}>"


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (Index("ix_evaluations_job_id", "job_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    job: Mapped["Job"] = relationship("Job", back_populates="evaluations")
    agent_scores: Mapped[List["AgentScore"]] = relationship(
        "AgentScore",
        back_populates="evaluation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    developer_recommendations: Mapped[List["DeveloperRecommendation"]] = relationship(
        "DeveloperRecommendation",
        back_populates="evaluation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Evaluation id={self.id} overall_score={self.overall_score}>"


class AgentScore(Base):
    __tablename__ = "agent_scores"
    __table_args__ = (
        Index("ix_agent_scores_evaluation_id_agent_name", "evaluation_id", "agent_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    # e.g. "security_agent" | "performance_agent" | "readability_agent" ...
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    # List of code snippets (or {file, lines, snippet} objects) the agent
    # cited as evidence. JSONB keeps this flexible without a separate table.
    evidence_snippets: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="agent_scores")

    def __repr__(self) -> str:
        return f"<AgentScore id={self.id} agent_name={self.agent_name!r} score={self.score}>"


class DeveloperRecommendation(Base):
    __tablename__ = "developer_recommendations"
    __table_args__ = (
        Index(
            "ix_developer_recommendations_evaluation_id_username",
            "evaluation_id",
            "developer_github_username",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False
    )
    developer_github_username: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    recommended_role: Mapped[str] = mapped_column(String(100), nullable=False)
    suggested_team_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)

    evaluation: Mapped["Evaluation"] = relationship(
        "Evaluation", back_populates="developer_recommendations"
    )

    def __repr__(self) -> str:
        return (
            f"<DeveloperRecommendation id={self.id} "
            f"developer_github_username={self.developer_github_username!r} "
            f"role={self.recommended_role!r}>"
        )