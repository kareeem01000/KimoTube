/* ============================================
   KimoTube - UI Management
   ============================================ */

const KimoUI = (() => {
  const elements = {};
  let activeFormatFilter = 'all';

  function cacheElements() {
    Object.assign(elements, {
      urlInput: document.getElementById('urlInput'),
      analyzeBtn: document.getElementById('analyzeBtn'),
      pasteBtn: document.getElementById('pasteBtn'),
      clearBtn: document.getElementById('clearBtn'),
      statusMsg: document.getElementById('statusMsg'),
      loadingSection: document.getElementById('loadingSection'),
      resultsSection: document.getElementById('resultsSection'),
      videoCard: document.getElementById('videoCard'),
      downloadSection: document.getElementById('downloadSection'),
      downloadList: document.getElementById('downloadList'),
      downloadCount: document.getElementById('downloadCount'),
      formatFilters: document.getElementById('formatFilters'),
      playlistSection: document.getElementById('playlistSection'),
      themeToggle: document.getElementById('themeToggle'),
      heroSection: document.getElementById('heroSection'),
      examples: document.querySelectorAll('.example-btn'),
      inputHint: document.querySelector('.input-hint'),
      toastContainer: document.getElementById('toastContainer')
    });
  }

  function init() {
    try {
      cacheElements();
      bindEvents();
      loadTheme();
      updateThemeIcon();
      setupKeyboardShortcuts();
      setupPasteDetection();
      setupScrollEffects();
      setupServiceWorker();
    } catch (e) {
      console.error('[KimoTube] Init error:', e);
    }
  }

  function bindEvents() {
    if (elements.analyzeBtn) {
      elements.analyzeBtn.addEventListener('click', handleAnalyze);
    }
    if (elements.pasteBtn) {
      elements.pasteBtn.addEventListener('click', handlePaste);
    }
    if (elements.clearBtn) {
      elements.clearBtn.addEventListener('click', handleClear);
    }
    if (elements.themeToggle) {
      elements.themeToggle.addEventListener('click', toggleTheme);
    }
    if (elements.urlInput) {
      elements.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleAnalyze();
        }
      });
      elements.urlInput.addEventListener('input', () => {
        hideStatus();
      });
    }
    if (elements.examples) {
      elements.examples.forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.dataset.url;
          if (url && elements.urlInput) {
            elements.urlInput.value = url;
            elements.urlInput.focus();
            handleAnalyze();
          }
        });
      });
    }
    document.addEventListener('click', (e) => {
      const downloadBtn = e.target.closest('.download-btn');
      if (downloadBtn) {
        e.preventDefault();
        const url = downloadBtn.dataset.url;
        const quality = downloadBtn.dataset.quality;
        window.KimoDownload.triggerDownload(url, quality);
      }
      const thumbBtn = e.target.closest('[data-thumb-action]');
      if (thumbBtn) {
        const action = thumbBtn.dataset.thumbAction;
        const thumbUrl = thumbBtn.dataset.thumbUrl;
        if (action && thumbUrl) {
          handleThumbnailAction(action, thumbUrl);
        }
      }
      const playlistItem = e.target.closest('.playlist-item');
      if (playlistItem) {
        const url = playlistItem.dataset.url;
        if (url && elements.urlInput) {
          elements.urlInput.value = url;
          elements.urlInput.focus();
          handleAnalyze();
        }
      }
    });
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        setTimeout(() => {
          if (elements.urlInput && elements.urlInput.value.trim()) {
            handleAnalyze();
          }
        }, 100);
      }
      if (e.key === 'Escape') {
        handleClear();
      }
      if (e.key === 't' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        toggleTheme();
      }
    });
  }

  function setupPasteDetection() {
    if (!elements.urlInput) return;
    elements.urlInput.addEventListener('paste', () => {
      setTimeout(() => {
        if (elements.urlInput.value.trim()) {
          elements.analyzeBtn.focus();
        }
      }, 50);
    });
  }

  function setupScrollEffects() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    window.addEventListener('scroll', window.KimoUtils.throttle(() => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, 100));
  }

  function setupServiceWorker() {
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem('kimotube-theme');
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        return;
      }
    } catch (e) {}
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('kimotube-theme', next); } catch (e) {}
    updateThemeIcon();
    showToast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  }

  function updateThemeIcon() {
    const icon = elements.themeToggle?.querySelector('.material-symbols-outlined');
    if (!icon) return;
    const theme = document.documentElement.getAttribute('data-theme');
    icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  let isAnalyzing = false;

  function handleAnalyze() {
    if (isAnalyzing) return;
    if (!elements.urlInput) return;
    const url = window.KimoUtils.sanitizeInput(elements.urlInput.value.trim());
    if (!url) {
      showStatus('Please enter a YouTube URL', 'error');
      elements.urlInput.focus();
      return;
    }
    if (!window.KimoUtils.isValidYouTubeUrl(url)) {
      showStatus('Invalid YouTube URL. Paste a valid YouTube link', 'error');
      elements.urlInput.focus();
      return;
    }
    isAnalyzing = true;
    hideStatus();
    showLoading('Connecting to API...');
    clearResults();

    const event = new CustomEvent('kimotube:analyze', { detail: { url } });
    document.dispatchEvent(event);
  }

  function handlePaste() {
    if (!elements.urlInput) return;
    navigator.clipboard.readText().then(text => {
      if (text) {
        elements.urlInput.value = text;
        elements.urlInput.focus();
      }
    }).catch(() => {
      elements.urlInput.focus();
      document.execCommand('paste');
    });
  }

  function handleClear() {
    if (!elements.urlInput) return;
    elements.urlInput.value = '';
    elements.urlInput.focus();
    hideStatus();
    clearResults();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    elements.heroSection?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleThumbnailAction(action, url) {
    switch (action) {
      case 'download':
        window.KimoDownload.downloadFile(url, 'thumbnail.jpg');
        break;
      case 'open':
        window.open(url, '_blank');
        break;
      case 'copy':
        window.KimoUtils.copyToClipboard(url).then(() => {
          showToast('Thumbnail URL copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Failed to copy URL', 'error');
        });
        break;
    }
  }

  function showLoading(msg) {
    if (!elements.loadingSection) return;
    elements.loadingSection.classList.add('show');
    const loadingText = elements.loadingSection.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = msg || 'Fetching video information...';
    if (elements.analyzeBtn) {
      elements.analyzeBtn.disabled = true;
      elements.analyzeBtn.innerHTML = '<span class="spinner-sm"></span> Processing...';
    }
  }

  function hideLoading() {
    isAnalyzing = false;
    if (!elements.loadingSection) return;
    elements.loadingSection.classList.remove('show');
    if (elements.analyzeBtn) {
      elements.analyzeBtn.disabled = false;
      elements.analyzeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px">search</span> Analyze';
    }
  }

  function showStatus(message, type = 'info') {
    if (!elements.statusMsg) return;
    elements.statusMsg.textContent = message;
    elements.statusMsg.className = `status-message show ${type}`;
  }

  function hideStatus() {
    if (!elements.statusMsg) return;
    elements.statusMsg.classList.remove('show');
    elements.statusMsg.textContent = '';
  }

  function clearResults() {
    if (elements.resultsSection) elements.resultsSection.classList.remove('show');
    if (elements.videoCard) elements.videoCard.innerHTML = '';
    if (elements.downloadList) elements.downloadList.innerHTML = '';
    if (elements.playlistSection) elements.playlistSection.classList.remove('show');
    if (elements.playlistSection) elements.playlistSection.innerHTML = '';
    if (elements.formatFilters) elements.formatFilters.innerHTML = '';
  }

  function renderVideoInfo(info) {
    if (!elements.videoCard || !elements.resultsSection) return;

    const isShort = info.isShort || window.KimoUtils.isShortsUrl(info.sourceUrl || '');
    const durationFormatted = window.KimoUtils.formatDuration(info.duration);
    const viewsFormatted = window.KimoUtils.formatNumber(info.views);
    const dateFormatted = window.KimoUtils.formatDate(info.uploadDate);
    const title = window.KimoUtils.escapeHtml(info.title || 'YouTube Video');
    const author = window.KimoUtils.escapeHtml(info.author || 'Unknown');
    const desc = window.KimoUtils.escapeHtml(info.description || '');
    const isDemo = info._demo === true;

    elements.videoCard.innerHTML = `
      <div class="video-card-header">
        <img class="video-thumbnail" src="${info.thumbnail || ''}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/480x360/1a1a2e/e8e8f0?text=No+Thumbnail'">
        <div class="video-badges">
          ${isDemo ? '<span class="badge" style="background:rgba(255,167,38,0.9);color:#fff">Demo</span>' : ''}
          ${isShort ? '<span class="badge badge-shorts">#Shorts</span>' : ''}
          ${durationFormatted !== '00:00' ? `<span class="badge badge-duration">${durationFormatted}</span>` : ''}
        </div>
      </div>
      <div class="video-card-body">
        <h2 class="video-title">${title}</h2>
        <div class="video-meta">
          <span class="video-meta-item">
            <span class="material-symbols-outlined">channel</span>
            ${author}
          </span>
          ${info.views ? `<span class="video-meta-item"><span class="material-symbols-outlined">visibility</span> ${viewsFormatted} views</span>` : ''}
          ${info.uploadDate ? `<span class="video-meta-item"><span class="material-symbols-outlined">calendar_today</span> ${dateFormatted}</span>` : ''}
          ${info.duration ? `<span class="video-meta-item"><span class="material-symbols-outlined">schedule</span> ${durationFormatted}</span>` : ''}
        </div>
        ${desc ? `<p class="video-description">${desc}</p>` : ''}
        ${isDemo ? '<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:rgba(255,167,38,0.1);border:1px solid rgba(255,167,38,0.2);font-size:13px;color:var(--text-secondary)"> Demo mode: downloads are simulated. Deploy to a server or configure a real API for actual downloads.</div>' : ''}
        <div class="thumbnail-actions">
          <button class="btn-secondary" data-thumb-action="download" data-thumb-url="${window.KimoUtils.getYouTubeThumbnail(info.videoId, 'maxres')}">
            <span class="material-symbols-outlined" style="font-size:18px">download</span> HD Thumbnail
          </button>
          <button class="btn-secondary" data-thumb-action="open" data-thumb-url="${window.KimoUtils.getYouTubeThumbnail(info.videoId, 'maxres')}">
            <span class="material-symbols-outlined" style="font-size:18px">open_in_new</span> Open
          </button>
          <button class="btn-secondary" data-thumb-action="copy" data-thumb-url="${window.KimoUtils.getYouTubeThumbnail(info.videoId, 'maxres')}">
            <span class="material-symbols-outlined" style="font-size:18px">content_copy</span> Copy URL
          </button>
        </div>
      </div>
    `;

    elements.resultsSection.classList.add('show');
    elements.videoCard.classList.add('scale-in');
  }

  function renderFormats(formats) {
    if (!elements.downloadList || !elements.formatFilters) return;

    const extensions = [...new Set(formats.map(f => f.extension))];

    elements.formatFilters.innerHTML = `
      <button class="filter-btn active" data-filter="all">All</button>
      ${extensions.map(ext => `<button class="filter-btn" data-filter="${ext}">${ext.toUpperCase()}</button>`).join('')}
      <button class="filter-btn" data-filter="audio">Audio</button>
    `;

    elements.formatFilters.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        elements.formatFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFormatFilter = btn.dataset.filter;
        renderFormatList(formats);
      });
    });

    activeFormatFilter = 'all';
    renderFormatList(formats);
  }

  function renderFormatList(formats) {
    if (!elements.downloadList) return;

    let filtered = formats;
    if (activeFormatFilter !== 'all') {
      if (activeFormatFilter === 'audio') {
        filtered = formats.filter(f => f.extension === 'mp3' || f.extension === 'm4a' || f.note === 'Audio Only');
      } else {
        filtered = formats.filter(f => f.extension === activeFormatFilter);
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      const qA = parseInt(a.quality);
      const qB = parseInt(b.quality);
      if (!isNaN(qA) && !isNaN(qB)) return qB - qA;
      return 0;
    });

    if (sorted.length === 0) {
      elements.downloadList.innerHTML = '<div class="empty-state">No formats available for this filter.</div>';
      if (elements.downloadCount) elements.downloadCount.textContent = '0 formats';
      return;
    }

    if (elements.downloadCount) elements.downloadCount.textContent = `${sorted.length} formats`;

    elements.downloadList.innerHTML = sorted.map((fmt, i) => {
      const sizeFormatted = window.KimoUtils.formatFileSize(fmt.size);
      const quality = window.KimoUtils.escapeHtml(fmt.quality);
      const ext = window.KimoUtils.escapeHtml(fmt.extension);
      const downloadUrl = window.KimoUtils.escapeHtml(fmt.url);

      return `
        <div class="download-item fade-in stagger-${(i % 8) + 1}" style="animation-delay:${i * 0.05}s">
          <div class="download-item-info">
            <span class="download-quality">${quality}</span>
            <span class="download-extension">${ext}</span>
            <div class="download-tags">
              ${fmt.size && fmt.size > 0 ? `<span class="download-tag">${sizeFormatted}</span>` : ''}
              ${fmt.hasAudio ? '<span class="download-tag">Audio ✓</span>' : '<span class="download-tag">Video Only</span>'}
              ${fmt.fps > 30 ? `<span class="download-tag">${fmt.fps}fps</span>` : ''}
              ${fmt.isHDR ? '<span class="download-tag">HDR</span>' : ''}
              ${fmt.note ? `<span class="download-tag">${window.KimoUtils.escapeHtml(fmt.note)}</span>` : ''}
            </div>
          </div>
          <button class="download-btn ripple-btn" data-url="${downloadUrl}" data-quality="${quality}">
            <span class="material-symbols-outlined" style="font-size:18px">download</span> Download
          </button>
        </div>
      `;
    }).join('');
  }

  function renderPlaylist(playlist) {
    if (!elements.playlistSection) return;
    const title = window.KimoUtils.escapeHtml(playlist.title || 'Playlist');
    const count = playlist.videoCount || playlist.items?.length || 0;
    const cover = playlist.cover || '';

    elements.playlistSection.innerHTML = `
      <div class="playlist-card scale-in">
        <div class="playlist-header">
          ${cover ? `<img class="playlist-cover" src="${cover}" alt="${title}" loading="lazy">` : ''}
          <div class="playlist-info">
            <h3>${title}</h3>
            <p>${count} videos</p>
          </div>
        </div>
        <div class="playlist-items">
          ${(playlist.items || []).map((item, i) => {
            const itemTitle = window.KimoUtils.escapeHtml(item.title || 'Untitled');
            const thumb = item.thumbnail || '';
            const itemUrl = item.url || `https://youtube.com/watch?v=${item.id}`;
            const dur = window.KimoUtils.formatDuration(item.duration);
            return `
              <div class="playlist-item fade-in stagger-${(i % 8) + 1}" data-url="${itemUrl}" role="button" tabindex="0" aria-label="Download ${itemTitle}">
                <img class="playlist-item-thumb" src="${thumb || 'https://via.placeholder.com/160x90/1a1a2e/e8e8f0?text=No+Thumb'}" alt="${itemTitle}" loading="lazy">
                <div class="playlist-item-info">
                  <h4>${itemTitle}</h4>
                  <span>${dur}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    elements.playlistSection.classList.add('show');
  }

  function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    toast.innerHTML = `
      <span class="material-symbols-outlined toast-icon">${icons[type] || 'info'}</span>
      <span>${window.KimoUtils.escapeHtml(message)}</span>
    `;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
  }

  function showError(message) {
    showStatus(message, 'error');
    showToast(message, 'error');
  }

  return {
    init,
    showLoading,
    hideLoading,
    showStatus,
    hideStatus,
    clearResults,
    renderVideoInfo,
    renderFormats,
    renderPlaylist,
    showToast,
    showError,
    elements
  };
})();

window.KimoUI = KimoUI;
