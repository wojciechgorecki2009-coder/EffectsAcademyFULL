/* global app, File, Folder, ImportOptions */

function EA_json(ok, message) {
  return '{"ok":' + (ok ? 'true' : 'false') + ',"message":"' + String(message || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"}';
}

function EA_jsonPackExtracted(message, folderPath, fileCount) {
  return '{"ok":false,"extracted":true,"open_folder":true,"folder_path":"' +
    String(folderPath || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
    '","file_count":' + Number(fileCount || 0) +
    ',"message":"' + String(message || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"}';
}

function EA_activeComp() {
  if (!app.project) return null;
  var item = app.project.activeItem;
  if (!item || !item.layers) return null;
  return item;
}

function EA_listFonts() {
  try {
    var fonts = [];
    var seen = {};

    function valueOf(font, names, fallback) {
      for (var nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
        try {
          var value = font[names[nameIndex]];
          if (value !== undefined && value !== null && String(value)) return String(value);
        } catch (propertyErr) {}
      }
      return fallback || "";
    }

    function addFont(font) {
      if (!font) return false;
      var postScriptName = valueOf(font, ["postScriptName"], "");
      if (!postScriptName) return false;
      if (seen[postScriptName]) return true;
      seen[postScriptName] = true;
      var family = valueOf(font, ["familyName", "family"], postScriptName);
      var style = valueOf(font, ["styleName", "style"], "");
      var fullName = valueOf(font, ["fullName", "name"], "");
      if (!fullName) fullName = family + (style && style.toLowerCase() !== "regular" ? " " + style : "");
      fonts.push({ postScriptName: postScriptName, family: family, style: style, fullName: fullName });
      return true;
    }

    function visit(collection, depth) {
      if (!collection || depth > 4) return;
      if (addFont(collection)) return;
      var length = 0;
      try { length = Number(collection.length || 0); } catch (lengthErr) {}
      for (var collectionIndex = 0; collectionIndex < length; collectionIndex += 1) {
        try { visit(collection[collectionIndex], depth + 1); } catch (fontErr) {}
      }
    }

    try { visit(app.fonts.allFonts, 0); } catch (allFontsErr) {}
    try { if (fonts.length < 1) visit(app.fonts, 0); } catch (fontsErr) {}
    if (fonts.length < 1) {
      fonts.push({ postScriptName: "Arial-BoldMT", family: "Arial", style: "Bold", fullName: "Arial Bold" });
    }
    fonts.sort(function (a, b) {
      var aName = String(a.fullName || a.postScriptName).toLowerCase();
      var bName = String(b.fullName || b.postScriptName).toLowerCase();
      return aName < bName ? -1 : (aName > bName ? 1 : 0);
    });

    function escapeJson(value) {
      return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    }
    var items = [];
    for (var i = 0; i < fonts.length; i += 1) {
      items.push("{" +
        '"postScriptName":"' + escapeJson(fonts[i].postScriptName) + '",' +
        '"family":"' + escapeJson(fonts[i].family) + '",' +
        '"style":"' + escapeJson(fonts[i].style) + '",' +
        '"fullName":"' + escapeJson(fonts[i].fullName) + '"' +
      "}");
    }
    return '{"ok":true,"fonts":[' + items.join(",") + "]}";
  } catch (err) {
    return EA_json(false, err && err.message ? err.message : String(err));
  }
}

function EA_importAsset(filePath, category, playbackRate) {
  app.beginUndoGroup("Effects Academy Import");
  try {
    playbackRate = Number(playbackRate || 1);
    if (!isFinite(playbackRate) || playbackRate <= 0) playbackRate = 1;
    var file = new File(filePath);
    if (!file.exists) return EA_json(false, "Downloaded file could not be found.");

    var lower = String(filePath).toLowerCase();
    var comp = EA_activeComp();

    if (lower.match(/\.ffx$/)) {
      if (!comp || comp.selectedLayers.length < 1) {
        return EA_json(false, "Select at least one layer before applying a preset.");
      }
      for (var i = 0; i < comp.selectedLayers.length; i += 1) {
        comp.selectedLayers[i].applyPreset(file);
      }
      return EA_json(true, "Preset applied to selected layer(s).");
    }

    if (lower.match(/\.(aep|aepx)$/)) {
      var projectImportOptions = new ImportOptions(file);
      app.project.importFile(projectImportOptions);
      return EA_json(true, "Project imported into the current After Effects project.");
    }

    var importOptions = new ImportOptions(file);
    var footage = app.project.importFile(importOptions);
    if (comp && category !== "Project Files") {
      var layer = comp.layers.add(footage);
      layer.startTime = comp.time;
      if (playbackRate !== 1) {
        layer.stretch = 100 / playbackRate;
      }
      return EA_json(true, "Imported and added to the active comp.");
    }

    return EA_json(true, "Imported into the project panel.");
  } catch (err) {
    return EA_json(false, err && err.message ? err.message : String(err));
  } finally {
    app.endUndoGroup();
  }
}

function EA_collectImportableFiles(folder, files) {
  var children = folder.getFiles();
  for (var i = 0; i < children.length; i += 1) {
    var item = children[i];
    if (item instanceof Folder) {
      EA_collectImportableFiles(item, files);
    } else if (item instanceof File) {
      var path = String(item.fsName).toLowerCase();
      if (path.match(/\.(aep|aepx|ffx|mov|mp4|m4v|avi|wav|mp3|aif|aiff|png|jpg|jpeg|gif|webp|psd|ai|eps)$/)) {
        files.push(item);
      }
    }
  }
}

function EA_importFolder(folderPath, category) {
  app.beginUndoGroup("Effects Academy Import Pack");
  try {
    var folder = new Folder(folderPath);
    if (!folder.exists) return EA_json(false, "Extracted project folder could not be found.");

    var files = [];
    EA_collectImportableFiles(folder, files);
    if (files.length < 1) {
      var allFiles = folder.getFiles("*");
      return EA_jsonPackExtracted("Pack extracted, but no After Effects project or importable media files were found. Opening the extracted folder.", folder.fsName, allFiles.length);
    }

    var importedCount = 0;
    var projectCount = 0;
    for (var i = 0; i < files.length; i += 1) {
      var lower = String(files[i].fsName).toLowerCase();
      if (!lower.match(/\.(aep|aepx)$/)) continue;
      app.project.importFile(new ImportOptions(files[i]));
      importedCount += 1;
      projectCount += 1;
    }

    if (projectCount < 1) {
      for (var j = 0; j < files.length; j += 1) {
        var filePath = String(files[j].fsName).toLowerCase();
        if (filePath.match(/\.ffx$/)) continue;
        app.project.importFile(new ImportOptions(files[j]));
        importedCount += 1;
      }
    }

    if (importedCount < 1) {
      return EA_jsonPackExtracted("Pack extracted, but the files inside are not directly importable by After Effects. Opening the extracted folder.", folder.fsName, files.length);
    }

    return EA_json(true, projectCount > 0
      ? "Project pack extracted and imported into the current project."
      : "Pack extracted and " + importedCount + " media file(s) imported into the project panel.");
  } catch (err) {
    return EA_json(false, err && err.message ? err.message : String(err));
  } finally {
    app.endUndoGroup();
  }
}

function EA_captionColor(hex) {
  var value = String(hex || "#FFFFFF").replace("#", "");
  if (value.length === 3) {
    value = value.charAt(0) + value.charAt(0) + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2);
  }
  if (!value.match(/^[0-9a-fA-F]{6}$/)) value = "FFFFFF";
  return [
    parseInt(value.substr(0, 2), 16) / 255,
    parseInt(value.substr(2, 2), 16) / 255,
    parseInt(value.substr(4, 2), 16) / 255
  ];
}

function EA_setEffectValue(effect, names, value) {
  if (!effect) return false;
  for (var i = 0; i < names.length; i += 1) {
    try {
      var prop = effect.property(names[i]);
      if (prop) {
        prop.setValue(value);
        return true;
      }
    } catch (err) {}
  }
  return false;
}

function EA_addEffect(layer, names) {
  var effects = layer.property("ADBE Effect Parade");
  if (!effects) return null;
  for (var i = 0; i < names.length; i += 1) {
    try {
      return effects.addProperty(names[i]);
    } catch (err) {}
  }
  return null;
}

function EA_findAerenderExecutable() {
  var candidates = [];
  function addCandidate(pathValue) {
    if (!pathValue) return;
    candidates.push(new File(pathValue));
  }

  var applicationFolder = new Folder(app.path);
  addCandidate(applicationFolder.fsName + "/aerender.exe");
  addCandidate(applicationFolder.fsName + "/Support Files/aerender.exe");
  if (applicationFolder.parent) {
    addCandidate(applicationFolder.parent.fsName + "/aerender.exe");
    addCandidate(applicationFolder.parent.fsName + "/Support Files/aerender.exe");
  }

  var programFilesPath = "C:/Program Files";
  try {
    var environmentProgramFiles = $.getenv("ProgramFiles");
    if (environmentProgramFiles) programFilesPath = environmentProgramFiles;
  } catch (environmentErr) {}
  var adobeFolder = new Folder(programFilesPath + "/Adobe");
  if (adobeFolder.exists) {
    try {
      var afterEffectsMajor = parseInt(String(app.version), 10);
      if (!isNaN(afterEffectsMajor) && afterEffectsMajor > 0) {
        var matchingInstall = adobeFolder.fsName + "/Adobe After Effects 20" + afterEffectsMajor;
        addCandidate(matchingInstall + "/Support Files/aerender.exe");
        addCandidate(matchingInstall + "/aerender.exe");
      }
    } catch (matchingVersionErr) {}
    var installedVersions = [];
    try { installedVersions = adobeFolder.getFiles("Adobe After Effects*"); } catch (versionErr) {}
    for (var versionIndex = 0; versionIndex < installedVersions.length; versionIndex += 1) {
      if (!(installedVersions[versionIndex] instanceof Folder)) continue;
      addCandidate(installedVersions[versionIndex].fsName + "/Support Files/aerender.exe");
      addCandidate(installedVersions[versionIndex].fsName + "/aerender.exe");
    }
  }

  for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    if (candidates[candidateIndex].exists) return candidates[candidateIndex];
  }
  return null;
}

function EA_preparePrecompAudioRender(outputPath) {
  var renderItem = null;
  try {
    var comp = EA_activeComp();
    if (!comp || !comp.selectedLayers || comp.selectedLayers.length < 1) {
      return EA_json(false, "Select the precomp layer again before adding captions.");
    }
    var layer = comp.selectedLayers[0];
    if (!layer.source || !layer.source.layers) {
      return EA_json(false, "The selected layer is no longer a precomp.");
    }
    if (!app.project.file || !app.project.file.exists) {
      return EA_json(false, "Save the After Effects project once before captioning a precomp.");
    }

    var precomp = layer.source;
    var mappedStart = EA_layerSourceTime(layer, layer.inPoint);
    var mappedEnd = EA_layerSourceTime(layer, layer.outPoint);
    var precompStart = Math.max(0, Math.min(mappedStart, mappedEnd));
    var precompEnd = Math.min(precomp.duration, Math.max(mappedStart, mappedEnd));
    var duration = Math.max(0.1, precompEnd - precompStart);

    renderItem = app.project.renderQueue.items.add(precomp);
    renderItem.timeSpanStart = precompStart;
    renderItem.timeSpanDuration = duration;
    var outputModule = renderItem.outputModule(1);
    try {
      outputModule.applyTemplate("Lossless");
    } catch (templateErr) {}
    try { outputModule.setSetting("Audio Output", "On"); } catch (audioSettingErr) {}
    try { outputModule.setSetting("Output Audio", "On"); } catch (legacyAudioSettingErr) {}
    outputModule.file = new File(outputPath);
    var renderQueueIndex = renderItem.index;

    app.project.save();
    var extension = String(app.project.file.name || "").toLowerCase().indexOf(".aepx") >= 0 ? ".aepx" : ".aep";
    var tempProject = new File(Folder.temp.fsName + "/EA-caption-" + (new Date().getTime()) + extension);
    if (!app.project.file.copy(tempProject.fsName)) {
      throw new Error("After Effects could not create the temporary caption render project.");
    }

    renderItem.remove();
    renderItem = null;
    try { app.project.renderQueue.showWindow(false); } catch (hideQueueErr) {}
    app.project.save();
    return "{" +
      '"ok":true,' +
      '"temp_project_path":"' + String(tempProject.fsName).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '",' +
      '"rq_index":' + renderQueueIndex +
    "}";
  } catch (err) {
    try { if (renderItem) renderItem.remove(); } catch (removeErr) {}
    try { app.project.renderQueue.showWindow(false); } catch (hideQueueOnErrorErr) {}
    try { if (app.project.file) app.project.save(); } catch (saveErr) {}
    return EA_json(false, String(err));
  }
}

function EA_selectedCaptionSource() {
  try {
    var comp = EA_activeComp();
    if (!comp) return EA_json(false, "Open a comp and select the clip you want to caption.");
    if (!comp.selectedLayers || comp.selectedLayers.length < 1) {
      return EA_json(false, "Select one video or audio layer in the active comp first.");
    }

    var layer = comp.selectedLayers[0];
    if (layer.source && layer.source.layers) {
      var precomp = layer.source;
      var mappedStart = EA_layerSourceTime(layer, layer.inPoint);
      var mappedEnd = EA_layerSourceTime(layer, layer.outPoint);
      if (!isFinite(mappedStart)) mappedStart = 0;
      if (!isFinite(mappedEnd)) mappedEnd = precomp.duration;
      mappedStart = Math.max(0, Math.min(precomp.duration, mappedStart));
      mappedEnd = Math.max(0, Math.min(precomp.duration, mappedEnd));
      var mainDuration = Math.max(0.1, Number(layer.outPoint) - Number(layer.inPoint));
      var audioSources = [];
      EA_collectCaptionAudioSources(precomp, mappedStart, mappedEnd, 0, mainDuration, 0, audioSources);
      if (audioSources.length < 1) {
        return EA_json(false, "No local audio or video clips with enabled audio were found inside the selected precomp.");
      }
      var sourcesJson = [];
      for (var sourceIndex = 0; sourceIndex < audioSources.length; sourceIndex += 1) {
        var source = audioSources[sourceIndex];
        sourcesJson.push("{" +
          '"file_path":"' + String(source.file.fsName).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '",' +
          '"source_start":' + source.sourceStart + ',' +
          '"source_end":' + source.sourceEnd + ',' +
          '"timeline_start":' + source.timelineStart + ',' +
          '"timeline_end":' + source.timelineEnd + ',' +
          '"reverse":' + (source.reverse ? "true" : "false") +
        "}");
      }
      return "{" +
        '"ok":true,' +
        '"mix_precomp":true,' +
        '"name":"' + String(layer.name || precomp.name).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '",' +
        '"duration":' + mainDuration + ',' +
        '"audio_sources":[' + sourcesJson.join(",") + "]" +
      "}";
    }
    var mappedSourceStart = EA_layerSourceTime(layer, layer.inPoint);
    var mappedSourceEnd = EA_layerSourceTime(layer, layer.outPoint);
    var sourceStart = Math.min(mappedSourceStart, mappedSourceEnd);
    var sourceEnd = Math.max(mappedSourceStart, mappedSourceEnd);
    if (!isFinite(sourceStart) || sourceStart < 0) sourceStart = 0;
    if (!isFinite(sourceEnd) || sourceEnd <= sourceStart) {
      sourceEnd = layer.source && isFinite(layer.source.duration) ? layer.source.duration : sourceStart + Math.max(0.1, layer.outPoint - layer.inPoint);
    }

    var candidate = EA_layerCaptionSourceCandidate(layer, sourceStart, sourceEnd, 0);
    if (!candidate) {
      return EA_json(false, "Could not find a local video/audio source inside the selected layer or precomp.");
    }

    return EA_captionSourceJson(candidate);
  } catch (err) {
    return EA_json(false, err && err.message ? err.message : String(err));
  }
}

function EA_collectCaptionAudioSources(comp, rangeStart, rangeEnd, rootStart, rootEnd, depth, output) {
  if (!comp || !comp.layers || depth > 6) return;
  var rangeLow = Math.min(Number(rangeStart), Number(rangeEnd));
  var rangeHigh = Math.max(Number(rangeStart), Number(rangeEnd));
  if (!isFinite(rangeLow) || !isFinite(rangeHigh) || rangeHigh - rangeLow <= 0.0001) return;
  var rangeDelta = Number(rangeEnd) - Number(rangeStart);
  if (!isFinite(rangeDelta) || Math.abs(rangeDelta) <= 0.0001) return;

  function rootTimeAt(compTime) {
    return Number(rootStart) + ((Number(compTime) - Number(rangeStart)) / rangeDelta) * (Number(rootEnd) - Number(rootStart));
  }

  for (var i = 1; i <= comp.numLayers; i += 1) {
    var child = comp.layer(i);
    if (!child || !child.source || child.enabled === false || child.hasAudio === false || child.audioEnabled === false) continue;
    var overlapStart = Math.max(rangeLow, Number(child.inPoint));
    var overlapEnd = Math.min(rangeHigh, Number(child.outPoint));
    if (!isFinite(overlapStart) || !isFinite(overlapEnd) || overlapEnd - overlapStart <= 0.0001) continue;
    try {
      if (child.audioActiveAtTime && !child.audioActiveAtTime((overlapStart + overlapEnd) / 2)) continue;
    } catch (audioActiveErr) {}

    var childSourceStart = EA_layerSourceTime(child, overlapStart);
    var childSourceEnd = EA_layerSourceTime(child, overlapEnd);
    var childRootStart = rootTimeAt(overlapStart);
    var childRootEnd = rootTimeAt(overlapEnd);
    if (!isFinite(childSourceStart) || !isFinite(childSourceEnd) || !isFinite(childRootStart) || !isFinite(childRootEnd)) continue;

    if (child.source.file) {
      if (!child.source.file.exists) continue;
      var sourceStart = Math.max(0, Math.min(childSourceStart, childSourceEnd));
      var sourceEnd = Math.max(childSourceStart, childSourceEnd);
      try {
        if (isFinite(child.source.duration) && child.source.duration > 0) sourceEnd = Math.min(sourceEnd, child.source.duration);
      } catch (sourceDurationErr) {}
      var timelineStart = Math.max(0, Math.min(childRootStart, childRootEnd));
      var timelineEnd = Math.min(Number(rootEnd) > Number(rootStart) ? Number(rootEnd) : Number(rootStart), Math.max(childRootStart, childRootEnd));
      if (sourceEnd - sourceStart <= 0.0001 || timelineEnd - timelineStart <= 0.0001) continue;
      output.push({
        file: child.source.file,
        sourceStart: sourceStart,
        sourceEnd: sourceEnd,
        timelineStart: timelineStart,
        timelineEnd: timelineEnd,
        reverse: childSourceEnd < childSourceStart
      });
    } else if (child.source.layers) {
      EA_collectCaptionAudioSources(child.source, childSourceStart, childSourceEnd, childRootStart, childRootEnd, depth + 1, output);
    }
  }
}

function EA_layerSourceTime(layer, compTime) {
  try {
    if (layer.timeRemapEnabled) {
      var timeRemap = layer.property("ADBE Time Remapping");
      if (timeRemap) return Number(timeRemap.valueAtTime(compTime, false));
    }
  } catch (timeRemapErr) {}
  var stretch = Number(layer.stretch || 100) / 100;
  if (!isFinite(stretch) || stretch === 0) stretch = 1;
  return Number((compTime - layer.startTime) / stretch);
}

function EA_layerCaptionSourceCandidate(layer, parentSourceStart, parentSourceEnd, depth) {
  depth = depth || 0;
  if (!layer || depth > 4) return null;

  if (layer.source && layer.source.file) {
    var file = layer.source.file;
    if (!file.exists) return null;
    var directStart = Math.min(Number(parentSourceStart), Number(parentSourceEnd));
    var directEnd = Math.max(Number(parentSourceStart), Number(parentSourceEnd));
    if (!isFinite(directStart) || directStart < 0) directStart = 0;
    if (!isFinite(directEnd) || directEnd <= directStart) {
      directEnd = layer.source && isFinite(layer.source.duration) ? layer.source.duration : directStart + Math.max(0.1, parentSourceEnd - parentSourceStart);
    }
    return {
      file: file,
      name: file.name || layer.name || "Selected clip",
      sourceStart: directStart,
      sourceEnd: directEnd,
      duration: layer.source && isFinite(layer.source.duration) ? layer.source.duration : 0,
      nested: depth > 0
    };
  }

  if (!layer.source || !layer.source.layers) return null;
  var nestedComp = layer.source;
  var nestedStart = Math.min(Number(parentSourceStart), Number(parentSourceEnd));
  var nestedEnd = Math.max(Number(parentSourceStart), Number(parentSourceEnd));
  if (!isFinite(nestedStart) || nestedStart < 0) nestedStart = 0;
  if (!isFinite(nestedEnd) || nestedEnd <= nestedStart) nestedEnd = nestedComp.duration || nestedStart + Math.max(0.1, parentSourceEnd - parentSourceStart);

  var best = null;
  var bestOverlap = 0;
  for (var i = 1; i <= nestedComp.numLayers; i += 1) {
    var child = nestedComp.layer(i);
    if (!child || child.enabled === false || child.hasAudio === false || child.audioEnabled === false) continue;
    var overlapStart = Math.max(nestedStart, child.inPoint);
    var overlapEnd = Math.min(nestedEnd, child.outPoint);
    var overlap = overlapEnd - overlapStart;
    if (overlap <= 0) continue;
    try {
      if (child.audioActiveAtTime && !child.audioActiveAtTime((overlapStart + overlapEnd) / 2)) continue;
    } catch (audioActiveErr) {}
    var childSourceStart = EA_layerSourceTime(child, overlapStart);
    var childSourceEnd = EA_layerSourceTime(child, overlapEnd);
    var candidate = EA_layerCaptionSourceCandidate(child, childSourceStart, childSourceEnd, depth + 1);
    if (candidate && overlap > bestOverlap) {
      best = candidate;
      bestOverlap = overlap;
    }
  }
  return best;
}

function EA_captionSourceJson(candidate) {
  return "{" +
    '"ok":true,' +
    '"file_path":"' + String(candidate.file.fsName).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '",' +
    '"name":"' + String(candidate.name || "Selected clip").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '",' +
    '"source_start":' + candidate.sourceStart + "," +
    '"source_end":' + candidate.sourceEnd + "," +
    '"duration":' + candidate.duration + "," +
    '"nested":' + (candidate.nested ? "true" : "false") +
  "}";
}

function EA_splitCaptionText(text, maxWords) {
  var words = String(text || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").split(" ");
  var chunks = [];
  var current = [];
  maxWords = Math.max(1, Number(maxWords || 4));
  for (var i = 0; i < words.length; i += 1) {
    if (!words[i]) continue;
    current.push(words[i]);
    if (current.length >= maxWords || words[i].match(/[.!?]$/)) {
      chunks.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

function EA_normalizeCaptionPayload(payloadJson) {
  var payload = JSON.parse(payloadJson);
  var settings = payload.settings || {};
  var captions = payload.captions || [];
  return {
    captions: captions,
    plainText: payload.plainText || "",
    settings: {
      font: settings.font || "Arial-BoldMT",
      fontSize: Number(settings.fontSize || 40),
      y: Number(settings.y || 50),
      color: settings.color || "#FFFFFF",
      glowExposure: Number(settings.glowExposure || 0.27),
      glowRadius: Number(settings.glowRadius || 400),
      shadowOpacity: Number(settings.shadowOpacity || 100),
      shadowSoftness: Number(settings.shadowSoftness || 43),
      fadeInPreset: settings.fadeInPreset === "Slow Fade On" ? "Slow Fade On" : "Fade Up Words",
      increaseTracking: settings.increaseTracking === true || settings.increaseTracking === "true"
    }
  };
}

var EA_captionPresetCache = {};

function EA_findPresetInFolder(folder, fileName, depth) {
  if (!folder || !folder.exists || depth > 7) return null;
  var entries;
  try { entries = folder.getFiles(); } catch (err) { return null; }
  for (var i = 0; i < entries.length; i += 1) {
    if (entries[i] instanceof File && String(entries[i].name).toLowerCase() === String(fileName).toLowerCase()) {
      return entries[i];
    }
  }
  for (var j = 0; j < entries.length; j += 1) {
    if (entries[j] instanceof Folder) {
      var found = EA_findPresetInFolder(entries[j], fileName, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function EA_findTextPreset(fileName) {
  if (EA_captionPresetCache[fileName] !== undefined) return EA_captionPresetCache[fileName];
  var applicationFolder = new Folder(app.path);
  var applicationPath = applicationFolder.fsName;
  var presetRoots = [];
  var direct = [];

  function addPresetRoot(rootPath) {
    if (!rootPath) return;
    var presetRoot = new Folder(rootPath);
    presetRoots.push(presetRoot);
    direct.push(new File(presetRoot.fsName + "/Text/Animate In/" + fileName));
    direct.push(new File(presetRoot.fsName + "/Text/Animate Out/" + fileName));
    direct.push(new File(presetRoot.fsName + "/Text/Tracking/" + fileName));
  }

  addPresetRoot(applicationPath + "/Presets");
  addPresetRoot(applicationPath + "/Support Files/Presets");
  addPresetRoot(applicationFolder.parent.fsName + "/Presets");
  addPresetRoot(applicationFolder.parent.fsName + "/Support Files/Presets");

  var programFilesPath = "C:/Program Files";
  try {
    var environmentProgramFiles = $.getenv("ProgramFiles");
    if (environmentProgramFiles) programFilesPath = environmentProgramFiles;
  } catch (environmentErr) {}
  var adobeFolder = new Folder(programFilesPath + "/Adobe");
  if (adobeFolder.exists) {
    var installedVersions = [];
    try { installedVersions = adobeFolder.getFiles("Adobe After Effects*"); } catch (versionErr) {}
    for (var versionIndex = 0; versionIndex < installedVersions.length; versionIndex += 1) {
      if (installedVersions[versionIndex] instanceof Folder) {
        addPresetRoot(installedVersions[versionIndex].fsName + "/Support Files/Presets");
      }
    }
  }
  for (var i = 0; i < direct.length; i += 1) {
    if (direct[i].exists) {
      EA_captionPresetCache[fileName] = direct[i];
      return direct[i];
    }
  }
  for (var j = 0; j < presetRoots.length; j += 1) {
    var result = EA_findPresetInFolder(presetRoots[j], fileName, 0);
    if (result) {
      EA_captionPresetCache[fileName] = result;
      return result;
    }
  }
  EA_captionPresetCache[fileName] = null;
  return null;
}

function EA_applyCaptionPreset(comp, layer, presetFile, atTime) {
  if (!presetFile || !presetFile.exists) return { applied: false, firstKey: atTime, lastKey: atTime, firstAnimator: 0, lastAnimator: 0 };
  try {
    var textProperties = layer.property("ADBE Text Properties");
    var animators = textProperties ? textProperties.property("ADBE Text Animators") : null;
    var propertyCountBefore = animators ? animators.numProperties : 0;
    for (var i = 1; i <= comp.numLayers; i += 1) comp.layer(i).selected = false;
    layer.selected = true;
    comp.time = Math.max(0, Math.min(comp.duration, atTime));
    layer.applyPreset(presetFile);
    textProperties = layer.property("ADBE Text Properties");
    animators = textProperties ? textProperties.property("ADBE Text Animators") : null;
    var propertyCountAfter = animators ? animators.numProperties : 0;
    layer.selected = false;
    var keyRange = { first: Number.POSITIVE_INFINITY, last: Number.NEGATIVE_INFINITY };
    for (var animatorIndex = propertyCountBefore + 1; animatorIndex <= propertyCountAfter; animatorIndex += 1) {
      EA_captionPropertyKeyRange(animators.property(animatorIndex), keyRange);
    }
    return {
      applied: propertyCountAfter > propertyCountBefore,
      firstKey: isFinite(keyRange.first) ? keyRange.first : atTime,
      lastKey: isFinite(keyRange.last) ? keyRange.last : atTime,
      firstAnimator: propertyCountBefore + 1,
      lastAnimator: propertyCountAfter
    };
  } catch (err) {
    try { layer.selected = false; } catch (selectionErr) {}
    return { applied: false, firstKey: atTime, lastKey: atTime, firstAnimator: 0, lastAnimator: 0 };
  }
}

function EA_captionPropertyKeyRange(property, range) {
  if (!property) return;
  try {
    if (property.numKeys && property.numKeys > 0) {
      range.first = Math.min(range.first, property.keyTime(1));
      range.last = Math.max(range.last, property.keyTime(property.numKeys));
    }
  } catch (keyErr) {}
  var childCount = 0;
  try { childCount = property.numProperties || 0; } catch (childCountErr) {}
  for (var i = 1; i <= childCount; i += 1) {
    try { EA_captionPropertyKeyRange(property.property(i), range); } catch (childErr) {}
  }
}

function EA_applyDefaultCaptionPresets(comp, layer, startTime, endTime, settings) {
  var originalTime = comp.time;
  var fadeUp = EA_findTextPreset("Fade Up Words.ffx");
  var slowFadeOn = EA_findTextPreset("Slow Fade On.ffx");
  var fadeOut = EA_findTextPreset("Fade Out Slow.ffx");
  var preferredFadeIn = settings.fadeInPreset === "Slow Fade On" ? slowFadeOn : fadeUp;
  var fallbackFadeIn = settings.fadeInPreset === "Slow Fade On" ? fadeUp : slowFadeOn;
  var fadeInResult = EA_applyCaptionPreset(comp, layer, preferredFadeIn, startTime);
  if (!fadeInResult.applied) fadeInResult = EA_applyCaptionPreset(comp, layer, fallbackFadeIn, startTime);
  var fadeInEnd = fadeInResult.applied ? fadeInResult.lastKey : startTime + 0.9;
  var fadeOutStart = Math.max(startTime, fadeInEnd - 0.15);
  var fadeOutResult = EA_applyCaptionPreset(comp, layer, fadeOut, fadeOutStart);
  comp.time = originalTime;
  var animationEnd = fadeOutResult.applied ? fadeOutResult.lastKey : Math.max(endTime, fadeInEnd);
  return { fadeIn: fadeInResult.applied, fadeOut: fadeOutResult.applied, animationEnd: animationEnd };
}

function EA_findCaptionPropertyByMatchName(property, matchName) {
  if (!property) return null;
  try { if (property.matchName === matchName) return property; } catch (matchErr) {}
  var childCount = 0;
  try { childCount = property.numProperties || 0; } catch (childCountErr) {}
  for (var i = 1; i <= childCount; i += 1) {
    try {
      var found = EA_findCaptionPropertyByMatchName(property.property(i), matchName);
      if (found) return found;
    } catch (childErr) {}
  }
  return null;
}

function EA_applyIncreaseTracking(comp, layer, startTime, endTime) {
  var preset = EA_findTextPreset("Increase Tracking.ffx");
  var result = EA_applyCaptionPreset(comp, layer, preset, startTime);
  if (!result.applied) return false;
  var textProperties = layer.property("ADBE Text Properties");
  var animators = textProperties ? textProperties.property("ADBE Text Animators") : null;
  if (!animators) return false;
  for (var i = result.firstAnimator; i <= result.lastAnimator; i += 1) {
    var animator = animators.property(i);
    var tracking = EA_findCaptionPropertyByMatchName(animator, "ADBE Text Tracking Amount");
    if (!tracking) continue;
    try { animator.name = "Increase Tracking"; } catch (nameErr) {}
    try {
      while (tracking.numKeys > 0) tracking.removeKey(tracking.numKeys);
      tracking.setValueAtTime(startTime, 0);
      tracking.setValueAtTime(endTime, 9);
      return true;
    } catch (trackingErr) {}
  }
  return false;
}

function EA_formatCaptionText(text) {
  var words = String(text || "").toUpperCase().replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").split(" ");
  if (words.length <= 4) return words.join(" ");
  var breakAt = Math.ceil(words.length / 2);
  return words.slice(0, breakAt).join(" ") + "\r" + words.slice(breakAt).join(" ");
}

function EA_createCaptionLayer(comp, text, startTime, endTime, settings) {
  var boxWidth = Math.max(100, comp.width * 0.82);
  var boxHeight = Math.max(settings.fontSize * 3.2, comp.height * 0.18);
  var layer = comp.layers.addBoxText([boxWidth, boxHeight]);
  layer.inPoint = Math.max(0, startTime);
  layer.outPoint = Math.min(comp.duration, Math.max(layer.inPoint + 4, endTime));

  var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
  var doc = textProp.value;
  doc.text = EA_formatCaptionText(text);
  try {
    doc.font = settings.font || "Arial-BoldMT";
  } catch (fontErr) {
    try { doc.font = "Arial-BoldMT"; } catch (fallbackFontErr) {}
  }
  doc.fontSize = settings.fontSize;
  doc.applyFill = true;
  doc.fillColor = EA_captionColor(settings.color);
  doc.applyStroke = false;
  doc.justification = ParagraphJustification.CENTER_JUSTIFY;
  try {
    doc.autoLeading = false;
    doc.leading = 31;
  } catch (leadingErr) {}
  textProp.setValue(doc);

  var anchorProp = layer.property("ADBE Transform Group").property("ADBE Anchor Point");
  var positionProp = layer.property("ADBE Transform Group").property("ADBE Position");
  var yRatio = Math.max(0, Math.min(100, settings.y)) / 100;
  anchorProp.expression = "var r = sourceRectAtTime(time, false); [r.left + r.width / 2, r.top + r.height / 2];";
  positionProp.expression = "[thisComp.width / 2, thisComp.height * " + yRatio + "];";

  var glow = EA_addEffect(layer, ["Deep Glow 2", "Deep Glow"]);
  if (glow) {
    EA_setEffectValue(glow, ["Exposure", "ADBE Deep Glow2-0002", "ADBE Deep Glow-0002"], settings.glowExposure);
    EA_setEffectValue(glow, ["Radius", "ADBE Deep Glow2-0001", "ADBE Deep Glow-0001"], settings.glowRadius);
  }

  var shadow = EA_addEffect(layer, ["ADBE Drop Shadow", "Drop Shadow"]);
  if (shadow) {
    var shadowOpacityPercent = Math.max(0, Math.min(100, Number(settings.shadowOpacity)));
    EA_setEffectValue(shadow, ["Opacity"], shadowOpacityPercent * 255 / 100);
    EA_setEffectValue(shadow, ["Softness"], settings.shadowSoftness);
    EA_setEffectValue(shadow, ["Distance"], 0);
  }

  var presetResult = EA_applyDefaultCaptionPresets(comp, layer, layer.inPoint, layer.outPoint, settings);
  if (presetResult.fadeOut) {
    layer.outPoint = Math.min(comp.duration, Math.max(layer.inPoint + 0.1, presetResult.animationEnd + comp.frameDuration));
  }
  var trackingApplied = settings.increaseTracking ? EA_applyIncreaseTracking(comp, layer, layer.inPoint, layer.outPoint) : false;

  return { layer: layer, fadeIn: presetResult.fadeIn, fadeOut: presetResult.fadeOut, tracking: trackingApplied };
}

function EA_createCaptions(payloadJson) {
  app.beginUndoGroup("Effects Academy Auto Captions");
  try {
    var comp = EA_activeComp();
    if (!comp) return EA_json(false, "Open a comp and select the clip you want to caption.");
    if (!comp.selectedLayers || comp.selectedLayers.length < 1) {
      return EA_json(false, "Select one clip/layer in the active comp first.");
    }

    var selectedLayer = comp.selectedLayers[0];
    var payload = EA_normalizeCaptionPayload(payloadJson);
    var captions = payload.captions;
    var startBase = selectedLayer.inPoint;
    var endBase = selectedLayer.outPoint;
    if (!isFinite(startBase)) startBase = comp.time;
    if (!isFinite(endBase) || endBase <= startBase) endBase = comp.duration;

    if (!captions || captions.length < 1) {
      var chunks = EA_splitCaptionText(payload.plainText, 4);
      if (chunks.length < 1) return EA_json(false, "Paste caption text or import an SRT/VTT/TXT file first.");
      captions = [];
      var duration = Math.max(0.3, endBase - startBase);
      var chunkDuration = duration / chunks.length;
      for (var i = 0; i < chunks.length; i += 1) {
        captions.push({
          text: chunks[i],
          start: i * chunkDuration,
          end: (i + 1) * chunkDuration
        });
      }
    }

    var created = 0;
    var fadeInCreated = 0;
    var fadeOutCreated = 0;
    var trackingCreated = 0;
    for (var j = 0; j < captions.length; j += 1) {
      var caption = captions[j];
      var start = startBase + Number(caption.start || 0);
      var end = startBase + Number(caption.end || 0);
      if (!isFinite(start) || !isFinite(end) || end <= start) continue;
      if (start >= endBase) continue;
      if (end > comp.duration) end = comp.duration;
      if (end <= start) continue;
      var createdCaption = EA_createCaptionLayer(comp, caption.text || "", start, end, payload.settings);
      if (createdCaption.fadeIn) fadeInCreated += 1;
      if (createdCaption.fadeOut) fadeOutCreated += 1;
      if (createdCaption.tracking) trackingCreated += 1;
      created += 1;
    }

    if (created < 1) return EA_json(false, "No caption layers were created. Check the selected clip timing and caption text.");
    if (fadeInCreated < created || fadeOutCreated < created) {
      return EA_json(true, "Created " + created + " caption text layer(s). Built-in preset check: fade in " + fadeInCreated + "/" + created + ", fade out " + fadeOutCreated + "/" + created + ".");
    }
    if (payload.settings.increaseTracking && trackingCreated < created) {
      return EA_json(true, "Created " + created + " caption text layer(s). Increase Tracking applied to " + trackingCreated + "/" + created + ".");
    }
    return EA_json(true, "Created " + created + " caption text layer(s) with " + payload.settings.fadeInPreset + " and Fade Out Slow" + (payload.settings.increaseTracking ? ", plus Increase Tracking." : "."));
  } catch (err) {
    return EA_json(false, err && err.message ? err.message : String(err));
  } finally {
    app.endUndoGroup();
  }
}
