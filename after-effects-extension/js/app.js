(function () {
  "use strict";

  var DEFAULT_API_BASE = "https://effects-academy-api.onrender.com";
  var TRANSFORMERS_MODULE_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
  var TRANSCRIPTION_MODELS = ["onnx-community/whisper-tiny.en", "Xenova/whisper-tiny.en"];
  var TARGET_SAMPLE_RATE = 16000;
  var MAX_TRANSCRIBE_MB = 80;
  var CATEGORIES = ["All", "Audios", "Presets", "Project Files", "Premium", "Captions", "Settings"];
  var ASSET_CATEGORIES = ["All", "Audios", "Presets", "Project Files", "Premium"];
  var AUDIO_CATEGORIES = { "Audios": true };
  var STORAGE_KEYS = {
    apiBase: "ea_extension_api_base",
    authToken: "ea_extension_auth_token",
    deviceId: "ea_extension_device_id",
    uiStyle: "ea_extension_ui_style",
    layoutMode: "ea_extension_layout_mode",
    density: "ea_extension_density",
    accent: "ea_extension_accent",
    motion: "ea_extension_motion",
    font: "ea_extension_font",
    captionFont: "ea_caption_font",
    captionFontSize: "ea_caption_font_size",
    captionY: "ea_caption_y",
    captionColor: "ea_caption_color",
    captionGlowExposure: "ea_caption_glow_exposure",
    captionGlowRadius: "ea_caption_glow_radius",
    captionShadowOpacity: "ea_caption_shadow_opacity",
    captionShadowSoftness: "ea_caption_shadow_softness"
  };

  var state = {
    apiBase: localStorage.getItem(STORAGE_KEYS.apiBase) || DEFAULT_API_BASE,
    authToken: localStorage.getItem(STORAGE_KEYS.authToken) || "",
    deviceId: localStorage.getItem(STORAGE_KEYS.deviceId) || "",
    uiStyle: localStorage.getItem(STORAGE_KEYS.uiStyle) || "default",
    layoutMode: localStorage.getItem(STORAGE_KEYS.layoutMode) || "auto",
    density: localStorage.getItem(STORAGE_KEYS.density) || "comfortable",
    accent: localStorage.getItem(STORAGE_KEYS.accent) || "violet",
    motion: localStorage.getItem(STORAGE_KEYS.motion) || "premium",
    font: localStorage.getItem(STORAGE_KEYS.font) || "modern",
    assets: [],
    category: "All",
    search: "",
    loadingId: "",
    captionSettings: {
      font: localStorage.getItem(STORAGE_KEYS.captionFont) || "Arial-BoldMT",
      fontSize: Number(localStorage.getItem(STORAGE_KEYS.captionFontSize) || 86),
      y: Number(localStorage.getItem(STORAGE_KEYS.captionY) || 78),
      color: localStorage.getItem(STORAGE_KEYS.captionColor) || "#FFFFFF",
      glowExposure: Number(localStorage.getItem(STORAGE_KEYS.captionGlowExposure) || 0.15),
      glowRadius: Number(localStorage.getItem(STORAGE_KEYS.captionGlowRadius) || 400),
      shadowOpacity: Number(localStorage.getItem(STORAGE_KEYS.captionShadowOpacity) || 100),
      shadowSoftness: Number(localStorage.getItem(STORAGE_KEYS.captionShadowSoftness) || 43)
    }
  };

  var els = {
    refreshBtn: document.getElementById("refreshBtn"),
    statusTitle: document.getElementById("statusTitle"),
    statusText: document.getElementById("statusText"),
    assetCount: document.getElementById("assetCount"),
    searchInput: document.getElementById("searchInput"),
    categoryTabs: document.getElementById("categoryTabs"),
    settingsPanel: document.getElementById("settingsPanel"),
    captionsPanel: document.getElementById("captionsPanel"),
    assetGrid: document.getElementById("assetGrid"),
    emptyState: document.getElementById("emptyState"),
    player: document.getElementById("player"),
    playerThumb: document.getElementById("playerThumb"),
    playerTitle: document.getElementById("playerTitle"),
    playerSubtitle: document.getElementById("playerSubtitle"),
    playerCurrent: document.getElementById("playerCurrent"),
    playerDuration: document.getElementById("playerDuration"),
    playerPlayBtn: document.getElementById("playerPlayBtn"),
    playerProgress: document.getElementById("playerProgress"),
    playerMuteBtn: document.getElementById("playerMuteBtn"),
    playerVolume: document.getElementById("playerVolume"),
    playerImportBtn: document.getElementById("playerImportBtn"),
    playerSlow09Btn: document.getElementById("playerSlow09Btn"),
    playerSlow08Btn: document.getElementById("playerSlow08Btn"),
    audioEl: document.getElementById("audioEl"),
    apiBaseInput: document.getElementById("apiBaseInput"),
    uiStyleInput: document.getElementById("uiStyleInput"),
    layoutModeInput: document.getElementById("layoutModeInput"),
    densityInput: document.getElementById("densityInput"),
    accentInput: document.getElementById("accentInput"),
    motionInput: document.getElementById("motionInput"),
    fontInput: document.getElementById("fontInput"),
    pairingCodeInput: document.getElementById("pairingCodeInput"),
    pairingCodeBtn: document.getElementById("pairingCodeBtn"),
    authTokenInput: document.getElementById("authTokenInput"),
    captionCreateBtn: document.getElementById("captionCreateBtn"),
    captionProgressTrack: document.getElementById("captionProgressTrack"),
    captionProgressBar: document.getElementById("captionProgressBar"),
    captionStatusText: document.getElementById("captionStatusText"),
    captionFontInput: document.getElementById("captionFontInput"),
    captionFontSizeInput: document.getElementById("captionFontSizeInput"),
    captionYInput: document.getElementById("captionYInput"),
    captionColorInput: document.getElementById("captionColorInput"),
    captionGlowExposureInput: document.getElementById("captionGlowExposureInput"),
    captionGlowRadiusInput: document.getElementById("captionGlowRadiusInput"),
    captionShadowOpacityInput: document.getElementById("captionShadowOpacityInput"),
    captionShadowSoftnessInput: document.getElementById("captionShadowSoftnessInput")
  };

  var currentAudioAsset = null;
  var transcriberPromise = null;

  function createDeviceId() {
    var random = "";
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i += 1) {
        random += ("0" + bytes[i].toString(16)).slice(-2);
      }
    } else {
      random = String(Math.random()).slice(2) + String(Date.now());
    }
    return "ea-ae-" + random + "-" + Date.now();
  }

  function ensureDeviceId() {
    if (!state.deviceId) {
      state.deviceId = createDeviceId();
      localStorage.setItem(STORAGE_KEYS.deviceId, state.deviceId);
    }
    return state.deviceId;
  }

  function fmtTime(value) {
    if (!isFinite(value) || value < 0) return "0:00";
    var minutes = Math.floor(value / 60);
    var seconds = String(Math.floor(value % 60));
    if (seconds.length < 2) seconds = "0" + seconds;
    return minutes + ":" + seconds;
  }

  function apiUrl(path) {
    return state.apiBase.replace(/\/+$/, "") + "/api" + path;
  }

  function fileUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return state.apiBase.replace(/\/+$/, "") + path;
  }

  function authenticatedFileUrl(path, download, filename) {
    var url = fileUrl(path);
    if (!url || /^https?:\/\//i.test(path || "")) return url;
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    var params = [];
    if (download) params.push("download=1");
    if (filename) params.push("name=" + encodeURIComponent(filename));
    if (state.authToken) params.push("access_token=" + encodeURIComponent(state.authToken));
    return params.length ? url + sep + params.join("&") : url;
  }

  function uploadFilename(path) {
    var match = String(path || "").match(/\/api\/uploads\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function authHeaders() {
    var headers = { "X-Extension-Device-Id": ensureDeviceId() };
    if (state.authToken) headers.Authorization = "Bearer " + state.authToken;
    return headers;
  }

  function safeFilename(asset) {
    if (asset.original_filename) return asset.original_filename;
    var title = (asset.title || "asset").replace(/[<>:"/\\|?*]+/g, "_").trim() || "asset";
    var match = String(asset.file_url || asset.external_url || "").match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return title + (match ? "." + match[1] : "");
  }

  function extensionFromPath(filePath) {
    var match = String(filePath || "").toLowerCase().match(/\.([a-z0-9]+)(?:[?#]|$)/);
    return match ? match[1] : "";
  }

  function isArchivePath(filePath) {
    return ["zip", "rar", "7z"].indexOf(extensionFromPath(filePath)) !== -1;
  }

  function isArchiveAsset(asset) {
    return isArchivePath(asset.original_filename || "") || isArchivePath(asset.file_url || "");
  }

  function isAudioAsset(asset) {
    return Boolean(AUDIO_CATEGORIES[asset.category]);
  }

  function canDirectImport(asset) {
    return Boolean(asset.file_url);
  }

  function categoryLabel(asset) {
    return asset.category || "Asset";
  }

  function subLabel(asset) {
    if (asset.creator_tag) return asset.creator_tag;
    if (asset.genre) return asset.genre;
    if (asset.ae_version) return asset.ae_version;
    return asset.description || "";
  }

  function setStatus(title, text) {
    els.statusTitle.textContent = title;
    els.statusText.textContent = text;
  }

  function setBodyClass(prefix, value) {
    var classes = document.body.className.split(/\s+/).filter(function (name) {
      return name && name.indexOf(prefix) !== 0;
    });
    if (value) classes.push(prefix + value);
    document.body.className = classes.join(" ");
  }

  function applyPreferences() {
    setBodyClass("style-", state.uiStyle);
    document.documentElement.setAttribute("data-ui-style", state.uiStyle);
    document.body.setAttribute("data-ui-style", state.uiStyle);
    setBodyClass("layout-", state.layoutMode);
    setBodyClass("density-", state.density);
    setBodyClass("accent-", state.accent);
    setBodyClass("motion-", state.motion);
    setBodyClass("font-", state.font);
  }

  function bindPreference(input, key, storageKey) {
    if (!input) return;
    input.value = state[key];
    input.addEventListener("change", function () {
      state[key] = input.value;
      localStorage.setItem(storageKey, state[key]);
      applyPreferences();
    });
  }

  function resetAppleCardMotion(card) {
    card.style.setProperty("--asset-glow-x", "50%");
    card.style.setProperty("--asset-glow-y", "18%");
    card.style.setProperty("--asset-tilt-x", "0deg");
    card.style.setProperty("--asset-tilt-y", "0deg");
    card.style.setProperty("--asset-parallax-x", "0px");
    card.style.setProperty("--asset-parallax-y", "0px");
  }

  function enhanceAppleCardMotion(card) {
    resetAppleCardMotion(card);

    card.addEventListener("pointermove", function (event) {
      if (state.uiStyle !== "apple") return;
      var rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      var pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      var tiltX = (0.5 - pointerY) * 7;
      var tiltY = (pointerX - 0.5) * 8;
      var parallaxX = (pointerX - 0.5) * 12;
      var parallaxY = (pointerY - 0.5) * 12;
      card.style.setProperty("--asset-glow-x", Math.round(pointerX * 100) + "%");
      card.style.setProperty("--asset-glow-y", Math.round(pointerY * 100) + "%");
      card.style.setProperty("--asset-tilt-x", tiltX.toFixed(2) + "deg");
      card.style.setProperty("--asset-tilt-y", tiltY.toFixed(2) + "deg");
      card.style.setProperty("--asset-parallax-x", parallaxX.toFixed(2) + "px");
      card.style.setProperty("--asset-parallax-y", parallaxY.toFixed(2) + "px");
    });

    card.addEventListener("pointerleave", function () {
      resetAppleCardMotion(card);
    });

    card.addEventListener("pointerdown", function (event) {
      if (state.uiStyle !== "apple" || event.button > 0) return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      if (card.__applePressAnimation && card.__applePressAnimation.cancel) {
        card.__applePressAnimation.cancel();
      }
      card.__applePressAnimation = card.animate(
        [
          {
            transform: "translate3d(0, -6px, 0) rotateX(var(--asset-tilt-x, 0deg)) rotateY(var(--asset-tilt-y, 0deg)) scale(1.01)",
            offset: 0
          },
          {
            transform: "translate3d(0, -2px, 0) rotateX(0deg) rotateY(0deg) scale(0.955)",
            offset: 0.2
          },
          {
            transform: "translate3d(0, -10px, 0) rotateX(var(--asset-tilt-x, 0deg)) rotateY(var(--asset-tilt-y, 0deg)) scale(1.032)",
            offset: 0.58
          },
          {
            transform: "translate3d(0, -7px, 0) rotateX(var(--asset-tilt-x, 0deg)) rotateY(var(--asset-tilt-y, 0deg)) scale(1.006)",
            offset: 0.8
          },
          {
            transform: "translate3d(0, -6px, 0) rotateX(var(--asset-tilt-x, 0deg)) rotateY(var(--asset-tilt-y, 0deg)) scale(1.01)",
            offset: 1
          }
        ],
        {
          duration: 1800,
          easing: "cubic-bezier(0.16, 1, 0.22, 1)",
          fill: "none"
        }
      );
    });
  }

  function bindCaptionSetting(input, key, storageKey, numeric) {
    if (!input) return;
    input.value = String(state.captionSettings[key]);
    input.addEventListener("change", function () {
      var value = numeric ? Number(input.value) : input.value.trim();
      if (numeric && !isFinite(value)) value = state.captionSettings[key];
      if (key === "color" && value.charAt(0) !== "#") value = "#" + value;
      state.captionSettings[key] = value;
      input.value = String(value);
      localStorage.setItem(storageKey, String(value));
    });
  }

  function parseCaptionTime(value) {
    var match = String(value || "").trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:[,.](\d{1,3}))?/);
    if (!match) return NaN;
    var hours = Number(match[1] || 0);
    var minutes = Number(match[2] || 0);
    var seconds = Number(match[3] || 0);
    var millis = Number((match[4] || "0").slice(0, 3));
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  function parseTimedCaptions(input) {
    var text = String(input || "").replace(/\r/g, "").trim();
    if (!text) return [];
    text = text.replace(/^WEBVTT[^\n]*(?:\n+)?/i, "");
    var blocks = text.split(/\n{2,}/);
    var captions = [];
    blocks.forEach(function (block) {
      var lines = block.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
      if (lines.length < 2) return;
      if (/^\d+$/.test(lines[0])) lines.shift();
      var timeIndex = -1;
      for (var i = 0; i < lines.length; i += 1) {
        if (lines[i].indexOf("-->") !== -1) {
          timeIndex = i;
          break;
        }
      }
      if (timeIndex === -1) return;
      var parts = lines[timeIndex].split("-->");
      var start = parseCaptionTime(parts[0]);
      var end = parseCaptionTime(parts[1]);
      if (!isFinite(start) || !isFinite(end) || end <= start) return;
      captions.push({
        start: start,
        end: end,
        text: lines.slice(timeIndex + 1).join(" ").replace(/<[^>]+>/g, "")
      });
    });
    return captions;
  }

  function captionPayload() {
    return {
      settings: {
        font: state.captionSettings.font || "Arial-BoldMT",
        fontSize: Number(state.captionSettings.fontSize || 86),
        y: Number(state.captionSettings.y || 78),
        color: state.captionSettings.color || "#FFFFFF",
        glowExposure: Number(state.captionSettings.glowExposure || 0.15),
        glowRadius: Number(state.captionSettings.glowRadius || 400),
        shadowOpacity: Number(state.captionSettings.shadowOpacity || 100),
        shadowSoftness: Number(state.captionSettings.shadowSoftness || 43)
      }
    };
  }

  function setCaptionStatus(text, progress) {
    if (els.captionStatusText) els.captionStatusText.textContent = text;
    if (els.captionProgressBar && typeof progress === "number") {
      els.captionProgressBar.style.width = Math.max(0, Math.min(100, progress)) + "%";
    }
  }

  function bufferToArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  function resampleAudio(audioData, sourceRate, targetRate) {
    if (sourceRate === targetRate) return audioData;
    var ratio = sourceRate / targetRate;
    var outputLength = Math.round(audioData.length / ratio);
    var output = new Float32Array(outputLength);
    for (var i = 0; i < outputLength; i += 1) {
      var sourceIndex = i * ratio;
      var low = Math.floor(sourceIndex);
      var high = Math.min(low + 1, audioData.length - 1);
      var weight = sourceIndex - low;
      output[i] = audioData[low] * (1 - weight) + audioData[high] * weight;
    }
    return output;
  }

  function decodeAudioPath(filePath, sourceInfo) {
    var fs = window.require && window.require("fs");
    if (!fs) return Promise.reject(new Error("CEP Node access is unavailable."));
    var stat = fs.statSync(filePath);
    var extractDuration = Math.max(0.1, Number(sourceInfo && sourceInfo.source_end || 0) - Number(sourceInfo && sourceInfo.source_start || 0));
    if (sourceInfo && extractDuration > 0 && stat.size > MAX_TRANSCRIBE_MB * 1024 * 1024) {
      return extractCaptionAudio(filePath, sourceInfo).then(function (audioPath) {
        return decodeAudioPath(audioPath, null);
      }).catch(function (err) {
        throw err;
      });
    }
    var arrayBuffer = bufferToArrayBuffer(fs.readFileSync(filePath));
    var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return Promise.reject(new Error("This panel cannot decode audio on this version of CEP."));
    var audioContext = new AudioContextCtor();
    return audioContext.decodeAudioData(arrayBuffer.slice(0)).then(function (audioBuffer) {
      var channelCount = audioBuffer.numberOfChannels;
      var length = audioBuffer.length;
      var mono = new Float32Array(length);
      for (var channel = 0; channel < channelCount; channel += 1) {
        var data = audioBuffer.getChannelData(channel);
        for (var i = 0; i < length; i += 1) {
          mono[i] += data[i] / channelCount;
        }
      }
      if (audioContext.close) audioContext.close();
      var resampled = resampleAudio(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
      var sourceStart = Math.max(0, Number(sourceInfo && sourceInfo.source_start || 0));
      var sourceEnd = Math.max(sourceStart, Number(sourceInfo && sourceInfo.source_end || 0));
      if (sourceEnd > sourceStart) {
        var startIndex = Math.max(0, Math.floor(sourceStart * TARGET_SAMPLE_RATE));
        var endIndex = Math.min(resampled.length, Math.ceil(sourceEnd * TARGET_SAMPLE_RATE));
        if (endIndex > startIndex) return resampled.slice(startIndex, endIndex);
      }
      return resampled;
    });
  }

  function captionExtractPath(sourcePath) {
    var path = window.require && window.require("path");
    var fs = window.require && window.require("fs");
    if (!path || !fs) throw new Error("CEP Node access is unavailable.");
    var dir = path.join(extensionDownloadDir(), "CaptionAudio");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    var parsed = path.parse(sourcePath || "selected-clip");
    var cleanName = (parsed.name || "selected-clip").replace(/[<>:"/\\|?*]+/g, "_").slice(0, 48) || "selected-clip";
    return path.join(dir, cleanName + "-" + Date.now() + ".wav");
  }

  function normalizeLocalPath(value) {
    var text = String(value || "");
    if (!text) return "";
    text = decodeURIComponent(text);
    text = text.replace(/^file:\/+/i, "");
    text = text.replace(/^localhost\//i, "");
    text = text.replace(/^([A-Za-z])\|/, "$1:");
    if (/^[A-Za-z]:/.test(text) === false && text.charAt(0) === "/") text = text.slice(1);
    return text.replace(/\//g, "\\");
  }

  function pushFfmpegCandidate(candidates, value) {
    if (!value) return;
    if (candidates.indexOf(value) === -1) candidates.push(value);
  }

  function extensionRootCandidates() {
    var path = window.require && window.require("path");
    var roots = [];
    function addRoot(value, isFile) {
      var normalized = normalizeLocalPath(value);
      if (!normalized) return;
      if (isFile || /index\.html$/i.test(normalized)) normalized = path.dirname(normalized);
      if (roots.indexOf(normalized) === -1) roots.push(normalized);
    }

    try {
      if (window.__adobe_cep__ && window.__adobe_cep__.getSystemPath) {
        addRoot(window.__adobe_cep__.getSystemPath("extension"), false);
        addRoot(window.__adobe_cep__.getSystemPath("EXTENSION"), false);
      }
    } catch (cepErr) {}

    try {
      if (window.location) {
        addRoot(window.location.href, true);
        addRoot(window.location.pathname, true);
      }
    } catch (locationErr) {}

    try {
      if (typeof __dirname !== "undefined") {
        addRoot(path.join(__dirname, ".."), false);
      }
    } catch (dirErr) {}

    try {
      if (process && process.cwd) addRoot(process.cwd(), false);
    } catch (cwdErr) {}

    return roots;
  }

  function findFfmpeg() {
    var path = window.require && window.require("path");
    var fs = window.require && window.require("fs");
    if (!path || !fs) return "";
    var localCandidates = [];
    var roots = extensionRootCandidates();
    for (var r = 0; r < roots.length; r += 1) {
      pushFfmpegCandidate(localCandidates, path.join(roots[r], "bin", "ffmpeg.exe"));
      pushFfmpegCandidate(localCandidates, path.join(roots[r], "vendor", "ffmpeg.exe"));
      pushFfmpegCandidate(localCandidates, path.join(roots[r], "..", "bin", "ffmpeg.exe"));
    }
    pushFfmpegCandidate(localCandidates, path.resolve("bin", "ffmpeg.exe"));
    pushFfmpegCandidate(localCandidates, path.resolve("after-effects-extension", "bin", "ffmpeg.exe"));
    pushFfmpegCandidate(localCandidates, "C:\\ffmpeg\\bin\\ffmpeg.exe");
    pushFfmpegCandidate(localCandidates, "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe");
    pushFfmpegCandidate(localCandidates, "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe");
    var found = firstExistingPath(localCandidates);
    if (found) return found;
    var envPath = String(process.env.Path || process.env.PATH || "");
    var parts = envPath.split(";");
    for (var i = 0; i < parts.length; i += 1) {
      var candidate = path.join(parts[i], "ffmpeg.exe");
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch (err) {}
    }
    findFfmpeg.lastSearched = localCandidates.slice(0, 8).join(" | ");
    return "";
  }

  function extractCaptionAudio(filePath, sourceInfo) {
    var ffmpeg = findFfmpeg();
    if (!ffmpeg) {
      throw new Error("Bundled FFmpeg was not found. Searched: " + (findFfmpeg.lastSearched || "extension bin folder"));
    }
    var sourceStart = Math.max(0, Number(sourceInfo && sourceInfo.source_start || 0));
    var sourceEnd = Math.max(sourceStart + 0.1, Number(sourceInfo && sourceInfo.source_end || sourceStart + 0.1));
    var duration = Math.max(0.1, sourceEnd - sourceStart);
    var outputPath = captionExtractPath(filePath);
    setCaptionStatus("Extracting only the selected " + duration.toFixed(1) + "s clip audio…", 8);
    return runProcess(ffmpeg, [
      "-y",
      "-ss",
      String(sourceStart),
      "-t",
      String(duration),
      "-i",
      filePath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(TARGET_SAMPLE_RATE),
      "-f",
      "wav",
      outputPath
    ]).then(function () {
      return outputPath;
    }).catch(function (err) {
      throw new Error("Large scenepack audio extraction failed: " + String(err && err.message || err || "FFmpeg could not run.").slice(0, 220));
    });
  }

  function loadBrowserTranscriber(onProgress) {
    if (!transcriberPromise) {
      var dynamicImport = new Function("specifier", "return import(specifier)");
      transcriberPromise = dynamicImport(TRANSFORMERS_MODULE_URL).then(function (module) {
        module.env.allowLocalModels = false;
        module.env.useBrowserCache = true;
        if (module.env.backends && module.env.backends.onnx && module.env.backends.onnx.wasm) {
          module.env.backends.onnx.wasm.proxy = false;
        }
        var chain = Promise.reject(new Error("No transcription model attempted."));
        var devices = ["cpu", "dml"];
        TRANSCRIPTION_MODELS.forEach(function (modelId) {
          devices.forEach(function (deviceName) {
            chain = chain.catch(function () {
              setCaptionStatus("Loading " + modelId + " on " + deviceName.toUpperCase() + "…", 18);
              return module.pipeline("automatic-speech-recognition", modelId, {
                device: deviceName,
                dtype: "q8",
                progress_callback: onProgress
              });
            });
          });
        });
        return chain;
      });
      transcriberPromise = transcriberPromise.catch(function (err) {
        transcriberPromise = null;
        throw err;
      });
    }
    return transcriberPromise;
  }

  function normalizeTranscriptionSegments(transcript) {
    var chunks = transcript && transcript.chunks && transcript.chunks.length ? transcript.chunks : [];
    var segments = [];
    for (var i = 0; i < chunks.length; i += 1) {
      var chunk = chunks[i];
      var timestamp = chunk.timestamp || chunk.timestamps || [];
      var start = Number(timestamp[0]);
      if (!isFinite(start)) start = i * 4;
      var fallbackEnd = start + Math.max(2, Math.min(6, String(chunk.text || "").split(/\s+/).length * 0.45));
      var end = Number(timestamp[1]);
      if (!isFinite(end)) end = fallbackEnd;
      var text = String(chunk.text || "").trim();
      if (text) segments.push({ start: Math.max(0, start), end: Math.max(start + 0.05, end), text: text });
    }
    if (segments.length) return segments;

    var fullText = String((transcript && transcript.text) || "").trim();
    if (!fullText) return [];
    var sentences = fullText.replace(/([.!?])\s+/g, "$1\n").split(/\n+/);
    for (var j = 0; j < sentences.length; j += 1) {
      var sentence = sentences[j].trim();
      if (sentence) segments.push({ start: j * 4, end: (j + 1) * 4, text: sentence });
    }
    return segments;
  }

  function segmentsForSelectedClip(segments, sourceInfo) {
    var sourceStart = Number(sourceInfo.source_start || 0);
    var sourceEnd = Number(sourceInfo.source_end || sourceInfo.duration || 0);
    if (!isFinite(sourceEnd) || sourceEnd <= sourceStart) sourceEnd = Number(sourceInfo.duration || 0);
    return segments.map(function (segment) {
      var start = Math.max(sourceStart, Number(segment.start || 0));
      var end = Math.min(sourceEnd, Number(segment.end || 0));
      if (!isFinite(start) || !isFinite(end) || end <= start) return null;
      return {
        start: start - sourceStart,
        end: end - sourceStart,
        text: segment.text
      };
    }).filter(Boolean);
  }

  function readSelectedCaptionSource() {
    return evalScript("EA_selectedCaptionSource()").then(function (result) {
      var parsed = {};
      try { parsed = JSON.parse(result || "{}"); } catch (e) {}
      if (!parsed.ok) throw new Error(parsed.message || "Select a footage layer first.");
      return parsed;
    });
  }

  function createCaptions() {
    if (els.captionCreateBtn) {
      els.captionCreateBtn.disabled = true;
      els.captionCreateBtn.textContent = "Transcribing…";
    }
    clearErrorState();
    setCaptionStatus("Reading selected layer…", 4);
    setStatus("Auto captions", "Reading the selected clip from After Effects…");

    var sourceInfo = null;
    readSelectedCaptionSource()
      .then(function (info) {
        sourceInfo = info;
        setCaptionStatus("Decoding audio locally from " + (info.name || "selected clip") + "…", 10);
        setStatus("Decoding audio", info.name || "Selected clip");
        return decodeAudioPath(info.file_path, info);
      })
      .then(function (audioData) {
        setCaptionStatus("Loading local transcription model…", 18);
        setStatus("Loading caption model", "First run can take a little while.");
        return loadBrowserTranscriber(function (event) {
          if (event && event.status) {
            var progressValue = typeof event.progress === "number" ? event.progress : undefined;
            if (typeof progressValue === "number" && progressValue <= 1) progressValue = progressValue * 100;
            setCaptionStatus(event.status.replace(/_/g, " "), typeof progressValue === "number" ? 18 + Math.round(progressValue * 0.34) : undefined);
          }
        }).then(function (transcriber) {
          setCaptionStatus("Transcribing selected clip on your device…", 52);
          setStatus("Transcribing locally", "Creating timestamped caption chunks…");
          return transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true
          });
        });
      })
      .then(function (transcript) {
        var segments = normalizeTranscriptionSegments(transcript);
        var text = String((transcript && transcript.text) || "").trim();
        if (!segments.length && !text) throw new Error("No speech was detected in the selected clip.");
        setCaptionStatus("Adding caption layers to the timeline…", 88);
        setStatus("Building captions", "Adding styled text layers in After Effects…");
        var payload = captionPayload();
        payload.captions = segments;
        payload.plainText = text;
        return evalScript("EA_createCaptions(" + JSON.stringify(JSON.stringify(payload)) + ")");
      })
      .then(function (result) {
        var parsed = {};
        try { parsed = JSON.parse(result || "{}"); } catch (e) {}
        if (parsed.ok) {
          clearErrorState();
          setCaptionStatus(parsed.message || "Captions created.", 100);
          setStatus("Captions added", parsed.message || "Caption layers were created.");
        } else {
          showError("Caption import needs attention", parsed.message || "After Effects could not create captions.");
        }
      })
      .catch(function (err) {
        setCaptionStatus(err.message || "Could not create captions.", 0);
        showError("Caption failed", err.message || "Could not transcribe and caption this clip.");
      })
      .finally(function () {
        if (els.captionCreateBtn) {
          els.captionCreateBtn.disabled = false;
          els.captionCreateBtn.textContent = "Transcribe + add captions";
        }
      });
  }

  function showError(title, text) {
    setStatus(title, text);
    var card = els.statusTitle && els.statusTitle.closest ? els.statusTitle.closest(".status-card") : null;
    if (!card) return;
    card.classList.remove("shake");
    card.classList.add("error");
    void card.offsetWidth;
    card.classList.add("shake");
    setTimeout(function () {
      card.classList.remove("shake");
    }, 460);
  }

  function clearErrorState() {
    var card = els.statusTitle && els.statusTitle.closest ? els.statusTitle.closest(".status-card") : null;
    if (card) card.classList.remove("error", "shake");
  }

  function renderTabs() {
    els.categoryTabs.innerHTML = "";
    CATEGORIES.forEach(function (category) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "tab" + (state.category === category ? " active" : "");
      button.textContent = category;
      button.title = category;
      button.onclick = function () {
        state.category = category;
        renderTabs();
        renderAssets();
      };
      els.categoryTabs.appendChild(button);
    });
  }

  function visibleAssets() {
    var search = state.search.trim().toLowerCase();
    return state.assets.filter(function (asset) {
      if (state.category === "Settings") return false;
      if (state.category !== "All" && asset.category !== state.category) return false;
      if (!search) return true;
      return [
        asset.title,
        asset.creator_tag,
        asset.genre,
        asset.description,
        asset.ae_version,
        asset.category
      ].join(" ").toLowerCase().indexOf(search) !== -1;
    });
  }

  function renderAssets() {
    if (state.category === "Captions") {
      document.body.classList.add("view-captions");
      document.body.classList.remove("view-settings");
      els.assetCount.textContent = "TXT";
      els.emptyState.classList.add("hidden");
      els.assetGrid.classList.add("hidden");
      els.settingsPanel.classList.add("hidden");
      els.captionsPanel.classList.remove("hidden");
      return;
    }

    if (state.category === "Settings") {
      document.body.classList.add("view-settings");
      document.body.classList.remove("view-captions");
      els.assetCount.textContent = "UI";
      els.emptyState.classList.add("hidden");
      els.assetGrid.classList.add("hidden");
      els.settingsPanel.classList.remove("hidden");
      els.captionsPanel.classList.add("hidden");
      return;
    }

    document.body.classList.remove("view-settings");
    document.body.classList.remove("view-captions");
    els.assetGrid.classList.remove("hidden");
    els.settingsPanel.classList.add("hidden");
    els.captionsPanel.classList.add("hidden");
    var assets = visibleAssets();
    els.assetCount.textContent = String(assets.length);
    els.emptyState.classList.toggle("hidden", assets.length > 0);
    els.assetGrid.innerHTML = "";

    assets.forEach(function (asset) {
      var card = document.createElement("article");
      card.className = "card";
      card.style.animationDelay = Math.min(360, els.assetGrid.children.length * 22) + "ms";
      enhanceAppleCardMotion(card);

      var thumb = document.createElement("div");
      thumb.className = "thumb";
      var thumbnailUrl = fileUrl(asset.thumbnail_url || "");
      if (thumbnailUrl) {
        var image = document.createElement("img");
        image.src = thumbnailUrl;
        image.alt = asset.title || "Asset thumbnail";
        image.loading = "lazy";
        thumb.appendChild(image);
      } else {
        thumb.textContent = categoryLabel(asset).slice(0, 3).toUpperCase();
      }

      var body = document.createElement("div");
      body.className = "card-body";

      var meta = document.createElement("div");
      meta.className = "meta";
      var badge = document.createElement("span");
      badge.className = "badge" + (asset.category === "Premium" ? " premium" : "");
      badge.textContent = categoryLabel(asset);
      var downloads = document.createElement("span");
      downloads.className = "downloads";
      downloads.textContent = "↓ " + (asset.download_count || 0);
      meta.appendChild(badge);
      meta.appendChild(downloads);

      var title = document.createElement("div");
      title.className = "title";
      title.textContent = asset.title || "Untitled asset";

      var sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = subLabel(asset);

      var actions = document.createElement("div");
      actions.className = "actions";

      var importBtn = document.createElement("button");
      importBtn.type = "button";
      importBtn.className = "primary";
      importBtn.textContent = isArchiveAsset(asset) ? "Unpack + import" : isAudioAsset(asset) ? "Add to comp" : "Import";
      importBtn.disabled = !canDirectImport(asset);
      importBtn.onclick = function () { importAsset(asset, importBtn); };

      var previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "secondary";
      previewBtn.textContent = isAudioAsset(asset) ? "▶" : "↗";
      previewBtn.onclick = function () {
        if (isAudioAsset(asset)) previewAudio(asset);
        else openExternal(asset);
      };

      actions.appendChild(importBtn);
      actions.appendChild(previewBtn);

      body.appendChild(meta);
      body.appendChild(title);
      body.appendChild(sub);
      body.appendChild(actions);
      card.appendChild(thumb);
      card.appendChild(body);
      els.assetGrid.appendChild(card);
    });
  }

  function requestJson(url, requestOptions) {
    requestOptions = requestOptions || {};
    if (window.require) {
      var http = window.require("http");
      var https = window.require("https");
      var URLCtor = window.require("url").URL;
      return new Promise(function (resolve, reject) {
        var parsed = new URLCtor(url);
        var client = parsed.protocol === "https:" ? https : http;
        var body = requestOptions.body ? JSON.stringify(requestOptions.body) : "";
        var headers = requestOptions.skipAuth ? {} : authHeaders();
        if (body) {
          headers["Content-Type"] = "application/json";
          headers["Content-Length"] = Buffer.byteLength(body);
        }
        var nodeOptions = {
          method: requestOptions.method || "GET",
          headers: headers
        };
        var req = client.request(parsed, nodeOptions, function (response) {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            requestJson(response.headers.location, requestOptions).then(resolve).catch(reject);
            response.resume();
            return;
          }
          var chunks = [];
          response.on("data", function (chunk) { chunks.push(chunk); });
          response.on("end", function () {
            var body = Buffer.concat(chunks).toString("utf8");
            if (response.statusCode < 200 || response.statusCode >= 300) {
              reject(new Error("Request failed: " + response.statusCode + " " + body.slice(0, 120)));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(new Error("Invalid API response."));
            }
          });
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
      });
    }

    var fetchOptions = {
      method: requestOptions.method || "GET",
      headers: requestOptions.skipAuth ? {} : authHeaders()
    };
    if (requestOptions.body) {
      fetchOptions.headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(requestOptions.body);
    }
    return fetch(url, fetchOptions).then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    });
  }

  function getJson(url) {
    return requestJson(url);
  }

  function postJson(url, body, skipAuth) {
    return requestJson(url, { method: "POST", body: body, skipAuth: skipAuth });
  }

  function getDirectUrl(asset, download) {
    var filename = uploadFilename(asset.file_url);
    if (!filename) return Promise.resolve(authenticatedFileUrl(asset.file_url, download, safeFilename(asset)));

    var params = download ? "?download=1&name=" + encodeURIComponent(safeFilename(asset)) : "";
    return getJson(apiUrl("/uploads/" + encodeURIComponent(filename) + "/direct" + params))
      .then(function (data) { return data.url || authenticatedFileUrl(asset.file_url, download, safeFilename(asset)); })
      .catch(function () { return authenticatedFileUrl(asset.file_url, download, safeFilename(asset)); });
  }

  function previewAudio(asset) {
    if (!asset.file_url) {
      showError("No preview", "This asset does not have an uploaded audio file.");
      return;
    }
    clearErrorState();
    setStatus("Preparing preview", asset.title || "Audio");
    getDirectUrl(asset, false).then(function (url) {
      els.playerTitle.textContent = asset.title || "Audio preview";
      els.playerSubtitle.textContent = asset.creator_tag ? "Audio by " + asset.creator_tag : "Playing from Effects Academy";
      els.playerThumb.innerHTML = "";
      var thumbnailUrl = fileUrl(asset.thumbnail_url || "");
      if (thumbnailUrl) {
        var image = document.createElement("img");
        image.src = thumbnailUrl;
        image.alt = "";
        els.playerThumb.appendChild(image);
      }
      currentAudioAsset = asset;
      els.playerCurrent.textContent = "0:00";
      els.playerDuration.textContent = "0:00";
      els.playerProgress.value = "0";
      els.playerProgress.max = "0";
      els.audioEl.src = url;
      els.player.classList.remove("hidden");
      els.audioEl.play().catch(function () {});
      setStatus("Previewing audio", asset.title || "Audio");
    }).catch(function (err) {
      showError("Preview failed", err.message || "Could not preview this audio.");
    });
  }

  function openExternal(asset) {
    var url = asset.external_url || asset.thumbnail_url || "";
    if (!url) return;
    if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
      window.cep.util.openURLInDefaultBrowser(url);
    } else {
      window.open(url, "_blank");
    }
  }

  function downloadBinary(url, targetPath) {
    var fs = window.require && window.require("fs");
    var http = window.require && window.require("http");
    var https = window.require && window.require("https");
    if (!fs || !http || !https) return Promise.reject(new Error("CEP Node access is unavailable."));

    return new Promise(function (resolve, reject) {
      var client = /^https:/i.test(url) ? https : http;
      var options = {};
      if (url.indexOf(state.apiBase.replace(/\/+$/, "")) === 0) {
        options.headers = authHeaders();
      }
      client.get(url, options, function (response) {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          downloadBinary(response.headers.location, targetPath).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error("Download failed: " + response.statusCode));
          response.resume();
          return;
        }
        var file = fs.createWriteStream(targetPath);
        response.pipe(file);
        file.on("finish", function () {
          file.close(function () { resolve(targetPath); });
        });
        file.on("error", reject);
      }).on("error", reject);
    });
  }

  function extensionDownloadDir() {
    var fs = window.require && window.require("fs");
    var path = window.require && window.require("path");
    if (!fs || !path) throw new Error("CEP Node access is unavailable.");
    var base = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE;
    var dir = path.join(base, "EffectsAcademy", "AfterEffectsDownloads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function uniqueTargetPath(filename) {
    var fs = window.require("fs");
    var path = window.require("path");
    var dir = extensionDownloadDir();
    var parsed = path.parse(filename);
    var candidate = path.join(dir, filename);
    var index = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(dir, parsed.name + "-" + index + parsed.ext);
      index += 1;
    }
    return candidate;
  }

  function uniqueExtractDir(archivePath) {
    var fs = window.require("fs");
    var path = window.require("path");
    var parsed = path.parse(archivePath);
    var root = path.join(extensionDownloadDir(), parsed.name + "-extracted");
    var candidate = root;
    var index = 1;
    while (fs.existsSync(candidate)) {
      candidate = root + "-" + index;
      index += 1;
    }
    fs.mkdirSync(candidate, { recursive: true });
    return candidate;
  }

  function uniqueNestedExtractDir(archivePath) {
    var fs = window.require("fs");
    var path = window.require("path");
    var parsed = path.parse(archivePath);
    var root = path.join(parsed.dir, parsed.name + "-unpacked");
    var candidate = root;
    var index = 1;
    while (fs.existsSync(candidate)) {
      candidate = root + "-" + index;
      index += 1;
    }
    fs.mkdirSync(candidate, { recursive: true });
    return candidate;
  }

  function collectArchiveFiles(folderPath, files) {
    var fs = window.require("fs");
    var path = window.require("path");
    var names = [];
    try {
      names = fs.readdirSync(folderPath);
    } catch (err) {
      return;
    }
    names.forEach(function (name) {
      var fullPath = path.join(folderPath, name);
      var stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch (err) {
        return;
      }
      if (stat.isDirectory()) {
        collectArchiveFiles(fullPath, files);
      } else if (stat.isFile() && isArchivePath(fullPath)) {
        files.push(fullPath);
      }
    });
  }

  function firstExistingPath(paths) {
    var fs = window.require("fs");
    for (var i = 0; i < paths.length; i += 1) {
      if (fs.existsSync(paths[i])) return paths[i];
    }
    return "";
  }

  function runProcess(command, args) {
    var childProcess = window.require && window.require("child_process");
    if (!childProcess) return Promise.reject(new Error("CEP process access is unavailable."));
    return new Promise(function (resolve, reject) {
      childProcess.execFile(command, args, { windowsHide: true }, function (error, stdout, stderr) {
        if (error) {
          reject(new Error((stderr || stdout || error.message || "Extraction failed").trim()));
          return;
        }
        resolve(stdout || "");
      });
    });
  }

  function extractArchiveTo(archivePath, extractDir) {
    var path = window.require("path");
    var ext = extensionFromPath(archivePath);
    if (ext === "zip") {
      return runProcess("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",
        archivePath,
        extractDir
      ]).then(function () { return extractDir; });
    }

    var sevenZip = firstExistingPath([
      "C:\\Program Files\\7-Zip\\7z.exe",
      "C:\\Program Files (x86)\\7-Zip\\7z.exe"
    ]);
    if (sevenZip) {
      return runProcess(sevenZip, ["x", archivePath, "-o" + extractDir, "-y"]).then(function () { return extractDir; });
    }

    var winRar = firstExistingPath([
      "C:\\Program Files\\WinRAR\\WinRAR.exe",
      "C:\\Program Files (x86)\\WinRAR\\WinRAR.exe"
    ]);
    if (winRar) {
      return runProcess(winRar, ["x", "-ibck", "-o+", archivePath, extractDir + path.sep]).then(function () { return extractDir; });
    }

    return Promise.reject(new Error("This is a ." + ext + " archive. Install WinRAR or 7-Zip so the extension can unpack and import it."));
  }

  function extractArchive(archivePath) {
    return extractArchiveTo(archivePath, uniqueExtractDir(archivePath));
  }

  function unpackNestedArchives(rootDir, depth) {
    depth = depth || 0;
    if (depth >= 2) return Promise.resolve(rootDir);
    var archives = [];
    collectArchiveFiles(rootDir, archives);
    if (!archives.length) return Promise.resolve(rootDir);

    var chain = Promise.resolve();
    archives.forEach(function (archivePath) {
      chain = chain.then(function () {
        return extractArchiveTo(archivePath, uniqueNestedExtractDir(archivePath))
          .then(function () { return null; })
          .catch(function () { return null; });
      });
    });
    return chain.then(function () { return unpackNestedArchives(rootDir, depth + 1); });
  }

  function openFolder(folderPath) {
    var childProcess = window.require && window.require("child_process");
    if (!childProcess || !folderPath) return;
    childProcess.execFile("explorer.exe", [folderPath], { windowsHide: true }, function () {});
  }

  function evalScript(script) {
    return new Promise(function (resolve, reject) {
      if (!window.__adobe_cep__ || !window.__adobe_cep__.evalScript) {
        reject(new Error("After Effects bridge is unavailable."));
        return;
      }
      window.__adobe_cep__.evalScript(script, function (result) {
        resolve(result);
      });
    });
  }

  function importAsset(asset, button, playbackRate) {
    if (!asset.file_url) {
      showError("No import file", "This asset only has an external link, so the AE panel cannot import it directly.");
      return;
    }
    playbackRate = playbackRate || 1;
    clearErrorState();
    state.loadingId = asset.id;
    var originalButtonText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Loading…";
    }
    setStatus("Downloading asset", playbackRate === 1 ? (asset.title || "Asset") : (asset.title || "Audio") + " at " + playbackRate + "x");

    getDirectUrl(asset, true)
      .then(function (url) {
        var targetPath = uniqueTargetPath(safeFilename(asset));
        return downloadBinary(url, targetPath);
      })
      .then(function (targetPath) {
        if (!isArchivePath(targetPath)) return targetPath;
        setStatus("Unpacking project pack", asset.title || "Archive");
        return extractArchive(targetPath).then(function (extractDir) {
          return unpackNestedArchives(extractDir).then(function () {
            return { extractedDir: extractDir };
          });
        });
      })
      .then(function (target) {
        setStatus("Sending to After Effects", asset.title || "Asset");
        var script = target && target.extractedDir
          ? "EA_importFolder(" + JSON.stringify(target.extractedDir) + "," + JSON.stringify(asset.category || "") + ")"
          : "EA_importAsset(" + JSON.stringify(target) + "," + JSON.stringify(asset.category || "") + "," + JSON.stringify(playbackRate) + ")";
        return evalScript(script);
      })
      .then(function (result) {
        var parsed = {};
        try { parsed = JSON.parse(result || "{}"); } catch (e) {}
        if (parsed.open_folder && parsed.folder_path) {
          openFolder(parsed.folder_path);
        }
        if (parsed.ok) {
          clearErrorState();
          setStatus("Imported", parsed.message || (asset.title || "Asset"));
        } else if (parsed.extracted) {
          clearErrorState();
          setStatus("Pack extracted", parsed.message || "Pack extracted. Opened the folder so you can choose files manually.");
        } else {
          showError("Import needs attention", parsed.message || "After Effects could not import this file.");
        }
      })
      .catch(function (err) {
        showError("Import failed", err.message || "Could not import this asset.");
      })
      .finally(function () {
        state.loadingId = "";
        if (button) {
          button.disabled = false;
          button.textContent = originalButtonText || (isArchiveAsset(asset) ? "Unpack + import" : isAudioAsset(asset) ? "Add to comp" : "Import");
        }
      });
  }

  function importCurrentAudio(rate, button) {
    if (!currentAudioAsset) {
      showError("Pick an audio first", "Preview an audio before adding slowed versions.");
      return;
    }
    importAsset(currentAudioAsset, button, rate);
  }

  function redeemPairingCode() {
    var code = (els.pairingCodeInput.value || "").trim().toUpperCase();
    if (!code) {
      showError("Pairing code required", "Generate a code on the Premium page, then enter it here.");
      return;
    }
    els.pairingCodeBtn.disabled = true;
    els.pairingCodeBtn.textContent = "Connecting…";
    clearErrorState();
    setStatus("Connecting Premium account", "Checking your pairing code…");
    postJson(apiUrl("/extension/redeem-code"), {
      code: code,
      device_id: ensureDeviceId()
    }, true)
      .then(function (data) {
        if (!data.token) throw new Error("No extension token returned.");
        state.authToken = data.token;
        localStorage.setItem(STORAGE_KEYS.authToken, state.authToken);
        els.authTokenInput.value = state.authToken;
        els.pairingCodeInput.value = "";
        setStatus("Premium account connected", "Loading your extension library…");
        return loadAssets();
      })
      .catch(function (err) {
        showError("Could not connect", err.message || "Pairing code is invalid, expired, or already used.");
      })
      .finally(function () {
        els.pairingCodeBtn.disabled = false;
        els.pairingCodeBtn.textContent = "Connect Premium account";
      });
  }

  function loadAssets() {
    clearErrorState();
    if (!state.authToken) {
      state.assets = [];
      renderAssets();
      showError("Premium pairing required", "Generate a pairing code on the Premium page, then enter it in Connection settings.");
      return Promise.resolve();
    }
    setStatus("Live library", "Loading assets from Effects Academy…");
    return getJson(apiUrl("/extension/assets"))
      .then(function (assets) {
      state.assets = (assets || []).filter(function (asset) {
          return ASSET_CATEGORIES.indexOf(asset.category) !== -1 && asset.category !== "Videos";
        });
        setStatus("Premium extension unlocked", "New uploads appear here after refresh.");
        renderAssets();
      })
      .catch(function (err) {
        showError("Premium access required", err.message || "Sign in with an active Premium account.");
        state.assets = [];
        renderAssets();
      });
  }

  function initSettings() {
    applyPreferences();
    els.apiBaseInput.value = state.apiBase;
    els.authTokenInput.value = state.authToken;
    bindPreference(els.uiStyleInput, "uiStyle", STORAGE_KEYS.uiStyle);
    bindPreference(els.layoutModeInput, "layoutMode", STORAGE_KEYS.layoutMode);
    bindPreference(els.densityInput, "density", STORAGE_KEYS.density);
    bindPreference(els.accentInput, "accent", STORAGE_KEYS.accent);
    bindPreference(els.motionInput, "motion", STORAGE_KEYS.motion);
    bindPreference(els.fontInput, "font", STORAGE_KEYS.font);
    bindCaptionSetting(els.captionFontInput, "font", STORAGE_KEYS.captionFont, false);
    bindCaptionSetting(els.captionFontSizeInput, "fontSize", STORAGE_KEYS.captionFontSize, true);
    bindCaptionSetting(els.captionYInput, "y", STORAGE_KEYS.captionY, true);
    bindCaptionSetting(els.captionColorInput, "color", STORAGE_KEYS.captionColor, false);
    bindCaptionSetting(els.captionGlowExposureInput, "glowExposure", STORAGE_KEYS.captionGlowExposure, true);
    bindCaptionSetting(els.captionGlowRadiusInput, "glowRadius", STORAGE_KEYS.captionGlowRadius, true);
    bindCaptionSetting(els.captionShadowOpacityInput, "shadowOpacity", STORAGE_KEYS.captionShadowOpacity, true);
    bindCaptionSetting(els.captionShadowSoftnessInput, "shadowSoftness", STORAGE_KEYS.captionShadowSoftness, true);
    els.apiBaseInput.addEventListener("change", function () {
      state.apiBase = els.apiBaseInput.value.trim() || DEFAULT_API_BASE;
      localStorage.setItem(STORAGE_KEYS.apiBase, state.apiBase);
      loadAssets();
    });
    els.authTokenInput.addEventListener("change", function () {
      state.authToken = els.authTokenInput.value.trim();
      localStorage.setItem(STORAGE_KEYS.authToken, state.authToken);
      loadAssets();
    });
    els.pairingCodeBtn.addEventListener("click", redeemPairingCode);
    els.pairingCodeInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") redeemPairingCode();
    });
    if (els.captionCreateBtn) els.captionCreateBtn.addEventListener("click", createCaptions);
  }

  function init() {
    initSettings();
    renderTabs();
    els.searchInput.addEventListener("input", function () {
      state.search = els.searchInput.value || "";
      renderAssets();
    });
    els.refreshBtn.addEventListener("click", loadAssets);
    els.playerPlayBtn.addEventListener("click", function () {
      if (!els.audioEl.src) return;
      if (els.audioEl.paused) els.audioEl.play().catch(function () {});
      else els.audioEl.pause();
    });
    els.playerProgress.addEventListener("input", function () {
      els.audioEl.currentTime = parseFloat(els.playerProgress.value || "0");
    });
    els.playerMuteBtn.addEventListener("click", function () {
      els.audioEl.muted = !els.audioEl.muted;
      els.playerMuteBtn.textContent = els.audioEl.muted ? "🔇" : "🔊";
    });
    els.playerVolume.addEventListener("input", function () {
      els.audioEl.volume = parseFloat(els.playerVolume.value || "1");
      els.audioEl.muted = els.audioEl.volume === 0;
      els.playerMuteBtn.textContent = els.audioEl.muted ? "🔇" : "🔊";
    });
    els.audioEl.addEventListener("play", function () {
      els.playerPlayBtn.textContent = "Ⅱ";
    });
    els.audioEl.addEventListener("pause", function () {
      els.playerPlayBtn.textContent = "▶";
    });
    els.audioEl.addEventListener("loadedmetadata", function () {
      els.playerProgress.max = String(els.audioEl.duration || 0);
      els.playerDuration.textContent = fmtTime(els.audioEl.duration);
    });
    els.audioEl.addEventListener("timeupdate", function () {
      els.playerProgress.value = String(els.audioEl.currentTime || 0);
      els.playerCurrent.textContent = fmtTime(els.audioEl.currentTime);
    });
    els.playerImportBtn.addEventListener("click", function () { importCurrentAudio(1, els.playerImportBtn); });
    els.playerSlow09Btn.addEventListener("click", function () { importCurrentAudio(0.9, els.playerSlow09Btn); });
    els.playerSlow08Btn.addEventListener("click", function () { importCurrentAudio(0.8, els.playerSlow08Btn); });
    loadAssets();
  }

  init();
}());
