/*
 * Demo mode for the extension panel on the website's "Test Extension" page.
 * Loaded before js/app.js, which sees window.EA_DEMO and then:
 *   - shows the public library instead of asking for a Premium login,
 *   - makes every import, apply and connect button explain what it would do in
 *     After Effects instead of downloading anything,
 *   - never reads, asks for or stores a token.
 * The page that holds this iframe gets {source: "ea-extension-demo", type, ...}
 * messages for the open tab and each button pressed, to show the matching FAQ.
 */
(function () {
  "use strict";

  var DEFAULT_API = "https://effects-academy-api.onrender.com";

  function apiBase() {
    try {
      var value = new URLSearchParams(window.location.search).get("api") || "";
      var url = new URL(value);
      var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
      if (url.protocol === "https:" || (local && url.protocol === "http:")) return url.origin;
    } catch (err) {}
    return DEFAULT_API;
  }

  function post(message) {
    if (window.parent === window) return;
    message.source = "ea-extension-demo";
    try { window.parent.postMessage(message, window.location.origin); } catch (err) {}
  }

  // A typical font list, so the caption font picker can be tried out.
  var FONTS = [
    ["Arial-BoldMT", "Arial", "Bold"],
    ["ArialMT", "Arial", "Regular"],
    ["BebasNeue-Regular", "Bebas Neue", "Regular"],
    ["Gotham-Bold", "Gotham", "Bold"],
    ["HelveticaNeue-Bold", "Helvetica Neue", "Bold"],
    ["Impact", "Impact", "Regular"],
    ["Inter-Bold", "Inter", "Bold"],
    ["Montserrat-Bold", "Montserrat", "Bold"],
    ["Montserrat-ExtraBold", "Montserrat", "ExtraBold"],
    ["Poppins-Bold", "Poppins", "Bold"],
    ["Poppins-SemiBold", "Poppins", "SemiBold"],
    ["Roboto-Bold", "Roboto", "Bold"],
    ["TheBoldFont", "THE BOLD FONT", "Bold"]
  ].map(function (font) {
    return { postScriptName: font[0], family: font[1], style: font[2], fullName: font[1] + " " + font[2] };
  });

  window.EA_DEMO = {
    apiBase: apiBase(),
    tab: function (name) { post({ type: "tab", tab: String(name) }); },
    action: function (id) { post({ type: "action", id: String(id) }); },
    // Stands in for After Effects. Only the calls the panel makes on its own are answered.
    evalScript: function (script) {
      if (/^EA_listFonts\(/.test(script)) return JSON.stringify({ ok: true, fonts: FONTS });
      if (script === "app.version") return "25.0";
      return JSON.stringify({ ok: false, message: "This is a demo, so nothing is sent to After Effects." });
    }
  };

  // The page's FAQ can open a tab: {source: "ea-extension-demo-host", type: "open-tab", tab}.
  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.source !== "ea-extension-demo-host" || data.type !== "open-tab") return;
    var tabs = document.querySelectorAll("#categoryTabs .tab");
    for (var i = 0; i < tabs.length; i += 1) {
      if (tabs[i].getAttribute("data-category") === data.tab) {
        tabs[i].click();
        return;
      }
    }
  });
}());
