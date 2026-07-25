from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text, Float, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def now_iso() -> datetime:
    return datetime.now(timezone.utc)


class Lecture(Base):
    __tablename__ = "lectures"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String, default="Untitled Lecture")
    language: Mapped[str] = mapped_column(String, default="auto")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_iso)
    status: Mapped[str] = mapped_column(String, default="recording")  # recording | completed
    transcript: Mapped[str] = mapped_column(Text, default="")

    chunks: Mapped[list["TranscriptChunk"]] = relationship(
        back_populates="lecture", cascade="all, delete-orphan"
    )
    summary: Mapped["Summary"] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", uselist=False
    )
    flashcards: Mapped[list["Flashcard"]] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", order_by="Flashcard.position"
    )
    podcast: Mapped["Podcast"] = relationship(
        back_populates="lecture", cascade="all, delete-orphan", uselist=False
    )


class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(ForeignKey("lectures.id", ondelete="CASCADE"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_iso)

    lecture: Mapped["Lecture"] = relationship(back_populates="chunks")


class Summary(Base):
    __tablename__ = "summaries"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(
        ForeignKey("lectures.id", ondelete="CASCADE"), unique=True
    )
    content_md: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_iso)

    lecture: Mapped["Lecture"] = relationship(back_populates="summary")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(ForeignKey("lectures.id", ondelete="CASCADE"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[str] = mapped_column(String, default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_iso)

    lecture: Mapped["Lecture"] = relationship(back_populates="flashcards")


class Podcast(Base):
    __tablename__ = "podcasts"

    id: Mapped[int] = mapped_column(primary_key=True)
    lecture_id: Mapped[int] = mapped_column(
        ForeignKey("lectures.id", ondelete="CASCADE"), unique=True
    )
    script_json: Mapped[str] = mapped_column(Text)
    audio_path: Mapped[str] = mapped_column(String)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_iso)

    lecture: Mapped["Lecture"] = relationship(back_populates="podcast")
