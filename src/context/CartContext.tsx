import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { CartItem, Equipment } from '../types';

const CART_STORAGE_KEY = 'molkom-rental-cart';
const DATES_STORAGE_KEY = 'molkom-rental-dates';

function loadCart(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // corrupted data — start fresh
  }
  return [];
}

function loadDates(): { dateFrom: string; dateTo: string } {
  try {
    const saved = localStorage.getItem(DATES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.dateFrom && parsed.dateTo) return parsed;
    }
  } catch {
    // start fresh
  }
  return { dateFrom: '', dateTo: '' };
}

interface CartContextType {
  items: CartItem[];
  addItem: (equipment: Equipment, quantity?: number) => void;
  removeItem: (equipmentId: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  dateFrom: string;
  dateTo: string;
  rentalDays: number;
  setDates: (dateFrom: string, dateTo: string) => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [dates, setDatesState] = useState(loadDates);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } else {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [items]);

  // Persist dates to localStorage
  useEffect(() => {
    if (dates.dateFrom && dates.dateTo) {
      localStorage.setItem(DATES_STORAGE_KEY, JSON.stringify(dates));
    } else {
      localStorage.removeItem(DATES_STORAGE_KEY);
    }
  }, [dates]);

  const rentalDays = useMemo(() => {
    if (!dates.dateFrom || !dates.dateTo) return 0;
    const from = new Date(dates.dateFrom);
    const to = new Date(dates.dateTo);
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 1);
  }, [dates.dateFrom, dates.dateTo]);

  const addItem = useCallback((equipment: Equipment, quantity?: number) => {
    setItems(prev => {
      const existing = prev.find(item => item.equipment.id === equipment.id);
      if (existing) {
        return prev.map(item =>
          item.equipment.id === equipment.id ? { ...item, quantity: quantity || 1 } : item
        );
      }
      return [...prev, { equipment, quantity: quantity || 1 }];
    });
  }, []);

  const removeItem = useCallback((equipmentId: number) => {
    setItems(prev => prev.filter(item => item.equipment.id !== equipmentId));
  }, []);

  const setDates = useCallback((dateFrom: string, dateTo: string) => {
    setDatesState({ dateFrom, dateTo });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setDatesState({ dateFrom: '', dateTo: '' });
  }, []);

  const totalItems = items.length;

  const totalPrice = items.reduce((sum, item) => {
    const qty = item.quantity || 1;
    return sum + calculatePrice(item.equipment.priceExclVat, rentalDays) * qty;
  }, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, clearCart, totalItems, totalPrice,
      dateFrom: dates.dateFrom, dateTo: dates.dateTo, rentalDays, setDates,
    }}>
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
  if (dayRate === 0 || days === 0) return 0;
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
