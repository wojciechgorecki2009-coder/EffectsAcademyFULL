/*
 * FAQ for the "Test Extension" page, one section per tab of the extension panel
 * plus the panel basics. `actions` are the ids the demo panel sends when a button
 * is pressed (see public/extension-demo/demo.js and EA_DEMO in the extension's
 * js/app.js), so the page can open the answer for the button that was just used.
 */

export const DEMO_TABS = ["All", "Audios", "Presets", "Project Files", "Premium", "Expressions", "3D Models", "Captions", "Settings"];

export const TAB_FAQ = {
  All: {
    title: "All",
    intro: "Everything in the library in one list: audios, presets, project files and Premium assets, newest first.",
    items: [
      {
        id: "all-card",
        q: "What's on each card?",
        a: "The artwork, a category badge, how many times it's been downloaded (↓), the title and a line with the creator, genre or After Effects version. Underneath are the main button and a smaller one next to it.",
      },
      {
        id: "all-main-button",
        q: "What does the main button do?",
        a: "Its label tells you. Add to comp downloads an audio and puts it in your active comp at the playhead. Import applies a preset to your selected layers, or brings any other file into your project. Unpack + import downloads a pack, unpacks it and imports what's inside.",
        actions: ["import", "import-audio", "import-preset", "import-archive", "import-project"],
      },
      {
        id: "all-small-button",
        q: "What's the small button next to it?",
        a: "On audios it plays a preview in the player. On everything else it opens the asset's page in your browser.",
        actions: ["open-link"],
      },
      {
        id: "all-files",
        q: "Where do the downloaded files go?",
        a: "Into an Effects Academy downloads folder on your computer (in AppData on Windows, your home folder on Mac), so everything you import keeps working in your projects.",
      },
      {
        id: "all-demo",
        q: "Is anything downloaded in this demo?",
        a: "No. You're looking at the real panel and the live library, but every button only explains what it would do in After Effects.",
      },
    ],
  },
  Audios: {
    title: "Audios",
    intro: "Every audio from the site's creators, ready to drop on your timeline.",
    items: [
      {
        id: "audios-preview",
        q: "How do I listen before adding one?",
        a: "Press the play button on the artwork or next to Add to comp. The player opens at the bottom with play/pause, a scrub bar, mute and volume. Previews work in this demo too.",
        actions: ["audio-preview"],
      },
      {
        id: "audios-add",
        q: "What does Add to comp do?",
        a: "It downloads the audio and adds it as a layer in your active comp, starting at the playhead. With no comp open, it goes into the Project panel instead.",
        actions: ["import-audio"],
      },
      {
        id: "audios-slowed",
        q: "What are Add 0.9x and Add 0.8x?",
        a: "They're in the player. They add the audio you're previewing slowed down to 0.9x or 0.8x speed, ready for slowed edits, so you don't have to time-stretch it yourself.",
        actions: ["import-slowed"],
      },
      {
        id: "audios-close",
        q: "How do I close the player?",
        a: "Press the × at the top right of the player. It stops the preview and slides away.",
      },
      {
        id: "audios-search",
        q: "Can I find a specific creator or song?",
        a: "Yes. Type in the search field: it looks through titles, creators and genres in the open tab.",
      },
    ],
  },
  Presets: {
    title: "Presets",
    intro: "Effect presets (.ffx) and preset packs.",
    items: [
      {
        id: "presets-apply",
        q: "How do I apply a preset?",
        a: "Select one or more layers in your comp, then press Import. The preset is applied to every selected layer. If nothing is selected, the panel asks you to select a layer first.",
        actions: ["import-preset"],
      },
      {
        id: "presets-packs",
        q: "What about preset packs?",
        a: "Packs (.zip, .rar or .7z) show Unpack + import. The panel downloads the pack, unpacks it, including archives inside it, and imports what After Effects can open. If there's nothing it can import directly, it opens the folder so you can pick the files.",
        actions: ["import-archive"],
      },
      {
        id: "presets-undo",
        q: "Can I undo it?",
        a: "Yes. Every import is a single undo step in After Effects, so Ctrl+Z (Cmd+Z on Mac) takes it back.",
      },
    ],
  },
  "Project Files": {
    title: "Project Files",
    intro: "After Effects project files and project packs.",
    items: [
      {
        id: "projects-unpack",
        q: "What does Unpack + import do?",
        a: "It downloads the pack, unpacks it (archives inside it too) and imports the project and its files into the project you have open. If it can't find anything to import, it opens the folder instead.",
        actions: ["import-archive", "import"],
      },
      {
        id: "projects-replace",
        q: "Will it replace my open project?",
        a: "No. An .aep is imported into your current project as its own folder in the Project panel. Your project stays open and untouched.",
        actions: ["import-project"],
      },
      {
        id: "projects-version",
        q: "Which After Effects version do I need?",
        a: "When a card lists an After Effects version, that's the version the project was made with. Projects from a newer version won't open in an older one.",
      },
      {
        id: "projects-rar",
        q: "Do I need anything to unpack packs?",
        a: ".zip packs unpack on their own. For .rar and .7z packs, have 7-Zip or WinRAR installed.",
      },
    ],
  },
  Premium: {
    title: "Premium",
    intro: "The Premium-only assets: the more advanced project files, presets and packs.",
    items: [
      {
        id: "premium-what",
        q: "What's in this tab?",
        a: "Only the assets marked Premium. They're included with your membership, with unlimited downloads, and new ones arrive every month.",
      },
      {
        id: "premium-import",
        q: "Do they import any differently?",
        a: "No. They use the same buttons as everything else: Import, Add to comp or Unpack + import, depending on the file.",
        actions: ["import", "import-archive", "import-preset", "import-project"],
      },
      {
        id: "premium-all",
        q: "Are they in the All tab too?",
        a: "Yes. All shows the whole library; this tab shows just the Premium items.",
      },
    ],
  },
  Expressions: {
    title: "Expressions",
    intro: "One-click text animations for your text layers.",
    items: [
      {
        id: "fx-apply",
        q: "How do I use an animation?",
        a: "Select a text layer, move the playhead to where the animation should start, then press Apply to text. The keyframes start at the playhead; press U on the layer to see them.",
        actions: ["expression-apply"],
      },
      {
        id: "fx-which",
        q: "Which animations are there?",
        a: "Letter Fade in, Pop Up, Swing Up and Letter Swing Up. Each card plays a looping example, so you can see it before you apply it.",
      },
      {
        id: "fx-edit",
        q: "Can I change an animation after applying it?",
        a: "Yes. The keyframes are normal keyframes you can move and re-ease. Pop Up also adds sliders in Effect Controls (Amplitude, Frequency, Decay and Floor) to tune its bounce.",
      },
      {
        id: "fx-window",
        q: "What's Open in its own window?",
        a: "It opens Expressions as its own small panel that you can float or dock anywhere, so you don't need the full extension open. It's also in Window › Extensions › Effects Academy Expressions.",
        actions: ["expressions-popout"],
      },
    ],
  },
  "3D Models": {
    title: "3D Models",
    intro: "Import Sketchfab models straight into your comp. This tab is in beta.",
    items: [
      {
        id: "models-find",
        q: "How do I find a model?",
        a: "Paste a Sketchfab model link and press Find. You'll see its name, creator, vertex and face count and its animations. A Not downloadable chip means its creator hasn't allowed downloads. Finding works for real in this demo.",
      },
      {
        id: "models-connect",
        q: "Why do I need to connect Sketchfab?",
        a: "Sketchfab only allows downloads from a signed-in account (a free one works). Open my Sketchfab API token takes you to the token; paste it in and press Connect. It's saved only in the panel and sent only to Sketchfab. In this demo, Connect just shows the next step and no token is asked for.",
        actions: ["sketchfab-connect"],
      },
      {
        id: "models-format",
        q: "OBJ or GLB?",
        a: "OBJ is best for After Effects: it's converted on your computer, with textures. GLB is one file with textures, exactly as Sketchfab provides it.",
      },
      {
        id: "models-import",
        q: "What does Import to comp do?",
        a: "It downloads the model and adds it to your active comp as a 3D layer. If the comp needs it, it switches the comp to the Advanced 3D renderer. 3D models need After Effects 2024 or newer.",
        actions: ["model-import"],
      },
      {
        id: "models-credit",
        q: "What's the licence card?",
        a: "It shows the model's licence and what it asks of you. Copy credit copies the attribution text so you can paste it into your video's description.",
      },
    ],
  },
  Captions: {
    title: "Captions",
    intro: "Automatic captions for the clip you select.",
    items: [
      {
        id: "captions-run",
        q: "How do I add captions?",
        a: "Select a video or audio layer (or a precomp with audio) in your active comp and press Add Captions. The panel transcribes it and builds caption text layers on the timeline, timed to the speech.",
        actions: ["captions-run"],
      },
      {
        id: "captions-local",
        q: "Is my audio uploaded anywhere?",
        a: "No. Transcription runs on your own computer, so how fast and accurate it is depends on your PC.",
      },
      {
        id: "captions-font",
        q: "Can I choose the font?",
        a: "Yes. The Caption font field lists the fonts installed in After Effects; type to search them. The demo shows a sample list.",
      },
      {
        id: "captions-style",
        q: "What do Fade-in animation and Increase Tracking do?",
        a: "Fade-in animation picks how each caption appears: Fade Up Words or Slow Fade On. Increase Tracking animates the letter spacing from 0 to 9 across each caption. Fade Out Slow is always added at the end.",
      },
    ],
  },
  Settings: {
    title: "Settings",
    intro: "Make the panel look the way you like. Changes apply instantly, and you can try them here.",
    items: [
      {
        id: "settings-style",
        q: "What's the difference between the styles?",
        a: "Liquid Glass matches the website, with glass and colour. Black & white minimal is flat and colourless.",
      },
      {
        id: "settings-layout",
        q: "Layout, Density, Card size and Interface size?",
        a: "Layout switches between grid cards and a vertical list, or leave it on Auto. Density tightens the spacing, Card size sets how big the cards are, and Interface size scales the whole panel.",
      },
      {
        id: "settings-accent",
        q: "Accent and Motion?",
        a: "Accent is the highlight colour. Motion is Full motion, or Calm for fewer animations.",
      },
      {
        id: "settings-paste",
        q: "What does Pasted images change?",
        a: "Whether an image you paste with the clipboard button is shrunk to fit the comp or kept at its original size.",
      },
      {
        id: "settings-font",
        q: "And Font?",
        a: "The panel's typeface: San Francisco, your system font, or Editor mono.",
      },
    ],
  },
};

