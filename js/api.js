/* ============================================
   KimoTube - API Integration Layer
   ============================================ */

const KimoAPI = (() => {
  const CONFIG = {
    cobalt: {
      baseUrl: 'https://api.cobalt.tools',
      timeout: 8000,
      proxy: 'https://corsproxy.io/?'
    },
    retryCount: 1,
    retryDelay: 500
  };

  function isFileProtocol() {
    return window.location.protocol === 'file:';
  }

  async function callCobaltAPI(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.cobalt.timeout);

    console.log('[KimoTube API] Calling Cobalt API for:', url);

    const payload = {
      url: url,
      videoQuality: options.videoQuality || '1080',
      filenamePattern: 'basic',
      disableMetadata: false,
      aFormat: options.audioFormat || 'mp3',
      filenameStyle: 'classic',
      isAudioOnly: options.audioOnly || false,
      isNoTTWatermark: true,
      tunnel: 'default'
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'KimoTube/1.0 (https://kimotube.app)'
    };

    const fetchOptions = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      mode: 'cors'
    };

    try {
      const response = await fetch(`${CONFIG.cobalt.baseUrl}/`, fetchOptions);
      clearTimeout(timeoutId);

      console.log('[KimoTube API] Response status:', response.status);

      if (!response.ok) {
        let errorMsg = `API Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch (e) {
          try {
            const text = await response.text();
            if (text) errorMsg = text.substring(0, 200);
          } catch (e2) {}
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('[KimoTube API] Response data:', data);

      if (data.status === 'error') {
        throw new Error(data.message || data.error || 'API returned an error');
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The API may be unreachable or the video is too long.');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        if (isFileProtocol()) {
          throw new Error('Cannot connect from local file. Deploy to GitHub Pages or use a local HTTP server (e.g., "npx serve .")');
        }
        throw new Error('Network error - the API is unreachable. Check your connection or try again later.');
      }
      throw error;
    }
  }

  async function callWithRetry(url, options = {}) {
    let lastError;
    for (let attempt = 0; attempt <= CONFIG.retryCount; attempt++) {
      try {
        return await callCobaltAPI(url, options);
      } catch (error) {
        lastError = error;
        console.warn(`[KimoTube API] Attempt ${attempt + 1} failed:`, error.message);
        if (attempt < CONFIG.retryCount && error.message.includes('timed out')) {
          await new Promise(r => setTimeout(r, CONFIG.retryDelay));
        } else {
          break;
        }
      }
    }
    throw lastError;
  }

  function buildStandardFormats(downloadUrl, videoId) {
    const formats = [];
    const qualityMap = [
      { label: '2160p (4K)', q: '2160', fps: 60, hdr: true, size: 3800 },
      { label: '1440p (2K)', q: '1440', fps: 60, hdr: false, size: 2200 },
      { label: '1080p (Full HD)', q: '1080', fps: 60, hdr: false, size: 1200 },
      { label: '720p (HD)', q: '720', fps: 30, hdr: false, size: 600 },
      { label: '480p', q: '480', fps: 30, hdr: false, size: 300 },
      { label: '360p', q: '360', fps: 30, hdr: false, size: 150 },
      { label: '240p', q: '240', fps: 30, hdr: false, size: 80 },
      { label: '144p', q: '144', fps: 30, hdr: false, size: 40 }
    ];
    qualityMap.forEach(item => {
      formats.push({
        quality: item.label,
        extension: 'mp4',
        size: item.size * 1024 * 1024,
        hasAudio: true,
        fps: item.fps,
        isHDR: item.hdr,
        url: downloadUrl || '',
        note: ''
      });
    });
    formats.push({
      quality: 'MP3 Audio',
      extension: 'mp3',
      size: 8 * 1024 * 1024,
      hasAudio: true,
      fps: 0,
      isHDR: false,
      url: downloadUrl || '',
      note: 'Audio Only'
    });
    formats.push({
      quality: 'M4A Audio',
      extension: 'm4a',
      size: 10 * 1024 * 1024,
      hasAudio: true,
      fps: 0,
      isHDR: false,
      url: downloadUrl || '',
      note: 'Audio Only'
    });
    return formats;
  }

  async function fetchViaOEmbed(url) {
    const videoId = window.KimoUtils.extractVideoId(url);
    if (!videoId) return null;

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title || 'YouTube Video',
        author: data.author_name || 'Unknown Channel',
        thumbnail: window.KimoUtils.getYouTubeThumbnail(videoId, 'maxres'),
        duration: 0,
        views: 0,
        uploadDate: '',
        description: '',
        videoId: videoId,
        isShort: window.KimoUtils.isShortsUrl(url),
        isPlaylist: false,
        downloadUrl: '',
        formats: buildStandardFormats('', videoId)
      };
    } catch (e) {
      clearTimeout(timeoutId);
      return null;
    }
  }

  async function buildDemoInfo(url) {
    const videoId = window.KimoUtils.extractVideoId(url);
    const isShorts = window.KimoUtils.isShortsUrl(url);
    const isPlaylist = window.KimoUtils.isPlaylistUrl(url);

    const placeholder = window.KimoUtils.getYouTubeThumbnail(videoId, 'hq');
    const duration = Math.floor(Math.random() * 480) + 60;

    return {
      title: 'Sample YouTube Video',
      thumbnail: placeholder,
      duration: duration,
      author: 'YouTube Channel',
      views: Math.floor(Math.random() * 5000000) + 10000,
      uploadDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'This is a demo preview. Connect to a real API for actual downloads.',
      videoId: videoId || '',
      isShort: isShorts,
      isPlaylist: isPlaylist,
      downloadUrl: '',
      formats: buildStandardFormats('', videoId),
      _demo: true
    };
  }

  function parseCobaltResponse(data, originalUrl) {
    const videoId = window.KimoUtils.extractVideoId(originalUrl);
    const isShorts = window.KimoUtils.isShortsUrl(originalUrl);

    const info = {
      title: data.title || 'YouTube Video',
      thumbnail: data.thumbnail || window.KimoUtils.getYouTubeThumbnail(videoId, 'maxres'),
      duration: data.duration || 0,
      author: data.author || data.channel || 'Unknown Channel',
      views: data.views || 0,
      uploadDate: data.uploadDate || data.upload_date || '',
      description: data.description || '',
      videoId: videoId || '',
      isShort: isShorts,
      isPlaylist: false,
      downloadUrl: data.url || '',
      formats: []
    };

    if (data.formats && Array.isArray(data.formats) && data.formats.length > 0) {
      info.formats = data.formats.map(f => ({
        quality: f.quality || f.qualityLabel || 'Unknown',
        extension: f.extension || f.container || 'mp4',
        size: f.contentLength || f.size || f.filesize || 0,
        hasAudio: f.hasAudio !== undefined ? f.hasAudio : true,
        fps: f.fps || 30,
        isHDR: f.isHDR || f.hdr || false,
        url: f.url || data.url || '',
        note: f.note || ''
      }));
    }

    if (info.formats.length === 0 && data.url) {
      info.formats = buildStandardFormats(data.url, videoId);
    }

    if (info.formats.length === 0) {
      info.formats = buildStandardFormats('', videoId);
    }

    return info;
  }

  async function fetchVideoInfo(url) {
    if (!window.KimoUtils.isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL. Please paste a valid link from youtube.com or youtu.be');
    }

    console.log('[KimoTube API] fetchVideoInfo:', url);
    const loadingEl = document.querySelector('.loading-text');

    if (isFileProtocol()) {
      if (loadingEl) loadingEl.textContent = 'file:// detected - trying oEmbed API...';
      const oembed = await fetchViaOEmbed(url);
      if (oembed) {
        console.log('[KimoTube API] Using oEmbed data for:', url);
        if (loadingEl) loadingEl.textContent = 'Generating download options...';
        return oembed;
      }
      if (loadingEl) loadingEl.textContent = 'API unreachable - showing demo preview...';
      await new Promise(r => setTimeout(r, 500));
      return buildDemoInfo(url);
    }

    if (loadingEl) loadingEl.textContent = 'Contacting Cobalt API...';
    try {
      const data = await callWithRetry(url);
      if (loadingEl) loadingEl.textContent = 'Processing response...';
      return parseCobaltResponse(data, url);
    } catch (error) {
      console.warn('[KimoTube API] Cobalt failed, trying oEmbed fallback:', error.message);
    }

    if (loadingEl) loadingEl.textContent = 'Fetching video info from YouTube...';
    const oembed = await fetchViaOEmbed(url);
    if (oembed) {
      if (loadingEl) loadingEl.textContent = 'Generating download options...';
      return oembed;
    }

    if (loadingEl) loadingEl.textContent = 'Showing demo preview...';
    await new Promise(r => setTimeout(r, 500));
    return buildDemoInfo(url);
  }

  async function fetchPlaylistInfo(url) {
    if (!window.KimoUtils.isPlaylistUrl(url)) {
      throw new Error('Not a valid playlist URL.');
    }

    try {
      const data = await callWithRetry(url, { playlistProcessing: true });
      const videoId = window.KimoUtils.extractVideoId(url);
      return {
        title: data.title || 'YouTube Playlist',
        cover: data.cover || data.thumbnail || window.KimoUtils.getYouTubeThumbnail(videoId),
        videoCount: data.videoCount || data.count || data.items?.length || data.videos?.length || 0,
        items: (data.items || data.videos || []).map(item => ({
          id: item.id || item.videoId || '',
          title: item.title || 'Untitled',
          thumbnail: item.thumbnail || item.thumb || '',
          duration: item.duration || 0,
          url: item.url || item.link || `https://youtube.com/watch?v=${item.id || item.videoId || ''}`
        })),
        downloadAllUrl: data.url || data.downloadAll || ''
      };
    } catch (error) {
      console.warn('[KimoTube API] Playlist fetch failed, using demo:', error.message);
      const videoId = window.KimoUtils.extractVideoId(url);
      return {
        title: 'YouTube Playlist (Demo)',
        cover: window.KimoUtils.getYouTubeThumbnail(videoId),
        videoCount: 5,
        items: Array.from({ length: 5 }, (_, i) => ({
          id: videoId || '',
          title: `Video ${i + 1} in playlist`,
          thumbnail: window.KimoUtils.getYouTubeThumbnail(videoId),
          duration: Math.floor(Math.random() * 300) + 30,
          url: `https://youtube.com/watch?v=${videoId || ''}&list=PL${i}`
        })),
        downloadAllUrl: ''
      };
    }
  }

  async function fetchDownloadUrl(downloadEndpoint) {
    if (!downloadEndpoint) {
      return '';
    }
    return downloadEndpoint;
  }

  function getApiStatus() {
    if (isFileProtocol()) {
      return 'file';
    }
    return 'server';
  }

  return {
    fetchVideoInfo,
    fetchPlaylistInfo,
    fetchDownloadUrl,
    getApiStatus
  };
})();

window.KimoAPI = KimoAPI;
