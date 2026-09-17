/**
 * Filtra traps SNMP recebidas antes de qualquer processamento de evento.
 * Todo trap passa por aqui primeiro: origem fora do filtro de rede, origem
 * desconhecida ou community errada nunca chegam ao parser (parks-trap-mapping.ts).
 */
import { ipMatchesCidr } from './cidr.util';

export interface IncomingTrap {
  sourceIp: string;
  community: string;
  oid: string;
}

export interface TrustedOlt {
  id: string;
  name: string;
  ipAddress: string;
  snmpCommunity: string;
}

export type TrapRejectionReason = 'NETWORK_NOT_ALLOWED' | 'UNKNOWN_SOURCE_IP' | 'COMMUNITY_MISMATCH';

export interface TrapValidationResult {
  accepted: boolean;
  oltId?: string;
  oltName?: string;
  rejectionReason?: TrapRejectionReason;
}

export class TrapSecurityService {
  /**
   * @param trustedOlts snapshot em memória das OLTs cadastradas (ip + community descriptografada).
   * @param allowedNetworks IPs/CIDRs globais autorizados a enviar traps. Vazio = sem
   * restricao de rede.
   * Ambos recarregados periodicamente pelo caller a cada cadastro/edição.
   */
  constructor(
    private readonly trustedOlts: TrustedOlt[],
    private readonly allowedNetworks: string[],
  ) {}

  validate(trap: IncomingTrap): TrapValidationResult {
    if (this.allowedNetworks.length > 0) {
      const networkAllowed = this.allowedNetworks.some((cidr) => ipMatchesCidr(trap.sourceIp, cidr));
      if (!networkAllowed) {
        return { accepted: false, rejectionReason: 'NETWORK_NOT_ALLOWED' };
      }
    }

    const olt = this.trustedOlts.find((o) => o.ipAddress === trap.sourceIp);
    if (!olt) {
      return { accepted: false, rejectionReason: 'UNKNOWN_SOURCE_IP' };
    }

    if (olt.snmpCommunity !== trap.community) {
      return { accepted: false, rejectionReason: 'COMMUNITY_MISMATCH' };
    }

    return { accepted: true, oltId: olt.id, oltName: olt.name };
  }
}
