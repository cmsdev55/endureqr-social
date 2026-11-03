# EndureQR social

Daily Instagram + Facebook posts for [endureqr.com](https://endureqr.com), posted automatically by GitHub Actions
through Meta's free Graph API. Images and reels in `media/` are served by GitHub Pages so Instagram can fetch them.

| File | What it is |
|---|---|
| `posts.json` | 30 days of posts: slides, captions, hashtags, the guide each one links to |
| `media/` | Rendered images (1080×1350) and reels (1080×1920 MP4) |
| `scripts/render.mjs` | Builds `media/` from `posts.json` (`npm install`, then `npm run render`) |
| `scripts/post.mjs` | Posts one day (`npm run dry-run` to preview) |
| `.github/workflows/social-post.yml` | Runs `post.mjs` every day at 14:00 UTC |
| `SETUP.md` | One-time Meta + GitHub setup |
| `STRATEGY.md` | Growth, backlinks and AdSense plan |
