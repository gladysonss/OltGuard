import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const menuItemStyle = (active: boolean): React.CSSProperties => ({
  padding: '9px 14px',
  fontSize: 13,
  borderRadius: 6,
  textDecoration: 'none',
  color: active ? 'var(--text)' : 'var(--text-muted)',
  background: active ? 'var(--surface-2)' : 'transparent',
});

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  VIEWER: 'Visualizador',
};

export function TopMenu() {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '10px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.8}
          strokeLinecap="round"
          style={{ width: 20, height: 20 }}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.02em' }}>OltGuard</span>
      </div>
      <nav style={{ display: 'flex', gap: 2 }}>
        <NavLink to="/" end style={({ isActive }) => menuItemStyle(isActive)}>
          Alarmes e Eventos
        </NavLink>
        {user?.role === 'ADMIN' && (
          <>
            <NavLink to="/olts" style={({ isActive }) => menuItemStyle(isActive)}>
              OLTs
            </NavLink>
            <NavLink to="/usuarios" style={({ isActive }) => menuItemStyle(isActive)}>
              Usuarios
            </NavLink>
            <NavLink to="/terminal-traps" style={({ isActive }) => menuItemStyle(isActive)}>
              Terminal de Traps
            </NavLink>
          </>
        )}
      </nav>

      {user && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <NavLink
            to="/minha-conta"
            style={({ isActive }) => ({ fontSize: 13, color: isActive ? 'var(--accent)' : 'var(--text)', textDecoration: 'none' })}
          >
            {user.name}
          </NavLink>
          <button
            onClick={logout}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>
      )}
    </header>
  );
}
