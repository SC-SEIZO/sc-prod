import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, AlertTriangle, CheckCircle, Clock, Save, Tag, X, User, Settings2, Bluetooth, RefreshCw, AlertCircle, PauseCircle, Inbox } from 'lucide-react';
import { PrintLabelModal } from './PrintLabelModal';
import { useUserRole } from '../../context/UserContext';
import { useProduction, getUniqueMachineKey } from '../../context/ProductionContext';
import { useParts } from '../../context/PartsContext';
import { getInitials } from '../../lib/utils';

interface MachineExecutionViewProps {
  machine: string;
  factory: string;
  selectedDate?: string;
}

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const isPM = timeStr.toLowerCase().includes('pm');
  const isAM = timeStr.toLowerCase().includes('am');
  const cleanTime = timeStr.replace(/(am|pm)/i, '').trim();
  const parts = cleanTime.split(':');
  if (parts.length < 2) return 0;
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

export function MachineExecutionView({ machine, factory, selectedDate }: MachineExecutionViewProps) {
  const { role, canExecute, verifyLeaderPin } = useUserRole();
  const machineKey = getUniqueMachineKey(factory, machine);
  // localStorage key to persist the pending (unsaved) abnormality form across logout/re-login
  const PENDING_ABNORMAL_LS_KEY = `sugity_pending_abnormal_${machineKey}`;
  const { parts } = useParts();

  // Bluetooth Printer Connection State (Persisted during session)
  const [btDevice, setBtDevice] = useState<any>(null);
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [connectionError, setConnectionError] = useState<string>('');
  const [lastConnectedName, setLastConnectedName] = useState<string>(() => {
    return typeof window !== 'undefined' ? (localStorage.getItem('sugity_last_printer') || '') : '';
  });

  // Bluetooth Pairing Requirement & Dev Bypass Toggle
  const [bypassBtRequirement, setBypassBtRequirement] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? (localStorage.getItem('sugity_dev_bypass_bt') === 'true') : true;
  });

  const toggleBypassBtRequirement = () => {
    const newVal = !bypassBtRequirement;
    setBypassBtRequirement(newVal);
    localStorage.setItem('sugity_dev_bypass_bt', String(newVal));
  };

  const isBtConnected = connectionStatus === 'connected';
  const isBtReadyForProduction = isBtConnected || bypassBtRequirement;

  const isBluetoothSupported = typeof window !== 'undefined' && 'bluetooth' in navigator;

  const connectBluetoothPrinter = async () => {
    if (!isBluetoothSupported) return;
    setConnectionStatus('connecting');
    setConnectionError('');
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb', '000018f0-0000-1000-8000-00805f9b34fb']
      });

      setConnectionStatus('connecting');
      const server = await device.gatt.connect();
      
      let service;
      try {
        service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
      } catch (e) {
        service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      }
      
      const characteristics = await service.getCharacteristics();
      const writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      
      if (!writeChar) {
        throw new Error('No write characteristic found on printer.');
      }
      
      setBtDevice(device);
      setBtCharacteristic(writeChar);
      setConnectionStatus('connected');
      
      if (device.name) {
        localStorage.setItem('sugity_last_printer', device.name);
        setLastConnectedName(device.name);
      }
      
      device.addEventListener('gattserverdisconnected', () => {
        setBtDevice(null);
        setBtCharacteristic(null);
        setConnectionStatus('disconnected');
      });
    } catch (err: any) {
      console.error('Bluetooth Connection Error:', err);
      setConnectionError(err.message || 'Failed to connect. Ensure printer is paired.');
      setConnectionStatus('error');
    }
  };

  const disconnectBluetoothPrinter = () => {
    if (btDevice && btDevice.gatt.connected) {
      btDevice.gatt.disconnect();
    }
    setBtDevice(null);
    setBtCharacteristic(null);
    setConnectionStatus('disconnected');
  };

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      if (btDevice && btDevice.gatt.connected) {
        btDevice.gatt.disconnect();
      }
    };
  }, [btDevice]);
  const {
    jobs,
    logList,
    runningJob,
    incrementJobProgress,
    updateJobStatus,
    addAbnormalityRecord,
    addJobDowntime,
    isAbnormalActive,
    activeAbnormalType,
    activeAbnormalStart,
    setMachineAbnormal,
    isNgActive,
    activeNgType,
    activeNgStart,
    setMachineNg,
    reviseJobNgQty,
    closeShiftProduction
  } = useProduction(machineKey, selectedDate);

  const activeJob = runningJob || {
    id: 'job-default',
    customer: 'Unknown',
    model: 'N/A',
    partName: 'No active job running',
    qtyDay: 0,
    qtyLot: 100,
    actualQty: 0,
    mold: 'N/A',
    material: 'N/A',
    ct: 60,
    status: 'queued',
    timeRange: '--:-- - --:--'
  };

  const isNoActiveJob = !runningJob || activeJob.id === 'job-default' || activeJob.model === 'N/A' || activeJob.model === 'No active job running';

  const [showPrintLabel, setShowPrintLabel] = useState(false);
  const [showLeaderSignOff, setShowLeaderSignOff] = useState(false);
  const [signOffPin, setSignOffPin] = useState('');
  const [signOffQty, setSignOffQty] = useState<number>(0);
  const [okQty, setOkQty] = useState<number>(0);
  const [ngQty, setNgQty] = useState<number>(0);
  const [checkQuality, setCheckQuality] = useState(false);
  const [checkCleanliness, setCheckCleanliness] = useState(false);
  const [signOffError, setSignOffError] = useState('');
  
  // Resolve Kanban quantity (spec) dynamically from master parts
  const labelQty = React.useMemo(() => {
    if (!activeJob || !activeJob.model) return 24;
    const modelStr = activeJob.model.trim().toUpperCase();
    const matched = parts.find((p: any) => 
      (p.partNumber && p.partNumber.trim().toUpperCase() === modelStr) || 
      (p.sebango && p.sebango.trim().toUpperCase() === modelStr) ||
      (p.part_number && p.part_number.trim().toUpperCase() === modelStr)
    );
    if (matched) {
      const specVal = parseInt(matched.spec);
      return isNaN(specVal) || specVal <= 0 ? 24 : specVal;
    }
    return 24; // fallback
  }, [activeJob, parts]);
  const [isReportingAbnormality, setIsReportingAbnormality] = useState(false);
  const [abnormalityType, setAbnormalityType] = useState('downtime');
  const [abnormalityNote, setAbnormalityNote] = useState('');
  const [abnormalityStartTime, setAbnormalityStartTime] = useState('');
  const [logFilterStart, setLogFilterStart] = useState('');
  const [logFilterEnd, setLogFilterEnd] = useState('');
  const [isRealtime, setIsRealtime] = useState(true);
  // Guard so the restore-from-localStorage effect only runs once per mount
  const hasRestoredPendingAbnormal = useRef(false);

  // --- NG (Quality Defect Ongoing) State ---
  const PENDING_NG_LS_KEY = `sugity_pending_ng_${machineKey}`;
  const [isReportingNg, setIsReportingNg] = useState(false);
  const [ngType, setNgType] = useState('defect');
  const [ngNote, setNgNote] = useState('');
  const [ngStartTime, setNgStartTime] = useState('');
  const [isResolvingNg, setIsResolvingNg] = useState(false);
  const [ngResolutionNote, setNgResolutionNote] = useState('');
  const [ngResolutionTime, setNgResolutionTime] = useState('');
  const hasRestoredPendingNg = useRef(false);

  // NG Revision panel in activity log (leader/planner only)
  const [ngReviseJobId, setNgReviseJobId] = useState<string | null>(null);
  const [ngReviseValue, setNgReviseValue] = useState<number>(0);
  const [ngRevisePin, setNgRevisePin] = useState('');
  const [ngReviseError, setNgReviseError] = useState('');

  // --- BUG FIX: Persist pending abnormality form across logout/re-login ---
  useEffect(() => {
    if (isAbnormalActive) {
      if (!hasRestoredPendingAbnormal.current) {
        hasRestoredPendingAbnormal.current = true;
        try {
          const raw = localStorage.getItem(PENDING_ABNORMAL_LS_KEY);
          if (raw) {
            const pending = JSON.parse(raw);
            if (pending?.isOpen) {
              setAbnormalityType(pending.type || 'downtime');
              setAbnormalityNote(pending.note || '');
              setAbnormalityStartTime(pending.startTime || '');
              setIsReportingAbnormality(true);
            }
          }
        } catch {}
      }
    } else {
      localStorage.removeItem(PENDING_ABNORMAL_LS_KEY);
      hasRestoredPendingAbnormal.current = false;
    }
  }, [isAbnormalActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist pending NG form across logout/re-login
  useEffect(() => {
    if (isNgActive) {
      if (!hasRestoredPendingNg.current) {
        hasRestoredPendingNg.current = true;
        try {
          const raw = localStorage.getItem(PENDING_NG_LS_KEY);
          if (raw) {
            const pending = JSON.parse(raw);
            if (pending?.isOpen) {
              setNgType(pending.type || 'defect');
              setNgNote(pending.note || '');
              setNgStartTime(pending.startTime || '');
              setIsReportingNg(true);
            }
          }
        } catch {}
      }
    } else {
      localStorage.removeItem(PENDING_NG_LS_KEY);
      hasRestoredPendingNg.current = false;
    }
  }, [isNgActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync in-progress abnormality form to localStorage
  useEffect(() => {
    if (!isReportingAbnormality) return;
    try {
      localStorage.setItem(PENDING_ABNORMAL_LS_KEY, JSON.stringify({
        isOpen: true,
        type: abnormalityType,
        note: abnormalityNote,
        startTime: abnormalityStartTime,
      }));
    } catch {}
  }, [isReportingAbnormality, abnormalityType, abnormalityNote, abnormalityStartTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync in-progress NG form to localStorage
  useEffect(() => {
    if (!isReportingNg) return;
    try {
      localStorage.setItem(PENDING_NG_LS_KEY, JSON.stringify({
        isOpen: true,
        type: ngType,
        note: ngNote,
        startTime: ngStartTime,
      }));
    } catch {}
  }, [isReportingNg, ngType, ngNote, ngStartTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1. Live Ticking Clock for elapsed calculations
  const [currentLiveTime, setCurrentLiveTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLiveTime(new Date());
    }, 10000); // tick every 10 seconds
    return () => clearInterval(timer);
  }, []);

  // 2. Print Lock Calculation
  const printLockStatus = React.useMemo(() => {
    if (activeJob.status !== 'running') {
      return { isLocked: false, message: '' };
    }
    // Guard: if no production start time recorded yet, don't lock
    if (!activeJob.actualProductionStart || typeof activeJob.actualProductionStart !== 'string') {
      return { isLocked: false, message: '' };
    }
    
    // Parse start time to date
    const parts = activeJob.actualProductionStart.split(':');
    if (parts.length < 2) return { isLocked: false, message: '' };
    const [hhStr, mmStr] = parts;
    const startDate = new Date(currentLiveTime);
    startDate.setHours(parseInt(hhStr, 10), parseInt(mmStr, 10), 0, 0);
    // Adjust if crossed midnight
    if (startDate.getTime() > currentLiveTime.getTime()) {
      startDate.setDate(startDate.getDate() - 1);
    }
    
    const diffMs = currentLiveTime.getTime() - startDate.getTime();
    const totalElapsedSecs = Math.floor(diffMs / 1000);
    const netElapsedSecs = Math.max(0, totalElapsedSecs - (activeJob.downtimeMinutes || 0) * 60);
    
    const cavity = activeJob.kav || 1;
    const ct = activeJob.ct || 60;
    
    // Target quantity if we print this label box
    const targetTotalQty = activeJob.actualQty + labelQty;
    
    // FIXED: Use max-producible quantity vs target qty for lock check.
    // Previous formula compared cumulative elapsed secs vs cumulative required secs,
    // which permanently locked after the 1st label (actualQty already counted in requiredSecs).
    const currentMaxProduced = Math.floor((netElapsedSecs / ct) * cavity);
    const isLocked = currentMaxProduced < targetTotalQty;
    
    let message = '';
    if (isLocked) {
      const needed = targetTotalQty - currentMaxProduced;
      const neededSecs = Math.ceil((needed / cavity) * ct);
      const remainingMins = Math.ceil(neededSecs / 60);
      message = `Print Locked: Machine has produced approx. ${currentMaxProduced}/${targetTotalQty} pcs. Need approx. ${remainingMins} more minute(s) of run time to print this box.`;
    }
    
    return { isLocked, message };
  }, [activeJob.status, activeJob.actualProductionStart, activeJob.actualQty, activeJob.downtimeMinutes, activeJob.kav, activeJob.ct, labelQty, currentLiveTime]);

  // Active Abnormality & Downtime State Tracking
  const [isResolvingAbnormality, setIsResolvingAbnormality] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionTime, setResolutionTime] = useState('');

  const actualQty = activeJob.actualQty;
  const targetQty = activeJob.qtyLot;
  const progressPercent = Math.min(100, Math.round(((isNaN(actualQty) ? 0 : actualQty) / targetQty) * 100)) || 0;

  // Find next job in the lineup queue
  const runningIndex = jobs.findIndex(j => j.id === activeJob.id);
  const nextJob = runningIndex !== -1 && runningIndex + 1 < jobs.length ? jobs[runningIndex + 1] : null;

  // Check if activeJob is the first job of either the Day shift or the Night shift
  const isFirstInShift = (() => {
    if (!jobs || jobs.length === 0) return false;
    const firstDayJob = jobs.find(j => j.shift === 'day');
    const firstNightJob = jobs.find(j => j.shift === 'night');
    return (firstDayJob && activeJob.id === firstDayJob.id) || (firstNightJob && activeJob.id === firstNightJob.id);
  })();

  const filteredLogs = logList.filter(log => {
    if (isRealtime) return true;
    const logMins = timeToMinutes(log.time);
    if (logFilterStart) {
      const startMins = timeToMinutes(logFilterStart);
      if (logMins < startMins) return false;
    }
    if (logFilterEnd) {
      const endMins = timeToMinutes(logFilterEnd);
      if (logMins > endMins) return false;
    }
    return true;
  });

  const handleLogAbnormality = () => {
    if (!abnormalityNote) return;
    
    // Ongoing active abnormality
    const formattedNote = `[START: ${abnormalityStartTime || '--:--'} • ONGOING] ${abnormalityNote}`;
    
    // Activate abnormal active tracking and log in context/DB in a single atomic update
    setMachineAbnormal(true, abnormalityType, abnormalityStartTime, {
      type: abnormalityType,
      note: formattedNote,
      timeStr: abnormalityStartTime
    });

    // Record is now officially saved — clear the persisted pending form
    localStorage.removeItem(PENDING_ABNORMAL_LS_KEY);

    setIsReportingAbnormality(false);
    setAbnormalityNote('');
    setAbnormalityStartTime('');
  };

  const handlePrintSuccess = (qty: number) => {
    incrementJobProgress(activeJob.id, qty, {
      type: 'success',
      note: `Printed label for ${qty} pcs. Progress updated.`
    });
  };

  const handleCompleteJob = () => {
    setOkQty(actualQty);
    setNgQty(0);
    setSignOffPin('');
    setCheckQuality(false);
    setCheckCleanliness(false);
    setSignOffError('');
    setShowLeaderSignOff(true);
  };

  const handleConfirmSignOff = async () => {
    if (!checkQuality || !checkCleanliness) {
      setSignOffError('Please check all verification checklist items.');
      return;
    }
    const leader = await verifyLeaderPin(signOffPin);
    if (!leader) {
      setSignOffError('Invalid Leader PIN code.');
      return;
    }
    
    const totalCloseQty = okQty + ngQty;

    updateJobStatus(
      activeJob.id,
      'complete-running',
      {
        type: 'success',
        note: `Production Completed! Plan: ${targetQty} pcs, Verified Output: ${totalCloseQty} pcs (OK: ${okQty} pcs, NG: ${ngQty} pcs). Approved by Leader: ${leader.name} (${leader.name === 'Master Leader' ? 'ML' : getInitials(leader.name)})`
      },
      ngQty,
      okQty
    );

    setShowLeaderSignOff(false);
  };

  const handleCompleteDandori = () => {
    if (!isBtReadyForProduction) {
      alert("⚠️ SAMBUNGAN PRINTER BLUETOOTH WAJIB TERHUBUNG!\n\nPrinter Bluetooth belum ter-pair. Silakan klik 'Pair Bluetooth Printer' di panel sebelah kanan sebelum memulai produksi, atau aktifkan 'Dev Mode Bypass'.");
      return;
    }
    updateJobStatus(activeJob.id, 'complete-dandori', {
      type: 'success',
      note: `Completed Dandori setup for ${activeJob.model}. Starting production.`
    });
  };

  const handleCloseShift = () => {
    if (!activeJob.shift) return;
    const confirmClose = window.confirm(`Are you sure you want to close the ${activeJob.shift.toUpperCase()} shift production? All remaining uncompleted jobs in this shift will be closed.`);
    if (confirmClose) {
      closeShiftProduction(activeJob.shift);
    }
  };

  const canStartProduction = role === 'member' || role === 'leader';

  return (
    <div className="flex-1 bg-slate-100 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden w-full h-full relative">
      
      {/* LEFT COLUMN: Main Execution & Queue */}
      <div className="w-full md:flex-1 border-r border-slate-200 p-4 md:p-6 space-y-6 flex-shrink-0 md:flex-shrink md:overflow-y-auto">
        
        {/* Active Abnormality Banner */}
        {isAbnormalActive && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-sm border-l-4 border-l-rose-600 flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-lg shrink-0">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div className="text-left">
                <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest">⚠️ Abnormality State Active</h4>
                <div className="text-base font-black text-slate-800 uppercase mt-0.5">{activeAbnormalType} Problem</div>
                <div className="text-xs text-rose-700 font-bold mt-1">Started at: <span className="font-mono bg-rose-100 px-1 py-0.5 rounded text-rose-950 font-black">{activeAbnormalStart}</span></div>
              </div>
            </div>
            {canExecute && (
              isReportingAbnormality ? (
                // Block resolving until the start log entry is saved — prevents orphaned RESOLVED logs
                <div className="px-4 py-2.5 bg-amber-100 border-2 border-amber-400 text-amber-900 rounded text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Save Abnormality Record First ⬆</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    setResolutionTime(timeStr);
                    setIsResolvingAbnormality(true);
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-black uppercase tracking-wider shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <CheckCircle className="w-4 h-4" /> Stop & Resolve Downtime
                </button>
              )
            )}
          </div>
        )}

        {/* Active NG Banner (Yellow) — machine keeps running, quality issue ongoing */}
        {isNgActive && !isAbnormalActive && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-sm border-l-4 border-l-amber-500 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-lg shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">⚠️ NG (Quality Issue) — Mesin Tetap Berjalan</h4>
                <div className="text-base font-black text-slate-800 uppercase mt-0.5">{activeNgType} — Sedang Investigasi</div>
                <div className="text-xs text-amber-700 font-bold mt-1">Dimulai: <span className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-black">{activeNgStart}</span></div>
              </div>
            </div>
            {canExecute && (
              isReportingNg ? (
                <div className="px-4 py-2.5 bg-amber-100 border-2 border-amber-400 text-amber-900 rounded text-xs font-black uppercase tracking-wider flex items-center gap-2 shrink-0 animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Save NG Record First ⬆</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    setNgResolutionTime(timeStr);
                    setIsResolvingNg(true);
                  }}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-black uppercase tracking-wider shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <CheckCircle className="w-4 h-4" /> Resolve & Tutup NG
                </button>
              )
            )}
          </div>
        )}

        {/* Current Active Job Panel */}
        <div className="relative">
          {/* Light-Theme Card Overlay when Bluetooth is Disconnected in Strict Mode */}
          {!isBtReadyForProduction && (
            <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-md rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-lg border border-amber-300 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-sm animate-bounce">
                <Bluetooth className="w-7 h-7 stroke-[2.5]" />
              </div>

              <span className="px-3 py-1 bg-amber-100 border border-amber-200/80 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                🔒 Lock Mode: Bluetooth Printer Offline
              </span>

              <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight mb-1">
                Printer Bluetooth Wajib Terhubung
              </h3>
              
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mb-6">
                Koneksi printer Bluetooth terputus atau tablet baru ter-reset. Untuk menjamin cetakan Kanban & Label produksi valid, sambungkan Bluetooth Printer sebelum memproses job ini.
              </p>

              <div className="w-full max-w-sm space-y-2.5">
                <button
                  onClick={connectBluetoothPrinter}
                  disabled={!isBluetoothSupported || connectionStatus === 'connecting'}
                  className={`w-full py-3 rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer ${
                    !isBluetoothSupported 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting Printer...</>
                  ) : (
                    <><Bluetooth className="w-4 h-4" /> Pair Bluetooth Printer Now</>
                  )}
                </button>

                <button
                  onClick={toggleBypassBtRequirement}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-amber-900 font-bold uppercase rounded-xl text-[10px] tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  ⚡ Aktifkan Dev Bypass Mode (Tanpa Printer)
                </button>
              </div>

              {connectionError && (
                <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] font-bold uppercase tracking-wider w-full max-w-sm text-center">
                  ⚠️ {connectionError}
                </div>
              )}
            </div>
          )}

          {isNoActiveJob ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <PauseCircle className="w-4 h-4 text-amber-400" />
                  Machine Status: Standby / Idle
                </h3>
              </div>
              <div className="flex gap-2 items-center">
                <span className="px-2.5 py-0.5 bg-slate-700/80 border border-slate-600 rounded text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                  No Active Work Order
                </span>
              </div>
            </div>

            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
                <Inbox className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                Tidak Ada Job Produksi Aktif
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-lg mb-6 leading-relaxed">
                Mesin <span className="font-bold text-slate-700">#{machine}</span> saat ini berada dalam status <span className="font-bold text-amber-600">Idle / Standby</span>. Belum ada rencana produksi aktif yang dialokasikan untuk jadwal saat ini.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mb-6 text-left">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Machine ID</span>
                  <span className="text-xs font-black text-slate-800 font-mono mt-0.5 block">#{machine} ({factory})</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Mesin</span>
                  <span className="text-xs font-black text-amber-600 font-mono mt-0.5 block uppercase">Idle / Standby</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Schedule</span>
                  <span className="text-xs font-black text-slate-800 font-mono mt-0.5 block">{jobs.length} Jobs Total</span>
                </div>
              </div>

              {/* Action options */}
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xl">
                <button 
                  onClick={() => {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    setAbnormalityStartTime(timeStr);
                    setMachineAbnormal(true, 'downtime', timeStr);
                    setIsReportingAbnormality(true);
                  }}
                  disabled={!canExecute || isAbnormalActive}
                  title={isAbnormalActive ? "Abnormality already active" : (!canExecute ? "Switch to Member role to report" : "Report machine downtime/breakdown")}
                  className={`flex-1 py-3 border-2 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors ${
                    (!canExecute || isAbnormalActive) ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" /> Report Downtime
                </button>
              </div>
            </div>
          </div>
        ) : activeJob.status === 'dandori' ? (
          <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <div className="w-3.5 h-3.5 rounded-full bg-blue-300 animate-ping shadow-[0_0_8px_rgba(147,197,253,0.8)]"></div>
                 <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                   <Settings2 className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
                   {isFirstInShift ? "Preparation Mode (Shift Start)" : "Dandori Setup Mode (Changeover)"}
                 </h3>
               </div>
               <div className="flex gap-2 items-center">
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold">SETUP TIMELINE</span>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold font-mono text-white">{activeJob.timeRange}</span>
                  {canExecute && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded uppercase ml-2">
                      <User className="w-3 h-3" />
                      Member Mode
                    </span>
                  )}
               </div>
            </div>
            
            <div className="p-6 flex flex-col items-center text-center">
              {/* Premium Info Panel / Visual Illustration */}
              <div className="w-full max-w-2xl mb-6 bg-slate-50 border border-slate-100 rounded-xl p-5 relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
                
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-1">
                    <Settings2 className="w-8 h-8 animate-spin" style={{ animationDuration: '10s' }} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">
                      {isFirstInShift ? "Shift Start Preparation" : "Upcoming Machine Configuration"}
                    </h4>
                    <div className="text-xl font-black font-mono text-slate-800 tracking-tight">{activeJob.model}</div>
                    <div className="text-sm font-bold text-slate-600 uppercase mt-0.5">{activeJob.partName}</div>
                    <div className="text-xs text-slate-400 font-medium mt-1">Customer: <span className="font-bold text-slate-600">{activeJob.customer}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Target Mold</div>
                    <div className="text-sm font-black font-mono text-slate-700 mt-1">{activeJob.mold}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Target Material</div>
                    <div className="text-xs font-black font-mono text-slate-700 mt-1.5 truncate" title={activeJob.material}>{activeJob.material}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Est. Setup Time</div>
                    <div className="text-sm font-black font-mono text-blue-600 mt-1">{activeJob.dandori} mins</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Production Lot</div>
                    <div className="text-sm font-black font-mono text-slate-700 mt-1">{activeJob.qtyLot} pcs</div>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="max-w-md mb-8">
                <h3 className="text-lg font-black text-slate-800 tracking-tight mb-2">
                  {isFirstInShift ? "Shift Start Preparation In Progress" : "Changeover In Progress"}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {isFirstInShift 
                    ? `Perform shift start preparation for model ${activeJob.model}. Check molds, machine state, and load materials before starting production.`
                    : `Prepare the mold ${activeJob.mold} and load the resin material ${activeJob.material}. Print functions and production progress tracking are currently locked.`}
                </p>
              </div>

              {/* Finish Dandori Button */}
              <div className="w-full max-w-2xl flex flex-col gap-3">
                <button 
                  onClick={handleCompleteDandori}
                  disabled={!canStartProduction}
                  title={!canStartProduction ? "Only Member or Leader role can finish shift preparation and start production" : (isFirstInShift ? "Finish Preparation & Start Running" : "Finish Changeover & Start Running")}
                  className={`w-full py-4 rounded-[4px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-transform shadow-md hover:-translate-y-0.5 ${
                    !canStartProduction ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none hover:translate-y-0' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                  }`}
                >
                  <CheckCircle className="w-5 h-5" /> {isFirstInShift ? "Finish Shift Preparation" : "Finish Dandori Setup"}
                </button>
                
                <button
                  onClick={handleCloseShift}
                  disabled={!canStartProduction}
                  title="Close current shift and skip any remaining jobs in it"
                  className={`w-full py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-600 font-bold uppercase rounded text-xs tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    !canStartProduction ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : ''
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-slate-500" /> Close {activeJob.shift?.toUpperCase()} Shift Production
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-[#E76114] text-white flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                 <h3 className="font-bold text-sm uppercase tracking-wider">Current Active Job</h3>
               </div>
               <div className="flex gap-2 items-center">
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold">{(activeJob.shift || 'day').toUpperCase()} SHIFT</span>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold font-mono text-white">{activeJob.timeRange}</span>
                  {canExecute && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded uppercase ml-2">
                      <User className="w-3 h-3" />
                      Member Mode
                    </span>
                  )}
               </div>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col md:flex-row justify-between mb-8">
                <div className="mb-4 md:mb-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Part Number / Model</div>
                  <div className="text-2xl font-black font-mono text-slate-800 tracking-tighter">{activeJob.model}</div>
                  <div className="text-sm font-bold mt-1 text-slate-600 uppercase">{activeJob.partName}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Mold: <span className="font-mono text-slate-700">{activeJob.mold}</span> • Material: <span className="font-mono text-slate-700">{activeJob.material}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</div>
                  <div className="inline-block px-3 py-1 bg-slate-100 text-slate-700 font-black text-lg border border-slate-200 rounded">{activeJob.customer}</div>
                </div>
              </div>

              {/* Progress Metrics */}
              <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
                 <div className="flex justify-between items-end mb-2">
                    <div className="text-xs font-bold text-slate-500 uppercase">Production Progress</div>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-black text-blue-600">{isNaN(actualQty) ? 0 : actualQty}</span>
                       <span className="text-sm font-bold text-slate-400">/ {targetQty} pcs</span>
                    </div>
                 </div>
                 <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden shadow-inner flex">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500 relative flex items-center justify-end pr-2 overflow-hidden whitespace-nowrap"
                      style={{ width: `${progressPercent}%` }}
                    >
                       {progressPercent > 5 && (
                         <span className="text-[9px] font-bold text-white shadow-sm">
                           {progressPercent}%
                         </span>
                       )}
                    </div>
                 </div>
                 <div className="flex justify-end items-start mt-4">
                    <div className="text-[10px] text-slate-400 font-medium flex flex-col gap-1 text-right mt-1">
                       <span>Cycle Time: <b className="text-slate-600">{activeJob.ct}s</b></span>
                       <span>Cavity: <b className="text-slate-600">{activeJob.kav || 1}</b></span>
                    </div>
                 </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                   <button 
                     onClick={() => setShowPrintLabel(true)}
                     disabled={!canExecute || activeJob.status === 'completed' || isAbnormalActive}
                     title={isAbnormalActive ? "Abnormality active, resolve first" : (!canExecute ? "Switch to Member role to print" : "Print labels and update qty")}
                     className={`flex-1 py-3 rounded-[4px] font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors shadow-sm ${
                       (!canExecute || activeJob.status === 'completed' || isAbnormalActive) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-[#037233] hover:bg-[#025c28] text-white'
                     }`}
                   >
                     <Tag className="w-4 h-4" /> Print Custom Label (Kanban)
                   </button>
                   <button 
                     onClick={() => {
                       const now = new Date();
                       const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                       setAbnormalityStartTime(timeStr);
                       setMachineAbnormal(true, 'downtime', timeStr);
                       setIsReportingAbnormality(true);
                    }}
                     disabled={!canExecute || isAbnormalActive}
                     title={isAbnormalActive ? "Abnormality already active" : (!canExecute ? "Switch to Member role to report" : "Report issue")}
                     className={`flex-1 py-3 border-2 rounded-[4px] font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors ${
                       (!canExecute || isAbnormalActive) ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50'
                     }`}
                   >
                     <AlertTriangle className="w-4 h-4" /> Report Abnormality
                   </button>
                </div>
                
                <button
                  onClick={() => {
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    setNgStartTime(timeStr);
                    setMachineNg(true, 'defect', timeStr);
                    setIsReportingNg(true);
                  }}
                  disabled={!canExecute || isNgActive || isAbnormalActive || activeJob.status === 'completed'}
                  title={isNgActive ? "NG sudah aktif" : isAbnormalActive ? "Selesaikan abnormality dulu" : (!canExecute ? "Switch ke Member role" : "Laporkan NG Quality")}
                  className={`w-full py-3 border-2 rounded-[4px] font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors ${
                    (!canExecute || isNgActive || isAbnormalActive || activeJob.status === 'completed') 
                      ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" /> Report NG (Quality Issue Ongoing)
                </button>

                <button 
                    onClick={handleCompleteJob}
                    disabled={!canExecute || activeJob.status === 'completed' || isAbnormalActive}
                    title={isAbnormalActive ? "Abnormality active, resolve first" : (!canExecute ? "Switch to Member role to complete" : "Finish current production")}
                    className={`w-full py-4 rounded-[4px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-transform shadow-md ${
                      (!canExecute || activeJob.status === 'completed' || isAbnormalActive) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 text-white'
                    }`}
                 >
                    <CheckCircle className="w-5 h-5" /> Complete Production
                 </button>

                 <button
                    onClick={handleCloseShift}
                    disabled={!canExecute || isAbnormalActive}
                    title="Close current shift and skip any remaining jobs in it"
                    className={`w-full py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-600 font-bold uppercase rounded text-xs tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                      (!canExecute || isAbnormalActive) ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : ''
                    }`}
                 >
                    <AlertCircle className="w-4 h-4 text-slate-500" /> Close {activeJob.shift?.toUpperCase()} Shift Production
                 </button>
               </div>
             </div>
           </div>
         )}
        </div>

        {/* Next in Queue */}
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3">Up Next in Queue</h3>
          {nextJob ? (
            <div className="bg-white rounded-lg border border-slate-200 p-4 opacity-70 flex items-center justify-between shadow-sm">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-[10px] font-bold">{nextJob.seq}</span>
                    <span className="text-sm font-bold font-mono">{nextJob.model}</span>
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 pl-7">{nextJob.partName}</div>
                  <div className="text-[10px] text-slate-400 pl-7 mt-1">Mold: {nextJob.mold} • Target: {nextJob.qtyLot} pcs</div>
               </div>
               <div className="text-right">
                  <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Pending Dandori ({nextJob.dandori}')</div>
               </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-dashed border-slate-300 p-4 text-center text-slate-400 text-xs">
              No further jobs in sequence queue.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Log & Abnormalities */}
      <div className="w-full md:w-80 bg-white flex flex-col border-t md:border-t-0 md:border-l border-slate-200 shrink-0 h-auto md:h-full">
          
          {/* Printer Connection Status Panel */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 select-none">
                <Bluetooth className="w-4 h-4 text-blue-600" /> Printer Connection
              </h3>
              {connectionStatus === 'connected' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase animate-pulse">
                  Linked
                </span>
              ) : connectionStatus === 'connecting' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 uppercase animate-pulse">
                  Linking
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-500 uppercase">
                  Offline
                </span>
              )}
            </div>

            {connectionStatus === 'connected' ? (
              <div className="bg-white p-2.5 rounded border border-slate-200/80 shadow-sm flex flex-col gap-2">
                <div className="text-[10px] font-bold text-slate-600 truncate">
                  Device: <span className="font-mono text-blue-600 font-extrabold">{btDevice?.name || 'Thermal Printer'}</span>
                </div>
                <button 
                  onClick={disconnectBluetoothPrinter}
                  className="w-full py-1.5 text-[9px] font-black text-rose-600 border border-rose-200 hover:bg-rose-50 rounded uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Disconnect Printer
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {lastConnectedName && (
                  <div className="text-[9px] font-bold text-slate-650 bg-blue-50/50 p-2 rounded border border-blue-100 leading-snug flex flex-col gap-0.5">
                    <div className="text-slate-400 text-[8px] uppercase tracking-wider font-extrabold">Configured Printer:</div>
                    <div className="font-mono font-black text-blue-700 flex items-center gap-1">
                      <Bluetooth className="w-3 h-3 animate-pulse text-blue-500" /> {lastConnectedName}
                    </div>
                  </div>
                )}
                <button 
                  onClick={connectBluetoothPrinter}
                  disabled={!isBluetoothSupported || connectionStatus === 'connecting'}
                  className={`w-full py-2.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                    !isBluetoothSupported 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:-translate-y-0.5'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pairing Printer...</>
                  ) : (
                    <><Bluetooth className="w-3.5 h-3.5" /> Pair Bluetooth Printer</>
                  )}
                </button>
                {!isBluetoothSupported && (
                  <div className="text-[8px] font-bold text-slate-400 leading-snug flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    Web Bluetooth is not supported in this browser. Fallback will trigger a local printing window.
                  </div>
                )}
                {connectionError && (
                  <div className="text-[8px] font-bold text-rose-600 bg-rose-50 p-2 rounded border border-rose-100 leading-snug">
                    {connectionError}
                  </div>
                )}
              </div>
            )}

            {/* Dev Mode Bypass BT Pairing Requirement Toggle */}
            <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black text-slate-700 uppercase tracking-tight">Dev Bypass Mode:</span>
                <button
                  onClick={toggleBypassBtRequirement}
                  className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border shadow-sm ${
                    bypassBtRequirement
                      ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                  }`}
                  title="Toggle Bluetooth Printer requirement lock for development"
                >
                  {bypassBtRequirement ? '⚡ Bypass ON' : '🔒 Strict BT Req'}
                </button>
              </div>
              <p className="text-[8px] font-bold text-slate-500 leading-snug">
                {bypassBtRequirement
                  ? 'Dev Bypass Aktif: Rencana pekerjaan dapat dimulai tanpa printer Bluetooth.'
                  : 'Mode Produksi: Bluetooth Wajib terhubung sebelum mulai pekerjaan.'}
              </p>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> Activity Log
              </h3>
              
              <button 
                onClick={() => {
                  setIsRealtime(!isRealtime);
                  if (!isRealtime) {
                    setLogFilterStart('');
                    setLogFilterEnd('');
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 ${
                  isRealtime 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isRealtime ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                {isRealtime ? 'Realtime (Live)' : 'Static Mode'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">From Time</label>
                <input 
                  type="time"
                  disabled={isRealtime}
                  value={logFilterStart}
                  onChange={(e) => setLogFilterStart(e.target.value)}
                  className={`w-full p-1.5 text-[10px] font-bold font-mono border rounded outline-none text-slate-700 bg-white transition-opacity ${
                    isRealtime ? 'opacity-40 cursor-not-allowed border-slate-100' : 'border-slate-200 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">To Time</label>
                <input 
                  type="time"
                  disabled={isRealtime}
                  value={logFilterEnd}
                  onChange={(e) => setLogFilterEnd(e.target.value)}
                  className={`w-full p-1.5 text-[10px] font-bold font-mono border rounded outline-none text-slate-700 bg-white transition-opacity ${
                    isRealtime ? 'opacity-40 cursor-not-allowed border-slate-100' : 'border-slate-200 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
              </div>
            </div>
          </div>
         
         {isReportingAbnormality ? (
           <div className="p-4 bg-rose-50 border-b border-rose-100 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-rose-800 text-xs uppercase">New Abnormality Record</h4>
                <button 
                  onClick={() => {
                    // Cancel: remove from DB and clear persisted form
                    localStorage.removeItem(PENDING_ABNORMAL_LS_KEY);
                    setMachineAbnormal(false);
                    setIsReportingAbnormality(false);
                    setAbnormalityNote('');
                    setAbnormalityStartTime('');
                    setAbnormalityType('downtime');
                  }} 
                  className="text-rose-500 hover:text-rose-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Show this warning when the form was auto-restored after a logout */}
              {isAbnormalActive && (
                <div className="mb-3 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded text-[10px] text-amber-900 font-bold leading-snug">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-600" />
                  <span>Mesin sudah dalam status Abnormal. Simpan record ini agar activity log tercatat dengan benar sebelum resolve.</span>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-[2]">
                    <label className="text-[10px] text-rose-800 font-bold uppercase mb-1 block opacity-70">Category</label>
                    <select 
                      value={abnormalityType} 
                      onChange={(e) => {
                        setAbnormalityType(e.target.value);
                        setMachineAbnormal(true, e.target.value, abnormalityStartTime);
                      }}
                      className="w-full p-2 text-xs border border-rose-200 rounded outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                    >
                      <option value="downtime">Machine Downtime (Stop)</option>
                      <option value="defect">Quality Defect (NG)</option>
                      <option value="material">Material Shortage</option>
                      <option value="mold">Mold Problem</option>
                    </select>
                  </div>
                  <div className="flex-[1]">
                    <label className="text-[10px] text-rose-800 font-bold uppercase mb-1 block opacity-70">Start Time</label>
                    <input 
                      type="time" 
                      value={abnormalityStartTime}
                      onChange={(e) => {
                        setAbnormalityStartTime(e.target.value);
                        setMachineAbnormal(true, abnormalityType, e.target.value);
                      }}
                      className="w-full p-2 text-xs border border-rose-200 rounded outline-none focus:ring-1 focus:ring-rose-500 bg-white font-mono"
                      required
                    />
                  </div>
                </div>
                
                <textarea 
                  value={abnormalityNote}
                  onChange={(e) => setAbnormalityNote(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full p-2 text-xs border border-rose-200 rounded outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                  rows={3}
                ></textarea>
                
                <button 
                  onClick={handleLogAbnormality}
                  className="w-full py-2 bg-rose-600 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-rose-700 shadow-sm transition-colors"
                >
                  <Save className="w-3 h-3" /> Save Record
                </button>
              </div>
           </div>
         ) : null}

          {isResolvingAbnormality ? (
            <div className="p-4 bg-emerald-50 border-b border-emerald-100 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-emerald-800 text-xs uppercase">Resolve Active Abnormality</h4>
                <button onClick={() => setIsResolvingAbnormality(false)} className="text-emerald-500 hover:text-emerald-800"><X className="w-4 h-4" /></button>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-[2]">
                    <label className="text-[10px] text-emerald-800 font-bold uppercase mb-1 block opacity-70">Abnormality Type</label>
                    <input 
                      type="text" 
                      disabled 
                      value={`${activeAbnormalType.toUpperCase()} PROBLEM`}
                      className="w-full p-2 text-xs border border-emerald-200 rounded outline-none bg-emerald-100/30 text-emerald-800 font-black font-mono" 
                    />
                  </div>
                  <div className="flex-[1]">
                    <label className="text-[10px] text-emerald-800 font-bold uppercase mb-1 block opacity-70">Stop Time</label>
                    <input 
                      type="time" 
                      value={resolutionTime}
                      onChange={(e) => setResolutionTime(e.target.value)}
                      className="w-full p-2 text-xs border border-emerald-200 rounded outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-mono font-bold"
                    />
                  </div>
                </div>
                
                <textarea 
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Enter resolution actions taken..."
                  className="w-full p-2 text-xs border border-emerald-200 rounded outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                  rows={3}
                ></textarea>
                
                <button 
                  onClick={() => {
                    if (!resolutionNote) return;
                    
                    let downtimeMins = 0;
                    if (activeAbnormalStart && resolutionTime) {
                      const [shStr, smStr] = activeAbnormalStart.split(':');
                      const [ehStr, emStr] = resolutionTime.split(':');
                      const startMins = parseInt(shStr, 10) * 60 + parseInt(smStr, 10);
                      const endMins = parseInt(ehStr, 10) * 60 + parseInt(emStr, 10);
                      downtimeMins = endMins - startMins;
                      if (downtimeMins < 0) {
                        downtimeMins += 1440; // overnight gap
                      }
                    }

                    const recordNote = `[RESOLVED] Abnormality resolved. Start Time: ${activeAbnormalStart || '--:--'} • Stop Time: ${resolutionTime}. Note: ${resolutionNote}`;
                    
                    // Stop abnormality, add log record, and add job downtime in one single atomic transaction
                    setMachineAbnormal(
                      false, 
                      undefined, 
                      undefined, 
                      { type: 'success', note: recordNote },
                      downtimeMins,
                      activeJob.id
                    );

                    setIsResolvingAbnormality(false);
                    setResolutionNote('');
                    setResolutionTime('');
                  }}
                  disabled={!resolutionNote}
                  className={`w-full py-2 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors ${
                    !resolutionNote ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Save className="w-3 h-3" /> Save & Stop Abnormality
                </button>
              </div>
           </div>
          ) : null}

          {/* NG Reporting Form */}
          {isReportingNg ? (
            <div className="p-4 bg-amber-50 border-b border-amber-100 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-amber-800 text-xs uppercase">New NG Quality Record</h4>
                <button
                  onClick={() => {
                    localStorage.removeItem(PENDING_NG_LS_KEY);
                    setMachineNg(false);
                    setIsReportingNg(false);
                    setNgNote('');
                    setNgStartTime('');
                    setNgType('defect');
                  }}
                  className="text-amber-500 hover:text-amber-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {isNgActive && (
                <div className="mb-3 flex items-start gap-2 p-2.5 bg-amber-100 border border-amber-300 rounded text-[10px] text-amber-900 font-bold leading-snug">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-600" />
                  <span>Mesin sudah dalam status NG. Simpan record ini agar activity log tercatat dengan benar.</span>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-[2]">
                    <label className="text-[10px] text-amber-800 font-bold uppercase mb-1 block opacity-70">Kategori NG</label>
                    <select
                      value={ngType}
                      onChange={(e) => {
                        setNgType(e.target.value);
                        setMachineNg(true, e.target.value, ngStartTime);
                      }}
                      className="w-full p-2 text-xs border border-amber-200 rounded outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    >
                      <option value="defect">Cacat / Defect Part</option>
                      <option value="dimensional">Dimensi / Dimensional</option>
                      <option value="appearance">Penampilan / Appearance</option>
                      <option value="material">Material Problem</option>
                      <option value="mold">Mold / Cetakan</option>
                    </select>
                  </div>
                  <div className="flex-[1]">
                    <label className="text-[10px] text-amber-800 font-bold uppercase mb-1 block opacity-70">Mulai</label>
                    <input
                      type="time"
                      value={ngStartTime}
                      onChange={(e) => {
                        setNgStartTime(e.target.value);
                        setMachineNg(true, ngType, e.target.value);
                      }}
                      className="w-full p-2 text-xs border border-amber-200 rounded outline-none focus:ring-1 focus:ring-amber-500 bg-white font-mono"
                      required
                    />
                  </div>
                </div>
                <textarea
                  value={ngNote}
                  onChange={(e) => setNgNote(e.target.value)}
                  placeholder="Deskripsikan kondisi NG yang terjadi..."
                  className="w-full p-2 text-xs border border-amber-200 rounded outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  rows={3}
                />
                <button
                  onClick={() => {
                    if (!ngNote) return;
                    const formattedNote = `[NG START: ${ngStartTime || '--:--'} • ONGOING] ${ngNote}`;
                    setMachineNg(true, ngType, ngStartTime, {
                      type: 'warning',
                      note: formattedNote,
                      timeStr: ngStartTime
                    });
                    localStorage.removeItem(PENDING_NG_LS_KEY);
                    setIsReportingNg(false);
                    setNgNote('');
                    setNgStartTime('');
                  }}
                  className="w-full py-2 bg-amber-500 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-amber-600 shadow-sm transition-colors"
                >
                  <Save className="w-3 h-3" /> Save NG Record
                </button>
              </div>
            </div>
          ) : null}

          {/* NG Resolving Form */}
          {isResolvingNg ? (
            <div className="p-4 bg-green-50 border-b border-green-100 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-green-800 text-xs uppercase">Resolve NG Quality Issue</h4>
                <button onClick={() => setIsResolvingNg(false)} className="text-green-500 hover:text-green-800"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-[2]">
                    <label className="text-[10px] text-green-800 font-bold uppercase mb-1 block opacity-70">Tipe NG</label>
                    <input
                      type="text"
                      disabled
                      value={`${activeNgType.toUpperCase()} NG`}
                      className="w-full p-2 text-xs border border-green-200 rounded outline-none bg-green-100/30 text-green-800 font-black font-mono"
                    />
                  </div>
                  <div className="flex-[1]">
                    <label className="text-[10px] text-green-800 font-bold uppercase mb-1 block opacity-70">Selesai</label>
                    <input
                      type="time"
                      value={ngResolutionTime}
                      onChange={(e) => setNgResolutionTime(e.target.value)}
                      className="w-full p-2 text-xs border border-green-200 rounded outline-none focus:ring-1 focus:ring-green-500 bg-white font-mono font-bold"
                    />
                  </div>
                </div>
                <textarea
                  value={ngResolutionNote}
                  onChange={(e) => setNgResolutionNote(e.target.value)}
                  placeholder="Tindakan perbaikan parameter yang dilakukan..."
                  className="w-full p-2 text-xs border border-green-200 rounded outline-none focus:ring-1 focus:ring-green-500 bg-white"
                  rows={3}
                />
                <button
                  onClick={() => {
                    if (!ngResolutionNote) return;
                    const recordNote = `[NG RESOLVED] NG selesai. Start: ${activeNgStart || '--:--'} • Stop: ${ngResolutionTime}. Tindakan: ${ngResolutionNote}`;
                    setMachineNg(
                      false,
                      undefined,
                      undefined,
                      { type: 'success', note: recordNote }
                    );
                    setIsResolvingNg(false);
                    setNgResolutionNote('');
                    setNgResolutionTime('');
                  }}
                  disabled={!ngResolutionNote}
                  className={`w-full py-2 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors ${
                    !ngResolutionNote ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <Save className="w-3 h-3" /> Save & Selesaikan NG
                </button>
              </div>
            </div>
          ) : null}

         <div className="flex-1 max-h-[300px] md:max-h-none overflow-y-auto p-4 shrink-0">
            <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-slate-200">
               {filteredLogs.map((log, index) => (
                 <div key={log.id || index} className="relative pl-6">
                    <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 border-white flex items-center justify-center z-10
                      ${log.type === 'warning' || log.type === 'downtime' || log.type === 'defect' || log.type === 'material' || log.type === 'mold' ? 'bg-rose-100 text-rose-600' : 
                        log.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                        'bg-slate-100 text-slate-500'
                      }
                    `}>
                       {log.type === 'warning' || log.type === 'downtime' || log.type === 'defect' || log.type === 'material' || log.type === 'mold' ? <AlertTriangle className="w-3 h-3" /> : 
                        log.type === 'success' ? <CheckCircle className="w-3 h-3" /> :
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 mb-0.5">{log.time}</div>
                      <div className={`text-xs font-medium ${
                        log.type === 'warning' || log.type === 'downtime' || log.type === 'defect' || log.type === 'material' || log.type === 'mold' ? 'text-rose-800 font-bold' : 
                        log.type === 'success' ? 'text-emerald-700 font-bold' : 
                        'text-slate-700'
                      }`}>
                        {log.message}
                      </div>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* NG Qty Revision Panel — hanya untuk Leader / Planner */}
         {(role === 'leader' || role === 'planner') && (() => {
           const completedJobsWithNg = jobs.filter(j => j.status === 'completed');
           if (completedJobsWithNg.length === 0) return null;
           return (
             <div className="border-t border-slate-200 p-4 bg-amber-50/40">
               <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                 <AlertTriangle className="w-3 h-3" /> Revisi NG Qty Lot
                 <span className="text-[8px] text-amber-600 font-bold normal-case">— Pengawas Only</span>
               </h4>
               <div className="space-y-2">
                 {completedJobsWithNg.map((job) => {
                   const totalClosed = (job.closedOkQty ?? 0) + (job.closedNgQty ?? 0);
                   const isRevising = ngReviseJobId === job.id;
                   return (
                     <div key={job.id} className="bg-white border border-amber-200 rounded-lg overflow-hidden">
                       <button
                         onClick={() => {
                           if (isRevising) {
                             setNgReviseJobId(null);
                             setNgReviseError('');
                           } else {
                             setNgReviseJobId(job.id);
                             setNgReviseValue(job.closedNgQty ?? 0);
                             setNgRevisePin('');
                             setNgReviseError('');
                           }
                         }}
                         className="w-full px-3 py-2 flex justify-between items-center text-left hover:bg-amber-50 transition-colors"
                       >
                         <div>
                           <div className="text-[10px] font-black text-slate-700 font-mono">{job.model}</div>
                           <div className="text-[9px] text-slate-500 font-medium">
                             OK: <b className="text-emerald-700">{job.closedOkQty ?? '—'}</b> pcs &nbsp;|&nbsp; NG: <b className="text-rose-600">{job.closedNgQty ?? '—'}</b> pcs &nbsp;|&nbsp; Total: <b>{totalClosed || job.actualQty}</b> pcs
                           </div>
                         </div>
                         <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                           isRevising ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'
                         }`}>{isRevising ? 'Tutup' : 'Revisi'}</span>
                       </button>
                       {isRevising && (
                         <div className="px-3 pb-3 pt-1 border-t border-amber-100 space-y-2">
                           <div className="grid grid-cols-2 gap-2">
                             <div>
                               <label className="text-[9px] font-extrabold uppercase text-rose-600 block mb-1">Revised NG Qty</label>
                               <input
                                 type="number"
                                 min={0}
                                 max={totalClosed || job.actualQty}
                                 value={ngReviseValue}
                                 onChange={(e) => setNgReviseValue(Math.max(0, parseInt(e.target.value) || 0))}
                                 className="w-full px-2 py-1.5 border border-rose-200 rounded text-xs font-mono font-bold text-slate-800 outline-none focus:border-rose-500"
                               />
                             </div>
                             <div>
                               <label className="text-[9px] font-extrabold uppercase text-emerald-600 block mb-1">Resulting OK Qty</label>
                               <div className="w-full px-2 py-1.5 border border-emerald-100 rounded text-xs font-mono font-black text-emerald-700 bg-emerald-50">
                                 {Math.max(0, (totalClosed || job.actualQty) - ngReviseValue)} pcs
                               </div>
                             </div>
                           </div>
                           <input
                             type="password"
                             maxLength={4}
                             placeholder="Leader PIN (4 digit)"
                             value={ngRevisePin}
                             onChange={(e) => { setNgRevisePin(e.target.value); setNgReviseError(''); }}
                             className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono text-center font-bold tracking-widest outline-none focus:border-amber-500 bg-slate-50"
                           />
                           {ngReviseError && (
                             <div className="text-[9px] font-bold text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-100">{ngReviseError}</div>
                           )}
                           <button
                             onClick={async () => {
                               const leader = await verifyLeaderPin(ngRevisePin);
                               if (!leader) { setNgReviseError('PIN salah.'); return; }
                               const base = totalClosed || job.actualQty;
                               const newNg = Math.max(0, Math.min(base, ngReviseValue));
                               const newOk = Math.max(0, base - newNg);
                               reviseJobNgQty(
                                 job.id,
                                 newNg,
                                 newOk,
                                 { type: 'warning', note: `[NG REVISI] Leader ${leader.name} merevisi NG Qty lot ${job.model}: OK=${newOk}, NG=${newNg} pcs.` }
                               );
                               setNgReviseJobId(null);
                               setNgReviseError('');
                             }}
                             className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                           >
                             <Save className="w-3 h-3" /> Konfirmasi Revisi
                           </button>
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             </div>
           );
         })()}
      </div>

      {showPrintLabel && (
        <PrintLabelModal
          partNumber={activeJob.model}
          partName={activeJob.partName}
          customer={activeJob.customer}
          targetTotal={targetQty}
          labelQty={labelQty}
          onSuccess={handlePrintSuccess}
          onClose={() => setShowPrintLabel(false)}
          
          btDevice={btDevice}
          btCharacteristic={btCharacteristic}
          connectionStatus={connectionStatus}
          isPrintLocked={printLockStatus.isLocked}
          lockMessage={printLockStatus.message}
        />
      )}

      {showLeaderSignOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 text-left">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <span className="font-extrabold uppercase tracking-wider text-xs">Leader Lot Close Sign-Off</span>
              </div>
              <button 
                onClick={() => setShowLeaderSignOff(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Job Summary */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Part Number:</span>
                  <span className="font-extrabold text-slate-800">{activeJob.model || activeJob.partNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Part Name:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[180px]">{activeJob.partName}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200/60 font-extrabold">
                  <span className="text-slate-600 uppercase">Target Plan:</span>
                  <span className="text-slate-800">{targetQty} pcs</span>
                </div>
                <div className="flex justify-between font-black text-slate-700">
                  <span className="uppercase">Running Scan Qty:</span>
                  <span>{actualQty} pcs</span>
                </div>
                <div className="flex justify-between font-black border-t border-slate-200/45 pt-1.5 text-blue-600">
                  <span className="uppercase">Total Closed Qty:</span>
                  <span>{okQty + ngQty} pcs</span>
                </div>
              </div>

              {/* OK & NG Piece Entry (Jiritsuka Self-Guarantee) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600">OK Qty (pcs) *</label>
                  <input
                    type="number"
                    min={0}
                    value={okQty}
                    onChange={(e) => setOkQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-600 transition-colors bg-white font-mono font-bold text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600">NG Qty (pcs) *</label>
                  <input
                    type="number"
                    min={0}
                    value={ngQty}
                    onChange={(e) => setNgQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-rose-600 transition-colors bg-white font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Lot Verification Checklist</h4>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={checkQuality}
                      onChange={(e) => setCheckQuality(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="text-[11px] text-slate-700 font-bold leading-snug">
                      <span className="block font-extrabold uppercase tracking-wider text-slate-800 text-[9px] mb-0.5">Quality Inspection</span>
                      Last-off part quality matches standards & approved (NG: 0 pcs / under threshold).
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={checkCleanliness}
                      onChange={(e) => setCheckCleanliness(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="text-[11px] text-slate-700 font-bold leading-snug">
                      <span className="block font-extrabold uppercase tracking-wider text-slate-800 text-[9px] mb-0.5">5S & Changeover Readiness</span>
                      Work area cleaned, molds prepped, and next set-up instructions confirmed.
                    </div>
                  </label>
                </div>
              </div>

              {/* PIN input */}
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Leader Verification PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Enter 4-Digit Leader PIN"
                  value={signOffPin}
                  onChange={(e) => setSignOffPin(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-mono text-center font-bold tracking-widest bg-slate-50"
                />
              </div>

              {signOffError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 p-2.5 rounded text-[10px] font-bold text-center">
                  ⚠️ {signOffError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
              <button
                onClick={() => setShowLeaderSignOff(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-center bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSignOff}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" /> Confirm & Close Lot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
