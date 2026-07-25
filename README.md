# Voice Study

Record a lecture, get a live transcript (English, French, or Spanish), and turn it into a summary, flashcards, or a two-host podcast recap — all powered by a single Groq API key.

## Setup

```bash
git clone https://github.com/herneygarcia/voice_study.git
cd voice_study
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit .env and set GROQ_API_KEY=your_key
```

Get a free Groq API key at https://console.groq.com.

## Run

```bash
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000.

## Notes

- Microphone recording requires a secure context. `localhost` works without HTTPS; testing from another device on the same Wi-Fi (via the LAN IP) will be blocked by the browser unless you use a tunnel (e.g. `ngrok`) or a dev HTTPS flag.
- All AI calls (transcription, summary/flashcards/podcast script, podcast voices) run server-side through Groq — the API key is never exposed to the browser.
- Data is stored locally in `data/app.db` (SQLite); generated podcast audio files live in `app/static_media/podcasts/`.
