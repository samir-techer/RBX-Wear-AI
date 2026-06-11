/**
 * RBXWear AI — script.js
 * Pure JS, no frameworks. Pollinations AI image generation.
 * Modular structure: Config → Utils → Toast → Modal → Generator → History → Init
 */

/* ============================================================
   1. CONFIG
   ============================================================ */
const CONFIG = {
  // Pollinations AI image endpoint — no API key required
  API_BASE:    'https://image.pollinations.ai/prompt/',
  // Image dimensions (square for quality, template overlay scales)
  IMG_WIDTH:   768,
  IMG_HEIGHT:  768,
  // Local storage key for generation history
  STORAGE_KEY: 'rbxwear_history',
  // Max items to persist in history
  MAX_HISTORY: 24,
  // Prompt max length
  MAX_CHARS:   500,
  // Loading copy rotation
  LOADING_MSGS: [
    'Painting fabric…',
    'Rendering threads…',
    'Applying style…',
    'Crafting graphic…',
    'Polishing details…',
    'Finalizing design…',
  ],
};

/* ============================================================
   2. UTILS
   ============================================================ */

/**
 * Sanitise a string for use in URLs — remove control chars.
 * We do NOT encode here; encodeURIComponent is applied at call site.
 */
function sanitise(str) {
  if (typeof str !== 'string') return '';
  // Strip tags and control chars
  return str.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Build the final composed prompt from user inputs.
 * Combines style, type, and user description.
 */
function buildPrompt(userPrompt, style, clothingType) {
  const safePrompt = sanitise(userPrompt);
  if (!safePrompt) return '';
  return `${style} Roblox ${clothingType.toLowerCase()} design, ${safePrompt}, high detail, clothing graphic, flat lay, seamless fabric print, game asset`;
}

/**
 * Build the Pollinations image URL.
 */
function buildImageURL(prompt) {
  const encoded = encodeURIComponent(prompt);
  return `${CONFIG.API_BASE}${encoded}?width=${CONFIG.IMG_WIDTH}&height=${CONFIG.IMG_HEIGHT}&nologo=true&seed=${Date.now()}`;
}

/**
 * Truncate a string with ellipsis.
 */
function truncate(str, max = 60) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * Format a timestamp to locale time string.
 */
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Download an image URL as a file.
 */
async function downloadImage(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch (err) {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

/* ============================================================
   3. TOAST NOTIFICATIONS
   ============================================================ */
const Toast = (() => {
  const container = document.getElementById('toast-container');

  function show(message, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<div class="toast-dot"></div><span>${message}</span>`;
    container.appendChild(el);

    const timer = setTimeout(() => remove(el), duration);

    el.addEventListener('click', () => {
      clearTimeout(timer);
      remove(el);
    });
  }

  function remove(el) {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  return { show };
})();

/* ============================================================
   4. ZOOM MODAL
   ============================================================ */
const Modal = (() => {
  const modal      = document.getElementById('zoom-modal');
  const backdrop   = document.getElementById('modal-backdrop');
  const closeBtn   = document.getElementById('modal-close');
  const zoomImg    = document.getElementById('zoom-image');
  const promptLbl  = document.getElementById('zoom-prompt-label');

  function open(src, prompt) {
    zoomImg.src = src;
    promptLbl.textContent = prompt || '';
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    // Clear src after transition to free memory
    setTimeout(() => { zoomImg.src = ''; }, 300);
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });

  return { open, close };
})();

/* ============================================================
   5. HISTORY
   ============================================================ */
const History = (() => {
  let items = [];

  /** Load from localStorage on init */
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }
    render();
  }

  /** Persist to localStorage */
  function save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(items.slice(0, CONFIG.MAX_HISTORY)));
    } catch (e) {
      // Storage quota exceeded — silently continue
    }
  }

  /** Add a new generation entry */
  function add(entry) {
    // entry: { id, imageUrl, userPrompt, fullPrompt, style, type, ts }
    items.unshift(entry);
    if (items.length > CONFIG.MAX_HISTORY) items.pop();
    save();
    render();
  }

  /** Remove an item by id */
  function remove(id) {
    items = items.filter(i => i.id !== id);
    save();
    render();
  }

  /** Clear all */
  function clear() {
    items = [];
    save();
    render();
  }

  /** Re-render the history grid */
  function render() {
    const grid  = document.getElementById('history-grid');
    const empty = document.getElementById('history-empty');

    // Remove all existing history items (keep empty placeholder)
    grid.querySelectorAll('.history-item').forEach(el => el.remove());

    if (items.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    items.forEach(item => {
      const el = buildCard(item);
      grid.appendChild(el);
    });
  }

  /** Build a single history card element */
  function buildCard(item) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.dataset.id = item.id;
    el.innerHTML = `
      <img class="history-thumb" src="${item.imageUrl}" alt="${item.userPrompt}" loading="lazy" />
      <div class="history-meta">
        <div class="history-prompt" title="${item.userPrompt}">${truncate(item.userPrompt, 40)}</div>
        <div class="history-tags">
          <span class="history-tag tag-style">${item.style}</span>
          <span class="history-tag tag-type">${item.type}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="history-btn regen" data-action="regen">↺ Reuse</button>
        <button class="history-btn"       data-action="zoom">⊕ View</button>
        <button class="history-btn"       data-action="dl">↓ DL</button>
        <button class="history-btn"       data-action="del">✕</button>
      </div>
    `;

    // Thumbnail click → zoom
    el.querySelector('.history-thumb').addEventListener('click', () => {
      Modal.open(item.imageUrl, item.fullPrompt);
    });

    // Action buttons
    el.querySelector('[data-action="regen"]').addEventListener('click', (e) => {
      e.stopPropagation();
      Generator.loadFromHistory(item);
      document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
    });

    el.querySelector('[data-action="zoom"]').addEventListener('click', (e) => {
      e.stopPropagation();
      Modal.open(item.imageUrl, item.fullPrompt);
    });

    el.querySelector('[data-action="dl"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const filename = `rbxwear-${item.style.toLowerCase()}-${item.type.toLowerCase()}-${item.id}.png`;
      await downloadImage(item.imageUrl, filename);
      Toast.show('Download started!', 'success');
    });

    el.querySelector('[data-action="del"]').addEventListener('click', (e) => {
      e.stopPropagation();
      remove(item.id);
      Toast.show('Removed from history', 'info');
    });

    return el;
  }

  // Clear history button
  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (items.length === 0) { Toast.show('History is already empty', 'info'); return; }
    if (confirm('Clear all generation history?')) {
      clear();
      Toast.show('History cleared', 'info');
    }
  });

  return { load, add, clear };
})();

/* ============================================================
   6. GENERATOR
   ============================================================ */
const Generator = (() => {
  /* --- State --- */
  let currentImageUrl  = null;
  let currentPromptFull = null;
  let currentUserPrompt = null;
  let currentStyle      = null;
  let currentType       = 'Shirt';
  let isGenerating      = false;
  let loadingInterval   = null;

  /* --- DOM refs --- */
  const promptInput    = document.getElementById('prompt-input');
  const promptCounter  = document.getElementById('prompt-counter');
  const styleSelect    = document.getElementById('style-select');
  const typeShirt      = document.getElementById('type-shirt');
  const typeHoodie     = document.getElementById('type-hoodie');
  const previewText    = document.getElementById('preview-text');
  const generateBtn    = document.getElementById('generate-btn');
  const regenBtn       = document.getElementById('regen-btn');
  const copyPromptBtn  = document.getElementById('copy-prompt-btn');
  const downloadBtn    = document.getElementById('download-btn');
  const zoomBtn        = document.getElementById('zoom-btn');
  const previewActions = document.getElementById('preview-actions');
  const templateToggle = document.getElementById('template-toggle');
  const templateMode   = document.getElementById('template-mode');
  const templateOverlay= document.getElementById('template-overlay');

  const previewIdle    = document.getElementById('preview-idle');
  const previewLoading = document.getElementById('preview-loading');
  const previewResult  = document.getElementById('preview-result');
  const resultImage    = document.getElementById('result-image');
  const loadingSub     = document.getElementById('loading-sub');

  /* --- Clothing type toggle --- */
  [typeShirt, typeHoodie].forEach(btn => {
    btn.addEventListener('click', () => {
      [typeShirt, typeHoodie].forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentType = btn.dataset.type;
      updatePromptPreview();
    });
  });

  /* --- Char counter & prompt preview --- */
  promptInput.addEventListener('input', () => {
    const len = promptInput.value.length;
    promptCounter.textContent = `${len} / ${CONFIG.MAX_CHARS}`;
    promptCounter.classList.toggle('warn', len > CONFIG.MAX_CHARS * 0.85);
    updatePromptPreview();
  });
  styleSelect.addEventListener('change', updatePromptPreview);

  function updatePromptPreview() {
    const userText = promptInput.value.trim();
    const style    = styleSelect.value;
    if (!userText) {
      previewText.textContent = 'Fill in the fields above to see your composed prompt';
      previewText.classList.remove('has-value');
      return;
    }
    const full = buildPrompt(userText, style, currentType);
    previewText.textContent = full;
    previewText.classList.add('has-value');
  }

  /* --- Copy prompt --- */
  copyPromptBtn.addEventListener('click', () => {
    const text = promptInput.value.trim();
    if (!text) { Toast.show('Nothing to copy yet', 'info'); return; }
    navigator.clipboard.writeText(text)
      .then(() => Toast.show('Prompt copied!', 'success'))
      .catch(() => Toast.show('Copy failed — try manually', 'error'));
  });

  /* --- Generate --- */
  generateBtn.addEventListener('click', () => generate());
  regenBtn.addEventListener('click',    () => generate());

  async function generate(overridePrompt = null, overrideStyle = null, overrideType = null) {
    if (isGenerating) return;

    const userPrompt  = sanitise(overridePrompt  ?? promptInput.value);
    const style       = overrideStyle ?? styleSelect.value;
    const clothingType= overrideType  ?? currentType;

    /* Validation */
    if (!userPrompt) {
      Toast.show('Please enter a design description', 'error');
      promptInput.focus();
      return;
    }
    if (userPrompt.length > CONFIG.MAX_CHARS) {
      Toast.show('Prompt is too long — please shorten it', 'error');
      return;
    }

    const fullPrompt = buildPrompt(userPrompt, style, clothingType);
    const imageUrl   = buildImageURL(fullPrompt);

    /* Set loading state */
    isGenerating = true;
    setUIState('loading');
    startLoadingMessages();

    try {
      /* Pre-load image to catch errors */
      await loadImage(imageUrl);

      /* Success */
      currentImageUrl   = imageUrl;
      currentPromptFull = fullPrompt;
      currentUserPrompt = userPrompt;
      currentStyle      = style;

      resultImage.src = imageUrl;
      setUIState('result');
      regenBtn.disabled = false;

      Toast.show('Design generated!', 'success');

      /* Persist to history */
      History.add({
        id:         Date.now().toString(36),
        imageUrl,
        userPrompt,
        fullPrompt,
        style,
        type:       clothingType,
        ts:         Date.now(),
      });

    } catch (err) {
      console.error('[RBXWear] Generation error:', err);
      Toast.show('Generation failed — check your connection and try again', 'error');
      setUIState('idle');
    } finally {
      isGenerating = false;
      stopLoadingMessages();
    }
  }

  /** Promise-based image pre-loader */
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
  }

  /** Rotate loading sub-messages */
  function startLoadingMessages() {
    let i = 0;
    loadingSub.textContent = CONFIG.LOADING_MSGS[0];
    loadingInterval = setInterval(() => {
      i = (i + 1) % CONFIG.LOADING_MSGS.length;
      loadingSub.textContent = CONFIG.LOADING_MSGS[i];
    }, 2200);
  }
  function stopLoadingMessages() {
    clearInterval(loadingInterval);
  }

  /** Switch between idle / loading / result UI states */
  function setUIState(state) {
    previewIdle.style.display    = state === 'idle'    ? '' : 'none';
    previewLoading.style.display = state === 'loading' ? 'flex' : 'none';
    previewResult.style.display  = state === 'result'  ? '' : 'none';

    generateBtn.disabled = state === 'loading';
    generateBtn.classList.toggle('loading', state === 'loading');

    previewActions.style.display  = state === 'result' ? '' : 'none';
    templateToggle.style.display  = state === 'result' ? '' : 'none';

    if (state !== 'result') {
      templateMode.checked = false;
      templateOverlay.classList.remove('visible');
    }
  }

  /* --- Download --- */
  downloadBtn.addEventListener('click', async () => {
    if (!currentImageUrl) return;
    const safe = (currentUserPrompt || 'design').replace(/[^a-z0-9]/gi, '-').slice(0, 30).toLowerCase();
    const filename = `rbxwear-${safe}-${Date.now()}.png`;
    await downloadImage(currentImageUrl, filename);
    Toast.show('Download started!', 'success');
  });

  /* --- Zoom --- */
  zoomBtn.addEventListener('click', () => {
    if (currentImageUrl) Modal.open(currentImageUrl, currentPromptFull);
  });

  /* --- Template overlay --- */
  templateMode.addEventListener('change', () => {
    templateOverlay.classList.toggle('visible', templateMode.checked);
    Toast.show(
      templateMode.checked ? 'Template overlay on' : 'Template overlay off',
      'info',
      1800
    );
  });

  /* --- Load a history item back into the generator --- */
  function loadFromHistory(item) {
    promptInput.value = item.userPrompt;
    promptCounter.textContent = `${item.userPrompt.length} / ${CONFIG.MAX_CHARS}`;

    // Match style
    styleSelect.value = item.style;

    // Match type buttons
    currentType = item.type;
    [typeShirt, typeHoodie].forEach(btn => {
      const match = btn.dataset.type === item.type;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    });

    updatePromptPreview();

    // Directly generate
    generate(item.userPrompt, item.style, item.type);
  }

  return { loadFromHistory };
})();

/* ============================================================
   7. SMOOTH SCROLL — nav links
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ============================================================
   8. INIT
   ============================================================ */
(function init() {
  History.load();
})();
