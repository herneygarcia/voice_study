from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import PODCASTS_DIR
from app.db import get_db
from app.models import Lecture
from app.schemas import LectureCreate, LectureDetail, LectureListItem, LectureUpdate

router = APIRouter(prefix="/api/lectures", tags=["lectures"])


def _to_list_item(lecture: Lecture) -> LectureListItem:
    return LectureListItem(
        id=lecture.id,
        title=lecture.title,
        language=lecture.language,
        created_at=lecture.created_at,
        status=lecture.status,
        has_transcript=bool(lecture.transcript.strip()),
        has_summary=lecture.summary is not None,
        has_flashcards=len(lecture.flashcards) > 0,
        has_podcast=lecture.podcast is not None,
    )


def _to_detail(lecture: Lecture) -> LectureDetail:
    return LectureDetail(
        id=lecture.id,
        title=lecture.title,
        language=lecture.language,
        created_at=lecture.created_at,
        status=lecture.status,
        transcript=lecture.transcript,
        has_summary=lecture.summary is not None,
        has_flashcards=len(lecture.flashcards) > 0,
        has_podcast=lecture.podcast is not None,
    )


@router.get("", response_model=list[LectureListItem])
def list_lectures(db: Session = Depends(get_db)):
    lectures = db.query(Lecture).order_by(Lecture.created_at.desc()).all()
    return [_to_list_item(lecture) for lecture in lectures]


@router.post("", response_model=LectureDetail)
def create_lecture(payload: LectureCreate, db: Session = Depends(get_db)):
    lecture = Lecture(title=payload.title, language=payload.language)
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return _to_detail(lecture)


@router.get("/{lecture_id}", response_model=LectureDetail)
def get_lecture(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    return _to_detail(lecture)


@router.patch("/{lecture_id}", response_model=LectureDetail)
def update_lecture(lecture_id: int, payload: LectureUpdate, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    if payload.title is not None:
        lecture.title = payload.title
    if payload.status is not None:
        lecture.status = payload.status
    if payload.transcript is not None:
        lecture.transcript = payload.transcript
    db.commit()
    db.refresh(lecture)
    return _to_detail(lecture)


@router.delete("/{lecture_id}")
def delete_lecture(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")

    if lecture.podcast:
        audio_file = PODCASTS_DIR / lecture.podcast.audio_path.split("/")[-1]
        if audio_file.exists():
            audio_file.unlink()

    db.delete(lecture)
    db.commit()
    return {"ok": True}
