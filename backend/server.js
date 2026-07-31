/* ============================================
   KimoTube Backend - Express + yt-dlp API
   ============================================
   Endpoints:
     GET  /api/health          -> { ok, ytDlp }
     POST /api/info            -> { ok, data } | { ok: false, error }
       body: { url: "https://www.youtube.com/watch?v=..." }
       handles videos, shorts and playlists
   Env vars:
     PORT              (default 3000)
     ALLOWED_ORIGIN    CORS origin for the frontend (default "*")
     API_KEY           optional shared secret; if set, clients must send
                       "x-api-key: <API_KEY>" header
     YTDLP_EXTRA_ARGS  extra yt-dlp args (space separated, optional)
     YTDLP_TIMEOUT_MS  per-request timeout (default 90000)
   ============================================ */

'use strict';

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const API_KEY = process.env.API_KEY || '';
const YTDLP_TIMEOUT = parseInt(process.env.YTDLP_TIMEOUT_MS || '90000', 10);
const EXTRA_ARGS = (process.env.YTDLP_EXTRA_ARGS || '').split(' ').filter(Boolean);

const BIN_DIR = path.join(__dirname, 'bin');
const YTDLP_PATH = process.env.YTDLP_PATH || path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

const ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];

/* ---------------- yt-dlp binary bootstrap ---------------- */

const YTDLP_RELEASES = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { 'User-Agent': 'KimoTubeBackend/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function ensureYtDlp() {
  if (fs.existsSync(YTDLP_PATH)) return;
  fs.mkdirSync(BIN_DIR, { recursive: true });

  console.log('[KimoTube] yt-dlp not found, downloading...');
  const assetName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const assetUrl = await new Promise((resolve, reject) => {
    https.get(YTDLP_RELEASES, { headers: { 'User-Agent': 'KimoTubeBackend/1.0' } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`release lookup failed: HTTP ${res.statusCode}`));
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const asset = data.assets.find((a) => a.name === assetName);
          if (!asset) return reject(new Error(`no ${assetName} asset in latest release`));
          resolve(asset.browser_download_url);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });

  await downloadFile(assetUrl, YTDLP_PATH);
  if (process.platform !== 'win32') {
    fs.chmodSync(YTDLP_PATH, 0o755);
  }
  console.log('[KimoTube] yt-dlp ready at', YTDLP_PATH);
}

/* ---------------- yt-dlp runner ---------------- */

const CLIENT_FALLBACKS = [
  '--extractor-args', 'youtube:player_client=tv_embedded',
  '--extractor-args', 'youtube:player_client=web_embedded'
];

async function runYtDlpRetry(args, timeoutMs) {
  let lastError;
  for (let attempt = 0; attempt <= CLIENT_FALLBACKS.length; attempt++) {
    try {
      const attemptArgs = attempt === 0 ? args : [...args, CLIENT_FALLBACKS[(attempt - 1) * 2], CLIENT_FALLBACKS[(attempt - 1) * 2 + 1]];
      return await runYtDlp(attemptArgs, timeoutMs);
    } catch (e) {
      lastError = e;
      const msg = e.message || '';
      const blocked = /403|Forbidden|unable to download video data|Sign in to confirm/i.test(msg);
      console.warn(`[KimoTube] yt-dlp attempt ${attempt + 1} failed:`, msg.slice(0, 200));
      if (!blocked || attempt >= CLIENT_FALLBACKS.length) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastError;
}

function runYtDlp(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const fullArgs = [...EXTRA_ARGS, ...args];
    const child = spawn(YTDLP_PATH, fullArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('yt-dlp timed out'));
    }, timeoutMs || YTDLP_TIMEOUT);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const msg = stderr.trim().split('\n').pop() || `yt-dlp exited with code ${code}`;
        return reject(new Error(msg));
      }
      resolve(stdout);
    });
  });
}

/* ---------------- helpers ---------------- */

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch (e) {
    return false;
  }
}