export const BASICS_FAQ = {
  title: "Panel basics",
  items: [
    {
      id: "basics-what",
      q: "What is the Effects Academy extension?",
      a: "A panel inside After Effects (2023 or newer) that comes with Premium. It puts the whole library and our tools next to your timeline, so you never leave After Effects to grab an asset.",
    },
    {
      id: "basics-install",
      q: "How do I get it?",
      a: "After subscribing, download the extension from the Premium page, install it with ZXP/UXP Installer, then open Window › Extensions › Effects Academy.",
    },
    {
      id: "basics-connect",
      q: "How do I connect my account?",
      a: "Open Connection settings at the bottom of the panel. On the Premium page, press Generate AE pairing code, type the code into the panel and press Connect Premium account. One account works with one install at a time; you can reset it from the Premium page when you move to a new PC.",
      actions: ["pairing"],
    },
    {
      id: "basics-paste",
      q: "What's the clipboard button at the top?",
      a: "Paste image. It imports the image on your clipboard (a screenshot, an image copied from a browser or an image file) into your active comp. Ctrl+V (Cmd+V) in the panel does the same.",
      actions: ["paste-image"],
    },
    {
      id: "basics-refresh",
      q: "And the arrow button next to it?",
      a: "Refresh. It reloads the library so new uploads show up.",
    },
    {
      id: "basics-status",
      q: "What does the bar under the title show?",
      a: "What the panel is doing right now: loading, importing, or what went wrong (it turns red when something needs your attention). The number on the right is how many assets are in the open tab.",
    },
    {
      id: "basics-search",
      q: "How does search work?",
      a: "It searches the open tab by title, creator, genre, description, After Effects version and category, as you type.",
    },
  ],
};

/** The FAQ item for a demo button, preferring the open tab's section. */
export function findFaqForAction(actionId, tab) {
  const sections = [TAB_FAQ[tab], BASICS_FAQ, ...DEMO_TABS.map((name) => TAB_FAQ[name])].filter(Boolean);
  for (const section of sections) {
    const item = section.items.find((entry) => entry.actions?.includes(actionId));
    if (item) return { item, inBasics: section === BASICS_FAQ, tab: section === BASICS_FAQ ? tab : section.title };
  }
  return null;
}
