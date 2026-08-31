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
