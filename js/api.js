// API layer — wraps IndexedDB + groq-client
// Maintains the same method signatures for recorder.js, dashboard.js, lecture.js

const Api = {};

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function showErrorToast(message, type = "error") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === "success" ? "#10b981" : "#ef4444"};
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

if (!document.querySelector("style[data-toast]")) {
  const style = document.createElement("style");
  style.setAttribute("data-toast", "true");
  style.textContent = `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}

// Lecture CRUD
Api.listLectures = async () => {
  const lectures = await getAll("lectures");
  lectures.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return lectures.map(lecture => {
    const hasTranscript = lecture.transcript && lecture.transcript.trim().length > 0;
    return {
      ...lecture,
      created_at: formatDate(lecture.created_at),
      has_transcript: hasTranscript,
      has_summary: false,
      has_flashcards: false,
      has_podcast: false,
    };
  });
};

Api.createLecture = async (title, language) => {
  const lecture = {
    title,
    language,
    created_at: new Date().toISOString(),
    status: "recording",
    transcript: "",
  };
  const id = await add("lectures", lecture);
  return { id, ...lecture, created_at: formatDate(lecture.created_at) };
};

Api.getLecture = async (id) => {
  const lecture = await get("lectures", Number(id));
  if (!lecture) {
    const err = new Error("Lecture not found");
    err.status = 404;
    throw err;
  }

  const hasTranscript = lecture.transcript && lecture.transcript.trim().length > 0;
  const summary = await get("summaries", Number(id));
  const flashcards = await getAllByIndex("flashcards", "lecture_id", Number(id));
  const podcast = await get("podcasts", Number(id));

  return {
    ...lecture,
    created_at: formatDate(lecture.created_at),
    has_transcript: hasTranscript,
    has_summary: !!summary,
    has_flashcards: flashcards.length > 0,
    has_podcast: !!podcast,
  };
};

Api.updateLecture = async (id, payload) => {
  const lecture = await get("lectures", Number(id));
  if (!lecture) throw new Error("Lecture not found");

  const updated = { ...lecture };
  if (payload.title !== undefined) updated.title = payload.title;
  if (payload.status !== undefined) updated.status = payload.status;
  if (payload.transcript !== undefined) updated.transcript = payload.transcript;

  await put("lectures", updated);
  return updated;
};

Api.deleteLecture = async (id) => {
  const numId = Number(id);

  // Cascade delete: flashcards, summary, podcast
  await deleteByIndex("flashcards", "lecture_id", numId);
  await deleteRecord("summaries", numId);
  await deleteRecord("podcasts", numId);
  await deleteRecord("lectures", numId);
};

// Recording
Api.uploadChunk = async (lectureId, blob, filename) => {
  const lectureId_num = Number(lectureId);
  const lecture = await get("lectures", lectureId_num);
  if (!lecture) throw new Error("Lecture not found");

  const newText = await transcribeChunk(blob, filename, lecture.language);
  const separator = lecture.transcript && !lecture.transcript.endsWith(" ") ? " " : "";
  const updatedTranscript = lecture.transcript + separator + newText;

  lecture.transcript = updatedTranscript;
  await put("lectures", lecture);

  return {
    transcript: updatedTranscript,
    new_text: newText,
  };
};

// Summary
Api.generateSummary = async (lectureId) => {
  const lectureId_num = Number(lectureId);
  const lecture = await get("lectures", lectureId_num);
  if (!lecture) throw new Error("Lecture not found");

  if (!lecture.transcript || !lecture.transcript.trim()) {
    throw new Error("No transcript available for summary");
  }

  const content_md = await generateSummary(lecture.transcript, lecture.language);
  const summary = {
    lecture_id: lectureId_num,
    content_md,
    created_at: new Date().toISOString(),
  };

  await put("summaries", summary);
  return summary;
};

Api.getSummary = async (lectureId) => {
  const summary = await get("summaries", Number(lectureId));
  if (!summary) {
    const err = new Error("Summary not found");
    err.status = 404;
    throw err;
  }
  return summary;
};

// Flashcards
Api.generateFlashcards = async (lectureId) => {
  const lectureId_num = Number(lectureId);
  const lecture = await get("lectures", lectureId_num);
  if (!lecture) throw new Error("Lecture not found");

  if (!lecture.transcript || !lecture.transcript.trim()) {
    throw new Error("No transcript available for flashcards");
  }

  const cards = await generateFlashcards(lecture.transcript, lecture.language);

  // Delete existing flashcards for this lecture
  await deleteByIndex("flashcards", "lecture_id", lectureId_num);

  // Insert new ones
  const savedCards = [];
  for (let i = 0; i < cards.length; i++) {
    const card = {
      lecture_id: lectureId_num,
      question: cards[i].question,
      answer: cards[i].answer,
      position: i,
      difficulty: "new",
      created_at: new Date().toISOString(),
    };
    const id = await add("flashcards", card);
    savedCards.push({ id, ...card });
  }

  return { flashcards: savedCards };
};

Api.getFlashcards = async (lectureId) => {
  const flashcards = await getAllByIndex("flashcards", "lecture_id", Number(lectureId));
  flashcards.sort((a, b) => a.position - b.position);
  return flashcards;
};

Api.rateFlashcard = async (lectureId, cardId, difficulty) => {
  const validDifficulties = ["new", "know", "struggling", "forgot"];
  if (!validDifficulties.includes(difficulty)) {
    throw new Error(`Invalid difficulty: ${difficulty}`);
  }

  const card = await get("flashcards", Number(cardId));
  if (!card || card.lecture_id !== Number(lectureId)) {
    throw new Error("Flashcard not found");
  }

  card.difficulty = difficulty;
  await put("flashcards", card);
  return card;
};

// Podcast
Api.generatePodcast = async (lectureId, onProgress = null) => {
  const lectureId_num = Number(lectureId);
  const lecture = await get("lectures", lectureId_num);
  if (!lecture) throw new Error("Lecture not found");

  if (!lecture.transcript || !lecture.transcript.trim()) {
    throw new Error("No transcript available for podcast");
  }

  const { segments, audioBlob, durationSeconds } = await generatePodcast(lecture.transcript, lecture.language, onProgress);

  const podcast = {
    lecture_id: lectureId_num,
    segments,
    audio_blob: audioBlob,
    duration_seconds: durationSeconds,
    created_at: new Date().toISOString(),
  };

  await put("podcasts", podcast);

  return {
    segments,
    audio_url: URL.createObjectURL(audioBlob),
    duration_seconds: durationSeconds,
  };
};

Api.getPodcast = async (lectureId) => {
  const podcast = await get("podcasts", Number(lectureId));
  if (!podcast) {
    const err = new Error("Podcast not found");
    err.status = 404;
    throw err;
  }

  return {
    segments: podcast.segments,
    audio_url: URL.createObjectURL(podcast.audio_blob),
    duration_seconds: podcast.duration_seconds,
  };
};
