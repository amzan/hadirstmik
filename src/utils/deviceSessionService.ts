import { api } from './api';
import type { DeviceSession } from '../types/attendance';
export const loadDeviceSessions = () => api<DeviceSession[]>('/auth/device-sessions');
export const clearCurrentSessionToken = () => api('/auth/logout','POST',{});
