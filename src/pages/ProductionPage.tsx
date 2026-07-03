import React, { useState, useContext } from 'react';
import { Card } from '../components/ui/card';
import { Factory, Droplet, Paintbrush, AlertCircle, Settings2, Info, Play, Calendar } from 'lucide-react';
import { MachineDetailModal } from '../components/production/MachineDetailModal';
import { ProductionContext, getUniqueMachineKey, getHeijunkaJobsForMachine, getTodayDateString } from '../context/ProductionContext';
import { useParts } from '../context/PartsContext';
import { PLANT_LAYOUT } from '../data/machineLayout';

export const InjectionMoldingIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 512 512" 
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Base of machine */}
    <rect x="20" y="300" width="472" height="160" rx="12" fill="#E2E8F0" stroke="#0F172A" strokeWidth="20" strokeLinejoin="round" />
    
    {/* Control Screen on Base */}
    <rect x="50" y="335" width="100" height="90" rx="8" fill="#FFFFFF" stroke="#0F172A" strokeWidth="16" strokeLinejoin="round" />
    <line x1="65" y1="365" x2="135" y2="365" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />
    <line x1="65" y1="395" x2="115" y2="395" stroke="#94A3B8" strokeWidth="10" strokeLinecap="round" />

    {/* Buttons on Base */}
    <rect x="180" y="360" width="40" height="30" rx="4" fill="#64748B" stroke="#0F172A" strokeWidth="12" strokeLinejoin="round" />
    <rect x="240" y="360" width="40" height="30" rx="4" fill="#64748B" stroke="#0F172A" strokeWidth="12" strokeLinejoin="round" />
    <rect x="300" y="360" width="40" height="30" rx="4" fill="#64748B" stroke="#0F172A" strokeWidth="12" strokeLinejoin="round" />

    {/* Bottom slits */}
    <line x1="370" y1="425" x2="370" y2="445" stroke="#0F172A" strokeWidth="12" strokeLinecap="round" />
    <line x1="410" y1="425" x2="410" y2="445" stroke="#0F172A" strokeWidth="12" strokeLinecap="round" />
    <line x1="450" y1="425" x2="450" y2="445" stroke="#0F172A" strokeWidth="12" strokeLinecap="round" />

    {/* Clamping unit / Mold plate (Left) */}
    <rect x="30" y="120" width="250" height="180" rx="8" fill="#CBD5E1" stroke="#0F172A" strokeWidth="20" strokeLinejoin="round" />
    {/* Mold window/cavity */}
    <rect x="65" y="150" width="180" height="120" rx="6" fill="#94A3B8" stroke="#0F172A" strokeWidth="18" strokeLinejoin="round" />
    <line x1="155" y1="150" x2="155" y2="270" stroke="#0F172A" strokeWidth="14" />

    {/* Injection Cylinder/Nozzle (Middle) */}
    <path d="M245 210l65-20v40z" fill="#64748B" stroke="#0F172A" strokeWidth="16" strokeLinejoin="round" />
    <rect x="310" y="185" width="40" height="50" rx="4" fill="#475569" stroke="#0F172A" strokeWidth="16" strokeLinejoin="round" />

    {/* Hopper / Barrel unit (Right) */}
    <rect x="350" y="200" width="70" height="100" rx="6" fill="#CBD5E1" stroke="#0F172A" strokeWidth="20" strokeLinejoin="round" />
    <rect x="365" y="100" width="40" height="100" fill="#94A3B8" stroke="#0F172A" strokeWidth="18" strokeLinejoin="round" />
    {/* Hopper funnel */}
    <path d="M325 50h120l-25 50h-70z" fill="#E2E8F0" stroke="#0F172A" strokeWidth="20" strokeLinejoin="round" />
    {/* Right side box/cabinet */}
    <rect x="410" y="110" width="75" height="100" rx="8" fill="#94A3B8" stroke="#0F172A" strokeWidth="18" strokeLinejoin="round" />
  </svg>
);

const PaintingRobotIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 512 512" 
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Base turntable / curved body at the bottom */}
    <path d="M230 460h80" stroke="#0F172A" strokeWidth="24" strokeLinecap="round" />
    <path d="M270 360v100" stroke="#0F172A" strokeWidth="24" strokeLinecap="round" />
    <path d="M220 370c-25 0-45-20-45-45s20-45 45-45h100c25 0 45 20 45 45s-20 45-45 45z" fill="#CBD5E1" stroke="#0F172A" strokeWidth="20" strokeLinejoin="round" />

    {/* Controller base panel on bottom right */}
    <rect x="330" y="340" width="130" height="120" rx="16" fill="#E2E8F0" stroke="#0F172A" strokeWidth="20" strokeLinejoin="round" />
    <circle cx="370" cy="380" r="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="12" />
    <circle cx="370" cy="420" r="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="12" />
    <line x1="405" y1="380" x2="435" y2="380" stroke="#0F172A" strokeWidth="16" strokeLinecap="round" />
    <line x1="405" y1="420" x2="435" y2="420" stroke="#0F172A" strokeWidth="16" strokeLinecap="round" />

    {/* Lower arm segment */}
    <path d="M270 280L410 110" stroke="#0F172A" strokeWidth="52" strokeLinecap="round" />
    <path d="M270 280L410 110" stroke="#94A3B8" strokeWidth="32" strokeLinecap="round" />
    <line x1="300" y1="243" x2="380" y2="147" stroke="#0F172A" strokeWidth="12" strokeLinecap="round" />

    {/* Elbow Joint (Top Right) */}
    <circle cx="410" cy="110" r="40" fill="#CBD5E1" stroke="#0F172A" strokeWidth="20" />
    <circle cx="410" cy="110" r="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="10" />

    {/* Upper arm segment */}
    <path d="M410 110L200 60" stroke="#0F172A" strokeWidth="52" strokeLinecap="round" />
    <path d="M410 110L200 60" stroke="#94A3B8" strokeWidth="32" strokeLinecap="round" />
    <line x1="375" y1="102" x2="235" y2="68" stroke="#0F172A" strokeWidth="12" strokeLinecap="round" />

    {/* Wrist Joint (Left) */}
    <circle cx="200" cy="60" r="40" fill="#CBD5E1" stroke="#0F172A" strokeWidth="20" />
    <circle cx="200" cy="60" r="12" fill="#FFFFFF" stroke="#0F172A" strokeWidth="10" />

    {/* Nozzle Mount */}
    <path d="M180 80l-35 35" stroke="#0F172A" strokeWidth="24" strokeLinecap="round" />
    {/* Nozzle tip */}
    <path d="M145 115l-15 15c-6 6-16 6-22 0l-10-10c-6-6-6-16 0-22l15-15z" fill="#E2E8F0" stroke="#0F172A" strokeWidth="20" strokeLinejoin="round" />
    <path d="M110 100l-25 25" stroke="#0F172A" strokeWidth="20" strokeLinecap="round" />

    {/* Spray paint mist/dashed lines */}
    <path d="M70 140L10 150" stroke="#0F172A" strokeWidth="20" strokeDasharray="20 20" strokeLinecap="round" />
    <path d="M75 165L20 200" stroke="#0F172A" strokeWidth="20" strokeDasharray="20 20" strokeLinecap="round" />
    <path d="M80 185L35 250" stroke="#0F172A" strokeWidth="20" strokeDasharray="20 20" strokeLinecap="round" />
    <path d="M85 200L55 295" stroke="#0F172A" strokeWidth="20" strokeDasharray="20 20" strokeLinecap="round" />
  </svg>
);

// Machine layout comes from the shared canonical source; FUKA numbers are
// recalculated dynamically from the production plans below.
const resinData = PLANT_LAYOUT.map(p => ({
  plant: p.plant,
  factories: p.factories.map(f => ({
    name: f.name,
    machines: f.machines,
    fuka: 0,
    maxFuka: 21,
    status: 'Normal'
  }))
}));

