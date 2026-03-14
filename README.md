# Fitness Tracker PWA

This folder contains a static installable PWA version of the fitness tracker.

## Local preview

Serve the folder over HTTP instead of opening `index.html` directly.

Example:

```powershell
cd fitness-tracker
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## iPhone install

1. Open the hosted app in Safari.
2. Tap `Share`.
3. Tap `Add to Home Screen`.

The app now includes a PNG Apple touch icon and offline caching.

## GitHub Pages deployment

This repo now includes [`.github/workflows/fitness-tracker-pages.yml`](../.github/workflows/fitness-tracker-pages.yml).

To publish:

1. Push the repository to GitHub.
2. In GitHub, open `Settings` → `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Run the `Deploy Fitness Tracker` workflow, or push a change to `main` or `master`.
5. Open the Pages URL shown by the workflow.

The workflow deploys only the contents of `fitness-tracker/`, so the app is published as a clean static site.

## Notes

- Service workers and install prompts require HTTP or HTTPS.
- The app caches its shell files for offline use.
- When a new version is available, the app shows a refresh banner.