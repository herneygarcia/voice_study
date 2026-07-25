from app.config import WHISPER_MODEL
from app.services.groq_client import get_client, with_retry


def transcribe_chunk(audio_bytes: bytes, filename: str, language: str = "auto") -> str:
    client = get_client()

    def _call():
        kwargs = {
            "file": (filename, audio_bytes),
            "model": WHISPER_MODEL,
            "response_format": "text",
        }
        if language and language != "auto":
            kwargs["language"] = language
        result = client.audio.transcriptions.create(**kwargs)
        return result if isinstance(result, str) else getattr(result, "text", str(result))

    text = with_retry(_call)
    return text.strip()
