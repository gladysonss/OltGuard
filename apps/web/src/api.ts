export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type UserRole = 'ADMIN' | 'VIEWER';

export interface CurrentUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export type AlarmSeverity = 'CLEAR' | 'INFO' | 'WARNING' | 'MINOR' | 'MAJOR' | 'CRITICAL';
export type AlarmCondition = 'ACTIVE' | 'CLEARED';
export type AlarmSource = 'OLT' | 'PON_LINK' | 'ONU';
export type OltBootstrapStatus = 'PENDING' | 'WALKING' | 'ACTIVE' | 'FAILED';

export interface Olt {
  id: string;
  name: string;
  ipAddress: string;
  snmpPort: number;
  sshUsername: string | null;
  sshPort: number;
  bootstrapStatus: OltBootstrapStatus;
  bootstrapError: string | null;
  reconciliationEnabled: boolean;
  reconciliationIntervalMinutes: number;
  createdAt: string;
  updatedAt: string;
  _count: { onus: number };
}

export interface OltTrustedIp {
  id: string;
  oltId: string;
  ipAddress: string;
  label: string | null;
  createdAt: string;
}

export interface Alarm {
  id: string;
  oltId: string;
  onuId: string | null;
  source: AlarmSource;
  slotNo: number;
  portNo: number | null;
  logicalPortNo: number | null;
  trapOid: string;
  alarmName: string;
  severity: AlarmSeverity;
  condition: AlarmCondition;
  confirmed: boolean;
  confirmedAt: string | null;
  raisedAt: string;
  clearedAt: string | null;
  olt: { id: string; name: string };
  onu: { id: string; serialNumber: string } | null;
}

export type AlarmSummary = Record<AlarmSeverity, number>;

export type TrapLogOutcome = 'ACCEPTED' | 'REJECTED' | 'UNMAPPED' | 'IGNORED';

export interface TrapLogEntry {
  timestamp: string;
  sourceIp: string;
  outcome: TrapLogOutcome;
  trapOid?: string;
  mibName?: string;
  oltId?: string;
  oltName?: string;
  severity?: string;
  condition?: 'SET' | 'CLEAR';
  slotNo?: number;
  portNo?: number;
  logicalPortNo?: number;
  serialNumber?: string;
  rejectionReason?: string;
  message: string;
  varbinds: { oid: string; value: string }[];
}

export interface CreateOltInput {
  name: string;
  ipAddress: string;
  snmpCommunity: string;
  snmpPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  sshPort?: number;
}

export interface UpdateOltInput {
  name?: string;
  ipAddress?: string;
  snmpCommunity?: string;
  snmpPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  sshPort?: number;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  password?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    onUnauthorized?.();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message ?? res.statusText;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; name: string; email: string; role: UserRole } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  me: () => request<CurrentUser>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: true }>('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const api = {
  listOlts: () => request<Olt[]>('/olts'),
  getOlt: (id: string) => request<Olt>(`/olts/${id}`),
  createOlt: (input: CreateOltInput) =>
    request<Olt>('/olts', { method: 'POST', body: JSON.stringify(input) }),
  updateOlt: (id: string, input: UpdateOltInput) =>
    request<Olt>(`/olts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  listTrustedIps: (oltId: string) => request<OltTrustedIp[]>(`/olts/${oltId}/trusted-ips`),
  addTrustedIp: (oltId: string, input: { ipAddress: string; label?: string }) =>
    request<OltTrustedIp>(`/olts/${oltId}/trusted-ips`, { method: 'POST', body: JSON.stringify(input) }),
  removeTrustedIp: (oltId: string, trustedIpId: string) =>
    request<void>(`/olts/${oltId}/trusted-ips/${trustedIpId}`, { method: 'DELETE' }),
  listAlarms: (params?: { oltId?: string }) => {
    const qs = params?.oltId ? `?oltId=${encodeURIComponent(params.oltId)}` : '';
    return request<Alarm[]>(`/alarms${qs}`);
  },
  alarmSummary: (oltId?: string) => {
    const qs = oltId ? `?oltId=${encodeURIComponent(oltId)}` : '';
    return request<AlarmSummary>(`/alarms/summary${qs}`);
  },
  confirmAlarm: (id: string) => request<Alarm>(`/alarms/${id}/confirm`, { method: 'PATCH', body: '{}' }),
  clearAlarm: (id: string) => request<Alarm>(`/alarms/${id}/clear`, { method: 'PATCH' }),
  confirmAndClearAlarm: (id: string) =>
    request<Alarm>(`/alarms/${id}/confirm-and-clear`, { method: 'PATCH', body: '{}' }),
};

export const userApi = {
  list: () => request<ManagedUser[]>('/users'),
  create: (input: CreateUserInput) =>
    request<ManagedUser>('/users', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateUserInput) =>
    request<ManagedUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
};
