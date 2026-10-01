/**
 * Install attribution for the activation scoreboard.
 *
 * Resolves where this install came from once, persists it, and attaches it to
 * every analytics event as `install_source` so marketing can compare channels by
 * activated users. Android reads the Play Install Referrer (the `referrer`
 * param on tagged Play links). iOS has no in-app equivalent for App Store
 * Connect campaign links, so iOS installs always resolve to "organic".
 *
 * The param is `install_source`, not the brief's `source`: Firebase predefines
 * `source` as a campaign-attribution param (campaign_details), and this one
 * rides on every event, so it must not collide with GA4's own attribution.
 *
 * Also logs `app_first_open` once per install. Firebase reserves the name
 * `first_open` (it logs that one itself), so the custom twin carries the
 * brief's params: platform, app_version, install_source.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { logEvent, setDefaultEventParams, setUserProperty } from './analyticsService';

const SOURCE_KEY = '@playnxt_install_source';
const FIRST_OPEN_LOGGED_KEY = '@playnxt_first_open_logged';

// Installed longer ago than this means an upgrade from a pre-attribution
// build, not a new install; those skip app_first_open.
const NEW_INSTALL_WINDOW_MS = 24 * 60 * 60 * 1000;

const ORGANIC = 'organic';
const ORGANIC_SOURCES = ['google-play', '(not set)', '(not%20set)'];

type Attribution = { source: string; campaign: string | null };

let _attribution: Promise<Attribution> | null = null;

/** Lowercase, param-safe, within GA4's 100-char value limit. */
function clean(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.toLowerCase().replace(/[^a-z0-9_.\-]/g, '').slice(0, 100);
  return v || null;
}

/**
 * Parse a Play install referrer string, e.g.
 * "utm_source=scenario-pages&utm_medium=web&utm_campaign=playnxt-30min-lowenergy".
 * Play reports untagged installs as utm_source=google-play&utm_medium=organic.
 */
export function parseInstallReferrer(referrer: string | null | undefined): Attribution {
  let raw = referrer || '';
  // A double-encoded link arrives with its separators still escaped
  if (!raw.includes('=') && /%3D/i.test(raw)) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      raw = '';
    }
  }
  const params: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    const [key, ...rest] = pair.split('=');
    if (!key) continue;
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      // Malformed escape: ignore this pair
    }
  }
  const rawSource = (params.utm_source || '').toLowerCase();
  if (!rawSource || ORGANIC_SOURCES.includes(rawSource) || params.utm_medium === 'organic') {
    return { source: ORGANIC, campaign: null };
  }
  return { source: clean(rawSource) || ORGANIC, campaign: clean(params.utm_campaign) };
}

async function readReferrerAttribution(): Promise<Attribution> {
  if (Platform.OS !== 'android') return { source: ORGANIC, campaign: null };
  try {
    return parseInstallReferrer(await Application.getInstallReferrerAsync());
  } catch {
    // No Play Store / referrer service unavailable
    return { source: ORGANIC, campaign: null };
  }
}

async function loadAttribution(): Promise<Attribution> {
  try {
    const stored = await AsyncStorage.getItem(SOURCE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Fall through and re-resolve
  }
  const attribution = await readReferrerAttribution();
  try {
    await AsyncStorage.setItem(SOURCE_KEY, JSON.stringify(attribution));
  } catch {
    // Re-resolved next launch; the referrer is stable for the install
  }
  return attribution;
}

/** The install's source, resolved once per install and cached. */
export function getInstallSource(): Promise<string> {
  if (!_attribution) _attribution = loadAttribution();
  return _attribution.then((a) => a.source).catch(() => ORGANIC);
}

async function isNewInstall(): Promise<boolean> {
  try {
    const installedAt = await Application.getInstallationTimeAsync();
    return Date.now() - installedAt.getTime() < NEW_INSTALL_WINDOW_MS;
  } catch {
    return true;
  }
}

/**
 * Call once at app start. Tags all later events with `install_source` and logs
 * `app_first_open` on a fresh install. Never throws.
 */
export async function initAttribution(): Promise<void> {
  try {
    if (!_attribution) _attribution = loadAttribution();
    const { source, campaign } = await _attribution;

    setDefaultEventParams({ install_source: source });
    setUserProperty('install_source', source);
    if (campaign) setUserProperty('install_campaign', campaign);

    if (await AsyncStorage.getItem(FIRST_OPEN_LOGGED_KEY)) return;
    if (await isNewInstall()) {
      logEvent('app_first_open', {
        platform: Platform.OS,
        app_version: Application.nativeApplicationVersion || 'unknown',
        install_source: source,
      });
    }
    await AsyncStorage.setItem(FIRST_OPEN_LOGGED_KEY, '1');
  } catch {
    // Attribution must never break startup
  }
}

/** Test-only: forget the cached attribution. */
export function _resetForTesting(): void {
  _attribution = null;
}
