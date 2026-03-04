import { ShoppingCart, Film } from 'lucide-react';
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
        <button className="cart-button" onClick={onCartClick} aria-label="Open cart">
          <ShoppingCart size={22} />
          {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </button>
      </div>
    </header>
  );
}
