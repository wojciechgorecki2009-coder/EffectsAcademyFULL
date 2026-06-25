# Effects Academy — Product Requirements (PRD)

## Original Problem Statement
Build a clean, modern, ultra-sleek asset-sharing website for a video editing
Discord community named "Effects Academy". Dark-mode aesthetic (deep grays, neon
accents), card-based grid, anonymous browsing with password-gated upload access.
Asset categories: Torrents, Project Files, Overlays, Audios (6 creators), Sound
FX, Presets, Premium. DMCA + Suggestions intake forms. Audio preview player with
volume control. Discord invite, 3D tilt cards, parallax hero, bouncy entrance
animations. Empty DB by default.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + Framer (CSS animations) +
  shadcn/ui. Routes: `/`, `/category/:slug`, `/dmca`, `/suggestions`.
- **Backend**: FastAPI + Motor (Mongo async). All routes under `/api`. Write
  endpoints gated by `X-Upload-Password` header.
- **Storage**: Local disk at `/app/backend/uploads`, served via
  `GET /api/uploads/{filename}` with `?download=1` for forced download.
- **DB collections**: `assets`, `packs`, `custom_categories`,
  `contact_submissions`.

## User Personas
- **Spectator** (default): anyone visiting the site. Can browse, search,
  preview audio, download assets, submit DMCA / suggestions.
- **Uploader** (mod): unlocked via password `EffectsAcademy2026Base44`. Can
  create / edit / delete assets, packs, and custom categories.

## Core Requirements (static)
- Discord invite URL: https://discord.gg/2VvMq3Pz85
- DMCA + Suggestions routing email (informational only):
  EffectsAcademy2026@hotmail.com
- Audio creators: MRBIT, IUSETHIS, NEXLO, ALTOM, S4MURAIAE, ZINC AUDIOS
- Torrent show groups: Action / Sci-Fi & Mystery / Drama
- Direct file download via `download` attribute / Content-Disposition header
- Custom categories: name + color + thumbnail
- Pack/group creation across every category

## Implemented (2026-05-31)
- Hero with mosaic parallax + smooth bouncy text entrance (custom cubic-bezier)
- Top nav (Browse, Torrents, Project Files, Overlays, Audios + More dropdown
  for Sound FX, Presets, Premium, DMCA, Suggestions), logo, Access Upload,
  Discord button
- Asset grid with category filter pills, search, 3D tilt cards with
  category-colored badges and download counter
- AudioPlayer (play/pause, progress, volume slider, mute, time)
- Upload modal: title, category, pack (create new), description, creator tag,
  AE version, BPM, show group, thumbnail upload-or-URL, file upload OR
  external URL
- Edit / Delete on each card for uploaders
- DMCA + Suggestions forms with success confirmation
- Backend tests: 14/14 passing (auth, CRUD, uploads, contact forms)

## Backlog (P0 → P2)
- **P1** Sound FX & Presets dedicated panel layouts with software-compat tags
- **P1** Custom user-generated categories UI (backend exists; expose in nav and
  upload modal)
- **P1** Premium tab gating mechanic (e.g., uploader-only or extra password)
- **P2** Email integration (Resend / SendGrid) to actually deliver DMCA +
  Suggestions to EffectsAcademy2026@hotmail.com
- **P2** Audio waveform visualization (canvas-rendered)
- **P2** Pagination / infinite scroll once asset count > 100
- **P2** Admin submissions inbox view in-app

## Next Tasks
1. Confirm UX with user, gather logo asset they wanted to provide.
2. Tackle P1 backlog: dedicated Sound FX / Presets layouts and the custom
   category UI.
