import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, X, UserPlus, ArrowLeft } from 'lucide-react';
import InventoryHeader from '../components/inventory/InventoryHeader';
import { useInventory } from '../context/InventoryContext';

export default function ProjectCreate() {
  const navigate = useNavigate();
  const { createProject, klasslista, klasslistaLoading } = useInventory();

  const [name, setName] = useState('');
  const [borrowers, setBorrowers] = useState<string[]>([]);
  const [manualBorrower, setManualBorrower] = useState('');
  const [equipmentManager, setEquipmentManager] = useState('');
  const [checkoutDate, setCheckoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addBorrowerFromDropdown = (selectedName: string) => {
    if (selectedName && !borrowers.includes(selectedName)) {
      setBorrowers([...borrowers, selectedName]);
    }
  };

  const addManualBorrower = () => {
    const trimmed = manualBorrower.trim();
    if (trimmed && !borrowers.includes(trimmed)) {
      setBorrowers([...borrowers, trimmed]);
      setManualBorrower('');
    }
  };

  const removeBorrower = (name: string) => {
    setBorrowers(borrowers.filter(b => b !== name));
  };

  const hasKlasslista = klasslista && (klasslista.film1.length > 0 || klasslista.film2.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Project name is required'); return; }
    if (borrowers.length === 0) { setError('At least one borrower is required'); return; }
    if (!equipmentManager) { setError('Equipment manager is required'); return; }
    if (!returnDate) { setError('Return date is required'); return; }

    setSaving(true);
    try {
      const project = await createProject({
        name: name.trim(),
        borrowers,
        equipmentManager,
        checkoutDate,
        returnDate,
      });
      navigate(`/inventory/project/${project.id}`);
    } catch {
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

              {/* Selected borrowers as chips */}
              {borrowers.length > 0 && (
                <div className="borrower-chips">
                  {borrowers.map(b => (
                    <span key={b} className="borrower-chip">
                      {b}
                      <button type="button" onClick={() => removeBorrower(b)} className="borrower-chip-x">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Grouped dropdown from klasslista */}
              {klasslistaLoading ? (
                <div className="borrower-loading">Loading student list...</div>
              ) : hasKlasslista ? (
                <select
                  className="form-select borrower-dropdown"
                  value=""
                  onChange={e => {
                    addBorrowerFromDropdown(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">Select borrower...</option>
                  {klasslista!.film1.length > 0 && (
                    <optgroup label="Film 1">
                      {klasslista!.film1.map(n => (
                        <option key={`f1-${n}`} value={n} disabled={borrowers.includes(n)}>
                          {n}{borrowers.includes(n) ? ' (added)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {klasslista!.film2.length > 0 && (
                    <optgroup label="Film 2">
                      {klasslista!.film2.map(n => (
                        <option key={`f2-${n}`} value={n} disabled={borrowers.includes(n)}>
                          {n}{borrowers.includes(n) ? ' (added)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : null}

              {/* Manual fallback input */}
              <div className="borrower-manual-row">
                <input
                  type="text"
                  value={manualBorrower}
                  onChange={e => setManualBorrower(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addManualBorrower();
                    }
                  }}
                  placeholder={hasKlasslista ? 'Or type name manually...' : 'Type borrower name...'}
                />
                <button type="button" className="borrower-add" onClick={addManualBorrower}>
                  <UserPlus size={14} />
                  Add
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Equipment Manager</label>
              <select
                value={equipmentManager}
                onChange={e => setEquipmentManager(e.target.value)}
                className="form-select"
              >
                <option value="">Select manager...</option>
                <option value="Fredrik">Fredrik</option>
                <option value="Karl">Karl</option>
                <option value="Mats">Mats</option>
              </select>
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
