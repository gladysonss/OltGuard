export type TrapLogOutcome = 'ACCEPTED' | 'REJECTED' | 'UNMAPPED' | 'IGNORED';

export interface TrapLogEntry {
  timestamp: string;
  sourceIp: string;
  community?: string;
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
