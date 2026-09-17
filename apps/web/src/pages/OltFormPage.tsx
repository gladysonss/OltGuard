import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const emptyForm = {
  name: '',
  ipAddress: '',
  city: '',
  manufacturer: '',
  snmpCommunity: '',
  snmpPort: '161',
  sshUsername: '',
  sshPassword: '',
  sshPort: '22',
};

export function OltFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getOlt(id)
      .then((olt) => {
        setForm({
          name: olt.name,
          ipAddress: olt.ipAddress,
          city: olt.city ?? '',
          manufacturer: olt.manufacturer ?? '',
          snmpCommunity: '',
          snmpPort: String(olt.snmpPort),
          sshUsername: olt.sshUsername ?? '',
          sshPassword: '',
          sshPort: String(olt.sshPort),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar OLT'))
      .finally(() => setLoading(false));
  }, [id]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && id) {
        await api.updateOlt(id, {
          name: form.name,
          ipAddress: form.ipAddress,
          city: form.city || undefined,
          manufacturer: form.manufacturer || undefined,
          snmpCommunity: form.snmpCommunity || undefined,
          snmpPort: Number(form.snmpPort),
          sshUsername: form.sshUsername || undefined,
          sshPassword: form.sshPassword || undefined,
          sshPort: Number(form.sshPort),
        });
      } else {
        await api.createOlt({
          name: form.name,
          ipAddress: form.ipAddress,
          city: form.city || undefined,
          manufacturer: form.manufacturer || undefined,
          snmpCommunity: form.snmpCommunity,
          snmpPort: Number(form.snmpPort),
          sshUsername: form.sshUsername || undefined,
          sshPassword: form.sshPassword || undefined,
          sshPort: Number(form.sshPort),
        });
      }
      navigate('/olts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar OLT');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ flex: 1, padding: '28px 32px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</span>
      </main>
    );
  }

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{isEdit ? 'Editar OLT' : 'Cadastrar nova OLT'}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            SNMP e obrigatorio (monitoramento). SSH e opcional por enquanto - so sera usado quando
            o provisionamento remoto for implementado.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <Section title="Identificacao">
            <Field label="Nome">
              <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex: OLT-Centro-01" required style={inputStyle} />
            </Field>
            <Field label="Endereco IP">
              <input value={form.ipAddress} onChange={(e) => update('ipAddress', e.target.value)} placeholder="192.168.0.10" required className="mono" style={inputStyle} />
            </Field>
            <div style={row2Style}>
              <Field label="Cidade">
                <input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Ex: Sao Paulo" style={inputStyle} />
              </Field>
              <Field label="Fabricante">
                <input value={form.manufacturer} onChange={(e) => update('manufacturer', e.target.value)} placeholder="Ex: Parks" style={inputStyle} />
              </Field>
            </div>
          </Section>

          <Section title="SNMP">
            <div style={row2Style}>
              <Field label={isEdit ? 'Community (deixe em branco para manter)' : 'Community'}>
                <input
                  value={form.snmpCommunity}
                  onChange={(e) => update('snmpCommunity', e.target.value)}
                  placeholder={isEdit ? '••••••••' : undefined}
                  required={!isEdit}
                  className="mono"
                  style={inputStyle}
                />
              </Field>
              <Field label="Porta SNMP">
                <input value={form.snmpPort} onChange={(e) => update('snmpPort', e.target.value)} type="number" required className="mono" style={inputStyle} />
              </Field>
            </div>
          </Section>

          <Section title="SSH (opcional)">
            <div style={row2Style}>
              <Field label="Usuario">
                <input value={form.sshUsername} onChange={(e) => update('sshUsername', e.target.value)} placeholder="admin" style={inputStyle} />
              </Field>
              <Field label="Porta SSH">
                <input value={form.sshPort} onChange={(e) => update('sshPort', e.target.value)} type="number" required className="mono" style={inputStyle} />
              </Field>
            </div>
            <Field label={isEdit ? 'Senha (deixe em branco para manter)' : 'Senha'}>
              <input
                value={form.sshPassword}
                onChange={(e) => update('sshPassword', e.target.value)}
                type="password"
                placeholder={isEdit ? '••••••••' : undefined}
                style={inputStyle}
              />
            </Field>
          </Section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <button type="submit" disabled={submitting} style={submitBtnStyle}>
              {submitting ? 'Salvando...' : isEdit ? 'Salvar alteracoes' : 'Cadastrar OLT'}
            </button>
            {isEdit && (
              <button type="button" onClick={() => navigate('/olts')} style={cancelBtnStyle}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', margin: 0 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
};

const row2Style: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };

const submitBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  color: '#171a21',
  fontWeight: 600,
  fontSize: 14,
  padding: '12px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  width: '100%',
};

const cancelBtnStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontWeight: 600,
  fontSize: 14,
  padding: '10px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  width: '100%',
};
