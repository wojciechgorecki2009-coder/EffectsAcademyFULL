/*
 * Expressions tab: one-click text animations.
 *
 * Each preset describes the text animators (plus any effects and expressions)
 * that EA_applyTextPreset in jsx/host.jsx builds on the selected text layers.
 * Keyframes start at the playhead and stay ordinary keyframes, so they can be
 * moved and re-eased. Add a preset by adding an entry below and its example
 * video (640×360 WebM) and poster to assets/expressions/.
 *
 * Property names are After Effects match names, so presets work in any language.
 */
(function () {
  "use strict";

  var PRESETS = [
    {
      id: "letter-fade-in",
      name: "Letter Fade in",
      description: "Each letter rises 100 px and fades in, one after another, left to right. 1.5 s with Easy Ease.",
      video: "./assets/expressions/letter-fade-in.webm",
      poster: "./assets/expressions/letter-fade-in.jpg",
      animators: [
        {
          name: "Letter Fade in",
          properties: {
            "ADBE Text Position 3D": [0, 100, 0],
            "ADBE Text Opacity": 0
          },
          selector: {
            advanced: {
              "ADBE Text Range Units": 1, // Percentage
              "ADBE Text Range Type2": 1, // Based on characters
              "ADBE Text Selector Mode": 1, // Add
              "ADBE Text Selector Max Amount": 100,
              "ADBE Text Range Shape": 2, // Ramp Up (Smoothness is hidden for this shape, so it isn't set)
              "ADBE Text Levels Max Ease": 50,
              "ADBE Text Levels Min Ease": 100,
              "ADBE Text Randomize Order": 0
            },
            values: {
              "ADBE Text Percent Start": 0,
              "ADBE Text Percent End": 100
            },
            keys: {
              "ADBE Text Percent Offset": [{ t: 0, v: -100 }, { t: 1.5, v: 100 }]
            },
            ease: "easy"
          }
        }
      ],
      effects: [],
      expressions: []
    }
  ];

  var panel = window.EAPanel;
  var grid = document.getElementById("expressionsGrid");
  var gate = document.getElementById("expressionsPremiumGate");
  if (!panel || !grid) return;

  var locked = true;
  var busy = false;

  function presetForHost(preset) {
    return { name: preset.name, animators: preset.animators, effects: preset.effects, expressions: preset.expressions };
  }

  function apply(preset, button) {
    if (busy) return;
    if (locked) {
      panel.showError("Premium authentication required", "Connect an active Premium account in Connection settings to use text animations.");
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = "Applying…";
    panel.clearErrorState();
    // JSON is also a valid ExtendScript object literal, so the preset passes straight through.
    panel.evalScript("EA_applyTextPreset(" + JSON.stringify(presetForHost(preset)) + ")").then(function (result) {
      var parsed = {};
      try { parsed = JSON.parse(result || "{}"); } catch (e) {}
      if (!parsed.ok) throw new Error(parsed.message || "After Effects couldn't add the animation.");
      panel.setStatus(preset.name + " applied", parsed.message);
    }).catch(function (err) {
      panel.showError("Couldn't apply " + preset.name, String((err && err.message) || err || "Something went wrong."));
    }).then(function () {
      busy = false;
      button.disabled = locked;
      button.textContent = "Apply to text";
    });
  }

  function buildCard(preset) {
    var card = document.createElement("article");
    card.className = "card fx-card";
    card.setAttribute("data-preset", preset.id);

    var thumb = document.createElement("div");
    thumb.className = "thumb fx-thumb";
    var video = document.createElement("video");
    video.src = preset.video;
    video.poster = preset.poster;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-label", preset.name + " example");
    thumb.appendChild(video);

    var body = document.createElement("div");
    body.className = "card-body";
    var title = document.createElement("div");
    title.className = "title";
    title.textContent = preset.name;
    var sub = document.createElement("p");
    sub.className = "fx-description";
    sub.textContent = preset.description;
    var actions = document.createElement("div");
    actions.className = "actions";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Apply to text";
    button.addEventListener("click", function () { apply(preset, button); });
    actions.appendChild(button);

    body.appendChild(title);
    body.appendChild(sub);
    body.appendChild(actions);
    card.appendChild(thumb);
    card.appendChild(body);
    return card;
  }

  PRESETS.forEach(function (preset) { grid.appendChild(buildCard(preset)); });

  function videos() { return grid.querySelectorAll("video"); }

  window.EAExpressions = {
    show: function () {
      var list = videos();
      for (var i = 0; i < list.length; i += 1) list[i].play().catch(function () {});
    },
    // Paused while another tab is open, so the previews cost nothing.
    hide: function () {
      var list = videos();
      for (var i = 0; i < list.length; i += 1) list[i].pause();
    },
    setLocked: function (value) {
      locked = value;
      if (gate) gate.classList.toggle("hidden", !value);
      grid.classList.toggle("premium-locked", value);
      var buttons = grid.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i += 1) buttons[i].disabled = value || busy;
    },
    count: PRESETS.length
  };

  window.EAExpressions.hide();
  window.EAExpressions.setLocked(!panel.hasPremium());
})();
