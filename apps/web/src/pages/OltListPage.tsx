import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Olt } from '../api';

const BOOTSTRAP_LABEL: Record<Olt['bootstrapStatus'], string> = {
  PENDING: 'Pendente',
  WALKING: 'Varrendo',
  ACTIVE: 'Ativa',
  FAILED: 'Falhou',
};

export function OltListPage() {
  const [olts, setOlts] = useState<Olt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listOlts()
      .then(setOlts)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar OLTs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>OLTs</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Equipamentos monitorados via SNMP e provisionados via SSH.
          </p>
        </div>
        <Link to="/olts/nova" style={primaryBtnStyle}>
          + Nova OLT
        </Link>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
        <div style={headRowStyle}>
          <span>Nome</span><span>IP</span><span>Cidade</span><span>Fabricante</span><span>Bootstrap</span><span>ONUs</span><span>Reconciliacao</span><span>Acoes</span>
        </div>

        {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</div>}
        {!loading && olts.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Nenhuma OLT cadastrada ainda.</div>
        )}

        {olts.map((olt) => (
          <div key={olt.id} style={rowStyle}>
            <span>{olt.name}</span>
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{olt.ipAddress}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{olt.city ?? '—'}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{olt.manufacturer ?? '—'}</span>
            <span
              style={{
                color: olt.bootstrapStatus === 'FAILED' ? 'var(--crit)' : 'var(--text-muted)',
                fontSize: 12.5,
              }}
            >
              {BOOTSTRAP_LABEL[olt.bootstrapStatus]}
            </span>
            <span className="mono" style={{ fontSize: 12.5 }}>{olt._count.onus}</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {olt.reconciliationEnabled ? `A cada ${olt.reconciliationIntervalMinutes} min` : 'Desligada'}
            </span>
            <Link to={`/olts/${olt.id}/editar`} style={secondaryBtnStyle}>
              Editar
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}

const headRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 0.9fr 0.9fr 0.9fr 0.5fr 1.1fr 0.7fr',
  gap: 12,
  padding: '10px 16px',
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 0.9fr 0.9fr 0.9fr 0.5fr 1.1fr 0.7fr',
  gap: 12,
  alignItems: 'center',
  padding: '10px 16px',
  fontSize: 13,
  borderBottom: '1px solid var(--border)',
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
  textDecoration: 'none',
};

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
  textDecoration: 'none',
  textAlign: 'center',
  width: 'fit-content',
};
