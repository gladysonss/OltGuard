import { useEffect, useRef, useState } from 'react';
import { api, API_BASE, getAuthToken, type TrapLogEntry, type TrapLogOutcome } from '../api';

const OUTCOME_COLOR: Record<TrapLogOutcome, string> = {
  ACCEPTED: 'var(--ok)',
  REJECTED: 'var(--crit)',
  UNMAPPED: 'var(--warn)',
  IGNORED: 'var(--text-muted)',
};

const OUTCOME_LABEL: Record<TrapLogOutcome, string> = {
  ACCEPTED: 'OK',
  REJECTED: 'REJEITADA',
  UNMAPPED: 'NAO MAPEADA',
  IGNORED: 'IGNORADA',
};

function formatLine(entry: TrapLogEntry): string {
  const time = new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour12: false });
  const parts = [`[${time}]`, entry.sourceIp.padEnd(15)];

  if (entry.trapOid) parts.push(entry.trapOid);
  if (entry.slotNo !== undefined) {
    let loc = `slot ${entry.slotNo}`;
    if (entry.portNo !== undefined) loc += `/porta ${entry.portNo}`;
    if (entry.logicalPortNo !== undefined) loc += `/onu ${entry.logicalPortNo}`;
    parts.push(loc);
  }

  return `${parts.join('  ')}  -  ${entry.message}`;
}

function formatRaw(entry: TrapLogEntry): string {
  const parts: string[] = [];
  if (entry.community !== undefined) parts.push(`community="${entry.community}"`);
  for (const vb of entry.varbinds) {
    parts.push(`${vb.oid} = ${vb.value}`);
  }
  return parts.join('   ');
}

export function TrapTerminalPage() {
  const [entries, setEntries] = useState<TrapLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const url = `${API_BASE}/traps/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      if (pausedRef.current) return;
      const entry: TrapLogEntry = JSON.parse(event.data);
      setEntries((prev) => {
        if (prev.some((e) => e.seq === entry.seq)) return prev;
        return [...prev.slice(-499), entry];
      });
    };

    return () => source.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [entries]);

  async function handleClear() {
    setClearing(true);
    try {
      await api.clearTraps();
    } catch {
      // segue limpando a visualizacao local mesmo se a chamada falhar
    } finally {
      setEntries([]);
      setClearing(false);
    }
  }

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, padding: '18px 22px', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Terminal de Traps</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Fluxo bruto de traps SNMP recebidas - use para validar se estao chegando
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: connected ? 'var(--ok)' : 'var(--crit)',
              }}
            />
            {connected ? 'Conectado' : 'Desconectado'}
          </span>
          <button onClick={() => setPaused((p) => !p)} style={secondaryBtnStyle}>
            {paused ? 'Retomar' : 'Pausar'}
          </button>
          <button onClick={handleClear} disabled={clearing} style={secondaryBtnStyle}>
            Limpar
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: '#0b0d12',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        {entries.length === 0 && (
          <div style={{ color: 'var(--text-muted)' }}>
            Aguardando traps... configure a OLT para enviar para este servidor na porta configurada.
          </div>
        )}
        {entries.map((entry) => {
          const raw = formatRaw(entry);
          return (
            <div key={entry.seq} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                <span
                  style={{
                    color: OUTCOME_COLOR[entry.outcome],
                    fontWeight: 700,
                    flexShrink: 0,
                    width: 96,
                  }}
                >
                  {OUTCOME_LABEL[entry.outcome]}
                </span>
                <span style={{ color: 'var(--text)' }}>{formatLine(entry)}</span>
              </div>
              {raw && (
                <div
                  style={{
                    marginLeft: 104,
                    color: 'var(--text-muted)',
                    fontSize: 11.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {raw}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}

const secondaryBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  cursor: 'pointer',
};
