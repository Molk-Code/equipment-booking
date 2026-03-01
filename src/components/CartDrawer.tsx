import { X, Trash2, ShoppingBag, Calendar } from 'lucide-react';
import { useCart, calculatePrice } from '../context/CartContext';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  const { items, removeItem, totalPrice, dateFrom, dateTo, rentalDays, setDates } = useCart();

  const datesChosen = dateFrom && dateTo && rentalDays > 0;

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
              {/* Rental period date picker */}
              <div className="cart-rental-period">
                <h4><Calendar size={16} /> Rental Period</h4>
                <div className="cart-date-row">
                  <div className="cart-date-field">
                    <label htmlFor="cart-date-from">From</label>
                    <input
                      id="cart-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={e => setDates(e.target.value, dateTo)}
                    />
                  </div>
                  <div className="cart-date-field">
                    <label htmlFor="cart-date-to">To</label>
                    <input
                      id="cart-date-to"
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      onChange={e => setDates(dateFrom, e.target.value)}
                    />
                  </div>
                </div>
                {datesChosen && (
                  <p className="cart-rental-days">{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</p>
                )}
              </div>

              {/* Cart items */}
              {items.map(item => {
                const qty = item.quantity || 1;
                const itemPrice = calculatePrice(item.equipment.priceExclVat, rentalDays) * qty;
                return (
                  <div key={item.equipment.id} className="cart-item">
                    <div className="cart-item-info">
                      <h4>{item.equipment.name}{qty > 1 ? ` x${qty}` : ''}</h4>
                      <span className="cart-item-category">{item.equipment.category}</span>
                    </div>
                    <div className="cart-item-right">
                      <span className="cart-item-price">
                        {item.equipment.priceExclVat > 0
                          ? datesChosen ? `${itemPrice} kr` : `${item.equipment.priceExclVat} kr/day`
                          : 'Free'}
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
                <strong>{datesChosen ? `${totalPrice} kr` : '—'}</strong>
              </div>
              {!datesChosen && (
                <p className="cart-dates-hint">Select rental dates to proceed</p>
              )}
              <button
                className="checkout-btn"
                onClick={onCheckout}
                disabled={!datesChosen}
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
