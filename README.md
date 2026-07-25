# Voice Study

Record a lecture, get a live transcript (English, French, or Spanish), and turn it into a summary, flashcards, or a two-host podcast recap — all powered by your own Groq API key.

## Getting Started

This is a static web app — no backend server required. Your data and all API calls stay in your browser.

### Option 1: Open directly in your browser

1. Clone this repository
2. Open `index.html` in your browser

### Option 2: Serve locally (recommended for testing PWA/service worker)

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Setup

1. Get a free Groq API key at https://console.groq.com/keys
2. Open the app and click the Settings (⚙️) button in the top-right
3. Paste your API key — it will be stored only in your browser's `localStorage`

## How It Works

- **Recording**: Press record, speak, and your microphone audio is captured in your browser
- **Transcription**: Each 15-second chunk is sent to Groq's Whisper API to transcribe
- **Live Transcript**: See your words appear in real-time as you speak
- **Summary**: Turn your transcript into structured markdown notes
- **Flashcards**: Auto-generate spaced-repetition study cards with questions and answers
- **Podcast**: Generate an engaging two-host conversational recap with AI-generated voices

All data — lectures, transcripts, summaries, flashcards, podcast audio — is stored in your browser's IndexedDB. **Clearing your browser data will delete them**, so export important lectures first if needed.

## API Key Security

Your Groq API key is stored only in your browser's `localStorage` and never sent to any server except Groq's API. The code is 100% client-side and open-source, so you can inspect it to verify.

## Deployment to GitHub Pages

1. Push this repo to GitHub
2. Go to Settings → Pages
3. Select "Deploy from branch" and choose `main` (root)
4. Visit `https://<your-github-username>.github.io/voice_study/`

The app will be installable as a mobile app ("Add to Home Screen" on iOS, or the install prompt on Android/Chrome).

## Notes

- Microphone recording requires HTTPS (or localhost for testing). If testing over a LAN IP, use `python -m http.server` to test service worker functionality
- All Groq API calls require the internet — offline use can record audio, but transcription/generation requires a live connection
- IndexedDB has browser-dependent storage limits (typically 50-100 MB). Large collections of lectures with podcasts may approach this limit

## Features

- ✅ Live transcription while recording
- ✅ Multi-language support (English, French, Spanish, auto-detect)
- ✅ Summary generation with structured markdown
- ✅ Flashcard auto-generation
- ✅ Two-host podcast recap with realistic voices
- ✅ Installable as a PWA (progressive web app)
- ✅ Offline app shell (cached assets)
- ✅ All data stored in your browser (no account required)

## Building

No build step required — this is a pure static site. All the source code is in:
- `index.html`, `record.html`, `lecture.html` — static pages
- `js/` — all JavaScript (IndexedDB, Groq client, app logic)
- `css/` — styling
- `assets/` — PWA manifest, icons

## License

Built by Herney García. Open source and free to use.
