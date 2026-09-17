import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type AllowedNetwork, type City } from '../api';

export function SettingsPage() {
  const [networks, setNetworks] = useState<AllowedNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCidr, setNewCidr] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [newCity, setNewCity] = useState('');
  const [citiesBusy, setCitiesBusy] = useState(false);

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

  const reloadCities = useCallback(async () => {
    setCitiesError(null);
    try {
      setCities(await api.listCities());
    } catch (err) {
      setCitiesError(err instanceof Error ? err.message : 'Falha ao carregar cidades');
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    reloadCities();
  }, [reload, reloadCities]);

  async function handleAddCity(e: FormEvent) {
    e.preventDefault();
    const name = newCity.trim();
    if (!name) return;

    setCitiesBusy(true);
    setCitiesError(null);
    try {
      await api.addCity({ name });
      setNewCity('');
      await reloadCities();
    } catch (err) {
      setCitiesError(err instanceof Error ? err.message : 'Falha ao adicionar cidade');
    } finally {
      setCitiesBusy(false);
    }
  }

  async function handleRemoveCity(id: string) {
    setCitiesBusy(true);
    setCitiesError(null);
    try {
      await api.removeCity(id);
      await reloadCities();
    } catch (err) {
      setCitiesError(err instanceof Error ? err.message : 'Falha ao remover cidade');
    } finally {
      setCitiesBusy(false);
    }
  }

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
      </div>

      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Cidades</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Cidades onde a operadora atua - usadas no cadastro de OLT (dropdown) e para agrupar a
          arvore de OLTs na tela de Alarmes.
        </p>
      </div>

      {citiesError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
          {citiesError}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {citiesLoading && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</span>}

        {!citiesLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cities.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, flex: 1 }}>{c.name}</span>
                <button disabled={citiesBusy} onClick={() => handleRemoveCity(c.id)} style={dangerBtnStyle}>
                  Remover
                </button>
              </div>
            ))}
            {cities.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma cidade cadastrada ainda.</span>
            )}
          </div>
        )}

        <form onSubmit={handleAddCity} style={{ display: 'flex', gap: 8 }}>
          <input
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="Ex: Sao Paulo"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={citiesBusy} style={primaryBtnStyle}>
            Adicionar
          </button>
        </form>
      </div>

      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Filtro de rede (traps)</h2>
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
