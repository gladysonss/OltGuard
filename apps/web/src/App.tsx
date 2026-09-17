import { Navigate, Route, Routes } from 'react-router-dom';
import { TopMenu } from './components/TopMenu';
import { AlarmsPage } from './pages/AlarmsPage';
import { OltListPage } from './pages/OltListPage';
import { OltFormPage } from './pages/OltFormPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { AccountPage } from './pages/AccountPage';
import { TrapTerminalPage } from './pages/TrapTerminalPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuth } from './auth/AuthContext';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <LoginPage />;
  }

  const adminOnly = (element: React.ReactElement) =>
    user.role === 'ADMIN' ? element : <Navigate to="/" replace />;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopMenu />
      <Routes>
        <Route path="/" element={<AlarmsPage />} />
        <Route path="/olts" element={adminOnly(<OltListPage />)} />
        <Route path="/olts/nova" element={adminOnly(<OltFormPage />)} />
        <Route path="/olts/:id/editar" element={adminOnly(<OltFormPage />)} />
        <Route path="/usuarios" element={adminOnly(<UsersPage />)} />
        <Route path="/minha-conta" element={<AccountPage />} />
        <Route path="/terminal-traps" element={adminOnly(<TrapTerminalPage />)} />
        <Route path="/configuracoes" element={adminOnly(<SettingsPage />)} />
      </Routes>
    </div>
  );
}
