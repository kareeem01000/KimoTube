/* ============================================
   KimoTube - Main Application Controller
   ============================================ */

const KimoApp = (() => {

  function init() {
    try {
      window.KimoUI.init();
      document.addEventListener('kimotube:analyze', handleAnalyze);
      window.KimoUI.setBackendStatus('checking');
      window.KimoAPI.checkBackend().then((status) => {
        window.KimoUI.setBackendStatus(status.connected ? 'connected' : 'offline', status.base, status.ytDlp);
      });
    } catch (e) {
      console.error('[KimoTube] App init error:', e);
    }
  }

  async function handleAnalyze(event) {
    const { url } = event.detail;
    if (!url) return;

    try {
      const loadingEl = document.querySelector('.loading-text');
      if (loadingEl) loadingEl.textContent = 'Contacting API server...';

      const isPlaylist = window.KimoUtils.isPlaylistUrl(url);

      if (isPlaylist) {
        await handlePlaylist(url);
      } else {
        await handleVideo(url);
      }
    } catch (error) {
      console.error('[KimoTube] Analysis error:', error);
      window.KimoUI.hideLoading();
      window.KimoUI.showError(error.message || 'An unexpected error occurred. Please try again.');
    }
  }

  async function handleVideo(url) {
    const loadingEl = document.querySelector('.loading-text');
    if (loadingEl) loadingEl.textContent = 'Fetching video information from API...';

    const info = await window.KimoAPI.fetchVideoInfo(url);
    info.sourceUrl = url;

    window.KimoUI.hideLoading();
    window.KimoUI.clearResults();
    window.KimoUI.renderVideoInfo(info);

    window.KimoUI.renderFormats(info.formats, info.sourceUrl);

    window.KimoUI.showToast('Video found! Select a format to download.', 'success');

    setTimeout(() => {
      document.getElementById('downloadSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  async function handlePlaylist(url) {
    const loadingEl = document.querySelector('.loading-text');
    if (loadingEl) loadingEl.textContent = 'Fetching playlist information...';

    const playlist = await window.KimoAPI.fetchPlaylistInfo(url);

    window.KimoUI.hideLoading();
    window.KimoUI.clearResults();
    window.KimoUI.renderPlaylist(playlist);

    window.KimoUI.showToast(`Playlist found: ${playlist.title} (${playlist.videoCount || playlist.items?.length || 0} videos)`, 'success');
  }

  return { init };
})();

window.KimoApp = KimoApp;

document.addEventListener('DOMContentLoaded', () => {
  KimoApp.init();
});
