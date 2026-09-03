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

function EA_selectedCaptionSource() {
  try {
    var comp = EA_activeComp();
    if (!comp) return EA_json(false, "Open a comp and select the clip you want to caption.");
    if (!comp.selectedLayers || comp.selectedLayers.length < 1) {
      return EA_json(false, "Select one video or audio layer in the active comp first.");
    }

    var layer = comp.selectedLayers[0];
    var sourceStart = Number(layer.inPoint - layer.startTime);
    var sourceEnd = Number(layer.outPoint - layer.startTime);
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

function EA_layerCaptionSourceCandidate(layer, parentSourceStart, parentSourceEnd, depth) {
  depth = depth || 0;
  if (!layer || depth > 4) return null;

  if (layer.source && layer.source.file) {
    var file = layer.source.file;
    if (!file.exists) return null;
    var directStart = Number(parentSourceStart);
    var directEnd = Number(parentSourceEnd);
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
  var nestedStart = Number(parentSourceStart);
  var nestedEnd = Number(parentSourceEnd);
  if (!isFinite(nestedStart) || nestedStart < 0) nestedStart = 0;
  if (!isFinite(nestedEnd) || nestedEnd <= nestedStart) nestedEnd = nestedComp.duration || nestedStart + Math.max(0.1, parentSourceEnd - parentSourceStart);

  var best = null;
  var bestOverlap = 0;
  for (var i = 1; i <= nestedComp.numLayers; i += 1) {
    var child = nestedComp.layer(i);
    if (!child || child.enabled === false || child.hasAudio === false) continue;
    var overlapStart = Math.max(nestedStart, child.inPoint);
    var overlapEnd = Math.min(nestedEnd, child.outPoint);
    var overlap = overlapEnd - overlapStart;
    if (overlap <= 0) continue;
    var candidate = EA_layerCaptionSourceCandidate(child, overlapStart - child.startTime, overlapEnd - child.startTime, depth + 1);
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
      fontSize: Number(settings.fontSize || 86),
      y: Number(settings.y || 78),
      color: settings.color || "#FFFFFF",
      glowExposure: Number(settings.glowExposure || 0.15),
      glowRadius: Number(settings.glowRadius || 400),
      shadowOpacity: Number(settings.shadowOpacity || 100),
      shadowSoftness: Number(settings.shadowSoftness || 43)
    }
  };
}

function EA_createCaptionLayer(comp, text, startTime, endTime, settings) {
  var layer = comp.layers.addText(String(text || "").toUpperCase());
  layer.inPoint = Math.max(0, startTime);
  layer.outPoint = Math.max(layer.inPoint + 0.05, endTime);

  var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
  var doc = textProp.value;
  doc.text = String(text || "").toUpperCase();
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
  textProp.setValue(doc);

  layer.property("ADBE Transform Group").property("ADBE Position").setValue([
    comp.width / 2,
    comp.height * Math.max(0, Math.min(100, settings.y)) / 100
  ]);
  layer.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0, 0]);

  var glow = EA_addEffect(layer, ["Deep Glow 2", "Deep Glow"]);
  if (glow) {
    EA_setEffectValue(glow, ["Exposure", "ADBE Deep Glow2-0002", "ADBE Deep Glow-0002"], settings.glowExposure);
    EA_setEffectValue(glow, ["Radius", "ADBE Deep Glow2-0001", "ADBE Deep Glow-0001"], settings.glowRadius);
  }

  var shadow = EA_addEffect(layer, ["ADBE Drop Shadow", "Drop Shadow"]);
  if (shadow) {
    EA_setEffectValue(shadow, ["Opacity"], settings.shadowOpacity);
    EA_setEffectValue(shadow, ["Softness"], settings.shadowSoftness);
    EA_setEffectValue(shadow, ["Distance"], 0);
  }

  return layer;
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
    for (var j = 0; j < captions.length; j += 1) {
      var caption = captions[j];
      var start = startBase + Number(caption.start || 0);
      var end = startBase + Number(caption.end || 0);
      if (!isFinite(start) || !isFinite(end) || end <= start) continue;
      if (start >= endBase) continue;
      if (end > endBase) end = endBase;
      EA_createCaptionLayer(comp, caption.text || "", start, end, payload.settings);
      created += 1;
    }

    if (created < 1) return EA_json(false, "No caption layers were created. Check the selected clip timing and caption text.");
    return EA_json(true, "Created " + created + " caption text layer(s).");
  } catch (err) {
    return EA_json(false, err && err.message ? err.message : String(err));
  } finally {
    app.endUndoGroup();
  }
}
