import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { CartItem, Equipment } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (equipment: Equipment, days: number, quantity?: number) => void;
  removeItem: (equipmentId: number) => void;
  updateDays: (equipmentId: number, days: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((equipment: Equipment, days: number, quantity?: number) => {
    setItems(prev => {
      const existing = prev.find(item => item.equipment.id === equipment.id);
      if (existing) {
        return prev.map(item =>
          item.equipment.id === equipment.id ? { ...item, days, quantity: quantity || 1 } : item
        );
      }
      return [...prev, { equipment, days, quantity: quantity || 1 }];
    });
  }, []);

  const removeItem = useCallback((equipmentId: number) => {
    setItems(prev => prev.filter(item => item.equipment.id !== equipmentId));
  }, []);

  const updateDays = useCallback((equipmentId: number, days: number) => {
    setItems(prev =>
      prev.map(item =>
        item.equipment.id === equipmentId ? { ...item, days } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.length;

  const totalPrice = items.reduce((sum, item) => {
    const qty = item.quantity || 1;
    return sum + calculatePrice(item.equipment.priceExclVat, item.days) * qty;
  }, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateDays, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}

export function calculatePrice(dayRate: number, days: number): number {
  if (dayRate === 0) return 0;
  // Weekly rate = 5 days worth at 15% discount: dayRate * 5 * 0.85
  // Applied per 5-day block. Remaining days at full day rate.
  const weekRate = Math.round(dayRate * 5 * 0.85);
  if (days >= 5) {
    const weeks = Math.floor(days / 5);
    const remainingDays = days % 5;
    return weeks * weekRate + remainingDays * dayRate;
  }
  return days * dayRate;
}

export function getWeekRate(dayRate: number): number {
  if (dayRate === 0) return 0;
  return Math.round(dayRate * 5 * 0.85);
}
