(async function initDashboard() {
  const listEl = document.getElementById("lecture-list");
  const cardTemplate = document.getElementById("lecture-card-template");
  const emptyTemplate = document.getElementById("empty-state-template");

  let lectures;
  try {
    lectures = await Api.listLectures();
  } catch (err) {
    listEl.innerHTML = "";
    showErrorToast("Could not load lectures: " + err.message);
    return;
  }

  listEl.innerHTML = "";

  if (!lectures.length) {
    listEl.appendChild(emptyTemplate.content.cloneNode(true));
    return;
  }

  for (const lecture of lectures) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".lecture-card");
    card.href = `./lecture.html?id=${lecture.id}`;

    const badge = node.querySelector(".status-badge");
    badge.textContent = lecture.status === "recording" ? "Recording" : "Completed";
    badge.classList.toggle("recording", lecture.status === "recording");

    node.querySelector(".lecture-title").textContent = lecture.title;
    node.querySelector(".lecture-date").textContent = formatDate(lecture.created_at);

    node.querySelector('[data-key="transcript"]').classList.toggle("active", lecture.has_transcript);
    node.querySelector('[data-key="summary"]').classList.toggle("active", lecture.has_summary);
    node.querySelector('[data-key="flashcards"]').classList.toggle("active", lecture.has_flashcards);
    node.querySelector('[data-key="podcast"]').classList.toggle("active", lecture.has_podcast);

    const deleteBtn = node.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm(`Delete "${lecture.title}"? This cannot be undone.`)) return;
      try {
        await Api.deleteLecture(lecture.id);
        card.remove();
        if (!listEl.querySelector(".lecture-card")) {
          listEl.appendChild(emptyTemplate.content.cloneNode(true));
        }
      } catch (err) {
        showErrorToast("Could not delete lecture: " + err.message);
      }
    });

    listEl.appendChild(node);
  }
})();
