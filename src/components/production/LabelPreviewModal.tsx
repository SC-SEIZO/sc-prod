import React, { useMemo } from 'react';
import { X, Eye } from 'lucide-react';

interface LabelPreviewModalProps {
  part: {
    partNumber?: string;
    partName?: string;
    customer?: string;
    sebango?: string;
    customerSebango?: string;
    customerPno?: string;
    model?: string;
    cycleTime?: string | number;
    area?: string;
    weight?: string | number;
    mold?: string;
    cavity?: string | number;
    qtyKanban?: number;
    spec?: string | number;
  };
  onClose: () => void;
}

export function LabelPreviewModal({ part, onClose }: LabelPreviewModalProps) {
  const partNumber  = part.partNumber  || '';
  const partName    = part.partName    || '--';
  const sebango     = part.sebango     || 'U0-****';
  const model       = part.model       || '--';
  const previewQty  = part.qtyKanban   != null ? part.qtyKanban : '--';
  const qrEncoded   = encodeURIComponent(sebango || partNumber || 'SGT');

  const customerUniqueItems = useMemo(() => {
    const raw = (part.customerSebango || '').trim();
    if (!raw || raw === 'GT-****') return ['-'];
    return raw.split(/[\/,;+]+/).map(s => s.trim()).filter(Boolean);
  }, [part.customerSebango]);

  const hasMetaInfo = part.area || part.cycleTime || part.mold || part.weight;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4 text-violet-600" />
            Label Preview
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded ml-1">
              Read Only
            </span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Label visual */}
        <div className="p-5 bg-slate-100 flex flex-col items-center gap-3">
          <div className="w-full max-w-[500px] bg-white border-[2px] border-black shadow-lg select-none text-black">

            {/* ── Row 1: Logo+SEBANGO | Customer Unique ── */}
            <div className="flex border-b-[2px] border-black" style={{minHeight:'80px'}}>
              <div className="flex flex-col items-center justify-center p-2 border-r-[2px] border-black" style={{width:'28%'}}>
                <img src="/sugity-logo.png" alt="Sugity" className="object-contain" style={{width:'65px', height:'49px'}} />
                <span style={{fontFamily:"'Montserrat',Arial,sans-serif", fontSize:'8px', fontWeight:600, letterSpacing:'2px', marginTop:'4px'}}>SEBANGO</span>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center px-3 py-2 text-center">
                <span style={{fontSize:'10px', color:'#555'}}>Customer Unique</span>
                <span style={{fontFamily:"'Montserrat',Arial,sans-serif", fontSize: customerUniqueItems.length > 1 ? '26px' : '44px', fontWeight:900, lineHeight:1.05, marginTop:'3px'}}>
                  {customerUniqueItems.join(' / ')}
                </span>
              </div>
            </div>

            {/* ── Row 2: Part No | Part Name | Model ── */}
            <div className="flex border-b-[2px] border-black">
              <div className="flex flex-col p-2 border-r-[2px] border-black" style={{width:'33%'}}>
                <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Part No.</span>
                <span style={{fontSize:'13px', fontWeight:700}}>{partNumber || '--'}</span>
              </div>
              <div className="flex flex-col p-2 border-r-[2px] border-black" style={{width:'34%'}}>
                <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Part Name</span>
                <span style={{fontSize:'12px', fontWeight:700, textTransform:'uppercase', lineHeight:1.2}}>{partName}</span>
              </div>
              <div className="flex flex-col p-2" style={{width:'33%'}}>
                <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Model</span>
                <span style={{fontSize:'13px', fontWeight:700}}>{model}</span>
              </div>
            </div>

            {/* ── Row 3: Sebango | Prod. Date | PCS/KANBAN ── */}
            <div className="flex border-b-[2px] border-black">
              <div className="flex flex-col p-2 border-r-[2px] border-black" style={{width:'33%'}}>
                <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Sebango</span>
                <span style={{fontSize:'12px'}}>{sebango}</span>
              </div>
              <div className="flex flex-col p-2 border-r-[2px] border-black" style={{width:'34%'}}>
                <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444'}}>Prod. Date</span>
                <span style={{fontSize:'11px', fontStyle:'italic', color:'#777', lineHeight:1.4}}>dd/mm/yyyy<br />hh:mm:ss (ID)</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2" style={{width:'33%'}}>
                <span style={{fontSize:'7px', fontWeight:700, textTransform:'uppercase', color:'#444', textAlign:'center'}}>Pcs / Kanban</span>
                <span style={{fontSize:'30px', fontWeight:900, lineHeight:1}}>{String(previewQty)}</span>
              </div>
            </div>

            {/* ── Row 4: QR Code (full width, large) ── */}
            <div className="flex items-center justify-center p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrEncoded}`}
                alt="QR Code"
                style={{width:'170px', height:'170px'}}
              />
            </div>

          </div>



          <p className="text-[9px] text-slate-400 font-semibold italic text-center">
            * LABEL ID, PROD. DATE, dan PCS/KBN akan terisi saat label dicetak oleh operator
          </p>
        </div>

        {/* Extra part info chips */}
        {hasMetaInfo && (
          <div className="px-5 pb-5 grid grid-cols-4 gap-2">
            {part.area && (
              <div className="bg-slate-50 rounded p-2 border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400">Area</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">{part.area}</div>
              </div>
            )}
            {part.cycleTime && (
              <div className="bg-slate-50 rounded p-2 border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400">C/T</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">{part.cycleTime}s</div>
              </div>
            )}
            {part.mold && (
              <div className="bg-slate-50 rounded p-2 border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400">Mold</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">{part.mold}</div>
              </div>
            )}
            {part.weight && (
              <div className="bg-slate-50 rounded p-2 border border-slate-100">
                <div className="text-[9px] font-black uppercase text-slate-400">Weight</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">{part.weight} kg</div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
