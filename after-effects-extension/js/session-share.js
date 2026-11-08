/*
 * Shares the Premium connection and look between the Effects Academy panels.
 *
 * Each CEP panel runs in its own browser, so the main panel and the standalone
 * Expressions window can't rely on seeing each other's localStorage. The main
 * panel writes the connection (API address, extension token, device id) and the
 * style settings to a small file in the user's own app-data folder; the
 * Expressions window reads it and watches it, so connecting or signing out in
 * one panel applies to the other within a couple of seconds.
 */
(function () {
  "use strict";

  var nodeRequire = window.require || (window.cep_node && window.cep_node.require);
  var fs = null;
  var path = null;
  var filePath = "";

  try {
    fs = nodeRequire("fs");
    path = nodeRequire("path");
    var os = nodeRequire("os");
    var base = process.platform === "win32"
      ? (process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"))
      : path.join(os.homedir(), "Library", "Application Support");
    filePath = path.join(base, "Effects Academy", "panel-session.json");
  } catch (err) {
    fs = null;
  }

  function read() {
    if (!fs || !filePath) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      return null;
    }
  }

  function write(session) {
    if (!fs || !filePath) return false;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      var next = JSON.stringify(session);
      var current = null;
      try { current = fs.readFileSync(filePath, "utf8"); } catch (readErr) {}
      if (current === next) return true;
      // Write then rename, so the other panel never reads a half-written file.
      var temp = filePath + ".tmp";
      fs.writeFileSync(temp, next, { encoding: "utf8", mode: 384 }); // 0600: only this user
      fs.renameSync(temp, filePath);
      return true;
    } catch (err) {
      return false;
    }
  }

  // Calls back with the new session whenever the file changes.
  function watch(callback) {
    if (!fs || !filePath) return function () {};
    var listener = function () { callback(read()); };
    fs.watchFile(filePath, { interval: 1500 }, listener);
    return function () { fs.unwatchFile(filePath, listener); };
  }

  window.EASession = { read: read, write: write, watch: watch, available: !!fs };
}());
