// Groq API client — replaces app/services/*.py
// Direct browser calls to Groq's REST API (transcription, chat, TTS)

const WHISPER_MODEL = "whisper-large-v3-turbo";
const LLM_MODEL = "llama-3.3-70b-versatile";
const TTS_MODEL = "canopylabs/orpheus-v1-english";
const TTS_VOICE_HOST_A = "austin";
const TTS_VOICE_HOST_B = "hannah";
const MAX_TRANSCRIPT_CHARS = 60000;
const GROQ_API_BASE = "https://api.groq.com/openai/v1";

function getApiKey() {
  const key = localStorage.getItem("groq_api_key");
  if (!key) {
    showErrorToast("API key not set. Open Settings to configure.");
    throw new Error("Groq API key not configured");
  }
  return key;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, attempts = 2, backoffMs = 1500) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await sleep(backoffMs);
      }
    }
  }
  throw lastError;
}

function getLanguageInstruction(language) {
  const SUPPORTED_LANGUAGES = { auto: "Auto-detect", en: "English", fr: "Français", es: "Español" };
  if (language !== "auto") {
    return `Respond in ${SUPPORTED_LANGUAGES[language] || "the same language as the transcript"}.`;
  }
  return "Respond in the same language as the transcript.";
}

async function transcribeChunk(blob, filename, language) {
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("model", WHISPER_MODEL);
  formData.append("response_format", "text");
  if (language !== "auto") {
    formData.append("language", language);
  }

  return withRetry(async () => {
    const res = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getApiKey()}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Transcription failed: ${res.status} ${res.statusText}`);
    return (await res.text()).trim();
  });
}

async function generateSummary(transcript, language = "auto") {
  let text = transcript;
  let truncatedNotice = "";
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    text = text.substring(0, MAX_TRANSCRIPT_CHARS);
    truncatedNotice = "\n\n[Note: transcript was truncated for length.]";
  }

  const langInstruction = getLanguageInstruction(language);
  const systemPrompt = `You are an expert academic note-taker helping a university student study. Produce a structured markdown summary of the lecture transcript below. Start with a short 'Quick Recap' section (2-3 sentences), then use '## ' headings for each key topic covered, with concise bullet points ('- ') for supporting details, definitions, and examples under each heading. Be clear and well organized. ${langInstruction}`;

  return withRetry(async () => {
    const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`Summary generation failed: ${res.status}`);
    const data = await res.json();
    if (!data.choices || !data.choices[0]) throw new Error("Empty API response");
    return (data.choices[0].message.content || "").trim() + truncatedNotice;
  });
}

async function generateFlashcards(transcript, language = "auto") {
  let text = transcript;
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    text = text.substring(0, MAX_TRANSCRIPT_CHARS);
  }

  const langInstruction = getLanguageInstruction(language).replace("Respond", "Write the flashcards");

  async function tryCall(strict) {
    const strictness = strict ? " Return ONLY valid JSON, no markdown code fences, no extra commentary — just the raw JSON object." : "";
    const systemPrompt = `You are an expert study-guide creator. Read the lecture transcript and produce 10-20 high-quality flashcards covering the most important concepts, definitions, and facts. Follow these rules for effective active-recall learning:
1. Ask questions, not prompts: Use 'What...?', 'Why...?', 'How...?' phrasing instead of bare terms or definitions. Example: Ask 'What is photosynthesis?' not 'Photosynthesis'.
2. One concept per card: Split compound ideas into separate flashcards. Each card should test a single retrievable fact or idea.
3. Avoid yes/no questions: Use open-ended questions that require the student to explain or describe.
4. Keep both question and answer short and concrete: Do not copy long passages from the transcript. Answers should be 1-3 sentences max.
Respond with a JSON object of the exact shape {"flashcards": [{"question": "...", "answer": "..."}, ...]}. ${langInstruction}${strictness}`;

    const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Flashcard generation failed: ${res.status}`);
    const data = await res.json();
    if (!data.choices || !data.choices[0]) throw new Error("Empty API response");
    return data.choices[0].message.content;
  }

  let raw = await withRetry(() => tryCall(false));
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    raw = await withRetry(() => tryCall(true));
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse flashcards JSON: ${err.message}`);
    }
  }

  const cards = parsed.flashcards || [];
  return cards
    .filter(c => c.question && c.answer)
    .map(c => ({
      question: String(c.question).trim(),
      answer: String(c.answer).trim(),
    }));
}

async function generatePodcastScript(transcript, language = "auto") {
  let text = transcript;
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    text = text.substring(0, MAX_TRANSCRIPT_CHARS);
  }

  const langInstruction = getLanguageInstruction(language).replace("Respond", "Write the dialogue");
  const systemPrompt = `You are a podcast scriptwriter. Turn the lecture transcript into an engaging, natural two-host conversational recap, as if two enthusiastic study-buddies are discussing what was covered. Alternate between 'Host A' and 'Host B', 6-14 short exchanges total, friendly and clear tone, highlighting the most important points. Respond with ONLY a JSON object: {"segments": [{"speaker": "Host A", "text": "..."}, {"speaker": "Host B", "text": "..."}, ...]}. ${langInstruction}`;

  return withRetry(async () => {
    const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Podcast script generation failed: ${res.status}`);
    const data = await res.json();
    if (!data.choices || !data.choices[0]) throw new Error("Empty API response");
    const parsed = JSON.parse(data.choices[0].message.content);
    const segments = parsed.segments || [];
    return segments
      .filter(s => s.text)
      .map(s => ({
        speaker: s.speaker || "Host A",
        text: String(s.text).trim(),
      }));
  });
}

