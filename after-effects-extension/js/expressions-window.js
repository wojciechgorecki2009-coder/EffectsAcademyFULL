/*
 * Bridge for the standalone Expressions window (expressions.html).
 *
 * Provides the small part of window.EAPanel that js/expressions.js uses
 * (evalScript, status messages, Premium state), using the connection the main
 * Effects Academy panel shares through js/session-share.js. Premium is checked
 * against the Effects Academy API the same way the main panel checks it.
 */
(function () {
  "use strict";

  var MAIN_EXTENSION_ID = "com.effectsacademy.panel";
  var DEFAULT_API_BASE = "https://effects-academy-api.onrender.com";
  var nodeRequire = window.require || (window.cep_node && window.cep_node.require);

  var statusTitle = document.getElementById("statusTitle");
  var statusText = document.getElementById("statusText");
  var gateText = document.getElementById("expressionsGateText");

  var session = (window.EASession && window.EASession.read()) || {};
  var premium = session.premium === true && !!session.authToken;
  var checkedToken = null;

  function setStatus(title, text) {
    if (statusTitle) statusTitle.textContent = title;
    if (statusText) statusText.textContent = text;
  }

  function statusCard() {
    return statusTitle && statusTitle.closest ? statusTitle.closest(".status-card") : null;
  }

  function showError(title, text) {
    setStatus(title, text);
    var card = statusCard();
    if (!card) return;
    card.classList.remove("shake");
    card.classList.add("error");
    void card.offsetWidth;
    card.classList.add("shake");
    setTimeout(function () { card.classList.remove("shake"); }, 460);
  }

  function clearErrorState() {
    var card = statusCard();
    if (card) card.classList.remove("error", "shake");
  }

  function evalScript(script) {
    return new Promise(function (resolve, reject) {
      if (!window.__adobe_cep__ || !window.__adobe_cep__.evalScript) {
        reject(new Error("After Effects bridge is unavailable."));
        return;
      }
      window.__adobe_cep__.evalScript(script, resolve);
    });
  }

  function openMainPanel() {
    try {
      if (window.__adobe_cep__ && window.__adobe_cep__.requestOpenExtension) {
        window.__adobe_cep__.requestOpenExtension(MAIN_EXTENSION_ID, "");
        return;
      }
    } catch (err) {}
    showError("Couldn't open Effects Academy", "Open it from Window › Extensions › Effects Academy.");
  }

  // Same check as the main panel: the extension asset list only answers an active Premium token.
  function verify(current) {
    if (!current || !current.authToken || !nodeRequire) return Promise.resolve(false);
    var base = String(current.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
    var URLCtor = nodeRequire("url").URL;
    var url = new URLCtor(base + "/api/extension/assets");
    var client = nodeRequire(url.protocol === "https:" ? "https" : "http");
    var headers = { Authorization: "Bearer " + current.authToken };
    if (current.deviceId) headers["X-Extension-Device-Id"] = current.deviceId;
    return new Promise(function (resolve) {
      var req = client.request(url, { method: "GET", headers: headers }, function (res) {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      req.on("error", function () { resolve(null); }); // offline: keep the last known answer
      req.setTimeout(20000, function () { req.destroy(); resolve(null); });
      req.end();
    });
  }

  function applyLook(prefs) {
    prefs = prefs || {};
    var keep = document.body.className.split(/\s+/).filter(function (name) {
      return name && !/^(style|accent|font|motion|scale)-/.test(name);
    });
    keep.push("style-" + (prefs.uiStyle === "minimal" ? "minimal" : "apple"));
    keep.push("accent-" + (prefs.accent || "mono"));
    keep.push("font-" + (prefs.font || "modern"));
    keep.push("motion-" + (prefs.motion || "premium"));
    keep.push("scale-" + (prefs.uiScale || "default"));
    document.body.className = keep.join(" ");
    var style = prefs.uiStyle === "minimal" ? "minimal" : "apple";
    document.documentElement.setAttribute("data-ui-style", style);
    document.body.setAttribute("data-ui-style", style);
  }

  function setPremium(value) {
    premium = value === true;
    if (window.EAExpressions) window.EAExpressions.setLocked(!premium);
  }

  function refresh(next) {
    session = next || {};
    applyLook(session.prefs);
    if (!session.authToken) {
      checkedToken = null;
      setPremium(false);
      if (gateText) gateText.textContent = "Connect your Premium account once in the Effects Academy panel (Connection settings). This window picks it up automatically.";
      return;
    }
    // Trust the main panel's last answer straight away, then confirm it.
    setPremium(session.premium === true);
    if (checkedToken === session.authToken) return;
    checkedToken = session.authToken;
    var token = session.authToken;
    verify(session).then(function (ok) {
      if (token !== session.authToken || ok === null) return;
      setPremium(ok);
      if (!ok && gateText) gateText.textContent = "Your Premium membership couldn't be verified. Reconnect your account in the Effects Academy panel (Connection settings).";
    });
  }

  window.EAPanel = {
    evalScript: evalScript,
    setStatus: setStatus,
    showError: showError,
    clearErrorState: clearErrorState,
    hasPremium: function () { return premium; },
    openMainPanel: openMainPanel
  };

  window.EAExpressionsWindow = {
    start: function () {
      refresh(session);
      if (window.EASession) window.EASession.watch(refresh);
      var buttons = [document.getElementById("openMainBtn"), document.getElementById("gateOpenMainBtn")];
      for (var i = 0; i < buttons.length; i += 1) {
        if (buttons[i]) buttons[i].addEventListener("click", openMainPanel);
      }
    }
  };

  applyLook(session.prefs);
}());
