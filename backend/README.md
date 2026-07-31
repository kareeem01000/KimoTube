# KimoTube Backend

Small Express API that uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) to resolve YouTube video/playlist info and real download URLs.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server + yt-dlp status |
| POST | `/api/info` | `{ "url": "..." }` → video info + formats, or playlist info |

## Deploy to Hugging Face Spaces (free, NO credit card)

The repo already includes a `Dockerfile` at the root for this.

1. Sign up at [huggingface.co](https://huggingface.co) (GitHub login works, **no credit card needed**).
2. **New Space** → name it `kimotube-backend` → **SDK: Docker** → Hardware: **CPU basic** (FREE).
3. In "Create with": choose **"Connect a GitHub repository"** → link your KimoTube repo → **Create Space**.
4. Wait for the build (~3-5 min). You'll get a URL like `https://YOURNAME-kimotube-backend.hf.space`.
5. Put that URL into `js/api.js` → `CONFIG.backend.baseUrl`, then push.

Notes:
- The Space sleeps after ~48h without visits and wakes on the next request (cold start takes ~1 min).
- To keep it awake, create a free [UptimeRobot](https://uptimerobot.com) monitor (HTTP, 5-min interval, no credit card) on the `/api/health` URL.
- YouTube 403 blocks are auto-retried with different player clients.

## Deploy to Render (free, requires credit card)

1. Push this repo to GitHub (the whole KimoTube repo is fine).
2. On [render.com](https://render.com) → sign in with GitHub → **New → Web Service** → connect your repo.
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
4. Optional env vars:
   - `ALLOWED_ORIGIN` = `https://kareeem01000.github.io` (your frontend URL)
   - `API_KEY` = a random secret; the frontend must then send it as `x-api-key`
   - `YTDLP_EXTRA_ARGS` = extra yt-dlp args if needed (e.g. `--extractor-args "youtube:player_client=android_vr"`)
5. Deploy → copy the `https://xxx.onrender.com` URL into `js/api.js` → `CONFIG.backend.baseUrl`.

The first deploy downloads the yt-dlp binary automatically (a few seconds on startup).

## Free tier notes

- The free instance **sleeps after 15 minutes without traffic**; the first request after sleep takes ~30-60s to wake up (cold start re-downloads the yt-dlp binary, since the disk is temporary).
- The backend **auto-retries YouTube 403 blocks** by switching player clients (`tv_embedded` → `web_embedded`), so most bot-blocks are handled automatically.
- If YouTube blocks the datacenter IP persistently, try a different `player_client` via `YTDLP_EXTRA_ARGS`.

## Run locally

```bash
cd backend
npm install
node server.js
# POST http://localhost:3000/api/info {"url":"https://www.youtube.com/watch?v=..."}
```
