/**
 * Filtra traps SNMP recebidas antes de qualquer processamento de evento.
 * Todo trap passa por aqui primeiro: origem desconhecida ou community errada
 * nunca chega ao parser (parks-trap-mapping.ts).
 */

export interface IncomingTrap {
  sourceIp: string;
  community: string;
  oid: string;
}

export interface TrustedOlt {
  id: string;
  ipAddress: string;
  snmpCommunity: string;
}

export type TrapRejectionReason = 'UNKNOWN_SOURCE_IP' | 'COMMUNITY_MISMATCH';

export interface TrapValidationResult {
  accepted: boolean;
  oltId?: string;
  rejectionReason?: TrapRejectionReason;
}

export class TrapSecurityService {
  /**
   * @param trustedOlts snapshot em memória das OLTs cadastradas (ip + community).
   * Recarregado periodicamente pelo caller a cada cadastro/edição de OLT —
   * este service não acessa o banco diretamente.
   */
  constructor(private readonly trustedOlts: TrustedOlt[]) {}

  validate(trap: IncomingTrap): TrapValidationResult {
    const olt = this.trustedOlts.find((o) => o.ipAddress === trap.sourceIp);

    if (!olt) {
      return { accepted: false, rejectionReason: 'UNKNOWN_SOURCE_IP' };
    }

    if (olt.snmpCommunity !== trap.community) {
      return { accepted: false, rejectionReason: 'COMMUNITY_MISMATCH' };
    }

    return { accepted: true, oltId: olt.id };
  }
}
