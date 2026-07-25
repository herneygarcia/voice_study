import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PODCASTS_DIR = BASE_DIR / "app" / "static_media" / "podcasts"

DATA_DIR.mkdir(parents=True, exist_ok=True)
PODCASTS_DIR.mkdir(parents=True, exist_ok=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

DATABASE_URL = f"sqlite:///{str(DATA_DIR / 'app.db').replace(chr(92), '/')}"

WHISPER_MODEL = "whisper-large-v3-turbo"
LLM_MODEL = "llama-3.3-70b-versatile"
TTS_MODEL = "canopylabs/orpheus-v1-english"
TTS_VOICE_HOST_A = "austin"
TTS_VOICE_HOST_B = "hannah"

SUPPORTED_LANGUAGES = {
    "auto": "Auto-detect",
    "en": "English",
    "fr": "Français",
    "es": "Español",
}
