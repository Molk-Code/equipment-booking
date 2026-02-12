import { useState, useMemo } from 'react';
import Header from './components/Header';
import CategoryFilter from './components/CategoryFilter';
import SearchBar from './components/SearchBar';
import ProductCard from './components/ProductCard';
import CartDrawer from './components/CartDrawer';
import Checkout from './components/Checkout';
import equipmentData from './data/equipment.json';
import type { Equipment, Category } from './types';

const equipment = equipmentData as Equipment[];

export default function App() {
  const [category, setCategory] = useState<Category>('ALL');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    equipment.forEach(e => {
      c[e.category] = (c[e.category] || 0) + 1;
    });
    return c;
  }, []);

  const filtered = useMemo(() => {
    let items = equipment;
    if (category !== 'ALL') {
      items = items.filter(e => e.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [category, search]);

  if (showCheckout) {
    return (
      <div className="app">
        <Header onCartClick={() => setCartOpen(true)} />
        <main className="main">
          <Checkout onBack={() => setShowCheckout(false)} />
        </main>
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Header onCartClick={() => setCartOpen(true)} />
      <main className="main">
        <div className="toolbar">
          <CategoryFilter active={category} onSelect={setCategory} counts={counts} />
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <div className="results-info">
          <span>{filtered.length} items</span>
          {category !== 'ALL' && <span className="active-filter">{category}</span>}
          {search && <span className="active-filter">"{search}"</span>}
        </div>
        <div className="product-grid">
          {filtered.map(e => (
            <ProductCard key={e.id} equipment={e} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="no-results">
            <p>No equipment found matching your search.</p>
          </div>
        )}
      </main>
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          setShowCheckout(true);
        }}
      />
    </div>
  );
}
