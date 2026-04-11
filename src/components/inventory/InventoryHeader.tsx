import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clapperboard, LayoutDashboard, PlusCircle, BarChart3, ArrowLeft, KeyRound, Check, X } from 'lucide-react';

const BOOKING_PW_KEY = 'booking_page_password';

export default function InventoryHeader() {
  const location = useLocation();
  const path = location.pathname;
  const [showPwPanel, setShowPwPanel] = useState(false);
  const [bookingPw, setBookingPw] = useState(() => localStorage.getItem(BOOKING_PW_KEY) || '');
  const [pwInput, setPwInput] = useState('');
  const [pwSaved, setPwSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Init input with current password when panel opens
  useEffect(() => {
    if (showPwPanel) {
      setPwInput(bookingPw);
      setPwSaved(false);
    }
  }, [showPwPanel, bookingPw]);

  // Close panel on outside click
  useEffect(() => {
    if (!showPwPanel) return;
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPwPanel(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showPwPanel]);

  const savePw = () => {
    const trimmed = pwInput.trim();
    if (trimmed) {
      localStorage.setItem(BOOKING_PW_KEY, trimmed);
    } else {
      localStorage.removeItem(BOOKING_PW_KEY);
    }
    setBookingPw(trimmed);
    setPwSaved(true);
    setTimeout(() => setShowPwPanel(false), 800);
  };

  const removePw = () => {
    localStorage.removeItem(BOOKING_PW_KEY);
    setBookingPw('');
    setPwInput('');
    setPwSaved(false);
    // Also clear any existing booking auth so visitors need to re-authenticate
    sessionStorage.removeItem('booking_authenticated');
    setTimeout(() => setShowPwPanel(false), 400);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/inventory" className="logo" style={{ textDecoration: 'none' }}>
          <Clapperboard size={28} />
          <div>
            <h1>Molkom Rental House</h1>
            <span className="logo-subtitle">Inventory System</span>
          </div>
        </Link>
        <nav className="inv-nav">
          <Link
            to="/inventory"
            className={`inv-nav-link ${path === '/inventory' ? 'active' : ''}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/inventory/new"
            className={`inv-nav-link ${path === '/inventory/new' ? 'active' : ''}`}
          >
            <PlusCircle size={16} />
            <span>New Project</span>
          </Link>
          <Link
            to="/inventory/stats"
            className={`inv-nav-link ${path === '/inventory/stats' ? 'active' : ''}`}
          >
            <BarChart3 size={16} />
            <span>Statistics</span>
          </Link>

          {/* Booking password toggle */}
          <div className="inv-nav-pw-wrap" ref={panelRef}>
            <button
              className={`inv-nav-link inv-nav-pw-btn ${bookingPw ? 'pw-active' : ''}`}
              onClick={() => setShowPwPanel(v => !v)}
              title={bookingPw ? 'Booking page password is set' : 'Set booking page password'}
            >
              <KeyRound size={16} />
              <span>Password</span>
            </button>

            {showPwPanel && (
              <div className="inv-pw-panel">
                <div className="inv-pw-panel-title">Booking Page Password</div>
                <p className="inv-pw-panel-desc">
                  {bookingPw
                    ? 'Visitors must enter this password to access the booking page.'
                    : 'No password set. The booking page is open to everyone.'}
                </p>
                <div className="inv-pw-panel-row">
                  <input
                    type="text"
                    className="inv-pw-panel-input"
                    value={pwInput}
                    onChange={e => setPwInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') savePw(); }}
                    placeholder="Enter password..."
                    autoFocus
                  />
                  <button
                    className="inv-pw-panel-save"
                    onClick={savePw}
                    disabled={!pwInput.trim()}
                    title="Save password"
                  >
                    {pwSaved ? <Check size={14} /> : 'Set'}
                  </button>
                </div>
                {bookingPw && (
                  <button className="inv-pw-panel-remove" onClick={removePw}>
                    <X size={12} />
                    Remove password (make booking open)
                  </button>
                )}
              </div>
            )}
          </div>

          <Link to="/" className="inv-nav-link inv-nav-back">
            <ArrowLeft size={16} />
            <span>Booking</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
