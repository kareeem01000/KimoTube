# KimoTube - YouTube Downloader

A modern, fast, and responsive YouTube downloader website that runs entirely on the frontend. Deploy directly to GitHub Pages with no backend required.

## Features

- Download YouTube videos, Shorts, and Playlists
- Multiple quality options (144p to 8K)
- Audio download (MP3/M4A)
- Thumbnail download
- Dark/Light mode with persistence
- PWA support (installable, offline)
- Glassmorphism design
- Fully responsive (mobile, tablet, desktop)
- SEO optimized
- Keyboard shortcuts
- No registration required
- Completely free

## Folder Structure

```
KimoTube/
  index.html            # Main entry point
  manifest.json         # PWA manifest
  service-worker.js     # Service worker
  robots.txt            # SEO
  sitemap.xml           # SEO
  README.md             # Documentation
  assets/
    logo.svg            # Logo
    favicon.svg         # Favicon
    icons/              # PWA icons
    images/             # Images
  styles/
    style.css           # Main styles
    responsive.css      # Responsive design
    animations.css      # Animations
    dark.css            # Dark mode
  js/
    app.js              # App controller
    api.js              # API integration
    ui.js               # UI management
    download.js         # Download handling
    utils.js            # Utilities
  offline/
    index.html          # Offline fallback page
```

## Deployment on GitHub Pages

1. Fork or push this repository to GitHub
2. Go to repository Settings > Pages
3. Select `main` branch and `/ (root)` folder
4. Click Save
5. Your site will be live at `https://<username>.github.io/KimoTube/`

### Custom Domain

1. Add a CNAME record pointing to `<username>.github.io`
2. In Settings > Pages, enter your custom domain
3. Update the canonical URL in `index.html`

## Configuration

The app uses the Cobalt API by default. To change the API:

1. Open `js/api.js`
2. Find the `CONFIG` object
3. Update `cobalt.baseUrl` with your preferred API endpoint

### API Format

The app expects API responses with the following structure:

```json
{
  "url": "https://download.url",
  "title": "Video Title",
  "thumbnail": "https://thumbnail.url",
  "duration": 245,
  "author": "Channel Name",
  "formats": [
    {
      "quality": "1080p",
      "extension": "mp4",
      "contentLength": 52428800,
      "hasAudio": true,
      "fps": 30
    }
  ]
}
```

## How It Works

1. User pastes a YouTube URL
2. URL is validated client-side
3. Request is sent to the API
4. Video information is displayed
5. User selects a format
6. Download is triggered directly

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Opera (latest)
- Android Chrome
- iOS Safari

## License

MIT License - feel free to use and modify.

## Credits

- Built with [Cobalt API](https://cobalt.tools)
- Icons by [Material Symbols](https://fonts.google.com/icons) & [Font Awesome](https://fontawesome.com)
- Font by [Inter](https://rsms.me/inter/)

## Future Improvements

- [ ] More API provider options
- [ ] Batch playlist downloads
- [ ] Download history
- [ ] Built-in video player
- [ ] More format options (GIF, audio extraction)
- [ ] Language localization
- [ ] Rate limiting and queue system
