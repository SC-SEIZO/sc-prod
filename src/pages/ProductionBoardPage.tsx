import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Factory, AlertCircle, Settings2, Play, Info, LogOut } from 'lucide-react';
import { MachineDetailModal } from '../components/production/MachineDetailModal';
import { ProductionContext, getUniqueMachineKey, getHeijunkaJobsForMachine, getTodayDateString } from '../context/ProductionContext';
import { useParts } from '../context/PartsContext';
import { useUserRole } from '../context/UserContext';
import { PLANT_LAYOUT } from '../data/machineLayout';
import { InjectionMoldingIcon } from './ProductionPage';
import { TabletControls } from '../components/layout/TabletControls';

type MachineStatus = 'running' | 'dandori' | 'ng' | 'abnormal' | 'abnormal-critical' | 'idle';

// Circled "Q" quality mark for machines currently flagged NG
const QualityQIcon = ({ className = '' }: { className?: string }) => (
  <span
    className={`rounded-full border-[3px] border-current font-black flex items-center justify-center leading-none shrink-0 ${className}`}
  >
    Q
  </span>
);

const STATUS_STYLE: Record<MachineStatus, { btn: string; label: string }> = {
  running: {
    btn: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-400',
    label: 'Running'
  },
  dandori: {
    btn: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-400',
    label: 'Dandori'
  },
  ng: {
    btn: 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.55)]',
    label: 'NG'
  },
  abnormal: {
    btn: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-400',
    label: 'Abnormal'
  },
  'abnormal-critical': {
    btn: 'bg-rose-200 hover:bg-rose-300 text-rose-950 border-rose-600 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.95)] ring-2 ring-rose-500/50',
    label: 'Abnormal >1H'
  },
  idle: {
    btn: 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300',
    label: 'Idle'
  }
};

const StatusIcon = ({ status, className }: { status: MachineStatus; className: string }) => {
  switch (status) {
    case 'running':
      return <Play className={className} />;
    case 'dandori':
      return <Settings2 className={`${className} animate-spin`} style={{ animationDuration: '6s' }} />;
    case 'ng':
      return <QualityQIcon className={className} />;
    case 'abnormal':
      return <AlertCircle className={className} />;
    case 'abnormal-critical':
      return <AlertCircle className={`${className} animate-bounce`} />;
    case 'idle':
    default:
      return <Info className={className} />;
  }
};

