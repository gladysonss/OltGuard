import { NavLink } from 'react-router-dom';

const menuItemStyle = (active: boolean): React.CSSProperties => ({
  padding: '9px 14px',
  fontSize: 13,
  borderRadius: 6,
  textDecoration: 'none',
  color: active ? 'var(--text)' : 'var(--text-muted)',
  background: active ? 'var(--surface-2)' : 'transparent',
});

export function TopMenu() {
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
        <NavLink to="/cadastro" style={({ isActive }) => menuItemStyle(isActive)}>
          Cadastro
        </NavLink>
      </nav>
    </header>
  );
}
