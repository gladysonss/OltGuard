import type { AlarmSeverity } from './api';

export const SEVERITY_LABEL: Record<AlarmSeverity, string> = {
  CRITICAL: 'Critico',
  MAJOR: 'Maior',
  MINOR: 'Menor',
  WARNING: 'Aviso',
  INFO: 'Info',
  CLEAR: 'Limpo',
};

export const SEVERITY_COLOR_VAR: Record<AlarmSeverity, string> = {
  CRITICAL: '--crit',
  MAJOR: '--warn',
  MINOR: '--accent2',
  WARNING: '--accent',
  INFO: '--unknown',
  CLEAR: '--ok',
};

export const SEVERITY_ORDER: AlarmSeverity[] = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'CLEAR'];
