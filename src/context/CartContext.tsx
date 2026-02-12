import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { CartItem, Equipment } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (equipment: Equipment, days: number) => void;
  removeItem: (equipmentId: number) => void;
  updateDays: (equipmentId: number, days: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((equipment: Equipment, days: number) => {
    setItems(prev => {
      const existing = prev.find(item => item.equipment.id === equipment.id);
      if (existing) {
        return prev.map(item =>
          item.equipment.id === equipment.id ? { ...item, days } : item
        );
      }
      return [...prev, { equipment, days }];
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
    return sum + calculatePrice(item.equipment.priceExclVat, item.days);
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
  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    const weekRate = dayRate * 5; // week rate = 5x day rate
    return weeks * weekRate + remainingDays * dayRate;
  }
  return days * dayRate;
}
