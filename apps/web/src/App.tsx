import { Route, Routes } from 'react-router-dom';
import { TopMenu } from './components/TopMenu';
import { AlarmsPage } from './pages/AlarmsPage';
import { OltRegisterPage } from './pages/OltRegisterPage';

export function App() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopMenu />
      <Routes>
        <Route path="/" element={<AlarmsPage />} />
        <Route path="/cadastro" element={<OltRegisterPage />} />
      </Routes>
    </div>
  );
}
