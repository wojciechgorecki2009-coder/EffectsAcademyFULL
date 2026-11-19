/*
 * The After Effects extension release the site offers. To ship a new version: build the
 * .zxp into public/downloads with this file name, then bump the version and the dates of
 * the "new version" popup (components/ExtensionLaunchAnnouncement.jsx).
 */
export const EXTENSION_VERSION = "1.2.0";
export const EXTENSION_SHORT_VERSION = "1.2";
export const EXTENSION_DOWNLOAD_URL = `/downloads/EffectsAcademy-AE-Extension-${EXTENSION_VERSION}.zxp`;

// The "new version" popup runs for exactly 5 days from the release.
export const EXTENSION_ANNOUNCE_START = Date.parse("2026-11-19T00:00:00Z");
export const EXTENSION_ANNOUNCE_END = Date.parse("2026-11-24T00:00:00Z");
