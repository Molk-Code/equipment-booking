import { ShoppingCart, Film, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

interface HeaderProps {
  onCartClick: () => void;
  onLogoClick?: () => void;
}

export default function Header({ onCartClick, onLogoClick }: HeaderProps) {
  const { totalItems } = useCart();

  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <Film size={28} />
          <div>
            <h1>Molkom Rental House</h1>
            <span className="logo-subtitle">Booking System</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to="/inventory"
            className="inv-nav-link"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}
          >
            <ClipboardList size={16} />
            <span>Inventory</span>
          </Link>
          <button className="cart-button" onClick={onCartClick} aria-label="Open cart">
            <ShoppingCart size={22} />
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
