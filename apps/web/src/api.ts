const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type AlarmSeverity = 'CLEAR' | 'INFO' | 'WARNING' | 'MINOR' | 'MAJOR' | 'CRITICAL';
export type AlarmCondition = 'ACTIVE' | 'CLEARED';
export type AlarmSource = 'OLT' | 'PON_LINK' | 'ONU';
export type OltBootstrapStatus = 'PENDING' | 'WALKING' | 'ACTIVE' | 'FAILED';

export interface Olt {
  id: string;
  name: string;
  ipAddress: string;
  snmpPort: number;
  sshUsername: string;
  sshPort: number;
  bootstrapStatus: OltBootstrapStatus;
  bootstrapError: string | null;
  reconciliationEnabled: boolean;
  reconciliationIntervalMinutes: number;
  createdAt: string;
  updatedAt: string;
  _count: { onus: number };
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

export interface CreateOltInput {
  name: string;
  ipAddress: string;
  snmpCommunity: string;
  snmpPort?: number;
  sshUsername: string;
  sshPassword: string;
  sshPort?: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message ?? res.statusText;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listOlts: () => request<Olt[]>('/olts'),
  createOlt: (input: CreateOltInput) =>
    request<Olt>('/olts', { method: 'POST', body: JSON.stringify(input) }),
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
