import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { InventoryProvider } from './context/InventoryContext';
import AppRouter from './AppRouter';
import './index.css';
import './inventory.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        <InventoryProvider>
          <AppRouter />
        </InventoryProvider>
      </CartProvider>
    </BrowserRouter>
  </StrictMode>
);
