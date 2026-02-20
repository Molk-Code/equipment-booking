import { useState } from 'react';
import { Plus, Minus, ShoppingCart, Check, Lock, X } from 'lucide-react';
import { useCart, calculatePrice, getWeekRate } from '../context/CartContext';
import type { Equipment } from '../types';

interface ProductCardProps {
  equipment: Equipment;
}

const categoryFallbacks: Record<string, string> = {
  CAMERA: '/images/image87.jpg',
  GRIP: '/images/image44.png',
  LIGHTS: '/images/image60.jpg',
  SOUND: '/images/image112.jpg',
  LOCATION: '/images/image123.jpg',
  BOOKS: '/images/image134.jpg',
};

export default function ProductCard({ equipment }: ProductCardProps) {
  const { items, addItem } = useCart();
  const [days, setDays] = useState(1);
  const [added, setAdded] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const inCart = items.some(item => item.equipment.id === equipment.id);
  const price = calculatePrice(equipment.priceExclVat, days);
  const imageUrl = equipment.image || categoryFallbacks[equipment.category] || categoryFallbacks.CAMERA;

  const handleAdd = () => {
    addItem(equipment, days);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
      <div className={`product-card ${added ? 'card-added' : ''}`}>
        <div className="product-image" onClick={() => setShowImage(true)} style={{ cursor: 'pointer' }}>
          <img src={imageUrl} alt={equipment.name} loading="lazy" />
          <span className="product-category-tag">{equipment.category}</span>
          {equipment.filmYear2 && (
            <span className="film-year2-badge">
              <Lock size={10} />
              Film Year 2 Only
            </span>
          )}
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
                <span className="price-week">{getWeekRate(equipment.priceExclVat)} kr/week</span>
              </>
            ) : (
              <span className="price-free">Free</span>
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

      {showImage && (
        <div className="image-modal-overlay" onClick={() => setShowImage(false)}>
          <div className="image-modal">
            <button className="image-modal-close" onClick={() => setShowImage(false)}>
              <X size={24} />
            </button>
            <img src={imageUrl} alt={equipment.name} />
            <p className="image-modal-name">{equipment.name}</p>
          </div>
        </div>
      )}
    </>
  );
}
