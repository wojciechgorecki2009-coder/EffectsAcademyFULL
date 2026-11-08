/*
 * Expressions tab: one-click text animations.
 *
 * Each preset describes the text animators, layer Transform keyframes, effects and
 * expressions that EA_applyTextPreset in jsx/host.jsx builds on the selected layers.
 * Keyframes start at the playhead and stay ordinary keyframes, so they can be
 * moved and re-eased. Add a preset by adding an entry below and its example
 * video (640×360 WebM) and poster to assets/expressions/.
 *
 * Property names are After Effects match names, so presets work in any language.
 */
(function () {
  "use strict";

  // Overshoot for Pop Up: after the last keyframe the value swings past it and settles,
  // driven by the speed it arrived with. Amplitude, Frequency (bounces per second) and Decay
  // come from the Pop Up controls; Floor bounces back off the end value instead of through it.
  // Controls are read by index so this works in any After Effects language.
  var OVERSHOOT = [
    "// Effects Academy: Pop Up overshoot",
    "var amp = effect(\"Pop Up Amplitude\")(1) / 1000;",
    "var freq = effect(\"Pop Up Frequency\")(1);",
    "var decay = effect(\"Pop Up Decay\")(1);",
    "var floor = effect(\"Pop Up Floor\")(1) == 1;",
    "var n = 0;",
    "if (numKeys > 0) {",
    "  n = nearestKey(time).index;",
    "  if (key(n).time > time) n--;",
    "}",
    "if (n > 0) {",
    "  var t = time - key(n).time;",
    "  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);",
    "  var wave = Math.sin(freq * t * 2 * Math.PI);",
    "  if (floor) wave = -Math.abs(wave);",
    "  value + v * amp * wave / Math.exp(decay * t);",
    "} else {",
    "  value;",
    "}"
  ].join("\n");

  // Settle for Swing Up: the same kind of bounce past the last keyframe, with its
  // settings written into the expression so no extra effects are added to the layer.
  var SWING_SETTLE = [
    "// Effects Academy: Swing Up settle",
    "var freq = 2;     // bounces per second",
    "var decay = 9.8;  // how fast the bounce dies away",
    "var amp = 0.11;   // bounce strength",
    "var n = 0;",
    "if (numKeys > 0) {",
    "  n = nearestKey(time).index;",
    "  if (key(n).time > time) n--;",
    "}",
    "if (n > 0) {",
    "  var t = time - key(n).time;",
    "  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);",
    "  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);",
    "} else {",
    "  value;",
    "}"
  ].join("\n");

  // Letter Swing Up: Wojtek's Expression Selector expression, as written, except that it
  // starts at the playhead (__EA_START__, filled in on apply) instead of the layer's In point.
  var LETTER_SWING = [
    "freq = 1;",
    "decay = 8;",
    "duration = 0.25;",
    "retard = textIndex*thisComp.frameDuration*1;",
    "start = thisLayer.startTime + __EA_START__; // where it was applied (seconds into the layer)",
    "t = time - (start + retard);",
    "startVal = [100,100,100];",
    "endVal = [0,0,0];",
    "if (t < duration){",
    "linear(t,0,duration,startVal,endVal);",
    "}else{",
    "amp = (endVal - startVal)/duration;",
    "w = freq*Math.PI*2;",
    "endVal + amp*(Math.sin((t-duration)*w)/Math.exp(decay*(t-duration))/w);",
    "}"
  ].join("\n");

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
    },
    {
      id: "pop-up",
      name: "Pop Up",
      description: "Rises 81 px, grows from 90% and fades in, then overshoots and settles with a bounce. 0.42 s; tune the bounce in the Pop Up effects.",
      video: "./assets/expressions/pop-up.webm",
      poster: "./assets/expressions/pop-up.jpg",
      animators: [],
      // Values are relative to where the layer already is: Position is offset from it,
      // Scale is a percentage of it, so the text ends exactly where it was placed.
      // easeIn/easeOut are [speed, influence %], as in Keyframe Velocity.
      transform: [
        {
          matchName: "ADBE Position",
          mode: "offset",
          keys: [
            { t: 0, v: [0, 81, 0], easeIn: [0, 69], easeOut: [0, 57] },
            // Arrives still moving (111.8 px/s), which is what the overshoot bounces off.
            { t: 25 / 60, v: [0, 0, 0], easeIn: [111.817, 69], easeOut: [0, 16.667] }
          ],
          expression: OVERSHOOT
        },
        {
          matchName: "ADBE Scale",
          mode: "percent",
          keys: [
            { t: 0, v: [90, 90, 100], easeIn: [0, 69], easeOut: [0, 57] },
            { t: 25 / 60, v: [100, 100, 100], easeIn: [0, 69], easeOut: [0, 16.667] }
          ]
        },
        {
          matchName: "ADBE Opacity",
          mode: "absolute",
          keys: [
            { t: 0, v: 0, easeIn: [0, 69], easeOut: [0, 57] },
            { t: 25 / 60, v: 100, easeIn: [0, 69], easeOut: [0, 16.667] }
          ]
        }
      ],
      effects: [
        { matchName: "ADBE Slider Control", name: "Pop Up Amplitude", values: { "ADBE Slider Control-0001": 90 } },
        { matchName: "ADBE Slider Control", name: "Pop Up Frequency", values: { "ADBE Slider Control-0001": 2 } },
        { matchName: "ADBE Slider Control", name: "Pop Up Decay", values: { "ADBE Slider Control-0001": 4 } },
        { matchName: "ADBE Checkbox Control", name: "Pop Up Floor", values: { "ADBE Checkbox Control-0001": 0 } }
      ],
      expressions: []
    },
    {
      id: "swing-up",
      name: "Swing Up",
      description: "The text swings up from 343 px below, untwisting from 60° and fading in, then overshoots and settles. 20 frames at 60 fps (0.33 s).",
      video: "./assets/expressions/swing-up.webm",
      poster: "./assets/expressions/swing-up.jpg",
      animators: [
        {
          name: "Swing Up",
          // Each letter starts 343 px lower, turned 60° and invisible; the selector's
          // Amount keyframes (100 → 0) bring it home.
          properties: {
            "ADBE Text Position 3D": [0, 343, 0],
            "ADBE Text Rotation": 60,
            "ADBE Text Opacity": 0
          },
          selector: {
            advanced: {
              "ADBE Text Range Units": 1, // Percentage
              "ADBE Text Range Type2": 1, // Based on characters
              "ADBE Text Selector Mode": 1, // Add
              "ADBE Text Range Shape": 1, // Square: every letter moves together
              "ADBE Text Levels Max Ease": 0,
              "ADBE Text Levels Min Ease": 0,
              "ADBE Text Randomize Order": 0
            },
            values: {
              "ADBE Text Percent Start": 0,
              "ADBE Text Percent End": 100,
              "ADBE Text Percent Offset": 0
            },
            // Measured from the original: a slow start (14.5% influence) and an arrival that's
            // still moving (-235.8%/s, 29.2% influence), which the settle expression bounces off.
            keys: {
              "ADBE Text Selector Max Amount": [
                { t: 0, v: 100, easeOut: [0, 14.5] },
                { t: 20 / 60, v: 0, easeIn: [-235.8, 29.2] }
              ]
            },
            expressions: {
              "ADBE Text Selector Max Amount": SWING_SETTLE
            }
          }
        }
      ],
      effects: [],
      expressions: []
    },
    {
      id: "letter-swing-up",
      name: "Letter Swing Up",
      description: "Each letter swings up from 343 px below, untwisting from 60° and fading in, a frame after the one before, then bounces and settles. 0.25 s per letter.",
      video: "./assets/expressions/letter-swing-up.webm",
      poster: "./assets/expressions/letter-swing-up.jpg",
      note: "It's driven by the expression on the Expression Selector's Amount: change freq, decay and duration there.",
      animators: [
        {
          name: "Letter Swing Up",
          properties: {
            "ADBE Text Position 3D": [0, 343, 0],
            "ADBE Text Rotation": 60,
            "ADBE Text Opacity": 0
          },
          // Range Selector left at its defaults (whole text); the Expression Selector does the timing.
          selector: {
            values: {
              "ADBE Text Percent Start": 0,
              "ADBE Text Percent End": 100,
              "ADBE Text Percent Offset": 0
            }
          },
          expressionSelector: {
            basedOn: 1, // Characters
            expression: LETTER_SWING
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
    return { name: preset.name, note: preset.note || "", animators: preset.animators, transform: preset.transform || [], effects: preset.effects, expressions: preset.expressions };
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
    if (panel.demo) {
      // Website demo: nothing to apply it to, so explain what would happen.
      setTimeout(function () {
        panel.demo("expression-apply", "Demo: " + preset.name, "In After Effects, this adds " + preset.name + " to the selected text layer, starting at the playhead. " + (preset.note || "Press U to see the keyframes."));
        busy = false;
        button.disabled = locked;
        button.textContent = "Apply to text";
      }, 450);
      return;
    }
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

  // "Open in its own window" (main panel only): opens the standalone Expressions panel
  // (expressions.html), which After Effects lets you float or dock like any panel.
  var popOut = document.getElementById("expressionsPopOutBtn");
  if (popOut) {
    popOut.addEventListener("click", function () {
      if (panel.demo) {
        panel.demo("expressions-popout", "Expressions opened in its own window", "Drag it by its title bar. In After Effects you can float or dock it anywhere, so you don't need the full extension open.");
        return;
      }
      try {
        window.__adobe_cep__.requestOpenExtension("com.effectsacademy.expressions", "");
        panel.clearErrorState();
        panel.setStatus("Expressions opened in its own window", "Drag its tab to dock it anywhere, or leave it floating. It's also in Window › Extensions › Effects Academy Expressions.");
      } catch (err) {
        panel.showError("Couldn't open the Expressions window", "Open it from Window › Extensions › Effects Academy Expressions.");
      }
    });
  }

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
