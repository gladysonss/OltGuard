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

/**
 * Usado no grafico de "alarmes ativos agora" - CLEAR fica de fora de proposito:
 * o /alarms/summary so conta condition=ACTIVE, entao um alarme so tem severity
 * CLEAR quando ja foi resolvido (junto com condition=CLEARED). Contar "Limpo"
 * nesse grafico seria um total historico que so cresce, nao um indicador do
 * que esta acontecendo agora.
 */
export const SEVERITY_ORDER: AlarmSeverity[] = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING'];
