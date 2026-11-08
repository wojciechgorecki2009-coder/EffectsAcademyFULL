/*
 * 3D Models tab: import Sketchfab models straight into the active comp.
 *
 * Works like the website's 3D Models tool: model details are public, and
 * downloads use the user's own Sketchfab account (their personal API token,
 * kept in this panel and only sent to Sketchfab). Only models their creators
 * made downloadable can be fetched. OBJ is made from the GLB on this computer
 * with js/vendor/obj-converter.js (a build of the website's converter, loaded
 * only when first needed), written to disk with its textures, then imported.
 */
(function () {
  "use strict";

  var API = "https://api.sketchfab.com/v3";
  var TOKEN_KEY = "ea_sketchfab_token";
  var TOKEN_URL = "https://sketchfab.com/settings/password";
  // Sketchfab's download links last 5 minutes; older ones are fetched again.
  var LINK_LIFETIME_MS = 4 * 60 * 1000;

  var panel = window.EAPanel;
  if (!panel) return;

  function byId(id) { return document.getElementById(id); }

  var els = {
    gate: byId("modelsPremiumGate"),
    workflow: byId("modelsWorkflow"),
    linkForm: byId("modelLinkForm"),
    linkInput: byId("modelLinkInput"),
    findBtn: byId("modelFindBtn"),
    lookupError: byId("modelLookupError"),
    card: byId("modelCard"),
    thumb: byId("modelThumb"),
    lockChip: byId("modelLockChip"),
    name: byId("modelName"),
    author: byId("modelAuthor"),
    vertices: byId("modelVertices"),
    faces: byId("modelFaces"),
    animations: byId("modelAnimations"),
    connect: byId("sketchfabConnect"),
    tokenLinkBtn: byId("sketchfabTokenLinkBtn"),
    tokenInput: byId("sketchfabTokenInput"),
    connectBtn: byId("sketchfabConnectBtn"),
    connectError: byId("sketchfabConnectError"),
    importCard: byId("modelImportCard"),
    accountName: byId("sketchfabAccountName"),
    disconnectBtn: byId("sketchfabDisconnectBtn"),
    formats: byId("modelFormats"),
    progressTrack: byId("modelProgressTrack"),
    progressBar: byId("modelProgressBar"),
    statusText: byId("modelStatusText"),
    importBtn: byId("modelImportBtn"),
    credit: byId("modelCredit"),
    license: byId("modelLicense"),
    licenseNote: byId("modelLicenseNote"),
    attribution: byId("modelAttribution"),
    copyCreditBtn: byId("modelCopyCreditBtn")
  };

  var state = {
    token: readToken(),
    account: null,
    model: null,
    links: null,
    format: "obj",
    busy: false,
    locked: true
  };

  // In the website demo (panel.demo) no Sketchfab token is ever read, asked for or stored.
  function readToken() {
    if (panel.demo) return "";
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }

  function saveToken(token) {
    if (panel.demo) return;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function show(el, visible) {
    if (el) el.classList.toggle("hidden", !visible);
  }

  function number(value) {
    return typeof value === "number" && isFinite(value) ? value.toLocaleString() : "—";
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    var units = ["B", "KB", "MB", "GB"];
    var value = bytes;
    var unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return (value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)) + " " + units[unit];
  }

  /** The 32-character model id in any Sketchfab model, embed or short link. */
  function parseModelUid(text) {
    var match = String(text || "").match(/(?:^|[^a-f0-9])([a-f0-9]{32})(?![a-f0-9])/i);
    return match ? match[1].toLowerCase() : null;
  }

  function sketchfab(path, token) {
    var options = token ? { headers: { Authorization: "Token " + token } } : undefined;
    return fetch(API + path, options).catch(function () {
      throw new Error("Couldn't reach Sketchfab. Check your connection and try again.");
    }).then(function (response) {
      if (response.ok) return response.json();
      var error = new Error(
        response.status === 401 ? "Sketchfab didn't accept your API token. Connect your account again." :
        response.status === 404 ? "There's no Sketchfab model at that link." :
        response.status === 429 ? "Sketchfab is limiting requests right now. Wait a minute and try again." :
        response.status === 403 ? "Sketchfab won't let this account download that model." :
        "Sketchfab had a problem. Try again in a moment."
      );
      error.status = response.status;
      throw error;
    });
  }

  function attributionText(model) {
    var author = (model.user && (model.user.displayName || model.user.username)) || "its creator";
    var profile = (model.user && model.user.profileUrl) || "https://sketchfab.com";
    var license = model.license ? " is licensed under " + model.license.label + (model.license.url ? " (" + model.license.url + ")" : "") : "";
    return "\"" + model.name + "\" (" + model.viewerUrl + ") by " + author + " (" + profile + ")" + license + ".";
  }

  function pickThumbnail(model) {
    var images = ((model.thumbnails && model.thumbnails.images) || []).slice().sort(function (a, b) { return a.width - b.width; });
    for (var i = 0; i < images.length; i += 1) {
      if (images[i].width >= 640) return images[i].url;
    }
    return images.length ? images[images.length - 1].url : "";
  }

  function safeName(name) {
    return String(name || "model").replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, " ").trim() || "model";
  }

  function setProgress(fraction, text) {
    show(els.progressTrack, fraction !== null);
    if (fraction !== null) els.progressBar.style.width = Math.round(Math.max(0, Math.min(1, fraction)) * 100) + "%";
    if (text) els.statusText.textContent = text;
  }

  function render() {
    var model = state.model;
    var connected = Boolean(state.token);
    var downloadable = Boolean(model && model.isDownloadable);

    show(els.connect, !connected);
    show(els.importCard, connected);
    show(els.credit, downloadable && Boolean(model.license));
    els.accountName.textContent = state.account ? state.account.displayName : connected ? "Connected" : "";

    var buttons = els.formats.querySelectorAll(".model-format");
    for (var i = 0; i < buttons.length; i += 1) {
      var id = buttons[i].getAttribute("data-format");
      var offered = Boolean(state.links && state.links.glb);
      var active = id === state.format;
      buttons[i].classList.toggle("active", active);
      buttons[i].setAttribute("aria-checked", active ? "true" : "false");
      buttons[i].disabled = state.busy || (Boolean(state.links) && !offered);
      var size = buttons[i].querySelector("[data-size]");
      size.textContent = !state.links ? "" : !offered ? "Not offered" : id === "obj" ? "Converted" : formatBytes(state.links.glb.size);
    }

    els.importBtn.disabled = state.locked || state.busy || !downloadable || !(state.links && state.links.glb);
    if (!state.busy) {
      els.importBtn.textContent = "Import " + state.format.toUpperCase() + " to comp";
      if (!model) setProgress(null, "Find a model to import it.");
      else if (!downloadable) setProgress(null, "Its creator hasn't made this model downloadable, so Sketchfab doesn't offer a download for it.");
    }
  }

  function renderModel() {
    var model = state.model;
    show(els.card, Boolean(model));
    if (!model) return;
    els.thumb.src = pickThumbnail(model);
    els.name.textContent = model.name || "Untitled model";
    els.author.textContent = "by " + ((model.user && (model.user.displayName || model.user.username)) || "unknown");
    els.vertices.textContent = number(model.vertexCount);
    els.faces.textContent = number(model.faceCount);
    els.animations.textContent = number(model.animationCount);
    show(els.lockChip, !model.isDownloadable);
    if (model.license) {
      els.license.textContent = model.license.label;
      els.licenseNote.textContent = model.license.requirements || "";
      els.attribution.textContent = attributionText(model);
    }
  }

  function loadLinks() {
    if (!state.model || !state.model.isDownloadable || !state.token) return Promise.resolve(null);
    if (panel.demo) {
      var archive = state.model.archives && state.model.archives.glb;
      state.links = { glb: { size: archive && archive.size }, fetchedAt: Date.now() };
      setProgress(null, "Ready to import.");
      render();
      return Promise.resolve(state.links);
    }
    setProgress(null, "Asking Sketchfab for the files…");
    return sketchfab("/models/" + state.model.uid + "/download", state.token).then(function (links) {
      state.links = { glb: links.glb && links.glb.url ? links.glb : null, fetchedAt: Date.now() };
      setProgress(null, state.links.glb ? "Ready to import." : "Sketchfab doesn't offer this model as GLB, so it can't be imported here.");
      render();
      return state.links;
    }).catch(function (err) {
      if (err.status === 401) disconnect();
      state.links = null;
      setProgress(null, err.message);
      render();
      return null;
    });
  }

  function find() {
    var uid = parseModelUid(els.linkInput.value);
    show(els.lookupError, false);
    if (!uid) {
      els.lookupError.textContent = "Paste a Sketchfab model link, like sketchfab.com/3d-models/name-1a2b3c…";
      show(els.lookupError, true);
      return;
    }
    if (state.model && state.model.uid === uid) return;
    els.findBtn.disabled = true;
    els.findBtn.textContent = "Finding…";
    state.links = null;
    sketchfab("/models/" + uid).then(function (model) {
      state.model = model;
      renderModel();
      render();
      return loadLinks();
    }).catch(function (err) {
      state.model = null;
      renderModel();
      render();
      els.lookupError.textContent = err.message;
      show(els.lookupError, true);
    }).then(function () {
      els.findBtn.disabled = false;
      els.findBtn.textContent = "Find";
    });
  }

  function checkAccount(token) {
    return sketchfab("/me", token).then(function (me) {
      return { username: me.username, displayName: me.displayName || me.username };
    });
  }

  function connect() {
    if (panel.demo) {
      // Pretend to be connected so the import options can be shown; the field is never read.
      els.tokenInput.value = "";
      state.token = "demo";
      state.account = { displayName: "Demo account" };
      render();
      panel.demo("sketchfab-connect", "Demo: Sketchfab connected", "In the extension you paste your own Sketchfab API token here. It's saved only in the panel and sent only to Sketchfab.");
      loadLinks();
      return;
    }
    var token = els.tokenInput.value.trim();
    if (!token) return;
    els.connectBtn.disabled = true;
    show(els.connectError, false);
    checkAccount(token).then(function (account) {
      state.token = token;
      state.account = account;
      saveToken(token);
      els.tokenInput.value = "";
      render();
      panel.setStatus("Sketchfab connected", "Signed in as " + account.displayName + ".");
      return loadLinks();
    }).catch(function (err) {
      els.connectError.textContent = err.status === 401 ? "That token wasn't accepted. Copy it again from your Sketchfab settings." : err.message;
      show(els.connectError, true);
    }).then(function () {
      els.connectBtn.disabled = false;
    });
  }

  function disconnect() {
    state.token = "";
    state.account = null;
    state.links = null;
    saveToken("");
    render();
  }

  var converterLoading = null;
  function loadConverter() {
    if (window.EAObjConverter) return Promise.resolve(window.EAObjConverter);
    if (!converterLoading) {
      converterLoading = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = "./js/vendor/obj-converter.js";
        script.onload = function () {
          if (window.EAObjConverter) resolve(window.EAObjConverter);
          else reject(new Error("The OBJ converter couldn't start in this version of After Effects."));
        };
        script.onerror = function () {
          converterLoading = null;
          reject(new Error("The OBJ converter is missing from the extension. Reinstall it, or import GLB instead."));
        };
        document.head.appendChild(script);
      });
    }
    return converterLoading;
  }

  function uniqueFolder(base) {
    var fs = window.require("fs");
    var path = window.require("path");
    var root = path.join(panel.extensionDownloadDir(), base);
    var candidate = root;
    for (var i = 2; fs.existsSync(candidate); i += 1) candidate = root + " " + i;
    fs.mkdirSync(candidate, { recursive: true });
    return candidate;
  }

  /** Writes the converter's { "name.obj": bytes, "textures/…": bytes } into a new folder. */
  function writeObjFiles(result, folderName) {
    var fs = window.require("fs");
    var path = window.require("path");
    var folder = uniqueFolder(folderName);
    Object.keys(result.files).forEach(function (relative) {
      var target = path.join(folder, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(result.files[relative]));
    });
    return path.join(folder, result.objName);
  }

  // Website demo: plays the progress steps without downloading the model.
  function demoImport(model) {
    var format = state.format.toUpperCase();
    var steps = [[0.15, "Downloading from Sketchfab…"], [0.55, state.format === "obj" ? "Converting to OBJ with textures…" : "Saving the GLB…"], [0.9, "Importing into After Effects…"]];
    state.busy = true;
    els.importBtn.textContent = "Importing…";
    render();
    steps.forEach(function (step, index) {
      setTimeout(function () { setProgress(step[0], step[1]); }, index * 650);
    });
    setTimeout(function () {
      state.busy = false;
      render();
      setProgress(1, "Demo finished. In After Effects, the model would now be in your comp.");
      panel.demo("model-import", "Demo: nothing was downloaded", "In After Effects, this downloads “" + (model.name || "the model") + "” as " + format + " and adds it to your active comp as a 3D layer.");
      setTimeout(function () { if (!state.busy) show(els.progressTrack, false); }, 1600);
    }, steps.length * 650 + 300);
  }

  function importModel() {
    var model = state.model;
    if (!model || state.busy || state.locked) return;
    if (panel.demo) {
      demoImport(model);
      return;
    }
    if (!window.require) {
      panel.showError("Import unavailable", "This panel needs After Effects' file access to import models.");
      return;
    }
    var fs = window.require("fs");
    var format = state.format;
    var name = safeName(model.name);
    var glbPath = "";
    var hadAnimation = false;
    state.busy = true;
    panel.clearErrorState();
    els.importBtn.textContent = "Importing…";
    render();
    setProgress(0.02, "Preparing the download…");

    // 3D model layers arrived in After Effects 2024, so older versions stop here.
    panel.evalScript("app.version").then(function (version) {
      if (parseFloat(version) < 24) throw new Error("3D models need After Effects 2024 or newer.");
    }, function () {}).then(function () {
      return state.links && Date.now() - state.links.fetchedAt < LINK_LIFETIME_MS ? state.links : loadLinks();
    }).then(function (current) {
      if (!current || !current.glb) throw new Error("Sketchfab didn't provide a download for this model.");
      glbPath = panel.uniqueTargetPath(name + ".glb");
      var share = format === "obj" ? 0.6 : 0.95;
      return panel.downloadBinary(current.glb.url, glbPath, function (fraction) {
        setProgress(fraction * share, "Downloading from Sketchfab… " + Math.round(fraction * 100) + "%");
      });
    }).then(function () {
      if (format !== "obj") return glbPath;
      setProgress(0.62, "Converting to OBJ…");
      return loadConverter().then(function (converter) {
        var buffer = fs.readFileSync(glbPath);
        var bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        return converter.glbToObjFiles(bytes, model.name, function (fraction) {
          setProgress(0.62 + fraction * 0.3, "Converting to OBJ… " + Math.round(fraction * 100) + "%");
        });
      }).then(function (result) {
        hadAnimation = result.hadAnimation;
        var objPath = writeObjFiles(result, name + " (OBJ)");
        try { fs.unlinkSync(glbPath); } catch (e) {}
        return objPath;
      });
    }).then(function (modelPath) {
      setProgress(0.96, "Sending to After Effects…");
      panel.setStatus("Importing 3D model", model.name || "Model");
      return panel.evalScript("EA_importModel(" + JSON.stringify(modelPath) + ")");
    }).then(function (result) {
      var parsed = {};
      try { parsed = JSON.parse(result || "{}"); } catch (e) {}
      if (!parsed.ok) throw new Error(parsed.message || "After Effects couldn't import this model.");
      var message = parsed.message + (hadAnimation ? " OBJ can't hold animation, so it's in its resting pose." : "");
      setProgress(1, message);
      panel.setStatus("3D model imported", model.name || "Model");
    }).catch(function (err) {
      var message = String((err && err.message) || err || "The import failed.");
      setProgress(null, message);
      panel.showError("3D model import failed", message);
    }).then(function () {
      state.busy = false;
      render();
      setTimeout(function () { if (!state.busy) show(els.progressTrack, false); }, 1600);
    });
  }

  function copyCredit() {
    var text = attributionText(state.model);
    var done = function () {
      els.copyCreditBtn.textContent = "Copied";
      setTimeout(function () { els.copyCreditBtn.textContent = "Copy credit"; }, 1600);
    };
    var fallback = function () {
      var area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      area.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  els.linkForm.addEventListener("submit", function (event) {
    event.preventDefault();
    find();
  });
  els.linkInput.addEventListener("paste", function (event) {
    var text = event.clipboardData && event.clipboardData.getData("text");
    if (parseModelUid(text)) setTimeout(find, 0);
  });
  els.connect.addEventListener("submit", function (event) {
    event.preventDefault();
    connect();
  });
  els.tokenLinkBtn.addEventListener("click", function () { panel.openUrl(TOKEN_URL); });
  els.disconnectBtn.addEventListener("click", disconnect);
  els.copyCreditBtn.addEventListener("click", copyCredit);
  els.importBtn.addEventListener("click", importModel);
  els.formats.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest(".model-format");
    if (!button || button.disabled) return;
    state.format = button.getAttribute("data-format");
    render();
  });

  window.EAModels = {
    /** Called when the tab opens: confirm a saved token still works. */
    show: function () {
      render();
      if (state.token && !state.account && !panel.demo) {
        checkAccount(state.token).then(function (account) {
          state.account = account;
          render();
        }).catch(function (err) {
          if (err.status === 401) disconnect();
        });
      }
    },
    setLocked: function (locked) {
      state.locked = locked;
      show(els.gate, locked);
      els.workflow.classList.toggle("premium-locked", locked);
      var controls = els.workflow.querySelectorAll("button, input");
      for (var i = 0; i < controls.length; i += 1) controls[i].disabled = locked;
      if (!locked) render();
    }
  };

  render();
  window.EAModels.setLocked(!panel.hasPremium());
})();
