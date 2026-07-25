(function initLectureDetail() {
  const lectureId = new URLSearchParams(window.location.search).get("id");
  if (!lectureId) {
    window.location.href = "./index.html";
    return;
  }

  const root = document.querySelector(".lecture-detail");

  const titleInput = document.getElementById("detail-title");
  const metaEl = document.getElementById("detail-meta");
  const transcriptTextEl = document.getElementById("transcript-text");
  const copyBtn = document.getElementById("copy-transcript-btn");

  const summaryBtn = document.getElementById("generate-summary-btn");
  const summaryLoading = document.getElementById("summary-loading");
  const summaryContent = document.getElementById("summary-content");

  const flashcardsBtn = document.getElementById("generate-flashcards-btn");
  const flashcardsLoading = document.getElementById("flashcards-loading");
  const flashcardsDeck = document.getElementById("flashcards-deck");
  const flashcardTemplate = document.getElementById("flashcard-template");

  const podcastBtn = document.getElementById("generate-podcast-btn");
  const podcastLoading = document.getElementById("podcast-loading");
  const podcastProgressText = document.getElementById("podcast-progress-text");
  const podcastContent = document.getElementById("podcast-content");

  let currentCards = [];
  let currentCardIndex = 0;

  // ---- Tabs ----
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
      btn.classList.add("active");
      document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).hidden = false;
    });
  });

  // ---- Tiny markdown-subset renderer (headings, bullets, bold) ----
  function renderMarkdown(md) {
    const lines = md.split("\n");
    let html = "";
    let inList = false;
    for (let line of lines) {
      line = line.trim();
      if (!line) {
        if (inList) { html += "</ul>"; inList = false; }
        continue;
      }
      const bolded = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (bolded.startsWith("### ")) {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<h3>${bolded.slice(4)}</h3>`;
      } else if (bolded.startsWith("## ")) {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<h2>${bolded.slice(3)}</h2>`;
      } else if (bolded.startsWith("- ")) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${bolded.slice(2)}</li>`;
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<p>${bolded}</p>`;
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  // ---- Load lecture ----
  async function loadLecture() {
    let lecture;
    try {
      lecture = await Api.getLecture(lectureId);
    } catch (err) {
      showErrorToast("Could not load lecture: " + err.message);
      return;
    }

    titleInput.value = lecture.title;
    metaEl.textContent = `${formatDate(lecture.created_at)} · ${lecture.status === "recording" ? "Recording" : "Completed"}`;
    transcriptTextEl.value = lecture.transcript || "";

    if (lecture.has_summary) {
      const summary = await Api.getSummary(lectureId);
      summaryContent.innerHTML = renderMarkdown(summary.content_md);
      summaryBtn.textContent = "Regenerate Summary";
    }
    if (lecture.has_flashcards) {
      const data = await Api.getFlashcards(lectureId);
      renderFlashcards(data.flashcards);
      flashcardsBtn.textContent = "Regenerate Flashcards";
    }
    if (lecture.has_podcast) {
      const podcast = await Api.getPodcast(lectureId);
      renderPodcast(podcast);
      podcastBtn.textContent = "Regenerate Podcast";
    }
  }

  titleInput.addEventListener("blur", async () => {
    const title = titleInput.value.trim() || "Untitled Lecture";
    try {
      await Api.updateLecture(lectureId, { title });
    } catch (err) {
      showErrorToast("Could not rename lecture: " + err.message);
    }
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(transcriptTextEl.value);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy transcript"), 1500);
    } catch (_) {
      showErrorToast("Could not copy to clipboard.");
    }
  });

  transcriptTextEl.addEventListener("blur", async () => {
    const transcript = transcriptTextEl.value.trim();
    if (transcript === "") return;
    try {
      await Api.updateLecture(lectureId, { transcript });
    } catch (err) {
      showErrorToast("Could not save transcript: " + err.message);
    }
  });

  // ---- Summary ----
  summaryBtn.addEventListener("click", async () => {
    summaryBtn.disabled = true;
    summaryLoading.hidden = false;
    try {
      const result = await Api.generateSummary(lectureId);
      summaryContent.innerHTML = renderMarkdown(result.content_md);
      summaryBtn.textContent = "Regenerate Summary";
    } catch (err) {
      showErrorToast("Summary generation failed: " + err.message);
    } finally {
      summaryBtn.disabled = false;
      summaryLoading.hidden = true;
    }
  });

  // ---- Flashcards ----
  function sortFlashcards(cards) {
    const difficultyOrder = { forgot: 0, struggling: 1, new: 2, know: 3 };
    return [...cards].sort((a, b) => {
      const aOrder = difficultyOrder[a.difficulty] ?? 2;
      const bOrder = difficultyOrder[b.difficulty] ?? 2;
      return aOrder - bOrder;
    });
  }

  function renderFlashcards(cards) {
    currentCards = sortFlashcards(cards);
    currentCardIndex = 0;
    flashcardsDeck.innerHTML = "";
    if (!cards.length) {
      flashcardsDeck.textContent = "No flashcards generated.";
      return;
    }

    const card = flashcardTemplate.content.cloneNode(true);
    flashcardsDeck.appendChild(card);

    const nav = document.createElement("div");
    nav.className = "flashcard-nav";
    nav.innerHTML = `
      <button class="btn btn-ghost" id="prev-card-btn" type="button">‹ Prev</button>
      <span class="flashcard-counter" id="card-counter"></span>
      <button class="btn btn-ghost" id="next-card-btn" type="button">Next ›</button>
    `;
    flashcardsDeck.appendChild(nav);

    updateCardView();

    const flashcardNode = flashcardsDeck.querySelector(".flashcard");
    flashcardNode.addEventListener("click", () => {
      flashcardNode.classList.toggle("flipped");
      if (flashcardNode.classList.contains("flipped")) {
        const ratingRow = flashcardNode.querySelector(".flashcard-rating-row");
        if (ratingRow) ratingRow.hidden = false;
      }
    });

    const ratingBtns = flashcardNode.querySelectorAll(".flashcard-rating-btn");
    ratingBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const difficulty = btn.dataset.rating;
        const card = currentCards[currentCardIndex];

        // Give immediate visual feedback that the click registered, and lock
        // out the other options, before the card advances.
        ratingBtns.forEach((b) => (b.disabled = true));
        btn.classList.add("selected");

        try {
          await Api.rateFlashcard(lectureId, card.id, difficulty);
          card.difficulty = difficulty;
          await new Promise((resolve) => setTimeout(resolve, 300));
          showCard(currentCardIndex + 1);
        } catch (err) {
          showErrorToast("Failed to rate card: " + err.message);
          btn.classList.remove("selected");
          ratingBtns.forEach((b) => (b.disabled = false));
        }
      });
    });

    let touchStartX = null;
    flashcardNode.addEventListener("touchstart", (e) => (touchStartX = e.touches[0].clientX));
    flashcardNode.addEventListener("touchend", (e) => {
      if (touchStartX === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 50) {
        if (delta < 0) showCard(currentCardIndex + 1);
        else showCard(currentCardIndex - 1);
      }
      touchStartX = null;
    });

    document.getElementById("prev-card-btn").addEventListener("click", () => showCard(currentCardIndex - 1));
    document.getElementById("next-card-btn").addEventListener("click", () => showCard(currentCardIndex + 1));
  }

  function showCard(index) {
    if (index < 0 || index >= currentCards.length) return;
    currentCardIndex = index;
    updateCardView();
  }

  function updateCardView() {
    const flashcardNode = flashcardsDeck.querySelector(".flashcard");
    if (!flashcardNode) return;
    flashcardNode.classList.remove("flipped");
    const ratingRow = flashcardNode.querySelector(".flashcard-rating-row");
    if (ratingRow) ratingRow.hidden = true;
    flashcardNode.querySelectorAll(".flashcard-rating-btn").forEach((b) => {
      b.classList.remove("selected");
      b.disabled = false;
    });

    const front = flashcardNode.querySelector(".flashcard-front");
    const answer = flashcardNode.querySelector(".flashcard-answer");
    const card = currentCards[currentCardIndex];

    front.textContent = card.question;
    answer.textContent = card.answer;

    const counter = document.getElementById("card-counter");
    if (counter) counter.textContent = `${currentCardIndex + 1} / ${currentCards.length}`;
  }

  flashcardsBtn.addEventListener("click", async () => {
    flashcardsBtn.disabled = true;
    flashcardsLoading.hidden = false;
    try {
      const result = await Api.generateFlashcards(lectureId);
      renderFlashcards(result.flashcards);
      flashcardsBtn.textContent = "Regenerate Flashcards";
    } catch (err) {
      showErrorToast("Flashcard generation failed: " + err.message);
    } finally {
      flashcardsBtn.disabled = false;
      flashcardsLoading.hidden = true;
    }
  });

  // ---- Podcast ----
  function renderPodcast(podcast, audioErrorMessage = null) {
    podcastContent.innerHTML = "";

    if (podcast.audio_url) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = podcast.audio_url;
      podcastContent.appendChild(audio);
    } else {
      const notice = document.createElement("p");
      notice.className = "podcast-audio-unavailable";
      notice.textContent = audioErrorMessage
        ? `Audio narration unavailable: ${audioErrorMessage}`
        : "Audio narration unavailable — script only.";
      podcastContent.appendChild(notice);
    }

    const scriptEl = document.createElement("div");
    scriptEl.className = "podcast-script";
    for (const seg of podcast.segments) {
      const line = document.createElement("p");
      line.className = "podcast-line";
      line.innerHTML = `<span class="podcast-speaker">${seg.speaker}:</span>${seg.text}`;
      scriptEl.appendChild(line);
    }
    podcastContent.appendChild(scriptEl);
  }

  podcastBtn.addEventListener("click", async () => {
    podcastBtn.disabled = true;
    podcastLoading.hidden = false;
    podcastProgressText.hidden = false;
    try {
      const result = await Api.generatePodcast(lectureId, (current, total) => {
        podcastProgressText.textContent = `Synthesizing voice ${current} of ${total}… this can take a minute or two.`;
      });
      renderPodcast(result);
      podcastBtn.textContent = "Regenerate Podcast";
      podcastProgressText.hidden = true;
    } catch (err) {
      if (err.audioFailed && err.segments) {
        renderPodcast({ segments: err.segments, audio_url: null }, err.message);
        podcastBtn.textContent = "Regenerate Podcast";
        showErrorToast("Script generated, but audio narration failed: " + err.message);
      } else {
        showErrorToast("Podcast generation failed: " + err.message);
      }
      podcastProgressText.hidden = true;
    } finally {
      podcastBtn.disabled = false;
      podcastLoading.hidden = true;
    }
  });

  loadLecture();
})();
