import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  User,
  UserCog,
  Users,
  Eye,
  AlertTriangle,
  ChevronRight,
  Factory,
  Database,
  FileText,
  MonitorPlay,
  X
} from 'lucide-react';
import { useUserRole, setPlannerAdminPin, AppTheme } from '../../context/UserContext';
import { getMemberPin } from '../../lib/utils';
import { FACTORY_LIST as FACTORY_DATA } from '../../data/machineLayout';

const THEME_STYLES: Record<AppTheme, {
  bg: string;
  glow1: string;
  glow2: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  focusBorder: string;
  buttonBg: string;
  cardHover: string;
  primaryGlow: string;
  textTitle: string;
  textDesc: string;
  textSub: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  badgeBg: string;
  badgeBorder: string;
  logoBorder: string;
}> = {
  sugity: {
    bg: 'bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black',
    glow1: 'bg-emerald-500/10',
    glow2: 'bg-orange-500/10',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/20',
    focusBorder: 'focus:border-emerald-500',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/50',
    cardHover: 'hover:border-emerald-500/50 hover:bg-emerald-500/5',
    primaryGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    textTitle: 'text-white',
    textDesc: 'text-slate-400',
    textSub: 'text-slate-350',
    cardBg: 'bg-white/5 backdrop-blur-md',
    cardBorder: 'border-white/10',
    inputBg: 'bg-slate-950',
    inputBorder: 'border-white/15',
    inputText: 'text-white',
    badgeBg: 'bg-white/5',
    badgeBorder: 'border-white/10',
    logoBorder: 'border-slate-800'
  },
  carbon: {
    bg: 'bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-zinc-950 to-black',
    glow1: 'bg-amber-500/5',
    glow2: 'bg-zinc-500/5',
    accentText: 'text-amber-500',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/20',
    focusBorder: 'focus:border-amber-500',
    buttonBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/50',
    cardHover: 'hover:border-amber-500/50 hover:bg-amber-500/5',
    primaryGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    textTitle: 'text-white',
    textDesc: 'text-zinc-400',
    textSub: 'text-zinc-350',
    cardBg: 'bg-white/5 backdrop-blur-md',
    cardBorder: 'border-white/10',
    inputBg: 'bg-zinc-950',
    inputBorder: 'border-white/15',
    inputText: 'text-white',
    badgeBg: 'bg-white/5',
    badgeBorder: 'border-white/10',
    logoBorder: 'border-zinc-800'
  },
  ocean: {
    bg: 'bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950 via-slate-950 to-black',
    glow1: 'bg-cyan-500/10',
    glow2: 'bg-blue-500/10',
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    accentBorder: 'border-cyan-500/20',
    focusBorder: 'focus:border-cyan-500',
    buttonBg: 'bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500/50',
    cardHover: 'hover:border-cyan-500/50 hover:bg-cyan-500/5',
    primaryGlow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    textTitle: 'text-white',
    textDesc: 'text-slate-400',
    textSub: 'text-slate-350',
    cardBg: 'bg-white/5 backdrop-blur-md',
    cardBorder: 'border-white/10',
    inputBg: 'bg-slate-950',
    inputBorder: 'border-white/15',
    inputText: 'text-white',
    badgeBg: 'bg-white/5',
    badgeBorder: 'border-white/10',
    logoBorder: 'border-slate-800'
  },
  sakura: {
    bg: 'bg-stone-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950 via-stone-950 to-black',
    glow1: 'bg-rose-500/15',
    glow2: 'bg-pink-500/10',
    accentText: 'text-rose-400',
    accentBg: 'bg-rose-500/10',
    accentBorder: 'border-rose-500/20',
    focusBorder: 'focus:border-rose-500',
    buttonBg: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/50',
    cardHover: 'hover:border-rose-500/50 hover:bg-rose-500/5',
    primaryGlow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    textTitle: 'text-white',
    textDesc: 'text-stone-400',
    textSub: 'text-stone-350',
    cardBg: 'bg-white/5 backdrop-blur-md',
    cardBorder: 'border-white/10',
    inputBg: 'bg-stone-950',
    inputBorder: 'border-white/15',
    inputText: 'text-white',
    badgeBg: 'bg-white/5',
    badgeBorder: 'border-white/10',
    logoBorder: 'border-stone-800'
  },
  light: {
    bg: 'bg-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-100 to-slate-200',
    glow1: 'bg-emerald-600/5',
    glow2: 'bg-slate-400/5',
    accentText: 'text-[#008d51]',
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-emerald-200',
    focusBorder: 'focus:border-emerald-600',
    buttonBg: 'bg-[#008d51] hover:bg-[#007038] focus:ring-emerald-500/50',
    cardHover: 'hover:border-emerald-500 hover:bg-white hover:shadow-xl hover:shadow-emerald-500/5',
    primaryGlow: 'shadow-[0_0_15px_rgba(0,141,81,0.1)]',
    textTitle: 'text-slate-800',
    textDesc: 'text-slate-500',
    textSub: 'text-slate-600',
    cardBg: 'bg-white/95 shadow-lg border border-slate-200/80',
    cardBorder: 'border-slate-200',
    inputBg: 'bg-slate-50',
    inputBorder: 'border-slate-300',
    inputText: 'text-slate-800',
    badgeBg: 'bg-slate-50',
    badgeBorder: 'border-slate-200',
    logoBorder: 'border-slate-200'
  }
};

