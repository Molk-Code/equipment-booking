import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, X, UserPlus, ArrowLeft } from 'lucide-react';
import InventoryHeader from '../components/inventory/InventoryHeader';
import { useInventory } from '../context/InventoryContext';

export default function ProjectCreate() {
  const navigate = useNavigate();
  const { createProject } = useInventory();

  const [name, setName] = useState('');
  const [borrowers, setBorrowers] = useState<string[]>(['']);
  const [checkoutDate, setCheckoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addBorrower = () => setBorrowers([...borrowers, '']);
  const removeBorrower = (i: number) => setBorrowers(borrowers.filter((_, idx) => idx !== i));
  const updateBorrower = (i: number, value: string) => {
    const updated = [...borrowers];
    updated[i] = value;
    setBorrowers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validBorrowers = borrowers.filter(b => b.trim());
    if (!name.trim()) { setError('Project name is required'); return; }
    if (validBorrowers.length === 0) { setError('At least one borrower is required'); return; }
    if (!returnDate) { setError('Return date is required'); return; }

    setSaving(true);
    try {
      const project = await createProject({
        name: name.trim(),
        borrowers: validBorrowers,
        checkoutDate,
        returnDate,
      });
      navigate(`/inventory/project/${project.id}`);
    } catch (err) {
      setError('Failed to create project. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <InventoryHeader />
      <main className="main">
        <div className="inv-form-page">
          <button className="back-btn" onClick={() => navigate('/inventory')}>
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          <h2 className="inv-page-title">
            <PlusCircle size={24} />
            Create New Project
          </h2>

          <form className="inv-form" onSubmit={handleSubmit}>
            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Documentary Short Film"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Borrowers</label>
              <div className="borrowers-list">
                {borrowers.map((b, i) => (
                  <div key={i} className="borrower-row">
                    <input
                      type="text"
                      value={b}
                      onChange={e => updateBorrower(i, e.target.value)}
                      placeholder={`Borrower ${i + 1}`}
                    />
                    {borrowers.length > 1 && (
                      <button type="button" className="borrower-remove" onClick={() => removeBorrower(i)}>
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="borrower-add" onClick={addBorrower}>
                  <UserPlus size={14} />
                  Add Borrower
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Checkout Date</label>
                <input
                  type="date"
                  value={checkoutDate}
                  onChange={e => setCheckoutDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Return Date</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  min={checkoutDate}
                />
              </div>
            </div>

            <div className="checkout-buttons">
              <button type="submit" className="primary-btn" disabled={saving}>
                <PlusCircle size={16} />
                {saving ? 'Creating...' : 'Create Project'}
              </button>
              <button type="button" className="secondary-btn" onClick={() => navigate('/inventory')}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