async function synthesizeSegment(text, voice) {
  let lastError;
  const maxAttempts = 5;
  const fetchTimeoutMs = 30000; // 30 second timeout per request

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Wrap fetch with timeout
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), fetchTimeoutMs);

      const res = await fetch(`${GROQ_API_BASE}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice,
          input: text,
          response_format: "wav",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (res.ok) {
        return res.arrayBuffer();
      }

      if (res.status === 429) {
        // Rate limited — wait and retry
        console.warn(`TTS rate limited (429), retrying ${attempt + 1}/${maxAttempts}...`);
        if (attempt < maxAttempts - 1) {
          await sleep(8000); // Safe margin above minimum 6s/request rate limit
        }
        continue;
      }

      // Non-429 error — fail fast
      throw new Error(`TTS synthesis failed: ${res.status}`);
    } catch (err) {
      lastError = err;
      if (err.name === "AbortError") {
        // Timeout — retry
        console.warn(`TTS request timed out, retrying...`);
        if (attempt < maxAttempts - 1) {
          await sleep(2000);
        }
        continue;
      }
      if (err.message && err.message.includes("TTS synthesis failed")) {
        throw err; // Genuine failure, stop retrying
      }
      // Network error — retry
      if (attempt < maxAttempts - 1) {
        await sleep(2000);
      }
    }
  }

  throw lastError || new Error("TTS synthesis failed after max retries");
}

function parseWavHeader(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  // Read RIFF header
  const chunkId = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (chunkId !== "RIFF") throw new Error("Invalid WAV file: missing RIFF header");

  // Find fmt chunk
  let fmtOffset = 12;
  let fmtSize = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;

  while (fmtOffset < arrayBuffer.byteLength) {
    const subchunkId = String.fromCharCode(
      view.getUint8(fmtOffset),
      view.getUint8(fmtOffset + 1),
      view.getUint8(fmtOffset + 2),
      view.getUint8(fmtOffset + 3)
    );
    const subchunkSize = view.getUint32(fmtOffset + 4, true);

    if (subchunkId === "fmt ") {
      fmtSize = subchunkSize;
      channels = view.getUint16(fmtOffset + 8, true);
      sampleRate = view.getUint32(fmtOffset + 12, true);
      bitsPerSample = view.getUint16(fmtOffset + 22, true);
      break;
    }
    fmtOffset += 8 + subchunkSize;
  }

  // Find data chunk
  let dataOffset = 12;
  let dataSize = 0;
  while (dataOffset < arrayBuffer.byteLength) {
    const subchunkId = String.fromCharCode(
      view.getUint8(dataOffset),
      view.getUint8(dataOffset + 1),
      view.getUint8(dataOffset + 2),
      view.getUint8(dataOffset + 3)
    );
    const subchunkSize = view.getUint32(dataOffset + 4, true);

    if (subchunkId === "data") {
      dataOffset += 8;
      dataSize = subchunkSize;
      break;
    }
    dataOffset += 8 + subchunkSize;
  }

  return {
    channels,
    sampleRate,
    bitsPerSample,
    pcmData: new Uint8Array(arrayBuffer, dataOffset, dataSize),
  };
}

function buildWavHeader(channels, sampleRate, bitsPerSample, dataSize) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // Chunk size
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  return new Uint8Array(header);
}

async function concatenateWavs(arrayBuffers) {
  if (!arrayBuffers || arrayBuffers.length === 0) {
    throw new Error("No WAV segments to concatenate");
  }

  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  const pcmParts = [];

  for (const buffer of arrayBuffers) {
    const header = parseWavHeader(buffer);
    if (!channels) {
      channels = header.channels;
      sampleRate = header.sampleRate;
      bitsPerSample = header.bitsPerSample;
    }
    pcmParts.push(header.pcmData);
  }

  // Concatenate PCM data
  const totalPcmSize = pcmParts.reduce((sum, part) => sum + part.byteLength, 0);
  const combinedPcm = new Uint8Array(totalPcmSize);
  let offset = 0;
  for (const part of pcmParts) {
    combinedPcm.set(part, offset);
    offset += part.byteLength;
  }

  // Build new WAV
  const header = buildWavHeader(channels, sampleRate, bitsPerSample, combinedPcm.byteLength);
  const wavBlob = new Blob([header, combinedPcm], { type: "audio/wav" });

  const bytesPerSample = bitsPerSample / 8;
  const totalFrames = combinedPcm.byteLength / (channels * bytesPerSample);
  const durationSeconds = totalFrames / sampleRate;

  return { blob: wavBlob, durationSeconds };
}

async function mapWithConcurrency(items, maxConcurrency, fn) {
  const results = [];
  const active = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then(
      result => {
        active.splice(active.indexOf(promise), 1);
        return result;
      }
    );
    results.push(promise);
    active.push(promise);

    if (active.length >= maxConcurrency) {
      await Promise.race(active);
    }
  }

  return Promise.all(results);
}

async function generatePodcast(transcript, language = "auto", onProgress = null) {
  const segments = await generatePodcastScript(transcript, language);
  if (!segments || segments.length === 0) {
    throw new Error("Podcast script generation returned no segments");
  }

  // Synthesize segments sequentially with 6s minimum spacing to respect 10 RPM rate limit
  const audioBuffers = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const voice = segment.speaker === "Host B" ? TTS_VOICE_HOST_B : TTS_VOICE_HOST_A;

    // Wait before each request (except the first) to respect rate limit: 60s / 10 requests = 6s minimum
    if (i > 0) {
      await sleep(6000);
    }

    const buffer = await synthesizeSegment(segment.text, voice);
    audioBuffers.push(buffer);

    if (onProgress) {
      onProgress(i + 1, segments.length);
    }
  }

  const { blob: audioBlob, durationSeconds } = await concatenateWavs(audioBuffers);

  return {
    segments,
    audioBlob,
    durationSeconds,
  };
}
