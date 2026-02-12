import { ShoppingCart, Film } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface HeaderProps {
  onCartClick: () => void;
}

export default function Header({ onCartClick }: HeaderProps) {
  const { totalItems } = useCart();

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <Film size={28} />
          <div>
            <h1>Molkom Film Equipment</h1>
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
