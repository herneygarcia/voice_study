import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Flashcard, Lecture, Podcast, Summary
from app.schemas import FlashcardItem, FlashcardRatingUpdate, FlashcardsResponse, PodcastResponse, PodcastSegment, SummaryResponse
from app.services.flashcards import generate_flashcards
from app.services.podcast import generate_podcast
from app.services.summary import generate_summary

router = APIRouter(prefix="/api/lectures", tags=["generation"])


def _require_transcript(lecture: Lecture) -> str:
    if not lecture.transcript.strip():
        raise HTTPException(400, "Lecture has no transcript yet")
    return lecture.transcript


@router.post("/{lecture_id}/generate-summary", response_model=SummaryResponse)
def create_summary(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    transcript = _require_transcript(lecture)

    try:
        content_md = generate_summary(transcript, lecture.language)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Summary generation failed: {exc}") from exc

    if lecture.summary:
        lecture.summary.content_md = content_md
    else:
        db.add(Summary(lecture_id=lecture.id, content_md=content_md))
    db.commit()
    return SummaryResponse(content_md=content_md)


@router.post("/{lecture_id}/generate-flashcards", response_model=FlashcardsResponse)
def create_flashcards(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    transcript = _require_transcript(lecture)

    try:
        cards = generate_flashcards(transcript, lecture.language)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Flashcard generation failed: {exc}") from exc

    if not cards:
        raise HTTPException(502, "No flashcards could be generated from this transcript")

    db.query(Flashcard).filter(Flashcard.lecture_id == lecture.id).delete()
    flashcards = []
    for position, card in enumerate(cards):
        fc = Flashcard(
            lecture_id=lecture.id,
            question=card["question"],
            answer=card["answer"],
            position=position,
            difficulty="new",
        )
        db.add(fc)
        flashcards.append(fc)
    db.commit()
    return FlashcardsResponse(
        flashcards=[
            FlashcardItem(id=fc.id, question=fc.question, answer=fc.answer, difficulty=fc.difficulty)
            for fc in flashcards
        ]
    )


@router.post("/{lecture_id}/generate-podcast", response_model=PodcastResponse)
def create_podcast(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    transcript = _require_transcript(lecture)

    try:
        result = generate_podcast(lecture.id, transcript, lecture.language)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Podcast generation failed: {exc}") from exc

    script_json = json.dumps(result["segments"])
    if lecture.podcast:
        lecture.podcast.script_json = script_json
        lecture.podcast.audio_path = result["audio_path"]
        lecture.podcast.duration_seconds = result["duration_seconds"]
    else:
        db.add(
            Podcast(
                lecture_id=lecture.id,
                script_json=script_json,
                audio_path=result["audio_path"],
                duration_seconds=result["duration_seconds"],
            )
        )
    db.commit()

    return PodcastResponse(
        segments=[PodcastSegment(**s) for s in result["segments"]],
        audio_url=f"/media/{result['audio_path']}",
        duration_seconds=result["duration_seconds"],
    )


@router.get("/{lecture_id}/podcast", response_model=PodcastResponse)
def get_podcast(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture or not lecture.podcast:
        raise HTTPException(404, "Podcast not found")
    try:
        segments = json.loads(lecture.podcast.script_json)
    except (json.JSONDecodeError, TypeError) as e:
        raise HTTPException(502, f"Podcast script data is corrupted: {e}") from e
    return PodcastResponse(
        segments=[PodcastSegment(**s) for s in segments],
        audio_url=f"/media/{lecture.podcast.audio_path}",
        duration_seconds=lecture.podcast.duration_seconds,
    )


@router.get("/{lecture_id}/flashcards", response_model=FlashcardsResponse)
def get_flashcards(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    return FlashcardsResponse(
        flashcards=[
            FlashcardItem(id=c.id, question=c.question, answer=c.answer, difficulty=c.difficulty)
            for c in lecture.flashcards
        ]
    )


@router.patch("/{lecture_id}/flashcards/{flashcard_id}", response_model=FlashcardItem)
def rate_flashcard(lecture_id: int, flashcard_id: int, update: FlashcardRatingUpdate, db: Session = Depends(get_db)):
    if update.difficulty not in ("new", "know", "struggling", "forgot"):
        raise HTTPException(400, "difficulty must be one of: new, know, struggling, forgot")
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    card = db.get(Flashcard, flashcard_id)
    if not card or card.lecture_id != lecture.id:
        raise HTTPException(404, "Flashcard not found")
    card.difficulty = update.difficulty
    db.commit()
    return FlashcardItem(id=card.id, question=card.question, answer=card.answer, difficulty=card.difficulty)


@router.get("/{lecture_id}/summary", response_model=SummaryResponse)
def get_summary(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture or not lecture.summary:
        raise HTTPException(404, "Summary not found")
    return SummaryResponse(content_md=lecture.summary.content_md)
