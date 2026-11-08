/*
 * Paste images: one click (or Ctrl+V in the panel) imports whatever image is on
 * the clipboard into the active comp, with no manual saving.
 *
 * After Effects can only use files on disk, so a copied image (from a browser,
 * a screenshot, Photoshop…) is saved as a PNG first: into "Clipboard Images"
 * next to the saved project, so it travels with it, or into the extension's
 * folder for an unsaved project. Image files copied in Explorer or Finder are
 * imported from where they are.
 */
(function () {
  "use strict";

  var panel = window.EAPanel;
  var button = document.getElementById("pasteImageBtn");
  if (!panel || !button) return;

  var IMAGE_FILE = /\.(png|jpe?g|gif|bmp|tiff?|webp|psd|ai|eps|tga|exr)$/i;

  // Prints IMAGE (saved to the given path), FILES then one path per line, or EMPTY.
  // The PNG format browsers put on the clipboard keeps transparency; the plain
  // bitmap (screenshots) is the fallback.
  function windowsScript(outPath) {
    return [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$out = " + panel.psLiteral(outPath),
    "$data = [System.Windows.Forms.Clipboard]::GetDataObject()",
    "if ($data -eq $null) { 'EMPTY'; exit }",
    "if ($data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {",
    "  $files = @($data.GetData([System.Windows.Forms.DataFormats]::FileDrop) | Where-Object { $_ -match '" + IMAGE_FILE.source.replace(/'/g, "''") + "' })",
    "  if ($files.Count -gt 0) { 'FILES'; $files; exit }",
    "}",
    "if ($data.GetDataPresent('PNG')) {",
    "  $stream = $data.GetData('PNG')",
    "  if ($stream -is [System.IO.Stream]) { $file = [System.IO.File]::Create($out); $stream.CopyTo($file); $file.Close(); 'IMAGE'; exit }",
    "}",
    "if ([System.Windows.Forms.Clipboard]::ContainsImage()) {",
    "  [System.Windows.Forms.Clipboard]::GetImage().Save($out, [System.Drawing.Imaging.ImageFormat]::Png)",
    "  'IMAGE'; exit",
    "}",
    "'EMPTY'"
    ].join("\n");
  }

  function pad(value) { return value < 10 ? "0" + value : String(value); }

  function timestamp() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + "." + pad(d.getMinutes()) + "." + pad(d.getSeconds());
  }

  /** "Clipboard Images" beside the saved project, or in the extension's folder. */
  function newImagePath() {
    var fs = window.require("fs");
    var path = window.require("path");
    return panel.evalScript("EA_projectFolder()").catch(function () { return ""; }).then(function (projectDir) {
      var base = projectDir && fs.existsSync(projectDir) ? projectDir : panel.extensionDownloadDir();
      var dir = path.join(base, "Clipboard Images");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      var name = "Clipboard " + timestamp();
      var candidate = path.join(dir, name + ".png");
      for (var i = 2; fs.existsSync(candidate); i += 1) candidate = path.join(dir, name + " " + i + ".png");
      return candidate;
    });
  }

  function lines(text) {
    return String(text || "").split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
  }

  /** Resolves to the image paths to import (empty when the clipboard holds no image). */
  function readClipboard(targetPath) {
    if (process.platform === "win32") {
      return panel.runProcess("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", windowsScript(targetPath)]).then(function (output) {
        var result = lines(output);
        if (result[0] === "IMAGE") return [targetPath];
        if (result[0] === "FILES") return result.slice(1);
        return [];
      });
    }
    if (process.platform === "darwin") {
      // A file copied in Finder first, then image data (screenshots, browsers).
      return panel.runProcess("osascript", ["-e", "POSIX path of (the clipboard as «class furl»)"]).then(function (output) {
        var file = lines(output)[0];
        if (file && IMAGE_FILE.test(file)) return [file];
        throw new Error("not a file");
      }).catch(function () {
        return panel.runProcess("osascript", [
          "-e", "set target to open for access (POSIX file \"" + targetPath.replace(/"/g, "\\\"") + "\") with write permission",
          "-e", "try",
          "-e", "write (the clipboard as «class PNGf») to target",
          "-e", "on error",
          "-e", "close access target",
          "-e", "return \"EMPTY\"",
          "-e", "end try",
          "-e", "close access target",
          "-e", "return \"IMAGE\""
        ]).then(function (output) {
          return lines(output)[0] === "IMAGE" ? [targetPath] : [];
        });
      });
    }
    return Promise.reject(new Error("Pasting images isn't supported on this system yet."));
  }

  function removeIfEmpty(file) {
    try {
      var fs = window.require("fs");
      if (fs.existsSync(file) && fs.statSync(file).size === 0) fs.unlinkSync(file);
    } catch (e) {}
  }

  function pasteImage() {
    if (button.disabled) return;
    if (!panel.hasPremium()) {
      panel.showError("Premium authentication required", "Connect an active Premium account in Connection settings to paste images.");
      return;
    }
    if (panel.demo) {
      panel.demo("paste-image", "Demo: paste image", "In After Effects, this imports the image on your clipboard (a screenshot, an image copied from a browser or an image file) into your active comp. Ctrl+V works too.");
      return;
    }
    if (!window.require) {
      panel.showError("Paste unavailable", "This panel needs After Effects' file access to paste images.");
      return;
    }
    button.disabled = true;
    button.classList.add("busy");
    panel.clearErrorState();
    panel.setStatus("Reading the clipboard", "Looking for a copied image…");
    var savedTo = "";

    newImagePath().then(function (target) {
      savedTo = target;
      return readClipboard(target);
    }).then(function (paths) {
      removeIfEmpty(savedTo);
      if (!paths.length) throw new Error("There's no image on the clipboard. Copy one (right-click it and choose Copy image, or take a screenshot), then press the button again.");
      panel.setStatus("Importing image", paths.length === 1 ? paths[0].split(/[\\/]/).pop() : paths.length + " images");
      return panel.evalScript("EA_importImages(" + JSON.stringify(paths.join("\n")) + "," + JSON.stringify(panel.clipboardFit()) + ")");
    }).then(function (result) {
      var parsed = {};
      try { parsed = JSON.parse(result || "{}"); } catch (e) {}
      if (!parsed.ok) throw new Error(parsed.message || "After Effects couldn't import the image.");
      panel.setStatus("Image pasted", parsed.message);
    }).catch(function (err) {
      removeIfEmpty(savedTo);
      panel.showError("Couldn't paste the image", String((err && err.message) || err || "Something went wrong.").slice(0, 300));
    }).then(function () {
      button.disabled = false;
      button.classList.remove("busy");
    });
  }

  button.addEventListener("click", pasteImage);

  // Ctrl+V (Cmd+V) anywhere in the panel, except while typing in a field.
  document.addEventListener("keydown", function (event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || String(event.key).toLowerCase() !== "v") return;
    var target = event.target;
    if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
    event.preventDefault();
    pasteImage();
  });
})();