export function LoginPage() {
  const { 
    setRole, 
    theme, 
    setTheme, 
    isAuthenticated, 
    loginSystem, 
    logoutSystem, 
    currentUser 
  } = useUserRole();

  const [selectedPortal, setSelectedPortal] = useState<'super-admin' | 'planner' | 'leader' | 'member' | 'production-board' | null>(null);

  // Device Authentication Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Operator Console Login States
  const [pin, setPin] = useState('');
  const [memberName, setMemberName] = useState('');
  const [showPinRefTable, setShowPinRefTable] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState(() => {
    const saved = localStorage.getItem('sugity_member_machine_login') || localStorage.getItem('sugity_operator_machine_login');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.factory) return parsed.factory;
      } catch (e) { }
    }
    return 'FACT 2';
  });
  const [selectedMachineId, setSelectedMachineId] = useState(() => {
    const saved = localStorage.getItem('sugity_member_machine_login') || localStorage.getItem('sugity_operator_machine_login');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed.id;
      } catch (e) { }
    }
    return 'MC 1';
  });
  const [errorMsg, setErrorMsg] = useState('');
  const isInitialSyncRef = React.useRef(true);

  // Sync selected machine when factory changes
  useEffect(() => {
    if (isInitialSyncRef.current) {
      isInitialSyncRef.current = false;
      return;
    }
    const fact = FACTORY_DATA.find(f => f.name === selectedFactory);
    if (fact && fact.machines.length > 0) {
      setSelectedMachineId(fact.machines[0].id);
    }
  }, [selectedFactory]);

  const handleDeviceLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoggingIn(true);
    try {
      await loginSystem(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePortalSelect = (portal: 'super-admin' | 'planner' | 'leader' | 'member' | 'production-board') => {
    setErrorMsg('');
    setPin('');
    setMemberName('');

    if (portal === 'super-admin') {
      setPlannerAdminPin('5555');
      setRole('super-admin');
      return;
    }

    if (portal === 'planner') {
      // Planner enters directly; pre-populate planner admin pin for client-to-API auth compatibility
      setPlannerAdminPin('5555');
      setRole('planner');
      return;
    }

    if (portal === 'leader') {
      // Leader enters directly; seed a default session based on the authenticated device user
      const sessionPayload = {
        id: currentUser?.email || 'device-leader',
        name: currentUser?.name || 'Device Leader',
        loginTimestamp: Date.now()
      };
      localStorage.setItem('sugity_active_leader_session', JSON.stringify(sessionPayload));
      setRole('leader');
      return;
    }

    if (portal === 'production-board') {
      setRole('production-board');
      return;
    }

    setSelectedPortal(portal);
  };

  const handleOperatorLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (selectedPortal === 'member') {
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
        localStorage.removeItem('sugity_operator_machine_login'); // clean up old key
        setRole('member');
      }
    }
  };

  const activeFactoryData = FACTORY_DATA.find(f => f.name === selectedFactory);
  const styles = THEME_STYLES[theme] || THEME_STYLES.sugity;

  const userRole = currentUser?.role;
  const portals = [
    {
      id: 'super-admin' as const,
      title: 'Super Admin Portal',
      desc: 'Master workspace with override privileges. Upload forecasts, edit sequencing, configure patterns, and access all settings.',
      icon: UserCog,
      glow: styles.glow2,
      color: 'text-amber-600',
      bg: 'bg-amber-550/10',
      border: 'border-amber-500/20',
      action: 'Access Super Admin',
      visible: userRole === 'super-admin'
    },
    {
      id: 'planner' as const,
      title: 'Planner Portal',
      desc: 'Forecast upload, capacity check, database adjustments, and master plan execution control.',
      icon: UserCog,
      glow: styles.glow1,
      color: styles.accentText,
      bg: styles.accentBg,
      border: styles.accentBorder,
      action: 'Access Portal',
      visible: userRole === 'planner' || userRole === 'super-admin'
    },
    {
      id: 'leader' as const,
      title: 'Leader Portal',
      desc: 'Shift scheduling, overtime setup, leveled sequencing adjustment, and shopfloor oversight.',
      icon: Users,
      glow: styles.glow2,
      color: styles.accentText,
      bg: styles.accentBg,
      border: styles.accentBorder,
      action: 'Access Portal',
      visible: userRole === 'planner' || userRole === 'leader' || userRole === 'super-admin'
    },
    {
      id: 'member' as const,
      title: 'Member Operation',
      desc: 'Dedicated screen locked to individual injection machines. Live execution, barcode label printing, and abnormality logs.',
      icon: Factory,
      glow: styles.glow1,
      color: styles.accentText,
      bg: styles.accentBg,
      border: styles.accentBorder,
      action: 'Access Console',
      visible: userRole === 'planner' || userRole === 'leader' || userRole === 'member' || userRole === 'super-admin'
    },
    {
      id: 'production-board' as const,
      title: 'Production Dashboard',
      desc: 'Fullscreen single-page monitor of every machine condition across SC1 & SC2 plants.',
      icon: MonitorPlay,
      glow: styles.glow1,
      color: styles.accentText,
      bg: styles.accentBg,
      border: styles.accentBorder,
      action: 'Enter Board',
      visible: true
    }
  ];

  const visiblePortals = portals.filter(p => p.visible);

  // Render Case 1: Device is not authorized
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8 select-none relative overflow-y-auto transition-colors duration-500 ${styles.bg}`}>
        {/* Decorative background glows */}
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-colors duration-500 ${styles.glow1}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-colors duration-500 ${styles.glow2}`}></div>

        {/* Brand Header */}
        <div className="w-full sm:absolute sm:top-8 sm:left-8 flex items-center justify-center sm:justify-start gap-3 mb-6 sm:mb-0 z-20">
          <div className="w-[88px] h-[58px] flex items-center justify-center transition-all shrink-0">
            <img src="/logo.png" alt="SC Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className={`text-sm sm:text-base font-black tracking-tight uppercase leading-none mb-0.5 transition-colors ${styles.textTitle} truncate`}>PT. SUGITY CREATIVES</span>
            <span className={`text-[9px] sm:text-xs font-bold tracking-widest uppercase leading-none transition-colors duration-500 ${styles.accentText} truncate`}>Integrated Production Planning System</span>
          </div>
        </div>

        {/* Device Authorization Form */}
        <div className="w-full max-w-[420px] z-10 py-12">
          <div className={`w-full ${styles.cardBg} ${styles.cardBorder} border backdrop-blur-xl rounded-2xl shadow-2xl p-8 flex flex-col space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-250`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>

            <div className="text-center space-y-2">
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto transition-colors ${styles.accentText} ${styles.accentBg} ${styles.accentBorder}`}>
                <User className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h2 className={`text-xl font-black uppercase tracking-wider transition-colors ${styles.textTitle}`}>
                Device Authorization
              </h2>
              <p className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${styles.textDesc}`}>
                Unlock this workstation by logging in
              </p>
            </div>

            <form onSubmit={handleDeviceLoginSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className={`text-[10px] font-black uppercase tracking-widest block ${styles.textDesc}`}>Email Address</label>
                <input
                  type="email"
                  placeholder="name@sugity.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-3.5 py-3 ${styles.inputBg} border ${styles.inputBorder} ${styles.focusBorder} ${styles.inputText} font-bold rounded-xl outline-none text-sm transition-all shadow-inner`}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className={`text-[10px] font-black uppercase tracking-widest block ${styles.textDesc}`}>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3.5 py-3 ${styles.inputBg} border ${styles.inputBorder} ${styles.focusBorder} ${styles.inputText} font-bold rounded-xl outline-none text-sm transition-all shadow-inner`}
                  required
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full py-3.5 text-white font-black uppercase text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 cursor-pointer ${styles.buttonBg} disabled:opacity-50 disabled:cursor-not-allowed mt-2`}
              >
                {isLoggingIn ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" /> Authorize Device
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Render Case 2: Device is authorized. Show Profile Portal Grid.
  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8 select-none relative overflow-y-auto transition-colors duration-500 ${styles.bg}`}>

      {/* Decorative background glows */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-colors duration-500 ${styles.glow1}`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] transition-colors duration-500 ${styles.glow2}`}></div>

      {/* Main Header / Brand Info & Logout */}
      <div className="w-full sm:absolute sm:top-8 sm:left-8 sm:right-8 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sm:mb-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-[88px] h-[58px] flex items-center justify-center transition-all shrink-0">
            <img src="/logo.png" alt="SC Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className={`text-sm sm:text-base font-black tracking-tight uppercase leading-none mb-0.5 transition-colors ${styles.textTitle} truncate`}>PT. SUGITY CREATIVES</span>
            <span className={`text-[9px] sm:text-xs font-bold tracking-widest uppercase leading-none transition-colors duration-500 ${styles.accentText} truncate`}>Integrated Production Planning System</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Device Active: <b className="text-slate-600">{currentUser?.name}</b></span>
          <button
            onClick={logoutSystem}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-200/50 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] cursor-pointer"
          >
            Logout System
          </button>
        </div>
      </div>

      <div className="w-full max-w-5xl flex flex-col items-center justify-center space-y-10 z-10 py-12">
        <div className="text-center space-y-3.5 max-w-2xl">
          <h1 className={`text-4xl sm:text-[40px] font-black uppercase tracking-wider transition-colors leading-tight ${styles.textTitle}`}>Production Monitoring & 3M System</h1>
          <p className={`text-sm font-bold uppercase tracking-wider transition-colors ${styles.textDesc}`}>Select your profile workspace below to access the system</p>
        </div>

        {selectedPortal === null ? (
          /* Role Selection Cards */
          <div className={`grid grid-cols-1 gap-6 w-full max-w-4xl ${
            visiblePortals.length === 1 ? 'max-w-sm' :
            visiblePortals.length === 2 ? 'md:grid-cols-2 max-w-2xl' :
            visiblePortals.length === 3 ? 'md:grid-cols-3 max-w-3xl' :
            'md:grid-cols-2 lg:grid-cols-4'
          }`}>
            {visiblePortals.map((p) => (
              <div
                key={p.id}
                onClick={() => handlePortalSelect(p.id)}
                className={`${styles.cardBg} ${styles.cardBorder} border p-6 rounded-2xl flex flex-col justify-between h-[245px] transition-all duration-300 cursor-pointer group hover:-translate-y-1 text-left relative overflow-hidden ${styles.cardHover}`}
              >
                <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-xl transition-all duration-500 ${p.glow} group-hover:scale-110`}></div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 ${p.color} ${p.bg} ${p.border} ${styles.primaryGlow}`}>
                  <p.icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className={`text-base font-black uppercase tracking-wider mb-1 ${styles.textTitle}`}>{p.title}</h3>
                  <p className={`text-xs font-medium leading-relaxed ${styles.textDesc}`}>{p.desc}</p>
                </div>
                <div className={`flex items-center text-xs font-black uppercase tracking-wider gap-1 pt-2 transition-colors duration-500 ${p.color}`}>
                  {p.action} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Form Entry (Only for Member Operator console) */
          <div className={`w-full max-w-[460px] ${styles.cardBg} ${styles.cardBorder} border backdrop-blur-xl rounded-2xl shadow-2xl p-8 flex flex-col space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-250`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>

            <div className="text-center space-y-2">
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto transition-colors ${styles.accentText} ${styles.accentBg} ${styles.accentBorder}`}>
                <Lock className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h2 className={`text-xl font-black uppercase tracking-wider transition-colors ${styles.textTitle}`}>
                Member Machine Login
              </h2>
              <p className={`text-xs font-bold uppercase tracking-wider transition-colors ${styles.textDesc}`}>
                Select your machine and enter details to log in
              </p>
            </div>

            <form onSubmit={handleOperatorLoginSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className={`text-[11px] font-black uppercase tracking-widest block ${styles.textDesc}`}>Select Factory</label>
                <select
                  value={selectedFactory}
                  onChange={(e) => setSelectedFactory(e.target.value)}
                  className={`w-full px-3.5 py-3 ${styles.inputBg} border ${styles.badgeBorder} ${styles.focusBorder} ${styles.inputText} font-bold rounded-xl outline-none text-sm transition-all appearance-none cursor-pointer`}
                >
                  {FACTORY_DATA.map(f => (
                    <option key={f.name} value={f.name} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-950 text-white'}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-black uppercase tracking-widest block ${styles.textDesc}`}>Select Machine</label>
                <select
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                  className={`w-full px-3.5 py-3 ${styles.inputBg} border ${styles.badgeBorder} ${styles.focusBorder} ${styles.inputText} font-bold rounded-xl outline-none text-sm transition-all appearance-none cursor-pointer`}
                >
                  {activeFactoryData?.machines.map(m => (
                    <option key={m.id} value={m.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-950 text-white'}>Machine {m.id} ({m.tonnage})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-black uppercase tracking-widest block ${styles.textDesc}`}>Member Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className={`w-full px-3.5 py-3 ${styles.inputBg} border ${styles.inputBorder} ${styles.focusBorder} ${styles.inputText} font-bold rounded-xl outline-none text-sm transition-all shadow-inner`}
                  required
                />
              </div>

              {/* Password / PIN input */}
              <div className="space-y-1">
                <label className={`text-[11px] font-black uppercase tracking-widest block ${styles.textDesc}`}>
                  Member PIN
                </label>
                <input
                  type="password"
                  placeholder="••••"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className={`w-full px-3.5 py-3 ${styles.inputBg} border ${styles.inputBorder} ${styles.focusBorder} ${styles.inputText} font-mono font-black rounded-xl outline-none text-center text-lg tracking-widest transition-all shadow-inner`}
                  required
                />
                <span className={`text-[10px] font-bold block mt-1.5 text-center uppercase tracking-wider ${styles.textDesc}`}>
                  <button
                    type="button"
                    onClick={() => setShowPinRefTable(true)}
                    className="text-emerald-500 hover:text-emerald-600 font-extrabold underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" /> View PIN Reference Table
                  </button>
                </span>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPortal(null)}
                  className={`flex-1 py-3.5 ${styles.badgeBg} border ${styles.badgeBorder} hover:bg-slate-200/50 dark:hover:bg-white/10 ${styles.textSub} font-black uppercase text-sm rounded-xl shadow-lg transition-transform active:scale-[0.98] tracking-widest text-center cursor-pointer`}
                >
                  Back
                </button>

                <button
                  type="submit"
                  className={`flex-1 py-3.5 text-white font-black uppercase text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 cursor-pointer ${styles.buttonBg}`}
                >
                  <Unlock className="w-4 h-4" /> Enter Portal
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* PIN REFERENCE MODAL */}
      {showPinRefTable && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950">
              <h3 className="font-black text-white uppercase text-xs tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Member PIN Guide Table
              </h3>
              <button
                onClick={() => setShowPinRefTable(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left border-collapse text-[10px] sm:text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-4 py-2 bg-white/5">Factory</th>
                    <th className="px-4 py-2 bg-white/5">Machine</th>
                    <th className="px-4 py-2 bg-white/5 text-right">PIN Code</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTORY_DATA.map(f =>
                    f.machines.map((m, idx) => {
                      const pinCode = getMemberPin(f.name, m.id);
                      return (
                        <tr key={`${f.name}-${m.id}`} className="border-b border-white/5 hover:bg-white/5 text-slate-350">
                          {idx === 0 ? (
                            <td className="px-4 py-2 font-bold text-white align-top bg-slate-950/20" rowSpan={f.machines.length}>
                              {f.name}
                            </td>
                          ) : null}
                          <td className="px-4 py-2 font-medium">Machine {m.id}</td>
                          <td className="px-4 py-2 font-mono font-bold text-emerald-400 text-right text-xs sm:text-sm">
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