export function ProductionBoardPage() {
  const { setRole } = useUserRole();
  const { parts } = useParts();
  const prodContext = useContext(ProductionContext);
  const machineJobs = prodContext?.machineJobs || {};
  const machineAvgJobs = prodContext?.machineAvgJobs || {};
  const dayOTs = prodContext?.dayOTs || {};
  const nightOTs = prodContext?.nightOTs || {};
  const activeAbnormalities = prodContext?.activeAbnormalities || {};
  const activeNgs = prodContext?.activeNgs || {};

  const [selectedMachine, setSelectedMachine] = useState<{ machine: string; tonnage: string; factory: string } | null>(null);

  // Live clock — also drives periodic status/shift re-evaluation
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayStr = getTodayDateString();

  // Resolve the live status of a machine (same rules as the Production page)
  const resolveStatus = (factoryName: string, machineId: string): MachineStatus => {
    const machineKey = getUniqueMachineKey(factoryName, machineId);
    const compositeKey = `${todayStr}_${machineKey}`;

    const activeAbnormal = activeAbnormalities[compositeKey];
    const isAbnormal = activeAbnormal ? activeAbnormal.isAbnormal : false;

    if (isAbnormal) {
      // Critical when the abnormality has lasted for more than 1 hour
      try {
        if (activeAbnormal?.start) {
          const [h, m] = activeAbnormal.start.split(':').map(Number);
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
          if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);
          const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
          if (diffHours > 1) return 'abnormal-critical';
        }
      } catch (e) {
        // fall through to plain abnormal
      }
      return 'abnormal';
    }

    const activeNgState = activeNgs[compositeKey];
    if (activeNgState ? activeNgState.isNg : false) return 'ng';

    // Resolve daily plan exactly like useProduction in context
    const rawJobs = machineJobs[compositeKey];
    const monthStr = todayStr.substring(0, 7);
    const avgKey = `${monthStr}_avg_${machineKey}`;
    const rawAvgJobs = machineAvgJobs[avgKey];

    const avgJobs = (rawAvgJobs && rawAvgJobs.length > 0)
      ? rawAvgJobs
      : getHeijunkaJobsForMachine(machineKey, dayOTs[compositeKey] || 'teiji', nightOTs[compositeKey] || 'teiji', todayStr, parts);

    const jobs = (rawJobs && rawJobs.length > 0) ? rawJobs : avgJobs;

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const isNightShiftTime = currentMins < 435 || currentMins >= 1260;
    const currentShift = isNightShiftTime ? 'night' : 'day';

    const shiftJobs = jobs.filter(j => j.shift === currentShift || (currentShift === 'night' && j.shift === 'overflow'));
    if (shiftJobs.length === 0) return 'idle';

    const activeJob =
      shiftJobs.find(j => j.status === 'running') ||
      shiftJobs.find(j => j.status === 'dandori') ||
      shiftJobs.find(j => j.status !== 'completed');

    if (!activeJob) return 'idle';
    if (activeJob.status === 'dandori') return 'dandori';
    return 'running';
  };

  // Flat navigation list for the detail modal prev/next buttons
  const allMachinesList = useMemo(() => {
    const list: { id: string; tonnage: string; factory: string }[] = [];
    PLANT_LAYOUT.forEach(plant => {
      plant.factories.forEach(fact => {
        fact.machines.forEach(mc => list.push({ id: mc.id, tonnage: mc.tonnage, factory: fact.name }));
      });
    });
    return list;
  }, []);

  const handleNavigateMachine = (direction: 'next' | 'prev') => {
    if (!selectedMachine) return;
    const currentIndex = allMachinesList.findIndex(
      m => m.id === selectedMachine.machine && m.factory === selectedMachine.factory
    );
    if (currentIndex === -1) return;
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % allMachinesList.length
      : (currentIndex - 1 + allMachinesList.length) % allMachinesList.length;
    const target = allMachinesList[newIndex];
    setSelectedMachine({ machine: target.id, tonnage: target.tonnage, factory: target.factory });
  };

  const factoryRows = PLANT_LAYOUT.flatMap(plant =>
    plant.factories.map(fact => ({ plant: plant.plant, ...fact }))
  );

  // Uniform machine button width: every row uses the same column count as the
  // widest factory (FACT 3), so all machine cards are exactly the same size.
  const maxCols = Math.max(...factoryRows.map(f => f.machines.length));

  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-100 text-slate-800 select-none">
      {/* Header — Sugity green */}
      <header className="h-16 shrink-0 flex items-center justify-between px-5 gap-4 bg-gradient-to-r from-[#037233] via-[#04873c] to-[#025c27] text-white shadow-[0_8px_30px_-4px_rgba(3,114,51,0.4)] border-b border-[#04873c]/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-[64px] h-[42px] flex items-center justify-center shrink-0 bg-white rounded-lg p-1 shadow-sm">
            <img src="/logo.png" alt="SC Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-black tracking-wider uppercase leading-tight truncate drop-shadow-sm">Production Board</span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-white/80 leading-none mt-0.5 truncate">
              All Plant Production Monitor — SC1 &amp; SC2
            </span>
          </div>

          {/* Resin Injection process card */}
          <div className="hidden md:flex items-center gap-2.5 ml-3 px-3.5 py-1.5 bg-white rounded-xl border border-white/40 shadow-md shrink-0">
            <InjectionMoldingIcon className="w-8 h-8" />
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-black uppercase tracking-wider text-slate-800">Resin Injection</span>
              <span className="text-[8px] font-extrabold uppercase tracking-widest text-[#E76114] mt-1">Injection Molding Process</span>
            </div>
          </div>
        </div>

        {/* Status Legend */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-emerald-100 text-[10px] font-bold uppercase tracking-wider">
            <Play className="w-3 h-3" /> Running
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-blue-100 text-[10px] font-bold uppercase tracking-wider">
            <Settings2 className="w-3 h-3 animate-spin" style={{ animationDuration: '6s' }} /> Dandori
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-amber-100 text-[10px] font-bold uppercase tracking-wider">
            <QualityQIcon className="w-3.5 h-3.5 text-[8px]" /> NG
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-rose-100 text-[10px] font-bold uppercase tracking-wider">
            <AlertCircle className="w-3 h-3" /> Abnormal
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 border border-white/25 text-white/70 text-[10px] font-bold uppercase tracking-wider">
            <Info className="w-3 h-3" /> Idle
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <TabletControls />
          <div className="text-right">
            <div className="text-xl font-black font-mono tracking-widest leading-none drop-shadow-sm">{timeStr}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/80 mt-1">{dateStr}</div>
          </div>
          <button
            onClick={() => setRole('guest')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-rose-500/80 border border-white/25 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Keluar dari Production Board"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Board: one row per factory, everything fits a single Full HD screen */}
      <main className="flex-1 min-h-0 p-3 flex flex-col gap-3">
        {factoryRows.map(fact => {
          const statuses = fact.machines.map(mc => resolveStatus(fact.name, mc.id));
          const runningCount = statuses.filter(s => s === 'running').length;
          const problemCount = statuses.filter(s => s === 'abnormal' || s === 'abnormal-critical' || s === 'ng').length;

          return (
            <section
              key={fact.name}
              className="flex-1 min-h-0 flex items-stretch gap-3 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm"
            >
              {/* Factory label — Sugity orange */}
              <div className="w-44 shrink-0 flex flex-col justify-center px-3 rounded-xl bg-gradient-to-br from-[#E76114] to-[#c95411] text-white shadow-md">
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest mb-1 text-white/85">
                  <Factory className="w-3 h-3" /> {fact.plant}
                </span>
                <span className="text-xl font-black uppercase tracking-wide leading-tight drop-shadow-sm">{fact.name}</span>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold">
                  <span className="text-emerald-100">{runningCount} Run</span>
                  <span className="text-white/50">•</span>
                  <span className={problemCount > 0 ? 'text-rose-100' : 'text-white/70'}>{problemCount} Issue</span>
                  <span className="text-white/50">•</span>
                  <span className="text-white/85">{fact.machines.length} MC</span>
                </div>
              </div>

              {/* Machine buttons — uniform width across ALL factories (matches FACT 3) */}
              <div
                className="flex-1 min-w-0 grid gap-2"
                style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}
              >
                {fact.machines.map((mc, k) => {
                  const status = statuses[k];
                  const style = STATUS_STYLE[status];

                  const btn = (
                    <button
                      onClick={() => setSelectedMachine({ machine: mc.id, tonnage: mc.tonnage, factory: fact.name })}
                      className={`w-full h-full min-w-0 border-2 rounded-md transition-all duration-300 cursor-pointer font-bold flex flex-col items-center justify-center gap-1.5 shadow-sm px-1 ${style.btn}`}
                      title={`${fact.name} ${mc.id} — ${style.label}`}
                    >
                      <StatusIcon status={status} className="w-7 h-7 text-[15px]" />
                      <span className="text-lg xl:text-xl font-black leading-none tracking-tight whitespace-nowrap">{mc.id}</span>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-80 whitespace-nowrap">{style.label}</span>
                    </button>
                  );

                  if (status === 'abnormal' || status === 'abnormal-critical') {
                    return (
                      <div key={mc.id} className={`abnormal-wave-wrapper w-full h-full min-w-0${status === 'abnormal-critical' ? ' critical' : ''}`}>
                        {btn}
                      </div>
                    );
                  }
                  if (status === 'ng') {
                    return (
                      <div key={mc.id} className="ng-wave-wrapper w-full h-full min-w-0">
                        {btn}
                      </div>
                    );
                  }
                  return <React.Fragment key={mc.id}>{btn}</React.Fragment>;
                })}
              </div>
            </section>
          );
        })}
      </main>

      {/* Machine detail — same Resin Injection Control as the Viewer flow */}
      {selectedMachine && (
        <MachineDetailModal
          machine={selectedMachine.machine}
          tonnage={selectedMachine.tonnage}
          factory={selectedMachine.factory}
          onClose={() => setSelectedMachine(null)}
          onNavigate={handleNavigateMachine}
          initialDate={todayStr}
        />
      )}
    </div>
  );
}
