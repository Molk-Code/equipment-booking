import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  equipmentName: string;
  onSave: (notes: string) => void;
  onClose: () => void;
}

export default function DamageReportModal({ equipmentName, onSave, onClose }: Props) {
  const [notes, setNotes] = useState('');

  return (
    <div className="damage-modal-overlay" onClick={onClose}>
      <div className="damage-modal" onClick={e => e.stopPropagation()}>
        <div className="damage-modal-header">
          <AlertTriangle size={20} />
          <h3>Report Damage</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="damage-modal-body">
          <p className="damage-equipment-name">{equipmentName}</p>
          <label className="damage-label">
            Describe the damage:
          </label>
          <textarea
            className="damage-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe what is damaged..."
            rows={4}
            autoFocus
          />
        </div>
        <div className="damage-modal-footer">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button
            className="primary-btn danger-btn"
            onClick={() => onSave(notes)}
            disabled={!notes.trim()}
          >
            <AlertTriangle size={16} />
            Mark as Damaged
          </button>
        </div>
      </div>
    </div>
  );
}
