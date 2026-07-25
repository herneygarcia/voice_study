from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lecture, TranscriptChunk
from app.schemas import TranscriptResponse
from app.services.transcription import transcribe_chunk

router = APIRouter(prefix="/api/lectures", tags=["recording"])


@router.post("/{lecture_id}/audio-chunk", response_model=TranscriptResponse)
async def upload_audio_chunk(
    lecture_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio chunk")

    try:
        new_text = transcribe_chunk(audio_bytes, file.filename or "chunk.webm", lecture.language)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Transcription failed: {exc}") from exc

    if new_text:
        chunk_index = len(lecture.chunks)
        db.add(TranscriptChunk(lecture_id=lecture.id, chunk_index=chunk_index, text=new_text))
        separator = " " if lecture.transcript and not lecture.transcript.endswith(" ") else ""
        lecture.transcript = f"{lecture.transcript}{separator}{new_text}".strip()
        db.commit()
        db.refresh(lecture)

    return TranscriptResponse(transcript=lecture.transcript, new_text=new_text)


@router.get("/{lecture_id}/transcript", response_model=TranscriptResponse)
def get_transcript(lecture_id: int, db: Session = Depends(get_db)):
    lecture = db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(404, "Lecture not found")
    return TranscriptResponse(transcript=lecture.transcript, new_text="")
