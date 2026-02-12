import { useState } from 'react';
import { Plus, Minus, ShoppingCart, Check } from 'lucide-react';
import { useCart, calculatePrice } from '../context/CartContext';
import type { Equipment } from '../types';

interface ProductCardProps {
  equipment: Equipment;
}

const categoryImages: Record<string, string> = {
  CAMERA: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=300&fit=crop',
  GRIP: 'https://images.unsplash.com/photo-1585939000680-9ecb0a804ccc?w=400&h=300&fit=crop',
  LIGHTS: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&h=300&fit=crop',
  SOUND: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&h=300&fit=crop',
  LOCATION: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=300&fit=crop',
  BOOKS: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop',
};

export default function ProductCard({ equipment }: ProductCardProps) {
  const { items, addItem } = useCart();
  const [days, setDays] = useState(1);
  const [added, setAdded] = useState(false);

  const inCart = items.some(item => item.equipment.id === equipment.id);
  const price = calculatePrice(equipment.priceExclVat, days);
  const imageUrl = equipment.image || categoryImages[equipment.category] || categoryImages.CAMERA;

  const handleAdd = () => {
    addItem(equipment, days);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className={`product-card ${added ? 'card-added' : ''}`}>
      <div className="product-image">
        <img src={imageUrl} alt={equipment.name} loading="lazy" />
        <span className="product-category-tag">{equipment.category}</span>
      </div>
      <div className="product-info">
        <h3 className="product-name">{equipment.name}</h3>
        {equipment.description && (
          <p className="product-description">{equipment.description}</p>
        )}
        <div className="product-pricing">
          {equipment.priceExclVat > 0 ? (
            <>
              <span className="price-day">{equipment.priceExclVat} kr/day</span>
              <span className="price-week">{equipment.priceExclVat * 5} kr/week</span>
            </>
          ) : (
            <span className="price-tbd">Price TBD</span>
          )}
        </div>
        <div className="product-actions">
          <div className="day-selector">
            <button
              className="day-btn"
              onClick={() => setDays(d => Math.max(1, d - 1))}
              aria-label="Decrease days"
            >
              <Minus size={14} />
            </button>
            <span className="day-count">{days} {days === 1 ? 'day' : 'days'}</span>
            <button
              className="day-btn"
              onClick={() => setDays(d => d + 1)}
              aria-label="Increase days"
            >
              <Plus size={14} />
            </button>
          </div>
          {equipment.priceExclVat > 0 && (
            <span className="subtotal">{price} kr</span>
          )}
          <button
            className={`add-to-cart-btn ${inCart ? 'in-cart' : ''}`}
            onClick={handleAdd}
          >
            {inCart ? <Check size={16} /> : <ShoppingCart size={16} />}
            {inCart ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
