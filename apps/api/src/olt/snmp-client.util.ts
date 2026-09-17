/**
 * Helpers finos sobre net-snmp para os walks de bootstrap da OLT (GPONs,
 * ONUs de cada GPON etc). Sessao SNMPv2c so - as OLTs Parks hoje em campo
 * usam v2c, sem autenticacao SNMPv3.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snmp = require('net-snmp');

const SNMP_TIMEOUT_MS = 5000;
const SNMP_RETRIES = 1;

export interface SnmpTarget {
  ipAddress: string;
  snmpPort: number;
  community: string;
}

export interface SnmpVarbind {
  oid: string;
  value: string;
}

export function createSnmpSession(target: SnmpTarget) {
  return snmp.createSession(target.ipAddress, target.community, {
    port: target.snmpPort,
    version: snmp.Version2c,
    timeout: SNMP_TIMEOUT_MS,
    retries: SNMP_RETRIES,
  });
}

/**
 * Anda a subarvore inteira de um OID (GETBULK em loop, via session.subtree
 * do net-snmp) e devolve todos os varbinds validos - varbinds de erro (ex:
 * noSuchInstance no fim da tabela) sao descartados, nunca rejeitam a promise.
 */
export function walkSubtree(session: ReturnType<typeof createSnmpSession>, baseOid: string): Promise<SnmpVarbind[]> {
  return new Promise((resolve, reject) => {
    const results: SnmpVarbind[] = [];
    session.subtree(
      baseOid,
      20,
      (varbinds: { oid: string; type: number; value: unknown }[]) => {
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) continue;
          results.push({
            oid: vb.oid,
            value: Buffer.isBuffer(vb.value) ? vb.value.toString('utf8') : String(vb.value),
          });
        }
      },
      (error: Error | null) => {
        if (error) reject(error);
        else resolve(results);
      },
    );
  });
}
