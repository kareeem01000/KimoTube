/* ============================================
   KimoTube - Download Manager
   ============================================ */

const KimoDownload = (() => {
  let activeDownloads = new Set();

  async function triggerDownload(url, quality, opts = {}) {
    if (!url) {
      if (opts.merge && opts.sourceUrl) {
        await mergeDownload(opts.sourceUrl, opts.merge, quality);
      } else {
        demoDownload(quality);
      }
      return;
    }

    if (activeDownloads.has(url)) {
      window.KimoUI.showToast('This download is already in progress', 'info');
      return;
    }

    activeDownloads.add(url);
    window.KimoUI.showToast(`Starting download: ${quality || 'video'}`, 'info');

    try {
      const downloadUrl = await window.KimoAPI.fetchDownloadUrl(url);
      if (!downloadUrl) {
        window.KimoUI.showToast('Download URL is empty. This feature requires a working API backend.', 'error');
        return;
      }
      await downloadFile(downloadUrl, generateFilename(quality));
    } catch (error) {
      window.KimoUI.showToast(`Download failed: ${error.message}`, 'error');
      console.error('[KimoTube] Download error:', error);
    } finally {
      activeDownloads.delete(url);
    }
  }

  async function mergeDownload(sourceUrl, mergeType, quality) {
    window.KimoUI.showToast(`Preparing ${quality || 'download'} on server, please wait...`, 'info');
    try {
      const { blob, filename } = await window.KimoAPI.fetchMergedDownload(sourceUrl, mergeType);
      if (!blob || blob.size === 0) throw new Error('Empty file received from server');
      saveBlob(blob, filename);
      window.KimoUI.showToast(`Download ready: ${filename}`, 'success');
    } catch (error) {
      console.error('[KimoTube] Merge download error:', error);
      window.KimoUI.showToast(`Download failed: ${error.message}`, 'error');
    }
  }

  function saveBlob(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'download.mp4';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 100);
  }

  function demoDownload(quality) {
    const content = [
      'KimoTube - Demo Download',
      '========================',
      '',
      'This is a sample file generated in demo mode.',
      'Real video downloads require a working API backend.',
      '',
      `Quality requested: ${quality || 'video'}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'To enable real downloads:',
      'Start the KimoTube backend (node server.js) and refresh this page.',
      'The download server indicator below the input must show green.',
      'Then analyze the video again and click a real format button.'
    ].join('\n');

    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `KimoTube_demo_${(quality || 'video').replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      window.KimoUI.showToast('Demo mode: sample file downloaded. Real downloads need an API server.', 'info');
    } catch (error) {
      console.error('[KimoTube] Demo download error:', error);
      window.KimoUI.showToast('Demo mode: no download URL available without an API server.', 'error');
    }
  }

  function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'video.mp4';
        a.rel = 'noopener noreferrer';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          resolve();
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  function generateFilename(quality) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const qualityStr = quality ? quality.replace(/[^a-zA-Z0-9]/g, '_') : 'video';
    return `KimoTube_${qualityStr}_${timestamp}.mp4`;
  }

  async function downloadFromBlob(url, filename) {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        headers: { 'Accept': '*/*' }
      });

      if (!response.ok) throw new Error('Failed to fetch file');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'download.mp4';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      return true;
    } catch (error) {
      console.error('Blob download failed:', error);
      return false;
    }
  }

  function downloadAll(items) {
    if (!items || items.length === 0) {
      window.KimoUI.showToast('No items to download', 'error');
      return;
    }
    window.KimoUI.showToast(`Starting download of ${items.length} items...`, 'info');
    items.forEach((item, index) => {
      setTimeout(() => {
        triggerDownload(item.url, `playlist_item_${index + 1}`);
      }, index * 2000);
    });
  }

  return {
    triggerDownload,
    downloadFile,
    downloadFromBlob,
    downloadAll
  };
})();

window.KimoDownload = KimoDownload;
