import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clapperboard, LayoutDashboard, PlusCircle, BarChart3, ArrowLeft, KeyRound, ExternalLink } from 'lucide-react';
import { fetchBookingPassword } from '../../utils/booking-password';

const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';

export default function InventoryHeader() {
  const location = useLocation();
  const path = location.pathname;
  const [showPwPanel, setShowPwPanel] = useState(false);
  const [bookingPw, setBookingPw] = useState('');
  const [pwLoading, setPwLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch current password from sheet on mount
  useEffect(() => {
    fetchBookingPassword().then(pw => {
      setBookingPw(pw);
      setPwLoading(false);
    });
  }, []);

  // Refresh when panel opens
  useEffect(() => {
    if (showPwPanel) {
      setPwLoading(true);
      fetchBookingPassword().then(pw => {
        setBookingPw(pw);
        setPwLoading(false);
      });
    }
  }, [showPwPanel]);

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

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

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

          {/* Booking password display */}
          <div className="inv-nav-pw-wrap" ref={panelRef}>
            <button
              className={`inv-nav-link inv-nav-pw-btn ${bookingPw ? 'pw-active' : ''}`}
              onClick={() => setShowPwPanel(v => !v)}
              title={bookingPw ? 'Booking page password is set' : 'No booking page password'}
            >
              <KeyRound size={16} />
              <span>Password</span>
            </button>

            {showPwPanel && (
              <div className="inv-pw-panel">
                <div className="inv-pw-panel-title">Booking Page Password</div>
                {pwLoading ? (
                  <p className="inv-pw-panel-desc">Loading...</p>
                ) : bookingPw ? (
                  <>
                    <p className="inv-pw-panel-desc">
                      Students must enter this password to access the booking page:
                    </p>
                    <div className="inv-pw-panel-current">{bookingPw}</div>
                  </>
                ) : (
                  <p className="inv-pw-panel-desc">
                    No password set. The booking page is open to everyone. Add a password in the Lösenord Booking tab to require it.
                  </p>
                )}
                <p className="inv-pw-panel-hint">
                  Change the password in the <strong>Lösenord Booking</strong> tab in the spreadsheet.
                </p>
                <a
                  href={`${sheetUrl}#gid=680730864`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inv-pw-panel-link"
                >
                  <ExternalLink size={12} />
                  Open Lösenord Booking
                </a>
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
