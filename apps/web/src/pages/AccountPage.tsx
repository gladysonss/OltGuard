import { useState, type FormEvent } from 'react';
import { authApi } from '../api';
import { useAuth } from '../auth/AuthContext';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrador', VIEWER: 'Visualizador' };

export function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('A confirmacao nao bate com a nova senha');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao trocar senha');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Minha conta</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {user?.name} &middot; {user?.email} &middot; {user ? (ROLE_LABEL[user.role] ?? user.role) : ''}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', margin: 0 }}>
            Trocar senha
          </p>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', color: 'var(--crit)', fontSize: 13 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--ok-soft)', color: 'var(--ok)', fontSize: 13 }}>
              Senha atualizada com sucesso.
            </div>
          )}

          <Field label="Senha atual">
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Nova senha">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} style={inputStyle} />
          </Field>
          <Field label="Confirmar nova senha">
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} style={inputStyle} />
          </Field>

          <button type="submit" disabled={submitting} style={submitBtnStyle}>
            {submitting ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </main>
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

const submitBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  color: '#171a21',
  fontWeight: 600,
  fontSize: 14,
  padding: '12px 16px',
  borderRadius: 8,
  cursor: 'pointer',
};
