import { Link, useLocation } from 'react-router-dom';
import { Clapperboard, LayoutDashboard, PlusCircle, BarChart3, ArrowLeft } from 'lucide-react';

export default function InventoryHeader() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/inventory" className="logo" style={{ textDecoration: 'none' }}>
          <Clapperboard size={28} />
          <div>
            <h1>Molkom Rental House</h1>
            <span className="logo-subtitle">Inventory System</span>
          </div>
        </Link>
        <nav className="inv-nav">
          <Link
            to="/inventory"
            className={`inv-nav-link ${path === '/inventory' ? 'active' : ''}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/inventory/new"
            className={`inv-nav-link ${path === '/inventory/new' ? 'active' : ''}`}
          >
            <PlusCircle size={16} />
            <span>New Project</span>
          </Link>
          <Link
            to="/inventory/stats"
            className={`inv-nav-link ${path === '/inventory/stats' ? 'active' : ''}`}
          >
            <BarChart3 size={16} />
            <span>Statistics</span>
          </Link>
          <Link to="/" className="inv-nav-link inv-nav-back">
            <ArrowLeft size={16} />
            <span>Booking</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
