/*
 * Phones and tablets (no hover, coarse pointer) render a lighter version of
 * the site: the same look, without the GPU-heavy blur filters, refraction and
 * scroll-linked parallax that make mobile Safari and Chrome kill the tab.
 * The flag is set before first paint by the boot script in public/index.html.
 */
export const LITE = typeof document !== "undefined" && "lite" in document.documentElement.dataset;
