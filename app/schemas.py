from datetime import datetime

from pydantic import BaseModel


class LectureCreate(BaseModel):
    title: str = "Untitled Lecture"
    language: str = "auto"


class LectureUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    transcript: str | None = None


class LectureListItem(BaseModel):
    id: int
    title: str
    language: str
    created_at: datetime
    status: str
    has_transcript: bool
    has_summary: bool
    has_flashcards: bool
    has_podcast: bool

    class Config:
        from_attributes = True


class LectureDetail(BaseModel):
    id: int
    title: str
    language: str
    created_at: datetime
    status: str
    transcript: str
    has_summary: bool
    has_flashcards: bool
    has_podcast: bool

    class Config:
        from_attributes = True


class TranscriptResponse(BaseModel):
    transcript: str
    new_text: str


class SummaryResponse(BaseModel):
    content_md: str


class FlashcardItem(BaseModel):
    id: int
    question: str
    answer: str
    difficulty: str = "new"

    class Config:
        from_attributes = True


class FlashcardRatingUpdate(BaseModel):
    difficulty: str


class FlashcardsResponse(BaseModel):
    flashcards: list[FlashcardItem]


class PodcastSegment(BaseModel):
    speaker: str
    text: str


class PodcastResponse(BaseModel):
    segments: list[PodcastSegment]
    audio_url: str
    duration_seconds: float
