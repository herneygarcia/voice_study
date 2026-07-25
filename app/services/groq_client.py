import time

from groq import Groq

from app.config import GROQ_API_KEY

_client: Groq | None = None


def get_client() -> Groq:
    global _client
    if _client is None:
        if not GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Copy .env.example to .env and add your key."
            )
        _client = Groq(api_key=GROQ_API_KEY)
    return _client


def with_retry(fn, attempts: int = 2, backoff: float = 1.5):
    last_error = None
    for attempt in range(attempts):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - deliberately broad, single retry point
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(backoff)
    raise last_error