function toDateString(ymd) {
  if (!ymd) return '';
  const s = String(ymd);
  if (s.length !== 8) return '';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function qualityLabel(info) {
  const h = info.height || 0;
  if (h >= 4320) return '4320p (8K)';
  if (h >= 2160) return '2160p (4K)';
  if (h >= 1440) return '1440p (2K)';
  if (h >= 1080) return '1080p (Full HD)';
  if (h >= 720) return '720p (HD)';
  if (h >= 480) return '480p';
  if (h >= 360) return '360p';
  if (h >= 240) return '240p';
  if (h >= 144) return '144p';
  return 'Audio Only';
}

function buildVideoResult(data) {
  const hasVideo = (f) => f.vcodec && f.vcodec !== 'none';
  const hasAudio = (f) => f.acodec && f.acodec !== 'none';
  const formats = data.formats || [];

  const combined = formats.filter((f) => hasVideo(f) && hasAudio(f) && f.url && f.height);
  const videoOnly = formats.filter((f) => hasVideo(f) && !hasAudio(f) && f.url && f.height);
  const audioOnly = formats.filter((f) => !hasVideo(f) && hasAudio(f) && f.url);

  const out = [];
  const seenCombined = new Set();

  combined
    .sort((a, b) => b.height - a.height)
    .forEach((f) => {
      const key = `${f.height}x${f.ext || ''}`;
      if (seenCombined.has(key)) return;
      seenCombined.add(key);
      out.push({
        quality: qualityLabel(f),
        extension: f.ext || 'mp4',
        size: f.filesize || f.filesize_approx || 0,
        hasAudio: true,
        fps: f.fps || 30,
        isHDR: (f.dynamic_range && f.dynamic_range !== 'SDR') || false,
        url: f.url,
        note: ''
      });
    });

  const covered = new Set(out.filter((o) => o.url && o.hasAudio).map((o) => o.quality));
  const heights = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];

  heights.forEach((h) => {
    const f = videoOnly
      .filter((x) => x.height === h)
      .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
    if (!f) return;
    const label = qualityLabel(f);
    if (covered.has(label)) return;
    covered.add(label);
    out.push({
      quality: label,
      extension: 'mp4',
      size: f.filesize || f.filesize_approx || 0,
      hasAudio: true,
      fps: f.fps || 30,
      isHDR: (f.dynamic_range && f.dynamic_range !== 'SDR') || false,
      url: '',
      merge: `video:${h}`,
      note: 'Video + Audio (server)'
    });
  });

  const bestAudio = audioOnly.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
  if (bestAudio) {
    out.push({
      quality: 'Best Audio',
      extension: bestAudio.ext || 'm4a',
      size: bestAudio.filesize || bestAudio.filesize_approx || 0,
      hasAudio: true,
      fps: 0,
      isHDR: false,
      url: bestAudio.url,
      note: 'Audio Only'
    });
  }

  out.push({
    quality: 'MP3 Audio',
    extension: 'mp3',
    size: 0,
    hasAudio: true,
    fps: 0,
    isHDR: false,
    url: '',
    merge: 'audio:mp3',
    note: 'Audio Only (server)'
  });

  const thumbnails = data.thumbnails || [];
  const bestThumb = thumbnails.length
    ? [...thumbnails].filter((t) => t.url).sort((a, b) => ((b.width || 0) - (a.width || 0)))[0]
    : {};

  return {
    title: data.title || 'YouTube Video',
    thumbnail: data.thumbnail || bestThumb.url || '',
    duration: data.duration || 0,
    author: data.channel || data.uploader || 'Unknown Channel',
    views: data.view_count || 0,
    uploadDate: toDateString(data.upload_date),
    description: data.description || '',
    videoId: (data.id || '').split('_')[0],
    isShort: /\/shorts\//.test(data.webpage_url || ''),
    isPlaylist: false,
    downloadUrl: '',
    formats: out
  };
}

function buildPlaylistResult(data) {
  const items = (data.entries || [])
    .filter((e) => e && e.id)
    .slice(0, 100)
    .map((e) => ({
      id: e.id,
      title: e.title || 'Untitled',
      thumbnail: (e.thumbnails && e.thumbnails.length ? e.thumbnails[e.thumbnails.length - 1].url : '') || e.thumbnail || '',
      duration: e.duration || 0,
      url: `https://www.youtube.com/watch?v=${e.id}`
    }));

  const thumbs = (data.thumbnails || []).map((t) => t.url).filter(Boolean);
  return {
    title: data.title || 'YouTube Playlist',
    cover: thumbs[thumbs.length - 1] || '',
    videoCount: data.playlist_count || items.length,
    items,
    downloadAllUrl: ''
  };
}

/* ---------------- app ---------------- */

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN }));
app.use(express.json({ limit: '50kb' }));

app.use((req, res, next) => {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ ok: false, error: 'missing or invalid API key' });
  }
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    const out = await runYtDlp(['--version']);
    res.json({ ok: true, ytDlp: out.trim() });
  } catch (e) {
    res.json({ ok: false, ytDlp: null, error: e.message });
  }
});

