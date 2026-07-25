(function initRecorder() {
  const CHUNK_MS = 15000;

  const setupEl = document.getElementById("record-setup");
  const titleInput = document.getElementById("lecture-title");
  const languageSelect = document.getElementById("lecture-language");
  const recordBtn = document.getElementById("record-btn");
  const timerEl = document.getElementById("record-timer");
  const statusEl = document.getElementById("record-status");
  const liveTranscriptEl = document.getElementById("live-transcript");
  const stopSaveBtn = document.getElementById("stop-save-btn");
  const canvas = document.getElementById("waveform");
  const canvasCtx = canvas.getContext("2d");

  let lectureId = null;
  let stream = null;
  let audioCtx = null;
  let analyser = null;
  let recorder = null;
  let recording = false;
  let elapsedSeconds = 0;
  let timerInterval = null;
  let animationFrame = null;
  let mimeType = "audio/webm";
  let chunkIndex = 0;

  for (const candidate of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidate)) {
      mimeType = candidate;
      break;
    }
  }

  function formatTimer(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function drawWaveform() {
    if (!analyser) return;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "#5b3df0";
    canvasCtx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.stroke();
    animationFrame = requestAnimationFrame(drawWaveform);
  }

  function appendTranscript(text) {
    if (!text) return;
    const placeholder = liveTranscriptEl.querySelector(".transcript-placeholder");
    if (placeholder) placeholder.remove();
    const span = document.createElement("span");
    span.className = "transcript-chunk";
    span.textContent = text + " ";
    liveTranscriptEl.appendChild(span);
    liveTranscriptEl.scrollTop = liveTranscriptEl.scrollHeight;
  }

  function appendTranscriptWarning(message) {
    const span = document.createElement("span");
    span.className = "transcript-chunk";
    span.style.color = "#d3413f";
    span.textContent = `[${message}] `;
    liveTranscriptEl.appendChild(span);
    liveTranscriptEl.scrollTop = liveTranscriptEl.scrollHeight;
  }

  async function uploadChunk(blob) {
    const filename = `chunk-${chunkIndex}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
    chunkIndex += 1;
    try {
      const result = await Api.uploadChunk(lectureId, blob, filename);
      appendTranscript(result.new_text);
    } catch (err) {
      appendTranscriptWarning("chunk failed, continuing");
    }
  }

  function recordNextChunk() {
    if (!recording) return;
    const localChunks = [];
    recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) localChunks.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(localChunks, { type: mimeType });
      if (blob.size > 0) await uploadChunk(blob);
      if (recording) recordNextChunk();
    };
    recorder.start();
    setTimeout(() => {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }, CHUNK_MS);
  }

  async function startRecording() {
    const title = titleInput.value.trim() || "Untitled Lecture";
    const language = languageSelect.value;

    try {
      const lecture = await Api.createLecture(title, language);
      lectureId = lecture.id;
    } catch (err) {
      showErrorToast("Could not start lecture: " + err.message);
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      showErrorToast("Microphone access denied or unavailable.");
      return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    drawWaveform();

    recording = true;
    elapsedSeconds = 0;
    timerEl.textContent = formatTimer(0);
    timerInterval = setInterval(() => {
      elapsedSeconds += 1;
      timerEl.textContent = formatTimer(elapsedSeconds);
    }, 1000);

    setupEl.style.display = "none";
    recordBtn.classList.add("recording");
    recordBtn.setAttribute("aria-label", "Stop recording");
    statusEl.textContent = "Recording…";
    stopSaveBtn.disabled = false;

    recordNextChunk();
  }

  async function stopAndSave() {
    recording = false;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioCtx) audioCtx.close();
    if (timerInterval) clearInterval(timerInterval);
    if (animationFrame) cancelAnimationFrame(animationFrame);

    recordBtn.classList.remove("recording");
    statusEl.textContent = "Saving…";
    stopSaveBtn.disabled = true;

    if (lectureId) {
      try {
        await Api.updateLecture(lectureId, { status: "completed" });
      } catch (err) {
        showErrorToast("Could not mark lecture as completed: " + err.message);
      }
      window.location.href = `/lectures/${lectureId}`;
    }
  }

  recordBtn.addEventListener("click", () => {
    if (!recording) startRecording();
  });

  stopSaveBtn.addEventListener("click", () => {
    stopAndSave();
  });
})();