const paintingData = [
  {
    plant: 'SC1 (Cibitung)',
    lines: [
      { name: 'MBF4 (Main Booth)', fuka: 20.1, maxFuka: 21, status: 'Over', note: 'Strengthen BCP (Stock & Backup)' },
      { name: 'SBF3 (Small Booth)', fuka: 17.2, maxFuka: 21, status: 'Normal', note: 'T/T Keep: Booth #1 4.0\'' }
    ]
  },
  {
    plant: 'SC2 (Karawang)',
    lines: [
      { name: 'Line 1', fuka: 16.7, maxFuka: 21, status: 'Normal', note: 'T/T Keep: 1.6\'' },
      { name: 'Line 2', fuka: 13.6, maxFuka: 21, status: 'Normal', note: 'Backup for SC1 MBF4' }
    ]
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Over': return 'bg-rose-500';
    case 'Warning': return 'bg-amber-500';
    case 'Normal': return 'bg-emerald-500';
    default: return 'bg-emerald-500';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'Over': return 'text-rose-700 bg-rose-100';
    case 'Warning': return 'text-amber-700 bg-amber-100';
    case 'Normal': return 'text-emerald-700 bg-emerald-100';
    default: return 'text-emerald-700 bg-emerald-100';
  }
};

export function ProductionPage() {
  const [selectedMachine, setSelectedMachine] = useState<{ machine: string, tonnage: string, factory: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'resin' | 'painting'>('resin');
  
  const { parts } = useParts();
  const prodContext = useContext(ProductionContext);
  const machineJobs = prodContext?.machineJobs || {};
  const machineAvgJobs = prodContext?.machineAvgJobs || {};
  const dayOTs = prodContext?.dayOTs || {};
  const nightOTs = prodContext?.nightOTs || {};
  const activeAbnormalities = prodContext?.activeAbnormalities || {};
  const activeNgs = prodContext?.activeNgs || {};

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);
  const todayStr = selectedDate;

  // Calculate plant-level and machine-level FUKA dynamically based on jobs assigned to those lines
  const dynamicResinData = React.useMemo(() => {
    return resinData.map(plantGroup => {
      const updatedFactories = plantGroup.factories.map(fact => {
        let totalLoadMins = 0;
        const machineCount = fact.machines.length;
        
        fact.machines.forEach(mc => {
          const machineKey = getUniqueMachineKey(fact.name, mc.id);
          const compositeKey = `${todayStr}_${machineKey}`;
          
          // Resolve daily plan exactly like useProduction in context
          const rawJobs = machineJobs[compositeKey];
          const monthStr = todayStr.substring(0, 7);
          const avgKey = `${monthStr}_avg_${machineKey}`;
          const rawAvgJobs = machineAvgJobs[avgKey];
          
          const avgJobs = (rawAvgJobs && rawAvgJobs.length > 0)
            ? rawAvgJobs
            : getHeijunkaJobsForMachine(machineKey, dayOTs[compositeKey] || 'teiji', nightOTs[compositeKey] || 'teiji', todayStr, parts);
            
          const jobs = (rawJobs && rawJobs.length > 0)
            ? rawJobs
            : avgJobs;

          const machineMins = jobs.reduce((sum, job) => sum + (job.time || 0) + (job.dandori || 0), 0);
          totalLoadMins += machineMins;
        });
        
        const fukaLoadHours = machineCount > 0 ? (totalLoadMins / 60) / machineCount : 0;
        
        // Determine status dynamically
        let status: 'Normal' | 'Warning' | 'Over' = 'Normal';
        if (fukaLoadHours >= 20.0) {
          status = 'Over';
        } else if (fukaLoadHours >= 18.0) {
          status = 'Warning';
        }
        
        return {
          ...fact,
          fuka: fukaLoadHours,
          status
        };
      });
      
      return {
        ...plantGroup,
        factories: updatedFactories
      };
    });
  }, [machineJobs, machineAvgJobs, dayOTs, nightOTs, todayStr]);

  // Flatten all machines in order to navigate easily
  const allMachinesList = React.useMemo(() => {
    const list: { id: string, tonnage: string, factory: string }[] = [];
    dynamicResinData.forEach(plant => {
      plant.factories.forEach(fact => {
        fact.machines.forEach(mc => {
          list.push({ id: mc.id, tonnage: mc.tonnage, factory: fact.name });
        });
      });
    });
    return list;
  }, [dynamicResinData]);

  const handleNavigateMachine = (direction: 'next' | 'prev') => {
    if (!selectedMachine) return;
    const currentIndex = allMachinesList.findIndex(
      m => m.id === selectedMachine.machine && m.factory === selectedMachine.factory
    );
    if (currentIndex === -1) return;
    
    let newIndex = currentIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % allMachinesList.length;
    } else {
      newIndex = (currentIndex - 1 + allMachinesList.length) % allMachinesList.length;
    }
    
    const target = allMachinesList[newIndex];
    setSelectedMachine({ machine: target.id, tonnage: target.tonnage, factory: target.factory });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Machine FUKA Control</h2>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-1">Manage operation time and load capacity</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Premium Date Selector */}
          <div className="h-10 flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 bg-white text-slate-700 font-bold text-xs shadow-sm shrink-0">
            <Calendar className="w-4 h-4 text-blue-600 stroke-[2.5] shrink-0" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer font-black text-slate-750 text-xs font-sans border-none p-0 outline-none w-[115px]"
            />
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full shrink-0 h-10 items-center">
            <button
              onClick={() => setActiveTab('resin')}
              className={`h-8 px-4 text-sm font-bold rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'resin' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <InjectionMoldingIcon className="w-5 h-5" /> Resin Injection
            </button>
            <button
              onClick={() => setActiveTab('painting')}
              className={`h-8 px-4 text-sm font-bold rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'painting' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <PaintingRobotIcon className="w-5 h-5" /> Painting
            </button>
          </div>
        </div>
      </div>

      {/* Premium Machine Status Legend */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <div>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Status Indikator Mesin</span>
            <span className="text-[10px] text-slate-400 font-medium">Keterangan warna & kondisi operasional mesin</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-bold transition-all hover:scale-105 hover:bg-emerald-100/50">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>Running</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200/70 text-blue-700 text-xs font-bold transition-all hover:scale-105 hover:bg-blue-100/50">
            <Settings2 className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Dandori / Set-up</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300/70 text-amber-700 text-xs font-bold transition-all hover:scale-105 hover:bg-amber-100/50">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span>Sedang NG (Quality)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200/70 text-rose-700 text-xs font-bold transition-all hover:scale-105 hover:bg-rose-100/50">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span>Abnormal Stop</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold transition-all hover:scale-105 hover:bg-slate-100/50">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Idle (No Plan)</span>
          </div>
        </div>
      </div>

      {activeTab === 'resin' && (
        <section>
          <div className="flex flex-col gap-6 mt-4">
          {dynamicResinData.map((plantGroup, i) => (
            <Card key={i} className="p-0 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Factory className="w-4 h-4 text-slate-400" />
                <h4 className="font-bold text-slate-700 text-sm">{plantGroup.plant}</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {plantGroup.factories.map((fact, j) => (
                  <div key={j} className="p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-black text-slate-800">{fact.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest ${getStatusText(fact.status)}`}>
                            {fact.status}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 font-mono flex flex-wrap gap-3 mt-3">
                          {fact.machines.map((mc, k) => {
                            const machineKey = getUniqueMachineKey(fact.name, mc.id);
                            const compositeKey = `${todayStr}_${machineKey}`;
                            // Check active abnormality reactively from context
                            const activeAbnormal = activeAbnormalities[compositeKey];
                            const isAbnormal = activeAbnormal ? activeAbnormal.isAbnormal : false;

                            // Check active NG from context
                            const activeNgState = activeNgs[compositeKey];
                            const isNgActive = !isAbnormal && (activeNgState ? activeNgState.isNg : false);
                            
                            // Resolve daily plan exactly like useProduction in context
                            const rawJobs = machineJobs[compositeKey];
                            const monthStr = todayStr.substring(0, 7);
                            const avgKey = `${monthStr}_avg_${machineKey}`;
                            const rawAvgJobs = machineAvgJobs[avgKey];
                            
                            const avgJobs = (rawAvgJobs && rawAvgJobs.length > 0)
                              ? rawAvgJobs
                              : getHeijunkaJobsForMachine(machineKey, dayOTs[compositeKey] || 'teiji', nightOTs[compositeKey] || 'teiji', todayStr, parts);
                              
                            const jobs = (rawJobs && rawJobs.length > 0)
                              ? rawJobs
                              : avgJobs;

                            const currentHour = new Date().getHours();
                            const currentMinute = new Date().getMinutes();
                            const currentMins = currentHour * 60 + currentMinute;
                            const isNightShiftTime = currentMins < 435 || currentMins >= 1260;
                            const currentShift = isNightShiftTime ? 'night' : 'day';

                            // Focus active job resolution exclusively on the current shift's jobs (ignore leftovers from previous shifts)
                            const shiftJobs = jobs.filter(j => j.shift === currentShift || (currentShift === 'night' && j.shift === 'overflow'));
                            const hasShiftJobs = shiftJobs.length > 0;
                            
                            const activeJob = (() => {
                              if (!hasShiftJobs) return undefined;
                              
                              const running = shiftJobs.find(j => j.status === 'running');
                              if (running) return running;

                              const dandori = shiftJobs.find(j => j.status === 'dandori');
                              if (dandori) return dandori;

                              return shiftJobs.find(j => j.status !== 'completed');
                            })();
                            
                            const isDandori = !isAbnormal && !isNgActive && (activeJob ? activeJob.status === 'dandori' : false);
                            const isRunning = !isAbnormal && !isNgActive && !isDandori && activeJob !== undefined;
                            const isIdle = !isAbnormal && !isNgActive && !isDandori && activeJob === undefined;
                            
                            // Check if abnormality has lasted for more than 1 hour
                            const isAbnormalLong = isAbnormal && (() => {
                              if (!activeAbnormal || !activeAbnormal.start) return false;
                              try {
                                const now = new Date();
                                const [h, m] = activeAbnormal.start.split(':').map(Number);
                                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
                                // If start time is mathematically in the future, it began on the previous day
                                if (start.getTime() > now.getTime()) {
                                  start.setDate(start.getDate() - 1);
                                }
                                const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
                                return diffHours > 1;
                              } catch (e) {
                                return false;
                              }
                            })();
                            
                            const btn = (
                              <button 
                                key={k} 
                                onClick={() => setSelectedMachine({ machine: mc.id, tonnage: mc.tonnage, factory: fact.name })}
                                className={`px-4 py-2 border rounded-md transition-all duration-300 cursor-pointer font-bold flex gap-2 items-center text-sm shadow-sm ${
                                  isAbnormal 
                                    ? isAbnormalLong
                                      ? 'bg-rose-200 hover:bg-rose-300 text-rose-950 border-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.95)] ring-2 ring-rose-500/50'
                                      : 'bg-rose-100 hover:bg-rose-200 text-rose-700 border-rose-300' 
                                    : isNgActive
                                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                                      : isDandori
                                        ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300'
                                        : isIdle
                                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-250'
                                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border-emerald-300'
                                }`}
                                title={`${mc.tonnage} Tonnage - ${isAbnormal ? (isAbnormalLong ? 'CRITICAL DOWNTIME (>1HR)' : 'ABNORMAL') : isNgActive ? 'SEDANG NG' : isDandori ? 'DANDORI' : isIdle ? 'IDLE' : 'RUNNING'}`}
                              >
                                {isAbnormal && (
                                  <AlertCircle className={`w-4 h-4 ${isAbnormalLong ? 'text-rose-600 animate-bounce' : 'text-rose-500'}`} />
                                )}
                                {isNgActive && <AlertCircle className="w-4 h-4 text-amber-600" />}
                                {isDandori && <Settings2 className="w-4 h-4" />}
                                {isIdle && <Info className="w-4 h-4 text-slate-400" />}
                                {isRunning && <Play className="w-4 h-4" />}
                                <span className="text-base">{mc.id}</span>
                                <span className={`text-[11px] opacity-80 border-l pl-2 ${
                                  isAbnormal 
                                    ? 'border-rose-300' 
                                    : isNgActive
                                      ? 'border-amber-400'
                                      : isDandori 
                                        ? 'border-blue-300' 
                                        : isIdle 
                                          ? 'border-slate-300' 
                                          : 'border-emerald-300'
                                }`}>{mc.tonnage}</span>
                              </button>
                            );

                            return isAbnormal ? (
                              <div
                                key={k}
                                className={`abnormal-wave-wrapper${isAbnormalLong ? ' critical' : ''}`}
                              >
                                {btn}
                              </div>
                            ) : isNgActive ? (
                              <div key={k} className="ng-wave-wrapper">
                                {btn}
                              </div>
                            ) : (
                              <React.Fragment key={k}>{btn}</React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <div className="flex items-baseline gap-1 justify-start sm:justify-end">
                          <span className="text-2xl font-black text-slate-800">{fact.fuka.toFixed(1)}</span>
                          <span className="text-[10px] font-bold text-slate-400">Hr/Day</span>
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">FUKA Load</div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                      <div 
                        className={`h-full ${getStatusColor(fact.status)}`}
                        style={{ width: `${(fact.fuka / fact.maxFuka) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
      )}

      {activeTab === 'painting' && (
      <section>
        <div className="flex flex-col gap-6 mt-4">
          {paintingData.map((plantGroup, i) => (
            <Card key={i} className="p-0 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Factory className="w-4 h-4 text-slate-400" />
                <h4 className="font-bold text-slate-700 text-sm">{plantGroup.plant}</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {plantGroup.lines.map((line, j) => (
                  <div key={j} className="p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-black text-slate-800">{line.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest ${getStatusText(line.status)}`}>
                            {line.status}
                          </span>
                        </div>
                        {line.note && (
                          <div className="flex items-start gap-1.5 mt-2 bg-blue-50 text-blue-700 text-[10px] p-2 rounded border border-blue-100 font-medium">
                            <Info className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{line.note}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <div className="flex items-baseline gap-1 justify-start sm:justify-end">
                          <span className="text-2xl font-black text-slate-800">{line.fuka.toFixed(1)}</span>
                          <span className="text-[10px] font-bold text-slate-400">Hr/Day</span>
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">FUKA Load</div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3 relative">
                      <div 
                        className={`h-full ${getStatusColor(line.status)}`}
                        style={{ width: `${(line.fuka / line.maxFuka) * 100}%` }}
                      />
                      {/* Teiji line marker approx at 16 hrs (66%) */}
                      <div className="absolute top-0 bottom-0 left-[66%] w-0.5 bg-slate-400/50" title="Teiji (Default Capacity)" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
      )}

      {/* Modal */}
      {selectedMachine && (
        <MachineDetailModal 
          machine={selectedMachine.machine} 
          tonnage={selectedMachine.tonnage}
          factory={selectedMachine.factory} 
          onClose={() => setSelectedMachine(null)} 
          onNavigate={handleNavigateMachine}
          initialDate={selectedDate}
        />
      )}
    </div>
  );
}

