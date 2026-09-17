import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Olt, type OltTrustedIp } from '../api';

export function SettingsPage() {
  const [olts, setOlts] = useState<Olt[]>([]);
  const [trustedIps, setTrustedIps] = useState<Record<string, OltTrustedIp[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newIpByOlt, setNewIpByOlt] = useState<Record<string, string>>({});
  const [newLabelByOlt, setNewLabelByOlt] = useState<Record<string, string>>({});
  const [busyOltId, setBusyOltId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const oltsRes = await api.listOlts();
      setOlts(oltsRes);
      const entries = await Promise.all(
        oltsRes.map(async (olt) => [olt.id, await api.listTrustedIps(olt.id)] as const),
      );
      setTrustedIps(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar configuracoes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleAdd(e: FormEvent, oltId: string) {
    e.preventDefault();
    const ipAddress = (newIpByOlt[oltId] ?? '').trim();
    if (!ipAddress) return;

    setBusyOltId(oltId);
    setError(null);
    try {
      await api.addTrustedIp(oltId, { ipAddress, label: newLabelByOlt[oltId]?.trim() || undefined });
      setNewIpByOlt((s) => ({ ...s, [oltId]: '' }));
      setNewLabelByOlt((s) => ({ ...s, [oltId]: '' }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar IP');
    } finally {
      setBusyOltId(null);
    }
  }

  async function handleRemove(oltId: string, trustedIpId: string) {
    setBusyOltId(oltId);
    setError(null);
    try {
      await api.removeTrustedIp(oltId, trustedIpId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover IP');
    } finally {
      setBusyOltId(null);
    }
  }

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Configuracoes</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          IPs de origem autorizados a enviar traps para cada OLT.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</span>}

      {!loading && olts.length === 0 && (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhuma OLT cadastrada ainda.</span>
      )}

      {olts.map((olt) => (
        <div key={olt.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{olt.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              IP de gerenciamento: <span className="mono" style={{ color: 'var(--text)' }}>{olt.ipAddress}</span>
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Traps sao aceitas do IP de gerenciamento acima e de qualquer IP extra listado abaixo -
            util quando a OLT esta atras de um roteador com IP publico dinamico.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(trustedIps[olt.id] ?? []).map((ip) => (
              <div key={ip.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <span className="mono" style={{ fontSize: 13, flex: 1 }}>{ip.ipAddress}</span>
                {ip.label && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ip.label}</span>}
                <button
                  disabled={busyOltId === olt.id}
                  onClick={() => handleRemove(olt.id, ip.id)}
                  style={dangerBtnStyle}
                >
                  Remover
                </button>
              </div>
            ))}
            {(trustedIps[olt.id] ?? []).length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum IP extra autorizado.</span>
            )}
          </div>

          <form onSubmit={(e) => handleAdd(e, olt.id)} style={{ display: 'flex', gap: 8 }}>
            <input
              value={newIpByOlt[olt.id] ?? ''}
              onChange={(e) => setNewIpByOlt((s) => ({ ...s, [olt.id]: e.target.value }))}
              placeholder="200.150.10.20"
              className="mono"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              value={newLabelByOlt[olt.id] ?? ''}
              onChange={(e) => setNewLabelByOlt((s) => ({ ...s, [olt.id]: e.target.value }))}
              placeholder="Rotulo (opcional, ex: roteador backup)"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="submit" disabled={busyOltId === olt.id} style={primaryBtnStyle}>
              Adicionar
            </button>
          </form>
        </div>
      ))}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
};

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  color: '#171a21',
  fontWeight: 600,
  fontSize: 13,
  padding: '9px 14px',
  borderRadius: 8,
  cursor: 'pointer',
};

const dangerBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  fontWeight: 600,
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid var(--crit)',
  background: 'var(--crit-soft)',
  color: 'var(--crit)',
  cursor: 'pointer',
};
