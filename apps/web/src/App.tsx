import { Navigate, Route, Routes } from 'react-router-dom';
import { TopMenu } from './components/TopMenu';
import { AlarmsPage } from './pages/AlarmsPage';
import { OltRegisterPage } from './pages/OltRegisterPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { AccountPage } from './pages/AccountPage';
import { TrapTerminalPage } from './pages/TrapTerminalPage';
import { useAuth } from './auth/AuthContext';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopMenu />
      <Routes>
        <Route path="/" element={<AlarmsPage />} />
        <Route
          path="/cadastro"
          element={user.role === 'ADMIN' ? <OltRegisterPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/usuarios"
          element={user.role === 'ADMIN' ? <UsersPage /> : <Navigate to="/" replace />}
        />
        <Route path="/minha-conta" element={<AccountPage />} />
        <Route
          path="/terminal-traps"
          element={user.role === 'ADMIN' ? <TrapTerminalPage /> : <Navigate to="/" replace />}
        />
      </Routes>
    </div>
  );
}
