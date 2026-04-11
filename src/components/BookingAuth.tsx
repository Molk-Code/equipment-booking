import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';

const BOOKING_PW_KEY = 'booking_page_password';
const BOOKING_AUTH_KEY = 'booking_authenticated';

export default function BookingAuth({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(BOOKING_AUTH_KEY) === 'true');

  // Check if a booking password is set
  const requiredPw = localStorage.getItem(BOOKING_PW_KEY);

  // No password set — booking page is open
  if (!requiredPw) {
    return <>{children}</>;
  }

  // Already authenticated this session
  if (authed) {
    return <>{children}</>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === requiredPw) {
      sessionStorage.setItem(BOOKING_AUTH_KEY, 'true');
      setAuthed(true);
      setError('');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  return (
    <div className="auth-overlay">
      <form className="auth-popup" onSubmit={handleSubmit}>
        <div className="auth-icon">
          <Lock size={32} />
        </div>
        <h2 className="auth-title">Molkom Rental House</h2>
        <p className="auth-subtitle">Enter password to access booking</p>
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
