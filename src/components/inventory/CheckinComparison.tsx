import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Wrench } from 'lucide-react';
import type { ProjectItem, QRScanEntry } from '../../types';
import DamageReportModal from './DamageReportModal';

interface Props {
  checkoutItems: ProjectItem[];
  checkinScans: QRScanEntry[];
  onMarkDamaged: (equipmentName: string, notes: string) => void;
}

export default function CheckinComparison({ checkoutItems, checkinScans, onMarkDamaged }: Props) {
  const [damageModal, setDamageModal] = useState<string | null>(null);
  const [inlineDamage, setInlineDamage] = useState<Record<string, string>>({});
  const [showDamageInput, setShowDamageInput] = useState<Record<string, boolean>>({});

  // Build a set of returned equipment names
  const returnedNames = new Set(checkinScans.map(s => s.equipmentName));

  const returned = checkoutItems.filter(i => returnedNames.has(i.equipmentName) || i.status === 'returned');
  const damaged = checkoutItems.filter(i => i.status === 'damaged');
  const missing = checkoutItems.filter(i =>
    !returnedNames.has(i.equipmentName) && i.status !== 'returned' && i.status !== 'damaged'
  );

  const handleInlineDamageSave = (equipmentName: string) => {
    const notes = inlineDamage[equipmentName]?.trim();
    if (notes) {
      onMarkDamaged(equipmentName, notes);
      setShowDamageInput(prev => ({ ...prev, [equipmentName]: false }));
      setInlineDamage(prev => ({ ...prev, [equipmentName]: '' }));
    }
  };

  return (
    <div className="checkin-comparison">
      <div className="checkin-summary-bar">
        <span className="checkin-stat returned">
          <CheckCircle size={14} /> {returned.length} returned
        </span>
        <span className="checkin-stat damaged">
          <AlertTriangle size={14} /> {damaged.length} damaged
        </span>
        <span className="checkin-stat missing">
          <XCircle size={14} /> {missing.length} missing
        </span>
      </div>

      <div className="checkin-items-list">
        {checkoutItems.map((item, i) => {
          const isReturned = returnedNames.has(item.equipmentName) || item.status === 'returned';
          const isDamaged = item.status === 'damaged';
          const isMissing = !isReturned && !isDamaged;
          const showInput = showDamageInput[item.equipmentName];

          return (
            <div key={`${item.equipmentName}-${i}`}>
              <div
                className={`checkin-item ${isReturned ? 'item-returned' : ''} ${isDamaged ? 'item-damaged' : ''} ${isMissing ? 'item-missing' : ''}`}
              >
                <div className="checkin-item-icon">
                  {isDamaged ? <AlertTriangle size={18} /> :
                   isReturned ? <CheckCircle size={18} /> :
                   <XCircle size={18} />}
                </div>
                <div className="checkin-item-info">
                  <span className="checkin-item-name">{item.equipmentName}</span>
                  {isDamaged && item.damageNotes && (
                    <span className="checkin-item-damage">{item.damageNotes}</span>
                  )}
                  {isMissing && <span className="checkin-item-status">MISSING</span>}
                </div>
                {!isDamaged && isReturned && (
                  <button
                    className="checkin-damage-btn"
                    onClick={() => {
                      setShowDamageInput(prev => ({
                        ...prev,
                        [item.equipmentName]: !prev[item.equipmentName]
                      }));
                    }}
                    title="Report damage"
                  >
                    <Wrench size={14} />
                  </button>
                )}
              </div>
              {/* Inline damage description input for returned items */}
              {showInput && isReturned && !isDamaged && (
                <div className="checkin-inline-damage">
                  <input
                    type="text"
                    className="checkin-damage-input"
                    placeholder="Describe the damage..."
                    value={inlineDamage[item.equipmentName] || ''}
                    onChange={e => setInlineDamage(prev => ({ ...prev, [item.equipmentName]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleInlineDamageSave(item.equipmentName);
                    }}
                    autoFocus
                  />
                  <button
                    className="checkin-damage-save-btn"
                    onClick={() => handleInlineDamageSave(item.equipmentName)}
                    disabled={!inlineDamage[item.equipmentName]?.trim()}
                  >
                    <AlertTriangle size={14} />
                    Mark Damaged
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {damageModal && (
        <DamageReportModal
          equipmentName={damageModal}
          onSave={(notes) => {
            onMarkDamaged(damageModal, notes);
            setDamageModal(null);
          }}
          onClose={() => setDamageModal(null)}
        />
      )}
    </div>
  );
}
