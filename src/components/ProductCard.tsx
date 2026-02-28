import { useState } from 'react';
import { Plus, Minus, ShoppingCart, Check, Lock, X } from 'lucide-react';
import { useCart, calculatePrice, getWeekRate } from '../context/CartContext';
import type { Equipment } from '../types';

interface ProductCardProps {
  equipment: Equipment;
}

export default function ProductCard({ equipment }: ProductCardProps) {
  const { items, addItem } = useCart();
  const [days, setDays] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const inCart = items.some(item => item.equipment.id === equipment.id);
  const price = calculatePrice(equipment.priceExclVat, days) * quantity;
  const imageUrl = equipment.image || '';
  const maxQty = equipment.available || 1;

  const handleAdd = () => {
    addItem(equipment, days, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
      <div className={`product-card ${added ? 'card-added' : ''}`}>
        <div className="product-image" onClick={() => imageUrl && setShowImage(true)} style={{ cursor: imageUrl ? 'pointer' : 'default' }}>
          {imageUrl ? (
            <img src={imageUrl} alt={equipment.name} loading="lazy" />
          ) : (
            <div className="image-placeholder">{equipment.name}</div>
          )}
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
          {equipment.notes && (
            <p className="product-notes">{equipment.notes}</p>
          )}
          {maxQty > 1 && (
            <p className="product-available">{maxQty} available</p>
          )}
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
            {maxQty > 1 && (
              <div className="qty-selector">
                <button
                  className="day-btn"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="day-count">{quantity} {quantity === 1 ? 'unit' : 'units'}</span>
                <button
                  className="day-btn"
                  onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
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
