// Settings UI — API key management modal

function getApiKey() {
  return localStorage.getItem("groq_api_key");
}

function setApiKey(key) {
  if (key) {
    localStorage.setItem("groq_api_key", key.trim());
  }
}

function clearApiKey() {
  localStorage.removeItem("groq_api_key");
}

function createSettingsModal() {
  const modal = document.createElement("div");
  modal.className = "settings-modal-backdrop";
  modal.id = "settings-modal";
  modal.style.display = "none";

  const content = document.createElement("div");
  content.className = "settings-modal-content";

  const header = document.createElement("div");
  header.className = "settings-modal-header";
  header.innerHTML = '<h2>Settings</h2><button class="settings-modal-close">&times;</button>';

  const body = document.createElement("div");
  body.className = "settings-modal-body";

  const keyLabel = document.createElement("label");
  keyLabel.textContent = "Groq API Key";
  keyLabel.style.display = "block";
  keyLabel.style.marginBottom = "8px";
  keyLabel.style.fontWeight = "500";

  const keyInput = document.createElement("textarea");
  keyInput.id = "api-key-input";
  keyInput.placeholder = "sk-...";
  keyInput.style.width = "100%";
  keyInput.style.padding = "8px";
  keyInput.style.borderRadius = "4px";
  keyInput.style.border = "1px solid var(--border, #e7e3ef)";
  keyInput.style.fontFamily = "monospace";
  keyInput.style.fontSize = "12px";
  keyInput.style.marginBottom = "16px";
  keyInput.style.minHeight = "60px";
  keyInput.style.resize = "vertical";

  const existingKey = getApiKey();
  if (existingKey) {
    keyInput.value = existingKey;
  }

  const helpText = document.createElement("p");
  helpText.style.fontSize = "14px";
  helpText.style.color = "var(--text-muted, #6f6884)";
  helpText.style.marginBottom = "16px";
  helpText.innerHTML = `Get a free API key at <a href="https://console.groq.com/keys" target="_blank" style="color: var(--primary, #1e3a8a); text-decoration: underline;">console.groq.com/keys</a>. Your key is stored only in your browser's localStorage and used to call Groq's API directly from your browser.`;

  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "8px";
  buttonContainer.style.justifyContent = "flex-end";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.className = "btn btn-primary";
  saveBtn.onclick = () => {
    const key = keyInput.value.trim();
    if (!key) {
      showErrorToast("API key cannot be empty");
      return;
    }
    setApiKey(key);
    showErrorToast("API key saved", "success");
    closeSettingsModal();
  };

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.className = "btn btn-ghost";
  clearBtn.style.color = "#dc2626";
  clearBtn.onclick = () => {
    if (confirm("Clear the stored API key?")) {
      clearApiKey();
      keyInput.value = "";
      showErrorToast("API key cleared");
    }
  };

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "btn btn-ghost";
  closeBtn.onclick = closeSettingsModal;

  buttonContainer.appendChild(clearBtn);
  buttonContainer.appendChild(closeBtn);
  buttonContainer.appendChild(saveBtn);

  body.appendChild(keyLabel);
  body.appendChild(keyInput);
  body.appendChild(helpText);
  body.appendChild(buttonContainer);

  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);

  header.querySelector(".settings-modal-close").onclick = closeSettingsModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeSettingsModal();
  };

  return modal;
}

function openSettingsModal() {
  let modal = document.getElementById("settings-modal");
  if (!modal) {
    modal = createSettingsModal();
    document.body.appendChild(modal);
  }
  modal.style.display = "flex";
  const input = modal.querySelector("#api-key-input");
  if (input) input.focus();
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.style.display = "none";
}

function initSettingsUI() {
  // Create modal if not exists
  if (!document.getElementById("settings-modal")) {
    const modal = createSettingsModal();
    document.body.appendChild(modal);
  }

  // Wire up settings button on page (added to each HTML page's nav)
  const settingsBtn = document.querySelector("[data-action='open-settings']");
  if (settingsBtn) {
    settingsBtn.onclick = (e) => {
      e.preventDefault();
      openSettingsModal();
    };
  }

  // Show modal on first load if no key is set
  if (!getApiKey()) {
    openSettingsModal();
  }
}

// Add styles to the page
function addSettingsStyles() {
  if (document.getElementById("settings-styles")) return;

  const style = document.createElement("style");
  style.id = "settings-styles";
  style.textContent = `
    .settings-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .settings-modal-content {
      background: var(--surface, white);
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .settings-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid var(--border, #e7e3ef);
    }

    .settings-modal-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--text, #1f1a2e);
    }

    .settings-modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-muted, #6f6884);
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .settings-modal-close:hover {
      color: var(--text, #1f1a2e);
    }

    .settings-modal-body {
      padding: 24px;
    }
  `;
  document.head.appendChild(style);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    addSettingsStyles();
    initSettingsUI();
  });
} else {
  addSettingsStyles();
  initSettingsUI();
}
