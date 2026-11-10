/*
 * Typewriter text, used instead of fade-ups when the site font is JetBrains Mono.
 *
 * Nothing in the DOM is changed: the characters not typed yet are painted transparent
 * with the CSS Custom Highlight API (::highlight(ea-untyped) in index.css), so the text
 * keeps its final layout the whole time and React's text nodes are never touched. A
 * caret follows the typing, blinks at the end and fades away.
 *
 * Jobs that start together type one after another (eyebrow, then title, then
 * intro), but nothing waits long hidden: a queued job starts at most 1.5 s late.
 */

export const supportsTypewriter =
  typeof window !== "undefined" &&
  typeof window.Highlight === "function" &&
  typeof CSS !== "undefined" &&
  Boolean(CSS.highlights);

let untyped = null;
function untypedHighlight() {
  if (!untyped) {
    untyped = new window.Highlight();
    CSS.highlights.set("ea-untyped", untyped);
  }
  return untyped;
}

let queueEnd = 0;
const MAX_QUEUE_WAIT = 1500;

function textNodes(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      // Screen-reader copies (KineticText's sr-only line) are not typed.
      if (node.parentElement?.closest(".sr-only")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

/** Characters of text inside `element`, the way the typewriter counts them. */
export function typedLength(element) {
  return element ? textNodes(element).reduce((sum, node) => sum + node.nodeValue.length, 0) : 0;
}

// Where the caret goes after `offset` characters of `node`.
function caretRect(node, offset) {
  const range = document.createRange();
  const length = node.nodeValue.length;
  if (offset < length) {
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    const rect = range.getClientRects()[0];
    if (rect) return { left: rect.left, top: rect.top, height: rect.height };
  }
  if (offset > 0) {
    range.setStart(node, Math.max(0, Math.min(length, offset) - 1));
    range.setEnd(node, Math.min(length, offset));
    const rects = range.getClientRects();
    const rect = rects[rects.length - 1];
    if (rect) return { left: rect.right, top: rect.top, height: rect.height };
  }
  return null;
}

/**
 * Hides the text inside `element` right away and returns a controller.
 * `start(delayMs)` types it; `cancel()` shows it as it is and removes the caret.
 * `onDone` runs once the last character is typed.
 */
export function prepareTypewriter(element, { msPerChar = 18, minDuration = 260, maxDuration = 1500, onDone } = {}) {
  const noop = { start() { onDone?.(); }, cancel() {} };
  if (!supportsTypewriter || !element) return noop;
  const nodes = textNodes(element);
  const total = nodes.reduce((sum, node) => sum + node.nodeValue.length, 0);
  if (!total) return noop;

  const highlight = untypedHighlight();
  const range = document.createRange();
  range.setStart(nodes[0], 0);
  range.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].nodeValue.length);
  highlight.add(range);

  const fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
  const duration = Math.min(maxDuration, Math.max(minDuration, total * msPerChar));
  let caret = null;
  let frame = 0;
  let timer = 0;
  let safety = 0;
  let finished = false;
  let cancelled = false;

  const removeCaret = () => {
    caret?.remove();
    caret = null;
  };

  const placeCaret = (node, offset) => {
    if (!caret) return;
    const rect = node?.isConnected ? caretRect(node, offset) : null;
    if (!rect) {
      caret.style.opacity = "0";
      return;
    }
    caret.style.opacity = "";
    caret.style.transform = `translate(${rect.left + window.scrollX}px, ${rect.top + window.scrollY + rect.height * 0.08}px)`;
    caret.style.height = `${rect.height * 0.84}px`;
  };

  // Finds the text node and offset after `count` characters.
  const locate = (count) => {
    let remaining = count;
    for (const node of nodes) {
      const length = node.nodeValue.length;
      if (remaining <= length) return [node, remaining];
      remaining -= length;
    }
    const last = nodes[nodes.length - 1];
    return [last, last.nodeValue.length];
  };

  const cancel = () => {
    cancelled = true;
    window.clearTimeout(timer);
    window.clearTimeout(safety);
    window.cancelAnimationFrame(frame);
    highlight.delete(range);
    removeCaret();
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(safety);
    highlight.delete(range);
    caret?.classList.add("is-done");
    onDone?.();
  };

  const run = (startTime) => {
    // Animation frames stop in background tabs; this makes sure the text still shows.
    safety = window.setTimeout(() => {
      finish();
      window.cancelAnimationFrame(frame);
      removeCaret();
    }, duration + 1000);
    caret = document.createElement("span");
    caret.className = "ea-type-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.style.width = `${Math.max(2, fontSize * 0.09)}px`;
    document.body.appendChild(caret);

    const tick = (now) => {
      if (cancelled) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const typed = Math.round(total * progress);
      const [node, offset] = locate(typed);
      if (!finished) {
        if (node.isConnected) {
          try {
            range.setStart(node, Math.min(offset, node.nodeValue.length));
          } catch (err) {
            // The text changed under us; just show it.
            highlight.delete(range);
          }
        }
        if (progress >= 1) finish();
      }
      placeCaret(node, offset);
      // The caret blinks at the end for a moment, then fades out.
      if (elapsed < duration + 1100) frame = window.requestAnimationFrame(tick);
      else removeCaret();
    };
    frame = window.requestAnimationFrame(tick);
  };

  return {
    start(delayMs = 0) {
      if (cancelled) return;
      const now = performance.now();
      const begin = Math.max(now + delayMs, Math.min(queueEnd - 60, now + MAX_QUEUE_WAIT));
      queueEnd = begin + duration;
      timer = window.setTimeout(() => run(performance.now()), begin - now);
    },
    cancel,
  };
}