app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8"><title>KimoTube Backend</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.6}
code{background:#f0f0f0;padding:2px 6px;border-radius:4px}</style></head>
<body>
<h1>✅ KimoTube Backend شغال</h1>
<p>ده السيرفر اللي بينزّل الفيديوهات. الموقع بيتكلم معاه أوتوماتيك — متفتحهوش من المتصفح.</p>
<p>الـ endpoints المتاحة:</p>
<ul>
<li><code>GET /api/health</code> — حالة السيرفر</li>
<li><code>POST /api/info</code> — { "url": "..." } → بيانات الفيديو + الصيغ</li>
<li><code>POST /api/download</code> — { "url": "...", "type": "video:1080 | audio:mp3" } → الملف النهائي</li>
</ul>
<p>للاستخدام: ارجع لصفحة <code>index.html</code> وعمل Analyze — كل حاجة بتشتغل لوحدها.</p>
</body></html>`);
});

app.get('/api/info', (req, res) => {
  res.status(405).json({ ok: false, error: 'POST required - send JSON body { "url": "..." }' });
});

app.get('/api/download', (req, res) => {
  res.status(405).json({ ok: false, error: 'POST required - send JSON body { "url": "...", "type": "video:1080" }' });
});

app.post('/api/info', async (req, res) => {
  const url = (req.body && req.body.url || '').trim();

  if (!url) return res.status(400).json({ ok: false, error: 'url is required' });
  if (!isAllowedUrl(url)) {
    return res.status(400).json({ ok: false, error: 'only YouTube links are supported' });
  }

  try {
    const isPlaylist = /(?:[?&]list=|youtube\.com\/playlist)/.test(url);
    const args = ['--skip-download', '--dump-single-json', '--no-warnings', '--no-color', '--no-playlist'];
    if (isPlaylist) {
      args.splice(args.indexOf('--no-playlist'), 1);
      args.push('--flat-playlist');
    }
    args.push(url);

    const stdout = await runYtDlpRetry(args);
    let data;
    try {
      data = JSON.parse(stdout);
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'invalid yt-dlp output' });
    }

    const result = isPlaylist && data.entries ? buildPlaylistResult(data) : buildVideoResult(data);
    res.json({ ok: true, data: result });
  } catch (e) {
    console.error('[KimoTube] /api/info error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.post('/api/download', async (req, res) => {
  const url = ((req.body && req.body.url) || '').trim();
  const type = ((req.body && req.body.type) || '').trim();

  if (!url || !type) return res.status(400).json({ ok: false, error: 'url and type are required' });
  if (!isAllowedUrl(url)) {
    return res.status(400).json({ ok: false, error: 'only YouTube links are supported' });
  }

  let args;
  if (type === 'audio:mp3') {
    args = ['-f', 'ba', '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--no-playlist'];
  } else if (/^video:\d+$/.test(type)) {
    const h = parseInt(type.split(':')[1], 10);
    if (h < 144 || h > 4320) return res.status(400).json({ ok: false, error: 'invalid quality' });
    args = ['-f', `bv*[height<=${h}]+ba/b[height<=${h}]`, '--merge-output-format', 'mp4', '--no-playlist'];
  } else {
    return res.status(400).json({ ok: false, error: 'invalid type' });
  }

  args.push('--retries', '3', '--fragment-retries', '5', '--retry-sleep', '2');

  let ffmpegDir = '';
  try {
    ffmpegDir = path.dirname(require('ffmpeg-static'));
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'ffmpeg not available on server' });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimotube-dl-'));
  const outTmpl = path.join(tmpDir, '%(title).100s [%(id)s].%(ext)s');

  try {
    await runYtDlpRetry([
      ...args,
      '--no-warnings',
      '--no-color',
      '--ffmpeg-location', ffmpegDir,
      '-o', outTmpl,
      url
    ], 600000);

    const files = fs.readdirSync(tmpDir);
    if (files.length === 0) throw new Error('no file produced');
    const file = path.join(tmpDir, files[0]);

    res.download(file, (err) => {
      if (err) console.error('[KimoTube] download stream error:', err.message);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  } catch (e) {
    console.error('[KimoTube] /api/download error:', e.message);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.use((req, res) => res.status(404).json({ ok: false, error: 'not found' }));

ensureYtDlp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[KimoTube] backend listening on port ${PORT}`);
      runYtDlp(['--version'])
        .then((v) => console.log(`[KimoTube] yt-dlp version: ${v.trim()}`))
        .catch(() => {});
    });
  })
  .catch((err) => {
    console.error('[KimoTube] failed to prepare yt-dlp:', err.message);
    process.exit(1);
  });
