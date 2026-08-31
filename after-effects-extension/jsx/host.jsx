/* global app, File, ImportOptions */

function EA_json(ok, message) {
  return '{"ok":' + (ok ? 'true' : 'false') + ',"message":"' + String(message || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"}';
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

    if (lower.match(/\.aep$/)) {
      app.open(file);
      return EA_json(true, "Project opened in After Effects.");
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
