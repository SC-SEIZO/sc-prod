import React, { useState, useEffect } from 'react';
import { ArrowLeft, Kanban, List, Database, ChevronLeft, ChevronRight, Calendar, BarChart2 } from 'lucide-react';
import { MachineExecutionView } from './MachineExecutionView';
import { MachinePatternView } from './MachinePatternView';
import { MachinePartListView } from './MachinePartListView';
import { MachineOeeView } from './MachineOeeView';
import { getUniqueMachineKey } from '../../context/ProductionContext';

interface MachineDetailModalProps {
  machine: string;
  tonnage: string;
  factory: string;
  onClose: () => void;
  onNavigate?: (direction: 'next' | 'prev') => void;
  initialDate?: string;
}

export function MachineDetailModal({ machine, tonnage, factory, onClose, onNavigate, initialDate }: MachineDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'execution' | 'pattern' | 'partlist' | 'oee'>('pattern');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const machineKey = getUniqueMachineKey(factory, machine);
  const formattedMachineName = `Machine ${machine}`;

  // Sync selectedDate when initialDate prop changes (e.g. parent date changes)
  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
  }, [initialDate]);

  // Reset activeTab to 'pattern' whenever the machine/factory changes via navigation
  useEffect(() => {
    setActiveTab('pattern');
  }, [machine, factory]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full h-full flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between p-3 px-4 sm:px-6 lg:px-8 border-b border-slate-200 bg-white shrink-0 h-auto lg:h-20 z-10 w-full select-none gap-3">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
            <button 
              onClick={onClose} 
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-all cursor-pointer duration-150 border border-slate-200/60 bg-slate-50/50 shadow-sm shrink-0"
              title="Back to Machine FUKA Control"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
            
            <div className="flex flex-col justify-center min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-wider uppercase leading-tight truncate">Resin Injection Control</h2>
              <span className="text-[8px] sm:text-[9px] text-slate-400 font-extrabold uppercase tracking-widest leading-none mt-0.5 truncate">Sugity Creatives Telemetry Hub</span>
            </div>
            
            <div className="w-px h-8 bg-slate-200 mx-1.5 hidden lg:block shrink-0"></div>
            
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-black uppercase">
              <span className="h-7.5 sm:h-9 flex items-center px-2.5 sm:px-3 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 font-black tracking-wider shadow-sm shrink-0">{factory}</span>
              <span className="h-7.5 sm:h-9 flex items-center px-2.5 sm:px-3 rounded-lg text-[#008d51] bg-[#e8f5e9] border border-[#a5d6a7]/50 font-black tracking-wider shadow-sm shrink-0">{formattedMachineName}</span>
              <span className="h-7.5 sm:h-9 flex items-center px-2.5 sm:px-3 rounded-lg text-slate-500 bg-slate-100/60 border border-slate-200/60 font-mono font-bold tracking-wider shadow-sm shrink-0">{tonnage}</span>
              <div className="h-7.5 sm:h-9 flex items-center gap-1 sm:gap-1.5 border border-slate-200 rounded-lg px-2 sm:px-3 bg-slate-50 text-slate-700 font-bold text-[11px] sm:text-xs shadow-inner shrink-0">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#008d51] stroke-[2.5] shrink-0" />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer font-black text-slate-700 text-[11px] sm:text-xs font-sans border-none p-0 outline-none w-[95px] sm:w-[115px]"
                />
              </div>
            </div>
            
            {onNavigate && (
              <div className="h-7.5 sm:h-9 flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 shrink-0 shadow-inner">
                <button 
                  onClick={() => onNavigate('prev')}
                  className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-white text-slate-500 hover:text-slate-800 rounded-lg transition-all cursor-pointer shadow-sm duration-150"
                  title="Previous Machine"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </button>
                <button 
                  onClick={() => onNavigate('next')}
                  className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center hover:bg-white text-slate-500 hover:text-slate-800 rounded-lg transition-all cursor-pointer shadow-sm duration-150"
                  title="Next Machine"
                >
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-end">
            <div className="h-8.5 sm:h-10 flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner gap-0.5 shrink-0 overflow-x-auto max-w-full">
              <button 
                onClick={() => setActiveTab('partlist')}
                className={`h-7.5 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-150 whitespace-nowrap ${activeTab === 'partlist' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'}`}
              >
                <Database className="w-3 h-3 shrink-0" /> Part List
              </button>
              <button 
                onClick={() => setActiveTab('execution')}
                className={`h-7.5 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-150 whitespace-nowrap ${activeTab === 'execution' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'}`}
              >
                <Kanban className="w-3 h-3 shrink-0" /> Execute
              </button>
              <button 
                onClick={() => setActiveTab('pattern')}
                className={`h-7.5 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-150 whitespace-nowrap ${activeTab === 'pattern' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'}`}
              >
                <List className="w-3 h-3 shrink-0" /> Pattern View
              </button>
              <button 
                onClick={() => setActiveTab('oee')}
                className={`h-7.5 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-150 whitespace-nowrap ${activeTab === 'oee' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'}`}
              >
                <BarChart2 className="w-3 h-3 shrink-0" /> OEE & Diag
              </button>
            </div>
          </div>
        </div>

        {/* Content Area - conditionally render Pattern, Execution, or Part List */}
        {activeTab === 'execution' && <MachineExecutionView machine={machine} factory={factory} selectedDate={selectedDate} />}
        {activeTab === 'pattern' && <MachinePatternView machine={machine} factory={factory} selectedDate={selectedDate} />}
        {activeTab === 'partlist' && <MachinePartListView machine={machine} factory={factory} selectedDate={selectedDate} />}
        {activeTab === 'oee' && <MachineOeeView machine={machine} factory={factory} selectedDate={selectedDate} />}
      </div>
    </div>
  );
}
