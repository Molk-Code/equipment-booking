import { useState } from 'react';
import { ArrowLeft, Send, FileText, Loader2 } from 'lucide-react';
import { useCart, calculatePrice } from '../context/CartContext';
import { generatePDF } from '../utils/pdf';
import { sendEmail, downloadPdf, getPdfFilename } from '../utils/email';
import type { CheckoutInfo } from '../types';

interface CheckoutProps {
  onBack: () => void;
}

export default function Checkout({ onBack }: CheckoutProps) {
  const { items, totalPrice, clearCart } = useCart();
  const [info, setInfo] = useState<CheckoutInfo>({
    name: '',
    email: '',
    className: '',
    dateFrom: '',
    dateTo: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);

    try {
      const pdfBlob = generatePDF(items, info, totalPrice);
      await sendEmail(pdfBlob, items, info, totalPrice);
      setSent(true);
      clearCart();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to send booking: ${msg}`);
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = () => {
    const pdfBlob = generatePDF(items, info, totalPrice);
    downloadPdf(pdfBlob, getPdfFilename(info));
  };

  if (sent) {
    return (
      <div className="checkout-success">
        <div className="success-icon">
          <Send size={48} />
        </div>
        <h2>Booking Inquiry Sent!</h2>
        <p>Your equipment booking inquiry has been emailed to the equipment manager. You will receive a confirmation at {info.email}.</p>
        <button className="primary-btn" onClick={onBack}>Back to Equipment</button>
      </div>
    );
  }

  return (
    <div className="checkout">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Equipment
      </button>

      <h2>Checkout</h2>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <h3>Borrower Information</h3>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              required
              value={info.name}
              onChange={e => setInfo(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Your full name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={info.email}
              onChange={e => setInfo(prev => ({ ...prev, email: e.target.value }))}
              placeholder="your.email@example.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="className">Class</label>
            <select
              id="className"
              required
              value={info.className}
              onChange={e => setInfo(prev => ({ ...prev, className: e.target.value }))}
              className="form-select"
            >
              <option value="" disabled>Select your class</option>
              <option value="Film Year 1">Film Year 1</option>
              <option value="Film Year 2">Film Year 2</option>
            </select>
          </div>

          <h3>Rental Period</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dateFrom">From</label>
              <input
                id="dateFrom"
                type="date"
                required
                value={info.dateFrom}
                onChange={e => setInfo(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="dateTo">To</label>
              <input
                id="dateTo"
                type="date"
                required
                value={info.dateTo}
                min={info.dateFrom}
                onChange={e => setInfo(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="checkout-buttons">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleDownloadPDF}
              disabled={!info.name || !info.email || !info.className || !info.dateFrom || !info.dateTo}
            >
              <FileText size={18} /> Download PDF
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={sending}
            >
              {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              {sending ? 'Sending...' : 'Send Booking'}
            </button>
          </div>
        </form>

        <div className="checkout-summary">
          <h3>Order Summary</h3>
          <div className="summary-items">
            {items.map(item => (
              <div key={item.equipment.id} className="summary-item">
                <div>
                  <span className="summary-name">{item.equipment.name}</span>
                  <span className="summary-days">{item.days} {item.days === 1 ? 'day' : 'days'}</span>
                </div>
                <span className="summary-price">
                  {item.equipment.priceExclVat > 0
                    ? `${calculatePrice(item.equipment.priceExclVat, item.days)} kr`
                    : 'Free'}
                </span>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <span>Total (excl. VAT)</span>
            <strong>{totalPrice} kr</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
