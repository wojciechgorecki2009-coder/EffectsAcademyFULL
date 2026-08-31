(function () {
  "use strict";

  var DEFAULT_API_BASE = "https://effects-academy-api.onrender.com";
  var CATEGORIES = ["All", "Audios", "Sound FX", "Presets", "Project Files", "Overlays", "Premium"];
  var AUDIO_CATEGORIES = { "Audios": true, "Sound FX": true };
  var STORAGE_KEYS = {
    apiBase: "ea_extension_api_base",
    authToken: "ea_extension_auth_token"
  };

  var state = {
    apiBase: localStorage.getItem(STORAGE_KEYS.apiBase) || DEFAULT_API_BASE,
    authToken: localStorage.getItem(STORAGE_KEYS.authToken) || "",
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
    audioEl: document.getElementById("audioEl"),
    apiBaseInput: document.getElementById("apiBaseInput"),
    authTokenInput: document.getElementById("authTokenInput")
  };

  function apiUrl(path) {
    return state.apiBase.replace(/\/+$/, "") + "/api" + path;
  }

  function fileUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return state.apiBase.replace(/\/+$/, "") + path;
  }

  function uploadFilename(path) {
    var match = String(path || "").match(/\/api\/uploads\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function authHeaders() {
    return state.authToken ? { Authorization: "Bearer " + state.authToken } : {};
  }

  function safeFilename(asset) {
    if (asset.original_filename) return asset.original_filename;
    var title = (asset.title || "asset").replace(/[<>:"/\\|?*]+/g, "_").trim() || "asset";
    var match = String(asset.file_url || asset.external_url || "").match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return title + (match ? "." + match[1] : "");
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

  function renderTabs() {
    els.categoryTabs.innerHTML = "";
    CATEGORIES.forEach(function (category) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "tab" + (state.category === category ? " active" : "");
      button.textContent = category;
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
      importBtn.textContent = isAudioAsset(asset) ? "Add to comp" : "Import";
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

  function getJson(url) {
    if (window.require) {
      var http = window.require("http");
      var https = window.require("https");
      var URLCtor = window.require("url").URL;
      return new Promise(function (resolve, reject) {
        var parsed = new URLCtor(url);
        var client = parsed.protocol === "https:" ? https : http;
        var options = {
          method: "GET",
          headers: authHeaders()
        };
        var req = client.request(parsed, options, function (response) {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            getJson(response.headers.location).then(resolve).catch(reject);
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
        req.end();
      });
    }

    return fetch(url, { headers: authHeaders() }).then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    });
  }

  function getDirectUrl(asset, download) {
    var filename = uploadFilename(asset.file_url);
    if (!filename) return Promise.resolve(fileUrl(asset.file_url));

    var params = download ? "?download=1&name=" + encodeURIComponent(safeFilename(asset)) : "";
    return getJson(apiUrl("/uploads/" + encodeURIComponent(filename) + "/direct" + params))
      .then(function (data) { return data.url || fileUrl(asset.file_url); })
      .catch(function () { return fileUrl(asset.file_url); });
  }

  function previewAudio(asset) {
    if (!asset.file_url) {
      setStatus("No preview", "This asset does not have an uploaded audio file.");
      return;
    }
    setStatus("Preparing preview", asset.title || "Audio");
    getDirectUrl(asset, false).then(function (url) {
      els.playerTitle.textContent = asset.title || "Audio preview";
      els.playerThumb.innerHTML = "";
      var thumbnailUrl = fileUrl(asset.thumbnail_url || "");
      if (thumbnailUrl) {
        var image = document.createElement("img");
        image.src = thumbnailUrl;
        image.alt = "";
        els.playerThumb.appendChild(image);
      }
      els.audioEl.src = url;
      els.player.classList.remove("hidden");
      els.audioEl.play().catch(function () {});
      setStatus("Previewing audio", asset.title || "Audio");
    }).catch(function (err) {
      setStatus("Preview failed", err.message || "Could not preview this audio.");
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
      client.get(url, function (response) {
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

  function importAsset(asset, button) {
    if (!asset.file_url) return;
    state.loadingId = asset.id;
    button.disabled = true;
    button.textContent = "Loading…";
    setStatus("Downloading asset", asset.title || "Asset");

    getDirectUrl(asset, true)
      .then(function (url) {
        var targetPath = uniqueTargetPath(safeFilename(asset));
        return downloadBinary(url, targetPath);
      })
      .then(function (targetPath) {
        setStatus("Sending to After Effects", asset.title || "Asset");
        var script = "EA_importAsset(" + JSON.stringify(targetPath) + "," + JSON.stringify(asset.category || "") + ")";
        return evalScript(script);
      })
      .then(function (result) {
        var parsed = {};
        try { parsed = JSON.parse(result || "{}"); } catch (e) {}
        if (parsed.ok) {
          setStatus("Imported", parsed.message || (asset.title || "Asset"));
        } else {
          setStatus("Import needs attention", parsed.message || "After Effects could not import this file.");
        }
      })
      .catch(function (err) {
        setStatus("Import failed", err.message || "Could not import this asset.");
      })
      .finally(function () {
        state.loadingId = "";
        button.disabled = false;
        button.textContent = isAudioAsset(asset) ? "Add to comp" : "Import";
      });
  }

  function loadAssets() {
    setStatus("Live library", "Loading assets from Effects Academy…");
    return getJson(apiUrl("/assets"))
      .then(function (assets) {
        state.assets = (assets || []).filter(function (asset) {
          return CATEGORIES.indexOf(asset.category) !== -1 && asset.category !== "Videos";
        });
        setStatus("Live library ready", "New uploads appear here after refresh.");
        renderAssets();
      })
      .catch(function (err) {
        setStatus("Could not load assets", err.message || "Check the API base/settings.");
        state.assets = [];
        renderAssets();
      });
  }

  function initSettings() {
    els.apiBaseInput.value = state.apiBase;
    els.authTokenInput.value = state.authToken;
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
  }

  function init() {
    initSettings();
    renderTabs();
    els.searchInput.addEventListener("input", function () {
      state.search = els.searchInput.value || "";
      renderAssets();
    });
    els.refreshBtn.addEventListener("click", loadAssets);
    loadAssets();
  }

  init();
}());
