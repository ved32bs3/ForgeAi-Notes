from app.db.session import Base
from app.models.models import (
    User,
    Repo,
    Job,
    CodeChunk,
    Evaluation,
    AgentScore,
    DeveloperRecommendation,
)

# Explicit export list so Alembic's autogenerate (env.py -> target_metadata)
# and any `from app.models import *` reliably picks up every mapped model.
__all__ = [
    "Base",
    "User",
    "Repo",
    "Job",
    "CodeChunk",
    "Evaluation",
    "AgentScore",
    "DeveloperRecommendation",
]