const Api = {
  async request(path, options = {}) {
    const res = await fetch(path, options);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (_) {}
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  },

  listLectures() {
    return this.request("/api/lectures");
  },
  createLecture(title, language) {
    return this.request("/api/lectures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, language }),
    });
  },
  getLecture(id) {
    return this.request(`/api/lectures/${id}`);
  },
  updateLecture(id, payload) {
    return this.request(`/api/lectures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  deleteLecture(id) {
    return this.request(`/api/lectures/${id}`, { method: "DELETE" });
  },
  uploadChunk(id, blob, filename) {
    const form = new FormData();
    form.append("file", blob, filename);
    return this.request(`/api/lectures/${id}/audio-chunk`, { method: "POST", body: form });
  },
  generateSummary(id) {
    return this.request(`/api/lectures/${id}/generate-summary`, { method: "POST" });
  },
  generateFlashcards(id) {
    return this.request(`/api/lectures/${id}/generate-flashcards`, { method: "POST" });
  },
  generatePodcast(id) {
    return this.request(`/api/lectures/${id}/generate-podcast`, { method: "POST" });
  },
  getSummary(id) {
    return this.request(`/api/lectures/${id}/summary`);
  },
  getFlashcards(id) {
    return this.request(`/api/lectures/${id}/flashcards`);
  },
  rateFlashcard(lectureId, cardId, difficulty) {
    return this.request(`/api/lectures/${lectureId}/flashcards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty }),
    });
  },
  getPodcast(id) {
    return this.request(`/api/lectures/${id}/podcast`);
  },
};

function showErrorToast(message) {
  const existing = document.querySelector(".error-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "error-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
