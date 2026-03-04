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

  // Build a set of returned equipment names
  const returnedNames = new Set(checkinScans.map(s => s.equipmentName));

  const returned = checkoutItems.filter(i => returnedNames.has(i.equipmentName) || i.status === 'returned');
  const damaged = checkoutItems.filter(i => i.status === 'damaged');
  const missing = checkoutItems.filter(i =>
    !returnedNames.has(i.equipmentName) && i.status !== 'returned' && i.status !== 'damaged'
  );

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

          return (
            <div
              key={`${item.equipmentName}-${i}`}
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
                  onClick={() => setDamageModal(item.equipmentName)}
                  title="Report damage"
                >
                  <Wrench size={14} />
                </button>
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
