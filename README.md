# Blind Bible Voice Evaluation

Static GitHub Pages site for listening to the four prepared Bible passage recordings and preparing a compact Discord ballot.

## Public contents

- `index.html` and `assets/`: static UI and local-only ballot logic.
- `data/passages.json`: public references and passage text.
- `audio/`: 36 MP3s under public passage/voice folders, named only `A.mp3`, `B.mp3`, and `C.mp3`.

The repository deliberately contains no model names or private clip key. A/B/C remain blind labels. Choices are saved only in the visitor's browser `localStorage`; the site has no vote-collection backend. Visitors copy their generated summary and post it in Discord.

## Local preview

Run a static server from the repository root, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

Publish from the `main` branch root in the repository's **Settings → Pages**. The `.nojekyll` file keeps GitHub Pages from processing the static assets with Jekyll. Once enabled, new pushes to `main` publish automatically.
