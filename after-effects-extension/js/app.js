(function () {
  "use strict";

  var DEFAULT_API_BASE = "https://effects-academy-api.onrender.com";
  var CATEGORIES = ["All", "Audios", "Presets", "Project Files", "Premium"];
  var AUDIO_CATEGORIES = { "Audios": true };
  var STORAGE_KEYS = {
    apiBase: "ea_extension_api_base",
    authToken: "ea_extension_auth_token",
    deviceId: "ea_extension_device_id",
    layoutMode: "ea_extension_layout_mode",
    density: "ea_extension_density",
    accent: "ea_extension_accent",
    motion: "ea_extension_motion",
    font: "ea_extension_font"
  };

  var state = {
    apiBase: localStorage.getItem(STORAGE_KEYS.apiBase) || DEFAULT_API_BASE,
    authToken: localStorage.getItem(STORAGE_KEYS.authToken) || "",
    deviceId: localStorage.getItem(STORAGE_KEYS.deviceId) || "",
    layoutMode: localStorage.getItem(STORAGE_KEYS.layoutMode) || "auto",
    density: localStorage.getItem(STORAGE_KEYS.density) || "comfortable",
    accent: localStorage.getItem(STORAGE_KEYS.accent) || "violet",
    motion: localStorage.getItem(STORAGE_KEYS.motion) || "premium",
    font: localStorage.getItem(STORAGE_KEYS.font) || "modern",
    assets: [],
    category: "All",
    search: "",
    loadingId: ""
  };

  var els = {
    refreshBtn: document.getElementById("refreshBtn"),
    statusTitle: document.getElementById("statusTitle"),
    statusText: document.getElementById("statusText"),
    assetCount: document.getElementById("assetCount"),
    searchInput: document.getElementById("searchInput"),
    categoryTabs: document.getElementById("categoryTabs"),
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
    layoutModeInput: document.getElementById("layoutModeInput"),
    densityInput: document.getElementById("densityInput"),
    accentInput: document.getElementById("accentInput"),
    motionInput: document.getElementById("motionInput"),
    fontInput: document.getElementById("fontInput"),
    pairingCodeInput: document.getElementById("pairingCodeInput"),
    pairingCodeBtn: document.getElementById("pairingCodeBtn"),
    authTokenInput: document.getElementById("authTokenInput")
  };

  var currentAudioAsset = null;

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
    var assets = visibleAssets();
    els.assetCount.textContent = String(assets.length);
    els.emptyState.classList.toggle("hidden", assets.length > 0);
    els.assetGrid.innerHTML = "";

    assets.forEach(function (asset) {
      var card = document.createElement("article");
      card.className = "card";
      card.style.animationDelay = Math.min(360, els.assetGrid.children.length * 22) + "ms";

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
          return CATEGORIES.indexOf(asset.category) !== -1 && asset.category !== "Videos";
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
    bindPreference(els.layoutModeInput, "layoutMode", STORAGE_KEYS.layoutMode);
    bindPreference(els.densityInput, "density", STORAGE_KEYS.density);
    bindPreference(els.accentInput, "accent", STORAGE_KEYS.accent);
    bindPreference(els.motionInput, "motion", STORAGE_KEYS.motion);
    bindPreference(els.fontInput, "font", STORAGE_KEYS.font);
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
