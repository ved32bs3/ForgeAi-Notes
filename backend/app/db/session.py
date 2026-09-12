import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables from a .env file at project root
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:Lucky%401234@localhost:5432/rag_project",
)

# Core SQLAlchemy engine — single connection pool for the app lifetime
engine = create_engine(DATABASE_URL)

# Session factory. autocommit=False / autoflush=False so callers explicitly
# control when writes hit the DB (standard FastAPI + SQLAlchemy pattern).
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Shared declarative base — every model in app.models.models inherits from this.
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session and guarantees
    it is closed after the request, even if an exception is raised.

    Usage:
        @router.get("/repos")
        def list_repos(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()