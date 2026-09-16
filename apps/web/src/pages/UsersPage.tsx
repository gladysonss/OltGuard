import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { userApi, type ManagedUser, type UserRole } from '../api';
import { useAuth } from '../auth/AuthContext';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'VIEWER' as UserRole });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setUsers(await userApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await userApi.create(form);
      setForm({ name: '', email: '', password: '', role: 'VIEWER' });
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao criar usuario');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(id: string, role: UserRole) {
    setBusyId(id);
    setError(null);
    try {
      await userApi.update(id, { role });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar papel');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await userApi.remove(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover usuario');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Usuarios</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Administradores cadastram OLTs; visualizadores so acompanham alarmes e eventos.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={headRowStyle}>
            <span>Nome</span><span>E-mail</span><span>Papel</span><span>Acoes</span>
          </div>

          {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Carregando...</div>}
          {!loading && users.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Nenhum usuario cadastrado.</div>
          )}

          {users.map((u) => {
            const isSelf = u.id === currentUser?.userId;
            const disabled = busyId === u.id;
            return (
              <div key={u.id} style={rowStyle}>
                <span>{u.name}{isSelf && <span style={{ color: 'var(--text-muted)' }}> (voce)</span>}</span>
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{u.email}</span>
                <select
                  value={u.role}
                  disabled={disabled || isSelf}
                  onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                  style={selectStyle}
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="VIEWER">Visualizador</option>
                </select>
                <button
                  disabled={disabled || isSelf}
                  onClick={() => handleRemove(u.id)}
                  style={{ ...dangerBtnStyle, opacity: isSelf ? 0.4 : 1 }}
                  title={isSelf ? 'Voce nao pode remover a propria conta' : 'Remover usuario'}
                >
                  Remover
                </button>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleCreate} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Novo usuario</span>

          {formError && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 12.5 }}>
              {formError}
            </div>
          )}

          <Field label="Nome">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required style={inputStyle} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required style={inputStyle} />
          </Field>
          <Field label="Senha">
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} style={inputStyle} />
          </Field>
          <Field label="Papel">
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))} style={selectStyle}>
              <option value="VIEWER">Visualizador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </Field>

          <button type="submit" disabled={submitting} style={submitBtnStyle}>
            {submitting ? 'Criando...' : 'Criar usuario'}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

const headRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1.4fr 1fr 0.8fr',
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
  gridTemplateColumns: '1.2fr 1.4fr 1fr 0.8fr',
  gap: 12,
  alignItems: 'center',
  padding: '10px 16px',
  fontSize: 13,
  borderBottom: '1px solid var(--border)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 11px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '7px 8px',
};

const submitBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  color: '#171a21',
  fontWeight: 600,
  fontSize: 13,
  padding: '10px 14px',
  borderRadius: 8,
  cursor: 'pointer',
};

const dangerBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--crit)',
  background: 'var(--crit-soft)',
  color: 'var(--crit)',
  cursor: 'pointer',
};
