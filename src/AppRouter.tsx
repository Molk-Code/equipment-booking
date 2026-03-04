import { Routes, Route } from 'react-router-dom';
import App from './App';
import InventoryDashboard from './pages/InventoryDashboard';
import ProjectCreate from './pages/ProjectCreate';
import ProjectDetail from './pages/ProjectDetail';
import InventoryStats from './pages/InventoryStats';

export default function AppRouter() {
  return (
    <Routes>
      {/* Inventory routes (specific paths first) */}
      <Route path="/inventory" element={<InventoryDashboard />} />
      <Route path="/inventory/new" element={<ProjectCreate />} />
      <Route path="/inventory/project/:projectId" element={<ProjectDetail />} />
      <Route path="/inventory/stats" element={<InventoryStats />} />

      {/* Existing booking app (catch-all) */}
      <Route path="/*" element={<App />} />
    </Routes>
  );
}
