import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, QrCode } from 'lucide-react';

export interface QRCodeCardProps {
  patientId: string;
  className?: string;
}

export const QRCodeCard: React.FC<QRCodeCardProps> = ({ patientId, className = '' }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(patientId, { width: 128, margin: 1, color: { dark: '#173B3A', light: '#FFFFFF' } })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrError('QR code could not be generated.');
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  const copyPatientId = async () => {
    try {
      await navigator.clipboard.writeText(patientId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setQrError('Could not copy the Patient ID. Please select and copy it manually.');
    }
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-border-subtle bg-white p-3 ${className}`}>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-osco-bg">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR code for Patient ID ${patientId}`} className="h-12 w-12" />
        ) : (
          <QrCode size={22} className="text-forest" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-text-muted">Your Patient ID</p>
        <p className="truncate font-mono text-xs font-semibold text-forest">{patientId}</p>
        {qrError && <p role="status" className="mt-1 text-[10px] text-warning">{qrError}</p>}
      </div>
      <button
        type="button"
        onClick={copyPatientId}
        aria-label="Copy Patient ID"
        className="ml-auto rounded-md p-2 text-text-secondary hover:bg-osco-bg hover:text-forest"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
};
