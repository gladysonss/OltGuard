/**
 * Filtra traps SNMP recebidas antes de qualquer processamento de evento.
 * Todo trap passa por aqui primeiro: origem fora do filtro de rede ou
 * community desconhecida nunca chegam ao parser (parks-trap-mapping.ts).
 *
 * A OLT e identificada pela community SNMP, nao pelo IP de origem: varias
 * OLTs podem sair atras do mesmo roteador/NAT e chegar ao servidor com o
 * mesmo IP de origem, entao o IP nao serve para diferenciar uma da outra
 * (so serve para o filtro de rede global, abaixo).
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
  snmpCommunity: string;
}

export type TrapRejectionReason = 'NETWORK_NOT_ALLOWED' | 'UNKNOWN_COMMUNITY';

export interface TrapValidationResult {
  accepted: boolean;
  oltId?: string;
  oltName?: string;
  rejectionReason?: TrapRejectionReason;
}

export class TrapSecurityService {
  /**
   * @param trustedOlts snapshot em memória das OLTs cadastradas (community descriptografada).
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

    const olt = this.trustedOlts.find((o) => o.snmpCommunity === trap.community);
    if (!olt) {
      return { accepted: false, rejectionReason: 'UNKNOWN_COMMUNITY' };
    }

    return { accepted: true, oltId: olt.id, oltName: olt.name };
  }
}
