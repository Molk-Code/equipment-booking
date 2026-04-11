import { Routes, Route } from 'react-router-dom';
import App from './App';
import InventoryDashboard from './pages/InventoryDashboard';
import ProjectCreate from './pages/ProjectCreate';
import ProjectDetail from './pages/ProjectDetail';
import InventoryStats from './pages/InventoryStats';
import InventoryAuth from './components/inventory/InventoryAuth';
import BookingAuth from './components/BookingAuth';

export default function AppRouter() {
  return (
    <Routes>
      {/* Inventory routes (specific paths first) — password protected */}
      <Route path="/inventory" element={<InventoryAuth><InventoryDashboard /></InventoryAuth>} />
      <Route path="/inventory/new" element={<InventoryAuth><ProjectCreate /></InventoryAuth>} />
      <Route path="/inventory/project/:projectId" element={<InventoryAuth><ProjectDetail /></InventoryAuth>} />
      <Route path="/inventory/stats" element={<InventoryAuth><InventoryStats /></InventoryAuth>} />

      {/* Existing booking app (catch-all) — optionally password protected */}
      <Route path="/*" element={<BookingAuth><App /></BookingAuth>} />
    </Routes>
  );
}
