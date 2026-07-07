import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  LogOut, 
  Calendar, 
  Clock, 
  User, 
  Database, 
  Kanban, 
  List, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCog,
  X,
  FileText
} from 'lucide-react';
import { useUserRole } from '../../context/UserContext';
import { MachineExecutionView } from './MachineExecutionView';
import { MachinePatternView } from './MachinePatternView';
import { MachinePartListView } from './MachinePartListView';
import { TabletControls } from '../layout/TabletControls';
import { getTodayDateString } from '../../context/ProductionContext';
import { getMemberPin } from '../../lib/utils';

const FACTORY_DATA = [
  {
    name: 'FACT 2',
    label: 'SC1 - Factory 2 (Cibitung)',
    machines: [
      { id: 'MC 1', tonnage: '2500T' },
      { id: 'MC 2', tonnage: '3500T' },
      { id: 'MC 3', tonnage: '3500T' },
      { id: 'MC 4', tonnage: '2500T' },
      { id: 'MC 5', tonnage: '3500T' },
      { id: 'MC 6', tonnage: '2500T' },
      { id: 'MC 7', tonnage: '2500T' },
      { id: 'MC 8', tonnage: '2500T' }
    ]
  },
  {
    name: 'FACT 3',
    label: 'SC1 - Factory 3 (Cibitung)',
    machines: [
      { id: 'MC 1', tonnage: '1300T' },
      { id: 'MC 2', tonnage: '1300T' },
      { id: 'MC 3', tonnage: '1300T' },
      { id: 'MC 4', tonnage: '1050T' },
      { id: 'MC 5', tonnage: '2500T' },
      { id: 'MC 6', tonnage: '1600T' },
      { id: 'MC 7', tonnage: '2500T' },
      { id: 'MC 8', tonnage: '2500T' },
      { id: 'MC 9', tonnage: '1600T' },
      { id: 'MC 10', tonnage: '1600T' },
      { id: 'MC 10B', tonnage: '1600T' },
      { id: 'MC 11', tonnage: '650T' },
      { id: 'MC 13', tonnage: '650T' },
      { id: 'MC 14', tonnage: '650T' }
    ]
  },
  {
    name: 'FACT 4',
    label: 'SC1 - Factory 4 (Cibitung)',
    machines: [
      { id: 'MC 1', tonnage: '2500T' },
      { id: 'MC 7', tonnage: '2500T' },
      { id: 'MC 8', tonnage: '2500T' },
      { id: 'MC B1', tonnage: '3500T' },
      { id: 'MC B2', tonnage: '3500T' },
      { id: 'MC B3', tonnage: '3500T' }
    ]
  },
  {
    name: 'SC2 Resin',
    label: 'SC2 - Karawang Plant',
    machines: [
      { id: 'MC 1', tonnage: '2500T' },
      { id: 'MC 2', tonnage: '3500T' },
      { id: 'MC 3', tonnage: '3500T' },
      { id: 'MC 4', tonnage: '3500T' },
      { id: 'MC 5', tonnage: '3500T' }
    ]
  }
];

