import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type AllowedNetwork } from '../api';

export function SettingsPage() {
  const [networks, setNetworks] = useState<AllowedNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCidr, setNewCidr] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setNetworks(await api.listAllowedNetworks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar configuracoes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const cidr = newCidr.trim();
    if (!cidr) return;

    setBusy(true);
    setError(null);
    try {
      await api.addAllowedNetwork({ cidr, label: newLabel.trim() || undefined });
      setNewCidr('');
      setNewLabel('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar IP/rede');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.removeAllowedNetwork(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover IP/rede');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Configuracoes</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          IPs ou faixas de rede (CIDR) autorizados a enviar traps para a aplicacao. Se a lista
          estiver vazia, nenhuma restricao de rede e aplicada - so a OLT + community continuam
          validando a origem.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</span>}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {networks.map((n) => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <span className="mono" style={{ fontSize: 13, flex: 1 }}>{n.cidr}</span>
                {n.label && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.label}</span>}
                <button disabled={busy} onClick={() => handleRemove(n.id)} style={dangerBtnStyle}>
                  Remover
                </button>
              </div>
            ))}
            {networks.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Nenhum filtro de rede cadastrado - a aplicacao aceita traps de qualquer origem
                (desde que corresponda a uma OLT + community cadastrada).
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
          <input
            value={newCidr}
            onChange={(e) => setNewCidr(e.target.value)}
            placeholder="200.150.10.0/24 ou 200.150.10.20"
            className="mono"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Rotulo (opcional, ex: rede do provedor)"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={busy} style={primaryBtnStyle}>
            Adicionar
          </button>
        </form>
      </div>
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
