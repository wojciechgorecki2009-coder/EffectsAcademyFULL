# Effects Academy After Effects Extension

CEP panel scaffold for After Effects 2023+.

This extension is intentionally not a 1:1 copy of the website. It is a fast asset launcher that reads the live Effects Academy API, previews audio, and imports selected files into the active After Effects project/composition.

## What it does now

- Loads live assets from the premium-only extension endpoint: `https://effects-academy-api.onrender.com/api/extension/assets`
- Requires a signed-in Effects Academy account with active Premium access
- Filters to editor-friendly categories: Audios, Presets, Project Files, Premium
- Searches by title, creator, genre, and description
- Shows thumbnails
- Previews Audios inside the panel
- Downloads/imports files into After Effects
- Applies `.ffx` presets to selected layers
- Adds audio/video/footage to the active comp when possible
- Uses `/api/uploads/{filename}/direct` for audio preview/download when possible, so object storage can serve big files directly instead of Render

## Install for development on Windows

1. Copy this whole `after-effects-extension` folder to:

   ```text
   C:\Users\<YOU>\AppData\Roaming\Adobe\CEP\extensions\com.effectsacademy.panel
   ```

2. Enable unsigned CEP extensions:

   ```powershell
   reg add HKCU\Software\Adobe\CSXS.11 /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add HKCU\Software\Adobe\CSXS.12 /v PlayerDebugMode /t REG_SZ /d 1 /f
   ```

3. Restart After Effects.

4. Open:

   ```text
   Window > Extensions > Effects Academy
   ```

5. On the website Premium page, use `Copy AE extension token`, then paste it into the extension's Connection settings.

## Production packaging

For public users, package this as a signed `.zxp` or provide a ZIP with clear install instructions. A signed installer is the cleaner long-term option.

## Create a development `.zxp`

From PowerShell:

```powershell
.\after-effects-extension\package-dev-zxp.ps1
```

This creates:

```text
dist\EffectsAcademy-AE-Panel-dev.zxp
```

This development file is a ZIP-format package using the `.zxp` extension. If a ZXP installer refuses it, install the unpacked folder during development or sign the package with Adobe `ZXPSignCmd`.

## Bandwidth notes

The panel should never bundle asset files. It only fetches metadata first. It downloads the real file only when the user previews/imports/downloads it.

For the lowest Render bandwidth:

- keep uploaded files in object storage;
- keep `S3_PUBLIC_BASE_URL` configured for public non-premium files;
- configure object storage CORS so AE/CEP can preview audio directly;
- use the existing direct URL endpoint for audio preview/import.

## Next recommended upgrades

- Add a website download button/page for this extension.
- Add an extension-specific login code flow instead of requiring token paste/manual auth.
- Add local caching so repeated imports of the same file do not redownload.
- Add premium-aware locked cards and login prompt inside the panel.
- Replace manual token entry with a website/device-code login flow.
- Add automatic update packaging for the extension files themselves.
