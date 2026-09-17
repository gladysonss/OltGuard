/**
 * Chave compacta "oltId:slotNo:portNo" usada pro filtro de GPON individual
 * na tela de Alarmes (selecionar uma porta PON especifica de uma OLT, em vez
 * de so a OLT inteira) - ver AlarmsPage.tsx e QueryAlarmsDto/QueryEventsDto.
 * oltId e um uuid (sem ":"), entao dividir na primeira ocorrencia de ":" e
 * seguro.
 */
export interface OltPortKey {
  oltId: string;
  slotNo: number;
  portNo: number;
}

const OLT_PORT_KEY_REGEX = /^(.+):(\d+):(\d+)$/;

export function parseOltPortKey(key: string): OltPortKey | null {
  const match = OLT_PORT_KEY_REGEX.exec(key);
  if (!match) return null;
  return { oltId: match[1], slotNo: Number(match[2]), portNo: Number(match[3]) };
}

export function parseOltPortKeys(keys: string[] | undefined): OltPortKey[] {
  if (!keys?.length) return [];
  return keys.map(parseOltPortKey).filter((k): k is OltPortKey => k !== null);
}
