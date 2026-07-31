/* ============================================
   KimoTube - Utility Functions
   ============================================ */

const KimoUtils = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  sanitizeInput(str) {
    if (!str) return '';
    return str.trim().replace(/[<>]/g, '');
  },

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatFileSize(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return 'Unknown';
    if (bytes === 0) return 'Unknown';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  },

  isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const patterns = [
      /(?:youtube\.com\/watch\?v=)[\w-]{11}/,
      /(?:youtu\.be\/)[\w-]{11}/,
      /(?:youtube\.com\/shorts\/)[\w-]{11}/,
      /(?:youtube\.com\/playlist\?list=)[\w-]+/,
      /(?:music\.youtube\.com\/watch\?v=)[\w-]{11}/,
      /(?:m\.youtube\.com\/watch\?v=)[\w-]{11}/,
      /(?:youtube\.com\/embed\/)[\w-]{11}/
    ];
    return patterns.some(pattern => pattern.test(url));
  },

  extractVideoId(url) {
    if (!url) return null;
    const patterns = [
      /(?:v=|vi=|v\/|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  },

  extractPlaylistId(url) {
    if (!url) return null;
    const match = url.match(/[?&]list=([\w-]+)/);
    return match ? match[1] : null;
  },

  isShortsUrl(url) {
    return /youtube\.com\/shorts\//.test(url);
  },

  isPlaylistUrl(url) {
    return /[?&]list=/.test(url);
  },

  getYouTubeThumbnail(videoId, quality = 'maxres') {
    if (!videoId) return '';
    const qualities = {
      default: 'default',
      mq: 'mqdefault',
      hq: 'hqdefault',
      sd: 'sddefault',
      maxres: 'maxresdefault'
    };
    return `https://img.youtube.com/vi/${videoId}/${qualities[quality] || 'hqdefault'}.jpg`;
  },

  copyToClipboard(text) {
    if (!text) return Promise.reject(new Error('No text to copy'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    } finally {
      document.body.removeChild(textarea);
    }
  },

  getOS() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
    if (/mac/i.test(ua)) return 'mac';
    if (/win/i.test(ua)) return 'windows';
    if (/linux/i.test(ua)) return 'linux';
    return 'unknown';
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
  },

  requestTimeout(promise, ms = 15000) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), ms);
    });
    return Promise.race([promise, timeoutPromise]);
  }
};

window.KimoUtils = KimoUtils;
