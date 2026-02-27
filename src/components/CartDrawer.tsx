import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart, calculatePrice } from '../context/CartContext';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const { items, removeItem, updateDays, totalPrice } = useCart();

  return (
    <>
      <div className={`cart-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`cart-drawer ${open ? 'open' : ''}`}>
        <div className="cart-header">
          <h2><ShoppingBag size={22} /> Cart ({items.length})</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close cart">
            <X size={22} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-empty">
            <ShoppingBag size={48} strokeWidth={1} />
            <p>Your cart is empty</p>
            <span>Add equipment to get started</span>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(item => {
                const qty = item.quantity || 1;
                const itemPrice = calculatePrice(item.equipment.priceExclVat, item.days) * qty;
                return (
                  <div key={item.equipment.id} className="cart-item">
                    <div className="cart-item-info">
                      <h4>{item.equipment.name}{qty > 1 ? ` x${qty}` : ''}</h4>
                      <span className="cart-item-category">{item.equipment.category}</span>
                      <div className="cart-item-days">
                        <button
                          className="day-btn-sm"
                          onClick={() => updateDays(item.equipment.id, Math.max(1, item.days - 1))}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{item.days} {item.days === 1 ? 'day' : 'days'}</span>
                        <button
                          className="day-btn-sm"
                          onClick={() => updateDays(item.equipment.id, item.days + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="cart-item-right">
                      <span className="cart-item-price">
                        {item.equipment.priceExclVat > 0 ? `${itemPrice} kr` : 'TBD'}
                      </span>
                      <button
                        className="remove-btn"
                        onClick={() => removeItem(item.equipment.id)}
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="cart-footer">
              <div className="cart-total">
                <span>Total</span>
                <strong>{totalPrice} kr</strong>
              </div>
              <button className="checkout-btn" onClick={onCheckout}>
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
