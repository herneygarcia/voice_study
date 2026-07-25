# Deployment Guide — voice_study

## Local Testing

1. Start a local server:
   ```bash
   python -m http.server 8000
   ```

2. Visit `http://localhost:8000` in your browser

3. Click Settings (⚙️) and paste a Groq API key from https://console.groq.com/keys

4. Test the full flow: Record → Transcribe → Generate Summary/Flashcards/Podcast

## Deploy to GitHub Pages

### Prerequisites
- GitHub account
- This repository pushed to GitHub

### Steps

1. **Enable GitHub Pages**
   - Go to your repository Settings
   - Scroll down to "Pages"
   - Under "Build and deployment", select:
     - **Source**: Deploy from a branch
     - **Branch**: main
     - **Folder**: / (root)
   - Click Save

2. **GitHub Actions will deploy** (if enabled, it takes 1-2 minutes)

3. **Visit your live site**
   - URL: `https://<your-github-username>.github.io/voice_study/`
   - Example: `https://herneygarcia.github.io/voice_study/`

### PWA Installation

After deploying to GitHub Pages, the app is installable:

**Desktop (Chrome/Edge):**
- Click the install icon in the address bar (or three-dot menu → "Install app")
- Launches as a standalone window

**Mobile:**
- **iOS Safari**: Tap Share → "Add to Home Screen"
- **Android Chrome**: Tap the three-dot menu → "Install app"
- Appears as an icon on your home screen, launches in full-screen mode

## Architecture

The app is entirely **static** and **client-side**:

- **No backend server** — GitHub Pages just serves HTML, CSS, JS
- **No build step** — everything is plain HTML/CSS/JavaScript
- **Data storage** — IndexedDB in your browser (survives page reloads, cleared only when you clear browser data)
- **API calls** — direct from your browser to Groq's servers using your own API key
- **Offline** — the app shell is cached; API calls require internet

## Troubleshooting

### "Settings modal doesn't appear"
- Check browser console (DevTools → Console) for errors
- Verify JavaScript files loaded (Network tab)

### "Transcription fails"
- Check your Groq API key in Settings
- Verify your API key has quota remaining at https://console.groq.com
- Check browser console for error details

### "Podcast generation fails with CORS error"
- Groq's TTS endpoint supports CORS (we've verified), but check if your network/firewall is blocking
- Try recording on a different network if available

### "PWA won't install"
- Manifest must be valid: visit `https://yoursite.com/assets/manifest.json` in the browser
- Icons must load: check Network tab for 404s on icon files
- Must be HTTPS (or localhost for testing)
- Service worker must register: open DevTools → Application → Service Workers

### "Data disappeared after browser restart"
- IndexedDB persists across reloads unless you:
  - Clear browsing data (Settings → Privacy)
  - Uninstall the PWA and reinstall
- **Backup important lectures** by copying the transcript before clearing data

## What's Different from the Old Version

**Old (Backend - no longer used):**
- FastAPI server stored API key server-side
- SQLite database on the server
- Jinja2 template rendering server-side
- User deployed a running Python service

**New (Static PWA - current):**
- No backend — just static files
- IndexedDB (browser storage) replaces SQLite
- Pure static HTML pages
- User deploys via GitHub Pages (zero effort)
- Groq API key is user's responsibility (stays in their browser)

## Security Notes

1. **API Key**: Your Groq key is stored only in your browser's `localStorage` and never sent to any server except Groq. Since the code is open-source, you can inspect `js/settings.js` and `js/groq-client.js` to verify.

2. **Data**: All lectures, transcripts, summaries, and audio are stored only in your browser's IndexedDB. They don't leave your device unless:
   - You manually copy/share a transcript
   - You use Groq's API (which is expected for transcription/generation)

3. **API Usage**: Every API call goes directly to Groq's servers. Monitor your API usage at https://console.groq.com/usage to watch costs.

## Cost

Groq has a free tier with rate limits. Monitor your usage:
- https://console.groq.com/usage

For the demo/testing, free tier is plenty. If heavy daily use:
- **Transcription** (Whisper): ~$0.50/hour of audio
- **LLM calls** (summary/flashcards/podcast script): ~$0.003 per call
- **TTS** (podcast voices): ~$0.003 per request

Costs vary; check Groq's pricing page for current rates.
