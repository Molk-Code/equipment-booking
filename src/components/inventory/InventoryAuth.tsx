import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';

const CORRECT_PASSWORD = 'K4ff3r4st';
const AUTH_KEY = 'inventory_authenticated';

export default function InventoryAuth({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(AUTH_KEY) === 'true');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      setAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="auth-overlay">
      <form className="auth-popup" onSubmit={handleSubmit}>
        <div className="auth-icon">
          <Lock size={32} />
        </div>
        <h2 className="auth-title">Molkom Rental House</h2>
        <p className="auth-subtitle">Enter password to access inventory</p>
        {error && <div className="auth-error">{error}</div>}
        <input
          type="password"
          className="auth-input"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        <button type="submit" className="auth-btn">
          Enter
        </button>
      </form>
    </div>
  );
}
