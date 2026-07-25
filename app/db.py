from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Migrate existing flashcards table to add difficulty column if missing
    with engine.connect() as conn:
        try:
            result = conn.execute(text("PRAGMA table_info(flashcards)"))
            columns = {row[1] for row in result.fetchall()}
            if "difficulty" not in columns:
                conn.execute(text('ALTER TABLE flashcards ADD COLUMN difficulty TEXT DEFAULT "new"'))
                conn.commit()
        except Exception:
            pass
