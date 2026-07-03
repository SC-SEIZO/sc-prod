import React, { useMemo, useState } from 'react';
import { PackageSearch, ArrowRight, ShieldCheck, Settings2, Plus, X, Calendar, CheckCircle } from 'lucide-react';
import { useUserRole } from '../../context/UserContext';
import { useParts } from '../../context/PartsContext';
import { useProduction, Job, getUniqueMachineKey } from '../../context/ProductionContext';
import { Card } from '../ui/card';

interface MachinePartListViewProps {
  machine: string;
  factory: string;
  selectedDate?: string;
}

export function MachinePartListView({ machine, factory, selectedDate }: MachinePartListViewProps) {
  const { role, canEditPattern } = useUserRole();
  const { parts: partListDb } = useParts();
  const machineKey = getUniqueMachineKey(factory, machine);
  
  const { 
    jobs, 
    reorderMachineJobs, 
    dayOT, 
    nightOT 
  } = useProduction(machineKey, selectedDate);

  const [schedulingPart, setSchedulingPart] = useState<any | null>(null);
  const [qtyLot, setQtyLot] = useState('500');
  const [dandori, setDandori] = useState('15');

  const [notification, setNotification] = useState<string | null>(null);

  const triggerNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const formattedFactory = useMemo(() => {
    if (factory === 'FACT 2') return 'F2';
    if (factory === 'FACT 3') return 'F3';
    if (factory === 'FACT 4') return 'F4';
    return '';
  }, [factory]);

  const matchMachineSubstring = `${formattedFactory} ${machine}`;
  const matchMachineSubstringAlt = `${formattedFactory}${machine}`;

  const homeLineParts = useMemo(() => {
    return partListDb.filter(
      p => p.homeLine === matchMachineSubstring || p.homeLine === matchMachineSubstringAlt
    );
  }, [partListDb, matchMachineSubstring, matchMachineSubstringAlt]);

  const backupLineParts = useMemo(() => {
    return partListDb.filter(
      p => (p.backupLine === matchMachineSubstring || p.backupLine === matchMachineSubstringAlt) && 
           p.homeLine !== p.backupLine
    );
  }, [partListDb, matchMachineSubstring, matchMachineSubstringAlt]);

  const handleSchedulePartClick = (part: any) => {
    setSchedulingPart(part);
    // Set some smart default lot size if they are larger parts
    const tonnageNum = parseInt(part.tonnage) || 0;
    if (tonnageNum >= 2500) {
      setQtyLot('200'); // Larger parts run in smaller lots
    } else {
      setQtyLot('500');
    }
    setDandori('15'); // Standard dandori setup default is 15 mins
  };

  const handleAddPartToSequence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingPart) return;

    const parsedQty = parseInt(qtyLot) || 100;
    const parsedDandori = parseInt(dandori) || 0;
    
    const cavity = schedulingPart.cavity || 1;
    const ct = schedulingPart.cycleTime || 60;
    const runtimeMins = Math.round(((parsedQty / cavity) * ct) / 60);

    const newJob: Job = {
      id: `job-${Date.now()}`,
      seq: jobs.length + 1,
      customer: schedulingPart.customer || 'Unknown',
      model: schedulingPart.partNumber || schedulingPart.sebango,
      partName: schedulingPart.partName || 'No Name',
      qtyDay: Math.round(parsedQty / 5) || 50,
      qtyLot: parsedQty,
      actualQty: 0,
      mold: schedulingPart.mold || 'MOLD-01',
      material: schedulingPart.material || 'PP RESIN',
      kav: cavity,
      ct: ct,
      dandori: parsedDandori,
      time: runtimeMins,
      status: jobs.length === 0 ? 'dandori' : 'queued',
      timeRange: '',
      shift: 'day',
    };

    const newJobs = [...jobs, newJob];
    reorderMachineJobs(newJobs);

    setSchedulingPart(null);
    triggerNotification(`Part ${newJob.model} successfully added to production lineup!`);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6 relative">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-8 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-4 backdrop-blur-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{notification}</span>
        </div>
      )}

      {/* Scheduling Pop-up Modal */}
      {schedulingPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <Card className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200 text-left">
            <div className="p-4 border-b border-slate-100 bg-[#037233] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5" />
                <div>
                  <h3 className="font-bold text-xs tracking-wide">Schedule Production Job</h3>
                  <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider mt-0.5 font-mono">{schedulingPart.partNumber || schedulingPart.sebango}</p>
                </div>
              </div>
              <button 
                onClick={() => setSchedulingPart(null)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPartToSequence} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/50 text-xs space-y-1.5 font-medium text-slate-700">
                <div>Part Name: <b className="text-slate-900">{schedulingPart.partName}</b></div>
                <div>Model / Customer: <b className="text-slate-900">{schedulingPart.model} / {schedulingPart.customer}</b></div>
                <div>Cavity: <b className="text-slate-900">{schedulingPart.cavity}</b> | Cycle Time: <b className="text-slate-900">{schedulingPart.cycleTime}s</b></div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Target Production Qty (Lot Target) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={qtyLot}
                  onChange={(e) => setQtyLot(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Dandori Setup Time (Minutes)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={dandori}
                  onChange={(e) => setDandori(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white font-bold"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setSchedulingPart(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#037233] hover:bg-[#025c27] text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-950/15 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Queue
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        
        {/* Home Line Parts */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <PackageSearch className="w-5 h-5 text-emerald-600" />
                Registered Part List (Home Machine)
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs uppercase tracking-wider ml-2">
                  {homeLineParts.length} Parts
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Parts naturally allocated to this machine for daily production.
              </p>
            </div>
          </div>

          <div className="bg-white border text-left rounded-lg shadow-sm overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold text-slate-600">Sebango / Part No</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Part Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Model / Customer</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 border-l border-slate-200 bg-slate-50">Material</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center border-l border-slate-200 bg-slate-50">Cycle Time</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center border-l border-slate-200 bg-slate-50">Dandori</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center border-l border-slate-200 bg-slate-50">Shikake</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center border-l border-slate-200 bg-slate-50">Backup Machine</th>
                    {canEditPattern && <th className="px-4 py-3 font-semibold text-slate-600 text-center border-l border-slate-200 bg-slate-50">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {homeLineParts.length > 0 ? (
                    homeLineParts.map((part, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-800 text-[13px]">{part.sebango}</div>
                          <div className="text-[11px] text-slate-500 max-w-[160px] truncate" title={part.partNumber}>{part.partNumber || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-700">{part.partName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 text-[10px] font-bold rounded bg-slate-200 text-slate-700 mr-2">{part.model}</span>
                          <span className="text-slate-500 text-xs">{part.customer}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate border-l border-slate-100 bg-slate-50/30" title={part.material}>
                          {part.material || '-'}
                        </td>
                        <td className="px-4 py-3 text-center border-l border-slate-100 bg-slate-50/30">
                           <div className="font-mono font-bold text-slate-700">{part.cycleTime}s</div>
                        </td>
                        <td className="px-4 py-3 text-center border-l border-slate-100 bg-slate-50/30">
                           <div className="font-mono font-bold text-slate-700">{part.dandori || 15} mins</div>
                        </td>
                        <td className="px-4 py-3 text-center border-l border-slate-100 bg-slate-50/30">
                           <div className="font-mono font-bold text-slate-700">{part.shikake || 2}x / day</div>
                        </td>
                        <td className="px-4 py-3 text-center border-l border-slate-100 bg-slate-50/30">
                          {part.backupLine && part.backupLine !== part.homeLine ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-amber-700 bg-amber-50 font-mono text-[11px] font-bold border border-amber-200">
                              {part.backupLine}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        {canEditPattern && (
                          <td className="px-4 py-3 text-center border-l border-slate-100 bg-slate-50/30">
                            <button
                              onClick={() => handleSchedulePartClick(part)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer mx-auto"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Schedule
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={canEditPattern ? 9 : 8} className="px-4 py-12 text-center text-slate-400 bg-slate-50/50">
                        No home parts registered to this machine.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Backup Line Parts */}
        <section>
          <div className="flex flex-col mb-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Backup Part List
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs uppercase tracking-wider ml-2">
                {backupLineParts.length} Parts
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Parts allocated here as a backup if their home machine encounters structural abnormalities or breakdown.
            </p>
          </div>

          <div className="bg-white border text-left rounded-lg shadow-sm overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 font-semibold text-slate-600">Sebango / Part No</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Part Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Model / Customer</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center bg-slate-50 border-l border-slate-200">Cycle Time</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center bg-slate-50 border-l border-slate-200">Dandori</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center bg-slate-50 border-l border-slate-200">Shikake</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center bg-slate-50 border-l border-slate-200">Home Machine</th>
                    {canEditPattern && <th className="px-4 py-3 font-semibold text-slate-600 text-center bg-slate-50 border-l border-slate-200">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backupLineParts.length > 0 ? (
                    backupLineParts.map((part, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-800 text-[13px]">{part.sebango}</div>
                          <div className="text-[11px] text-slate-500 max-w-[160px] truncate" title={part.partNumber}>{part.partNumber || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-700">{part.partName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 text-[10px] font-bold rounded bg-slate-200 text-slate-700 mr-2">{part.model}</span>
                          <span className="text-slate-500 text-xs">{part.customer}</span>
                        </td>
                        <td className="px-4 py-3 text-center border-l bg-slate-50/30 border-slate-100">
                          <div className="font-mono font-bold text-slate-700">{part.cycleTime}s</div>
                        </td>
                        <td className="px-4 py-3 text-center border-l bg-slate-50/30 border-slate-100">
                          <div className="font-mono font-bold text-slate-700">{part.dandori || 15} mins</div>
                        </td>
                        <td className="px-4 py-3 text-center border-l bg-slate-50/30 border-slate-100">
                          <div className="font-mono font-bold text-slate-700">{part.shikake || 2}x / day</div>
                        </td>
                        <td className="px-4 py-3 text-center border-l bg-slate-50/30 border-slate-100">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {part.homeLine} <ArrowRight className="w-3 h-3 text-amber-500" /> Here
                          </span>
                        </td>
                        {canEditPattern && (
                          <td className="px-4 py-3 text-center border-l bg-slate-50/30 border-slate-100">
                            <button
                              onClick={() => handleSchedulePartClick(part)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer mx-auto"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Schedule
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={canEditPattern ? 8 : 7} className="px-4 py-12 text-center text-slate-400 bg-slate-50/50">
                        No backup parts registered to this machine.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
