import type { OnuStatus } from './api';

export const ONU_STATUS_LABEL: Record<OnuStatus, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
  ACTIVATE_PENDING: 'Ativando',
  DEACTIVATE_PENDING: 'Desativando',
  DISABLE_PENDING: 'Desabilitando',
  DISABLE: 'Desabilitada',
  INVALID: 'Invalida',
};

export const ONU_STATUS_COLOR_VAR: Record<OnuStatus, string> = {
  ACTIVE: '--ok',
  INACTIVE: '--text-muted',
  ACTIVATE_PENDING: '--accent',
  DEACTIVATE_PENDING: '--accent',
  DISABLE_PENDING: '--warn',
  DISABLE: '--crit',
  INVALID: '--crit',
};
