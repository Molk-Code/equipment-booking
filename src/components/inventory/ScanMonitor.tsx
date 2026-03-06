import { useEffect, useRef } from 'react';
import { Radio, Package } from 'lucide-react';
import type { QRScanEntry } from '../../types';

interface Props {
  isScanning: boolean;
  recentScans: QRScanEntry[];
  mode: 'checkout' | 'checkin';
}

export default function ScanMonitor({ isScanning, recentScans, mode }: Props) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play beep on new scan
  useEffect(() => {
    if (recentScans.length === 0) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = mode === 'checkout' ? 880 : 660;
      osc.type = 'sine';
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // audio not available
    }
  }, [recentScans.length, mode]);

  return (
    <div className={`scan-monitor ${isScanning ? 'active' : ''}`}>
      <div className="scan-monitor-header">
        <div className="scan-monitor-status">
          {isScanning && <span className="scan-pulse" />}
          <Radio size={18} />
          <span>
            {isScanning
              ? `Scanning (${mode === 'checkout' ? 'Check-Out' : 'Check-In'})...`
              : 'Scanning Stopped'}
          </span>
        </div>
      </div>

      {isScanning && recentScans.length === 0 && (
        <div className="scan-waiting">
          Waiting for QR scans from mobile device...
        </div>
      )}

      {recentScans.length > 0 && (
        <div className="scan-list">
          {recentScans.map((scan, i) => (
            <div key={`${scan.timestamp}-${i}`} className="scan-entry">
              <Package size={16} />
              <span className="scan-entry-name">{scan.equipmentName}</span>
              <span className="scan-entry-time">{scan.timestamp}</span>
            </div>
          ))}
        </div>
      )}

      <div className="scan-count">
        {recentScans.length} {recentScans.length === 1 ? 'item' : 'items'} scanned
      </div>

    </div>
  );
}
