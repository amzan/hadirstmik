/**
 * Utility Service for Device Session Management & Security Isolation
 * STMIK PGRI Arungbinang Kebumen
 */

import { DeviceSession, User } from '../types/attendance';

export const STORAGE_KEY_DEVICE_ID = 'stmik_device_fingerprint_id';
export const STORAGE_KEY_SESSION_TOKEN = 'stmik_active_device_session_token';
export const STORAGE_KEY_DEVICE_SESSIONS = 'stmik_device_sessions_v1';

/**
 * Get or create a persistent unique device ID for this browser
 */
export function getOrCreateDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!deviceId) {
      deviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, deviceId);
    }
    return deviceId;
  } catch {
    return `dev-${Date.now().toString(36)}`;
  }
}

/**
 * Detect browser, OS, and device type from userAgent and screen info
 */
export function getDeviceInfo(): {
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  ipSimulated: string;
  locationCity: string;
} {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  // Detect OS
  let os = 'Windows';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Windows/i.test(ua)) os = 'Windows';

  // Detect Device Type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect Browser
  let browser = 'Browser Web';
  if (/Edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Google Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

  // Format friendly device name
  let deviceName = `${browser} di ${os}`;
  if (deviceType === 'mobile') {
    deviceName = `${os} Smartphone (${browser})`;
  } else if (deviceType === 'tablet') {
    deviceName = `${os} Tablet (${browser})`;
  }

  // Simulated campus network IP & Location
  const ipSimulated = `180.252.${(Math.abs(hashString(os + browser)) % 200) + 10}.${(Math.abs(hashString(getOrCreateDeviceId())) % 250) + 2}`;
  const locationCity = 'Kebumen, Jawa Tengah (Kampus STMIK)';

  return {
    deviceName,
    deviceType,
    browser,
    os,
    ipSimulated,
    locationCity,
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Get active session token in this browser
 */
export function getCurrentSessionToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_SESSION_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Set active session token in this browser
 */
export function setCurrentSessionToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION_TOKEN, token);
  } catch {}
}

/**
 * Clear active session token
 */
export function clearCurrentSessionToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SESSION_TOKEN);
  } catch {}
}

/**
 * Load all registered device sessions from localStorage
 */
export function loadDeviceSessions(): DeviceSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEVICE_SESSIONS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading device sessions:', e);
  }
  return [];
}

/**
 * Save all registered device sessions to localStorage
 */
export function saveDeviceSessions(sessions: DeviceSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEVICE_SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Error saving device sessions:', e);
  }
}

/**
 * Register or update device session for logged-in user
 */
export function createOrUpdateDeviceSession(user: User): {
  session: DeviceSession;
  allSessions: DeviceSession[];
} {
  const deviceId = getOrCreateDeviceId();
  const info = getDeviceInfo();
  const existingSessions = loadDeviceSessions();
  const now = Date.now();

  let sessionToken = getCurrentSessionToken();
  if (!sessionToken) {
    sessionToken = `tok-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    setCurrentSessionToken(sessionToken);
  }

  // Find if a session already exists for this device and user
  const existingIdx = existingSessions.findIndex(
    s => s.deviceId === deviceId && s.userId === user.id
  );

  let session: DeviceSession;

  if (existingIdx >= 0) {
    session = {
      ...existingSessions[existingIdx],
      sessionToken,
      userName: user.name,
      userUsername: user.username,
      userRole: user.role,
      userAvatarUrl: user.avatarUrl,
      deviceName: info.deviceName,
      deviceType: info.deviceType,
      browser: info.browser,
      os: info.os,
      ipSimulated: info.ipSimulated,
      locationCity: info.locationCity,
      lastActiveTimestamp: now,
      status: 'ACTIVE',
    };
    existingSessions[existingIdx] = session;
  } else {
    session = {
      id: `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      deviceId,
      sessionToken,
      userId: user.id,
      userUsername: user.username,
      userName: user.name,
      userRole: user.role,
      userAvatarUrl: user.avatarUrl,
      deviceName: info.deviceName,
      deviceType: info.deviceType,
      browser: info.browser,
      os: info.os,
      ipSimulated: info.ipSimulated,
      locationCity: info.locationCity,
      loginTimestamp: now,
      lastActiveTimestamp: now,
      status: 'ACTIVE',
    };
    existingSessions.push(session);
  }

  saveDeviceSessions(existingSessions);

  return { session, allSessions: existingSessions };
}
