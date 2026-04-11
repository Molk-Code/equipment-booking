import { useState, useEffect, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { fetchBookingPassword } from '../utils/booking-password';

const BOOKING_AUTH_KEY = 'booking_authenticated_pw';

export default function BookingAuth({ children }: { children: ReactNode }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(false);
  const [requiredPw, setRequiredPw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch booking password from Google Sheet on mount
  useEffect(() => {
    fetchBookingPassword().then(pw => {
      setRequiredPw(pw);

      // Check if previously authenticated with the SAME password
      const storedPw = sessionStorage.getItem(BOOKING_AUTH_KEY);
      if (pw && storedPw === pw) {
        setAuthed(true);
      } else if (pw && storedPw && storedPw !== pw) {
        // Password changed — invalidate old session
        sessionStorage.removeItem(BOOKING_AUTH_KEY);
        setAuthed(false);
      } else if (!pw) {
        // No password required — clear any stored auth
        sessionStorage.removeItem(BOOKING_AUTH_KEY);
        setAuthed(true);
      }

      setLoading(false);
    });
  }, []);

  // Still loading — show nothing to avoid flash
  if (loading) {
    return null;
  }

  // No password set — booking page is open
  if (!requiredPw) {
    return <>{children}</>;
  }

  // Already authenticated with current password
  if (authed) {
    return <>{children}</>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === requiredPw) {
      sessionStorage.setItem(BOOKING_AUTH_KEY, requiredPw);
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
