import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Printer, Check, Tag, Save } from 'lucide-react';
import { useUserRole } from '../../context/UserContext';
import { useParts } from '../../context/PartsContext';
import { getInitials } from '../../lib/utils';
import QRCode from 'qrcode';

interface PrintLabelModalProps {
  partNumber: string;
  partName: string;
  customer: string;
  targetTotal: number;
  labelQty: number;
  onSuccess: (qty: number) => void;
  onClose: () => void;

  // Shared Bluetooth States & Actions
  btDevice: any;
  btCharacteristic: any;
  connectionStatus: string;

  isPrintLocked?: boolean;
  lockMessage?: string;
}

export function PrintLabelModal({ 
  partNumber, 
  partName, 
  customer, 
  targetTotal, 
  labelQty, 
  onSuccess, 
  onClose,

  btDevice,
  btCharacteristic,
  connectionStatus,
  isPrintLocked = false,
  lockMessage = ''
}: PrintLabelModalProps) {
  const { role, canEditMaster } = useUserRole();
  const { parts } = useParts();

  const getLabelInitials = () => {
    if (role === 'member') {
      const saved = localStorage.getItem('sugity_member_machine_login') || localStorage.getItem('sugity_operator_machine_login');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.memberName) {
            return getInitials(parsed.memberName);
          }
        } catch (e) {}
      }
      return 'MB';
    }
    if (role === 'leader') return 'LD';
    if (role === 'planner') return 'PL';
    return '';
  };

  const getFormattedDateTime = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // dd/mm/yyyy
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // hh:mm
    
    const initials = getLabelInitials();
    const suffix = initials ? ` (${initials})` : '';
    
    return `${dateStr}-${timeStr}${suffix}`;
  };
  const [kelipatan, setKelipatan] = useState<number>(labelQty);
  const [isPrinting, setIsPrinting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Label sequence: persists across modal open/close via sessionStorage
  // Stabilize the key using useMemo so it doesn't change at midnight mid-session
  const sessionSeqKey = useMemo(
    () => `print_seq_${partNumber}_${new Date().toISOString().slice(0, 10)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partNumber]
  );
  const [printedCount, setPrintedCount] = useState<number>(() => {
    try { return parseInt(sessionStorage.getItem(`print_seq_${partNumber}_${new Date().toISOString().slice(0, 10)}`) || '0'); } catch (_) { return 0; }
  });

  // Label ID — resolved async from Supabase counter (cross-device safe), fallback to localStorage
  const [labelId, setLabelId] = useState<string>('');

  // Timeout ref for success animation — cleared on unmount to avoid setState on unmounted component
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(successTimeoutRef.current), []);

  // QR code preview — generated locally (no external API) so it works on factory intranet
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');


  const fetchCounter = async () => {
    let cancelled = false;
    const dateKey = new Date().toISOString().slice(0, 10);
    const localCounterKey = `sugity_label_seq_${dateKey}`;

    try {
      const response = await fetch(`/api/label-counters/${dateKey}`);
      if (response.ok) {
        const data = await response.json();
        const nextSeq = data.seq ? (data.seq + 1) : 1;

        if (!cancelled) {
          const now = new Date();
          const dd = String(now.getDate()).padStart(2, '0');
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const yy = String(now.getFullYear()).slice(2);
          setLabelId(`SGT${dd}${mm}${yy}-${String(nextSeq).padStart(4, '0')}`);
          localStorage.setItem(localCounterKey, String(nextSeq - 1));
        }
        return;
      }
    } catch (e) {
      // fall through to localStorage
    }

    if (!cancelled) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(2);
      const seq = parseInt(localStorage.getItem(localCounterKey) || '0') + 1;
      setLabelId(`SGT${dd}${mm}${yy}-${String(seq).padStart(4, '0')}`);
    }
  };

  // Fetch label counter on mount
  useEffect(() => {
    fetchCounter();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isBluetoothSupported = typeof window !== 'undefined' && 'bluetooth' in navigator;

  const totalLabels = isNaN(targetTotal) || isNaN(kelipatan) ? 0 : Math.ceil(targetTotal / (kelipatan || 1));

  // Production date-time formatter for label — includes seconds + operator ID
  const getProdDateTime = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // dd/mm/yyyy
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); // hh:mm:ss
    const initials = getLabelInitials();
    const suffix = initials ? ` (${initials})` : '';
    return `${dateStr} - ${timeStr}${suffix}`;
  };

  // Retrieve Sebango, model, and Customer Unique codes from master parts mapping
  const partDetails = useMemo(() => {
    if (Array.isArray(parts)) {
      const matched = parts.find((p: any) =>
        (p.partNumber && p.partNumber.trim().toUpperCase() === partNumber.trim().toUpperCase()) ||
        (p.sebango && p.sebango.trim().toUpperCase() === partNumber.trim().toUpperCase()) ||
        (p.part_number && p.part_number.trim().toUpperCase() === partNumber.trim().toUpperCase())
      );
      if (matched) {
        return {
          sebango: matched.sebango || 'U0-****',
          customerSebango: matched.customerSebango || matched.customer_sebango || '',
          model: matched.model || '--'
        };
      }
    }
    return {
      sebango: 'U0-****',
      customerSebango: '',
      model: '--'
    };
  }, [parts, partNumber]);

  // Generate QR preview locally (no external API — works on factory intranet/offline)
  useEffect(() => {
    const qrContent = partDetails?.sebango || partNumber || 'SGT';
    QRCode.toDataURL(qrContent, { width: 160, margin: 1 })
      .then(url => setQrPreviewUrl(url))
      .catch(() => setQrPreviewUrl(''));
  }, [partDetails?.sebango, partNumber]);

  const customerUniqueItems = useMemo(() => {
    const raw = (partDetails.customerSebango || '').trim();
    if (!raw || raw === 'GT-****') return ['-'];
    return raw.split(/[\/,;\+]+/).map(item => item.trim()).filter(Boolean);
  }, [partDetails.customerSebango]);

  // Clean Web Bluetooth BLE connection function


  // Compile binary ESC/POS payload optimized for 80mm thermal label printers
  const generateEscPosData = () => {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    const addBytes = (bytes: number[]) => {
      parts.push(new Uint8Array(bytes));
    };

    const addText = (text: string) => {
      parts.push(encoder.encode(text));
    };

    // Helper: pad/trim to exact char width
    const col = (s: string, w: number) => s.substring(0, w).padEnd(w);

    const SEP = '-'.repeat(42) + '\n';

    // ─── Initialize printer ───
    addBytes([0x1B, 0x40]); // ESC @ (init)
    addBytes([0x1B, 0x20, 0x00]); // Character spacing = 0

    // ═══════════════════════════════════════
    // ROW 1: Customer Unique  (large, center)
    // ═══════════════════════════════════════
    addBytes([0x1B, 0x61, 0x01]); // Center
    addBytes([0x1B, 0x45, 0x00]); // Bold OFF
    addBytes([0x1D, 0x21, 0x00]); // Normal size
    addText('Customer Unique\n');

    addBytes([0x1B, 0x45, 0x01]); // Bold ON
    addBytes([0x1D, 0x21, 0x11]); // Double width + height
    const uniqueDisplay = customerUniqueItems.join(' / ');
    addText(`${uniqueDisplay}\n`);
    addBytes([0x1D, 0x21, 0x00]); // Reset size
    addBytes([0x1B, 0x45, 0x00]); // Bold OFF

    // ═══════════════════════════════════════
    // ROW 2: Part No | Part Name | Model
    // ═══════════════════════════════════════
    addBytes([0x1B, 0x61, 0x00]); // Left
    addText(SEP);

    // Each field on its own labeled row – avoids column truncation/overlap
    addBytes([0x1B, 0x45, 0x01]); // Bold label
    addText('PART NO. :');
    addBytes([0x1B, 0x45, 0x00]);
    addText(` ${partNumber}\n`);

    addBytes([0x1B, 0x45, 0x01]);
    addText('PART NAME:');
    addBytes([0x1B, 0x45, 0x00]);
    addText(` ${partName.toUpperCase()}\n`);

    addBytes([0x1B, 0x45, 0x01]);
    addText('MODEL    :');
    addBytes([0x1B, 0x45, 0x00]);
    addText(` ${(partDetails.model || '').toUpperCase()}\n`);

    // ═══════════════════════════════════════
    // ROW 3: Sebango | Prod. Date | Pcs/KBN
    // ═══════════════════════════════════════
    addText(SEP);

    // Header labels (bold)
    addBytes([0x1B, 0x45, 0x01]);
    addText(`${col('SEBANGO', 14)}${col('PROD. DATE', 16)}PCS/KBN\n`);
    addBytes([0x1B, 0x45, 0x00]);

    // Values
    const prodDateTime = getProdDateTime();
    // prodDateTime format: "dd/mm/yyyy hh:mm:ss (ID)"
    const dtParts = prodDateTime.split(' ');
    const dateVal = dtParts[0] || '';
    const timeVal = dtParts.slice(1).join(' ');
    const sebVal = col(partDetails.sebango || '', 14);

    const seqDisp = `${String(printedCount + 1).padStart(2, '0')}/${String(totalLabels).padStart(2, '0')}`;
    addText(`${sebVal}${col(dateVal, 16)}${kelipatan}\n`);
    if (timeVal) {
      addText(`${' '.repeat(14)}${timeVal}\n`);
    }
    // Sequence number (right-aligned)
    addBytes([0x1B, 0x61, 0x02]); // Right align
    addBytes([0x1B, 0x45, 0x01]); // Bold ON
    addText(`Label: ${seqDisp}\n`);
    addBytes([0x1B, 0x45, 0x00]); // Bold OFF
    addBytes([0x1B, 0x61, 0x00]); // Left align

    // ═══════════════════════════════════════
    // ROW 4: QR Code  (native ESC/POS GS(k)
    // ═══════════════════════════════════════
    addText(SEP);
    addBytes([0x1B, 0x61, 0x01]); // Center

    const qrContent = partDetails.sebango || partNumber || 'SGT';
    const qrBytes   = encoder.encode(qrContent);
    const dataLen   = qrBytes.length + 3;
    const pL        = dataLen & 0xFF;
    const pH        = (dataLen >> 8) & 0xFF;

    // GS ( k – set QR module size (12 dots per module, +50% from previous 8)
    addBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x0C]);
    // GS ( k – set error correction: M (49)
    addBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]);
    // GS ( k – store QR data
    addBytes([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]);
    parts.push(qrBytes);
    // GS ( k – print QR
    addBytes([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);

    // Feed & Cut
    addText('\n\n\n');
    addBytes([0x1D, 0x56, 0x41, 0x03]); // Full cut

    // Combine all parts
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach(p => { result.set(p, offset); offset += p.length; });
    return result;
  };

  // Chunk transmission method to prevent BLE buffer overflow on generic print hardware
  const sendBluetoothData = async (data: Uint8Array) => {
    if (!btCharacteristic) return;
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await btCharacteristic.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 15));
    }
  };

  // Fallback web-print window – receipt thermal printer (RPP02N 80mm roll)
  const handleBrowserPrint = async () => {
    const seqDisp = `${String(printedCount + 1).padStart(2, '0')}/${String(totalLabels).padStart(2, '0')}`;
    const qrContent = partDetails.sebango || partNumber || 'SGT';
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: 240,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch (_) { qrDataUrl = ''; }

    const printWindow = window.open('', '_blank', 'width=680,height=740');
    if (!printWindow) {
      alert('Please allow popups to trigger printing.');
      return;
    }

    const prodDateTime = getProdDateTime();
    const uniqueDisplay = customerUniqueItems.join(' / ');
    const uniqueFontSize = customerUniqueItems.length > 1 ? 13 : 24;
    const sebango = partDetails.sebango;
    const model = partDetails.model;
    const logoSrc = `${window.location.origin}/sugity-logo.png`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Label</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 80mm;
      max-width: 80mm;
      font-family: Arial, Helvetica, sans-serif;
      background: white;
      color: black;
    }
    .lbl {
      width: 78mm;
      margin: 1mm;
      border: 1.5pt solid black;
    }
    .row {
      display: flex;
      width: 100%;
      border-bottom: 1pt solid black;
    }
    .row:last-child { border-bottom: none; }
    .sep { border-right: 1pt solid black; }
    .pad { padding: 2pt 3pt; }

    /* Row 1 */
    .logo-area {
      width: 27%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3pt;
    }
    .logo-text {
      font-size: 5.5pt;
      font-weight: 700;
      letter-spacing: 1pt;
      text-align: center;
      margin-top: 2pt;
      text-transform: uppercase;
    }
    .unique-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3pt 4pt;
      text-align: center;
    }
    .unique-lbl { font-size: 5.5pt; color: #444; display: block; }
    .unique-val {
      font-size: ${uniqueFontSize}pt;
      font-weight: 900;
      line-height: 1.05;
      display: block;
      word-break: break-all;
    }

    /* Row 2 & 3 */
    .fl { font-size: 5pt; font-weight: 700; text-transform: uppercase; color: #333; display: block; }
    .fv { font-size: 7pt; font-weight: 700; display: block; margin-top: 1pt; }
    .fv-sm { font-size: 6.5pt; display: block; margin-top: 1pt; }
    .fv-date { font-size: 6pt; font-style: italic; display: block; margin-top: 1pt; line-height: 1.4; }

    /* Row 3 qty */
    .qty-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2pt 3pt;
      text-align: center;
    }
    .qty-val { font-size: 16pt; font-weight: 900; line-height: 1; margin-top: 2pt; }
    .seq-badge { font-size: 7pt; font-weight: 900; color: #222; display: block; margin-top: 3pt; letter-spacing: 0.5pt; }

    /* Row 4 QR */
    .qr-area {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 4pt;
    }
  </style>
</head>
<body>
<div class="lbl">

  <!-- Row 1: Logo+SEBANGO | Customer Unique -->
  <div class="row">
    <div class="logo-area sep">
      <img src="${logoSrc}" width="42" height="31" style="object-fit:contain;" />
      <span class="logo-text">SEBANGO</span>
    </div>
    <div class="unique-area">
      <span class="unique-lbl">Customer Unique</span>
      <span class="unique-val">${uniqueDisplay}</span>
    </div>
  </div>

  <!-- Row 2: Part No | Part Name | Model -->
  <div class="row">
    <div class="pad sep" style="width:33%">
      <span class="fl">Part No.</span>
      <span class="fv">${partNumber}</span>
    </div>
    <div class="pad sep" style="width:34%">
      <span class="fl">Part Name</span>
      <span class="fv" style="text-transform:uppercase">${partName.toUpperCase()}</span>
    </div>
    <div class="pad" style="width:33%">
      <span class="fl">Model</span>
      <span class="fv">${model}</span>
    </div>
  </div>

  <!-- Row 3: Sebango | Prod. Date | Pcs/Kanban -->
  <div class="row">
    <div class="pad sep" style="width:33%">
      <span class="fl">Sebango</span>
      <span class="fv-sm">${sebango}</span>
    </div>
    <div class="pad sep" style="width:34%">
      <span class="fl">Prod. Date</span>
      <span class="fv-date">${prodDateTime}</span>
    </div>
    <div class="qty-area" style="width:33%">
      <span class="fl">Pcs / Kanban</span>
      <span class="qty-val">${kelipatan}</span>
      <span class="seq-badge">${seqDisp}</span>
    </div>
  </div>

  <!-- Row 4: QR Code -->
  <div class="qr-area">
    ${qrDataUrl
      ? `<img src="${qrDataUrl}" width="180" height="180" />`
      : `<p style="font-size:8pt;text-align:center;padding:6pt;font-weight:bold;">${sebango}</p>`
    }
  </div>

</div>
<script>
  window.onload = function() {
    setTimeout(function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    }, 300);
  };
</script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (connectionStatus === 'connected' && btCharacteristic) {
        // Send ESC/POS payload via Bluetooth
        const data = generateEscPosData();
        await sendBluetoothData(data);
      } else {
        // Fallback to browser system print
        await handleBrowserPrint();
      }

      // --- Increment label counter (cross-device via REST API, localStorage fallback) ---
      const dateKey = new Date().toISOString().slice(0, 10);
      const localCounterKey = `sugity_label_seq_${dateKey}`;

      try {
        const response = await fetch(`/api/label-counters/${dateKey}`);
        let newSeq = 1;
        if (response.ok) {
          const data = await response.json();
          newSeq = (data.seq || 0) + 1;
        }
        await fetch('/api/label-counters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date_key: dateKey, seq: newSeq })
        });

        // Keep localStorage in sync as offline cache
        localStorage.setItem(localCounterKey, String(newSeq));
      } catch (e) {
        // REST API failed — increment localStorage counter as fallback
        const current = parseInt(localStorage.getItem(localCounterKey) || '0');
        localStorage.setItem(localCounterKey, String(current + 1));
      }

      // Persist sequence counter across modal open/close
      const newPrintedCount = printedCount + 1;
      try { sessionStorage.setItem(sessionSeqKey, String(newPrintedCount)); } catch (_) {}
      setPrintedCount(newPrintedCount);

      setSuccess(true);
      onSuccess(kelipatan);
      // Refresh labelId for next print (H-08 fix: stale labelId after first print)
      fetchCounter();
      successTimeoutRef.current = setTimeout(() => {
        setSuccess(false);
        setIsPrinting(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Printing failed. Please check printer connection or use fallback print.');
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-none overflow-y-auto md:overflow-visible">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            Print Production Label
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row min-h-[380px]">
          {/* Controls Panel */}
          <div className="p-6 border-r border-slate-100 w-full md:w-80 shrink-0 bg-slate-50 flex flex-col justify-between">
            <div className="space-y-5 flex-1">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Total Production (Target)</label>
                <div className="text-xl font-black text-slate-800">{targetTotal} <span className="text-xs text-slate-400 font-medium pb-1">pcs</span></div>
              </div>
              
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Label Qty Box Standard</label>
                <div className="text-2xl font-black text-slate-800 bg-white px-3 py-2.5 rounded text-center border border-slate-200 shadow-sm font-mono font-bold">
                  {isNaN(kelipatan) ? 0 : kelipatan} <span className="text-xs text-slate-500 font-bold">Qty / Box</span>
                </div>
              </div>

              <div className="bg-blue-50 text-blue-800 p-3 rounded border border-blue-100 hidden md:block">
                <div className="text-[10px] uppercase font-bold text-blue-600/70 mb-1">Total Labels to Print</div>
                <div className="text-2xl font-black">{isNaN(totalLabels) ? 0 : totalLabels} <span className="text-xs font-bold text-blue-600/70">Labels</span></div>
              </div>

              {isPrintLocked && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-[10px] font-bold leading-snug flex items-start gap-1.5 shadow-sm mt-3">
                  <span className="text-amber-500 text-xs mt-0.5">⚠️</span>
                  <div>
                    {lockMessage}
                    {role !== 'member' && (
                      <div className="mt-1.5 text-blue-700 font-extrabold uppercase text-[8px] tracking-wider bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 inline-block">
                        Leader Bypass Active
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6">
              <button 
                onClick={handlePrint}
                disabled={isPrinting || success || (isPrintLocked && role === 'member')}
                className={`w-full py-4 rounded-[4px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                  success ? 'bg-emerald-500 text-white scale-95' : 
                  isPrinting ? 'bg-blue-400 text-white cursor-wait scale-95' : 
                  (isPrintLocked && role === 'member') ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#008d51] text-white hover:bg-[#007442] hover:-translate-y-0.5'
                }`}
              >
                {success ? (
                  <><Check className="w-5 h-5 animate-bounce" /> Label Printed!</>
                ) : isPrinting ? (
                  <>Printing Label...</>
                ) : (
                  <><Printer className="w-5 h-5" /> PRINT LABEL {totalLabels > 0 ? `${String(printedCount + 1).padStart(2,'0')}/${String(totalLabels).padStart(2,'0')}` : ''}</>
                )}
              </button>
            </div>
          </div>

          {/* Preview Panel – new label design */}
          <div className="flex-1 p-4 bg-slate-100 flex flex-col items-center justify-center overflow-auto min-h-[380px]">
            <div className="text-[10px] text-slate-400 font-black mb-2 uppercase flex items-center gap-1 select-none">
              <Tag className="w-3.5 h-3.5 text-slate-400" /> Label Preview
              {/* New label: Customer Unique top, QR bottom full-width */}
              <div className="bg-white w-full max-w-[460px] border-[2px] border-black shadow-md text-black relative select-none">
                {isPrinting && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center text-[#006B3C] font-black tracking-widest uppercase text-xs">
                    Transmitting...
                  </div>
                )}

                {/* Row 1: Logo+SEBANGO | Customer Unique */}
                <div className="flex border-b-[2px] border-black" style={{minHeight:'68px'}}>
                  <div className="flex flex-col items-center justify-center p-2 border-r-[2px] border-black" style={{width:'28%'}}>
                    <img src="/sugity-logo.png" alt="Sugity" className="object-contain" style={{width:'52px', height:'39px'}} />
                    <span style={{fontFamily:"'Montserrat',Arial,sans-serif", fontSize:'7px', fontWeight:600, letterSpacing:'2px', marginTop:'3px'}}>SEBANGO</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-3 py-2 text-center">
                    <span style={{fontSize:'9px', color:'#555'}}>Customer Unique</span>
                    <span style={{fontFamily:"'Montserrat',Arial,sans-serif", fontSize: customerUniqueItems.length > 1 ? '22px' : '38px', fontWeight:900, lineHeight:1.05, marginTop:'2px'}}>
                      {customerUniqueItems.join(' / ')}
                    </span>
                  </div>
                </div>

                {/* Row 2: Part No | Part Name | Model */}
                <div className="flex border-b-[2px] border-black">
                  <div className="flex flex-col p-1.5 border-r-[2px] border-black" style={{width:'33%'}}>
                    <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Part No.</span>
                    <span style={{fontSize:'12px', fontWeight:700}}>{partNumber}</span>
                  </div>
                  <div className="flex flex-col p-1.5 border-r-[2px] border-black" style={{width:'34%'}}>
                    <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Part Name</span>
                    <span style={{fontSize:'11px', fontWeight:700, textTransform:'uppercase', lineHeight:1.2}}>{partName}</span>
                  </div>
                  <div className="flex flex-col p-1.5" style={{width:'33%'}}>
                    <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Model</span>
                    <span style={{fontSize:'12px', fontWeight:700}}>{partDetails.model}</span>
                  </div>
                </div>

                {/* Row 3: Sebango | Prod. Date | PCS/KANBAN */}
                <div className="flex border-b-[2px] border-black">
                  <div className="flex flex-col p-1.5 border-r-[2px] border-black" style={{width:'33%'}}>
                    <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Sebango</span>
                    <span style={{fontSize:'10px'}}>{partDetails.sebango}</span>
                  </div>
                  <div className="flex flex-col p-1.5 border-r-[2px] border-black" style={{width:'34%'}}>
                    <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Prod. Date</span>
                    <span style={{fontSize:'9px', fontStyle:'italic', color:'#555', lineHeight:1.4}}>{getProdDateTime()}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-1.5" style={{width:'33%'}}>
                    <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444', textAlign:'center'}}>Pcs / Kanban</span>
                    <span style={{fontSize:'26px', fontWeight:900, lineHeight:1}}>{isNaN(kelipatan) ? 0 : kelipatan}</span>
                  </div>
                </div>

                  {/* Row 4: QR Code (full width, large) - generated locally, no external API */}
                <div className="flex items-center justify-center p-3">
                  {qrPreviewUrl ? (
                    <img
                      src={qrPreviewUrl}
                      alt="QR"
                      style={{width:'155px', height:'155px'}}
                    />
                  ) : (
                    <div style={{width:'155px', height:'155px', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9', borderRadius:'4px'}}>
                      <span style={{fontSize:'10px', color:'#94a3b8'}}>Generating QR...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