export function MemberPortal() {
  const { setRole } = useUserRole();
  
  // Persistence state for active machine login
  const [loggedInMachine, setLoggedInMachine] = useState<{ factory: string, id: string, tonnage: string, memberName: string } | null>(() => {
    const saved = localStorage.getItem('sugity_member_machine_login') || localStorage.getItem('sugity_operator_machine_login');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.factory && parsed.id) {
          return {
            factory: parsed.factory,
            id: parsed.id,
            tonnage: parsed.tonnage || '',
            memberName: parsed.memberName || 'Member'
          };
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  });

  const [selectedFactory, setSelectedFactory] = useState<string>('FACT 2');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('MC 1');
  const [memberName, setMemberName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showPinRefTable, setShowPinRefTable] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'execution' | 'pattern' | 'partlist'>('execution');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock effect
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      // Auto-update date if it changes (e.g. crossover midnight)
      const todayStr = getTodayDateString();
      setSelectedDate(prev => {
        if (prev !== todayStr) {
          return todayStr;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync selected machine when factory changes
  useEffect(() => {
    const fact = FACTORY_DATA.find(f => f.name === selectedFactory);
    if (fact && fact.machines.length > 0) {
      setSelectedMachineId(fact.machines[0].id);
    }
  }, [selectedFactory]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!memberName.trim()) {
      setErrorMsg('Member Name is required.');
      return;
    }

    const expectedPin = getMemberPin(selectedFactory, selectedMachineId);
    if (pin.trim().toUpperCase() !== expectedPin) {
      setErrorMsg(`Incorrect Member PIN.`);
      return;
    }

    const factoryData = FACTORY_DATA.find(f => f.name === selectedFactory);
    const machine = factoryData?.machines.find(m => m.id === selectedMachineId);

    if (machine) {
      const loginDetails = {
        factory: selectedFactory,
        id: selectedMachineId,
        tonnage: machine.tonnage,
        memberName: memberName.trim(),
        loginTimestamp: Date.now()
      };
      localStorage.setItem('sugity_member_machine_login', JSON.stringify(loginDetails));
      localStorage.removeItem('sugity_operator_machine_login'); // clean up old session key
      setLoggedInMachine(loginDetails);
      setPin('');
      setMemberName('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sugity_member_machine_login');
    localStorage.removeItem('sugity_operator_machine_login');
    setLoggedInMachine(null);
  };

  const activeFactoryData = FACTORY_DATA.find(f => f.name === selectedFactory);
  const formattedMachineName = loggedInMachine && loggedInMachine.id ? (loggedInMachine.id.startsWith('#') ? `Machine ${loggedInMachine.id}` : `Machine #${loggedInMachine.id}`) : '';

  // Render Login Card
  if (!loggedInMachine) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-100 to-slate-200 p-4 select-none relative overflow-y-auto">
        <div className="absolute top-6 left-6 flex items-center gap-3">
          <div className="w-[78px] h-[51px] flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="SC Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-slate-800 text-xs font-black tracking-tight uppercase leading-none mb-0.5">PT. SUGITY CREATIVES</span>
            <span className="text-[#008d51] text-[8px] font-bold tracking-widest uppercase leading-none">Shopfloor Member Console</span>
          </div>
        </div>

        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button
            onClick={() => setShowPinRefTable(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-[#008d51] text-[10px] font-black uppercase rounded-lg tracking-wider transition-all duration-200 cursor-pointer shadow-sm animate-pulse"
          >
            <FileText className="w-3.5 h-3.5" /> PIN Table
          </button>
          <button
            onClick={() => setRole('guest')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 hover:text-slate-800 text-[10px] font-black uppercase rounded-lg tracking-wider transition-all duration-200 cursor-pointer shadow-sm"
          >
            <UserCog className="w-3.5 h-3.5" /> Entrance Portal
          </button>
        </div>

        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl p-8 flex flex-col space-y-5 relative overflow-hidden mt-12 sm:mt-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-[#008d51] shadow-[0_0_15px_rgba(0,141,81,0.1)]">
              <Lock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider">Member Machine Auth</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Select your machine and enter credentials</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Select Factory</label>
              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-600 text-slate-800 font-bold rounded-xl outline-none text-xs transition-colors appearance-none cursor-pointer"
              >
                {FACTORY_DATA.map(f => (
                  <option key={f.name} value={f.name} className="bg-white text-slate-800">{f.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Select Machine</label>
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-600 text-slate-800 font-bold rounded-xl outline-none text-xs transition-colors appearance-none cursor-pointer"
              >
                {activeFactoryData?.machines.map(m => (
                  <option key={m.id} value={m.id} className="bg-white text-slate-800">Machine {m.id} ({m.tonnage})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Member Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-600 text-slate-800 font-bold rounded-xl outline-none text-xs transition-colors shadow-inner"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Member PIN</label>
              <input
                type="password"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 focus:border-emerald-600 text-slate-800 font-mono font-black rounded-xl outline-none text-center text-base tracking-widest transition-all shadow-inner"
                required
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#008d51] hover:bg-[#007038] text-white font-black uppercase text-xs rounded-xl shadow-lg transition-transform active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              <Unlock className="w-4 h-4" /> Access Machine Console
            </button>
          </form>
        </div>

        {/* PIN REFERENCE MODAL */}
        {showPinRefTable && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#008d51]" />
                  Member PIN Guide Table
                </h3>
                <button 
                  onClick={() => setShowPinRefTable(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <table className="w-full text-left border-collapse text-[10px] sm:text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="px-4 py-2 bg-slate-50/50">Factory</th>
                      <th className="px-4 py-2 bg-slate-50/50">Machine</th>
                      <th className="px-4 py-2 bg-slate-50/50">Tonnage</th>
                      <th className="px-4 py-2 bg-slate-50/50 text-right">PIN Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FACTORY_DATA.map(f => 
                      f.machines.map((m, idx) => {
                        const pinCode = getMemberPin(f.name, m.id);
                        return (
                          <tr key={`${f.name}-${m.id}`} className="border-b border-slate-100 hover:bg-slate-50 text-slate-600">
                            {idx === 0 ? (
                              <td className="px-4 py-2 font-bold text-slate-800 align-top bg-slate-50" rowSpan={f.machines.length}>
                                {f.name}
                              </td>
                            ) : null}
                            <td className="px-4 py-2 font-medium">Machine {m.id}</td>
                            <td className="px-4 py-2 opacity-60 font-mono">{m.tonnage}</td>
                            <td className="px-4 py-2 font-mono font-bold text-[#008d51] text-right text-xs sm:text-sm">
                              {pinCode}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Logged In Console
  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-3 sm:p-4 px-4 sm:px-6 border-b border-slate-200 bg-white shrink-0 h-auto lg:h-20 z-10 w-full select-none shadow-sm gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-[60px] sm:w-[72px] h-[39px] sm:h-[45px] bg-gradient-to-b from-white to-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-center p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06),_inset_0_1px_1px_rgba(255,255,255,1)] shrink-0 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer animate-logo-float">
            <img src="/logo.png" alt="SC Logo" className="max-h-full max-w-full object-contain" />
          </div>
          
          <div className="flex flex-col justify-center text-left shrink-0">
            <h2 className="text-[11px] sm:text-xs font-black text-slate-800 tracking-wider uppercase leading-tight">
              <span className="hidden sm:inline">Member Dashboard</span>
              <span className="inline sm:hidden">Member</span>
            </h2>
            <span className="text-[8px] text-[#008d51] font-black uppercase tracking-widest leading-none mt-0.5 hidden sm:block">PT. Sugity Creatives</span>
          </div>
          
          <div className="w-px h-8 bg-slate-200 mx-1 sm:mx-1.5 hidden lg:block shrink-0"></div>
          
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-black uppercase min-w-0">
            {/* Unified Compact Badge for Factory, Machine, Tonnage & Member Name */}
            <span className="h-9 flex items-center px-2 sm:px-3 rounded-lg text-[10px] sm:text-[10.5px] font-black tracking-wider text-[#008d51] bg-[#e8f5e9] border border-[#a5d6a7]/50 shadow-sm shrink-0">
              {loggedInMachine.factory} • <span className="hidden sm:inline">{formattedMachineName}</span><span className="inline sm:hidden">{loggedInMachine.id}</span> ({loggedInMachine.tonnage})
              <span className="mx-2 text-[#a5d6a7]">|</span>
              <span className="text-slate-700 normal-case">{loggedInMachine.memberName}</span>
            </span>
            
            {/* Live Clock */}
            <div className="h-9 flex items-center gap-1 sm:gap-1.5 border border-slate-200 rounded-lg px-2 sm:px-2.5 bg-slate-50 text-slate-700 font-mono font-black text-[11px] sm:text-xs shadow-inner shrink-0 select-none hidden md:flex">
              <Clock className="w-3.5 h-3.5 text-[#008d51] stroke-[2.5]" />
              <span>{currentTime || '--:--:--'}</span>
            </div>

            {/* Date Selector (Static for Member) */}
            <div className="h-9 flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 sm:px-3 bg-slate-100 text-slate-600 font-bold text-[11px] sm:text-xs shadow-inner shrink-0 select-none">
              <Calendar className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#008d51] stroke-[2.5] shrink-0" />
              <span className="font-black text-slate-700 text-[11px] sm:text-xs font-sans">
                {selectedDate}
              </span>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
          <div className="h-10 flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner gap-0.5 shrink-0 overflow-x-auto max-w-full">
            <button 
              onClick={() => setActiveTab('partlist')}
              className={`h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 rounded-md text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeTab === 'partlist' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
              title="Part List"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Part List</span>
              <span className="hidden sm:inline md:hidden">Parts</span>
            </button>
            <button 
              onClick={() => setActiveTab('execution')}
              className={`h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 rounded-md text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeTab === 'execution' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
              title="Execute Production"
            >
              <Kanban className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Execute</span>
              <span className="hidden sm:inline md:hidden">Exec</span>
            </button>
            <button 
              onClick={() => setActiveTab('pattern')}
              className={`h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 rounded-md text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeTab === 'pattern' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
              title="Pattern View"
            >
              <List className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Pattern View</span>
              <span className="hidden sm:inline md:hidden">Pattern</span>
            </button>
          </div>

          <div className="h-9 w-px bg-slate-200 shrink-0 mx-0.5 hidden lg:block"></div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <TabletControls variant="light" compact={true} />
            <button
              onClick={handleLogout}
              className="h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-[10.5px] uppercase tracking-wider cursor-pointer transition-colors shadow-sm bg-white"
              title="Switch to another machine"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Switch Machine</span>
              <span className="hidden sm:inline xl:hidden">Switch</span>
            </button>

            <button
              onClick={() => setRole('guest')}
              className="h-9 flex items-center justify-center gap-1.5 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[10.5px] uppercase tracking-wider cursor-pointer transition-colors shadow-sm bg-white"
              title="Return to entrance portal"
            >
              <UserCog className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Exit Member</span>
              <span className="hidden sm:inline xl:hidden">Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Tab Contents */}
      <div className="flex-1 overflow-hidden relative bg-slate-100 flex flex-col">
        {activeTab === 'execution' && (
          <MachineExecutionView 
            machine={loggedInMachine.id} 
            factory={loggedInMachine.factory} 
            selectedDate={selectedDate} 
          />
        )}
        
        {activeTab === 'pattern' && (
          <div className="w-full h-full overflow-y-auto p-8 pt-6">
            <MachinePatternView 
              machine={loggedInMachine.id} 
              factory={loggedInMachine.factory} 
              selectedDate={selectedDate} 
            />
          </div>
        )}
        
        {activeTab === 'partlist' && (
          <div className="w-full h-full overflow-y-auto p-8 pt-6">
            <MachinePartListView 
              machine={loggedInMachine.id} 
              factory={loggedInMachine.factory} 
              selectedDate={selectedDate} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
