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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Operator Console Login States
  const [pin, setPin] = useState('');
  const [memberName, setMemberName] = useState('');
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

  // Rate-limiting and lockout states managed purely in-memory
  const [deviceFailedAttempts, setDeviceFailedAttempts] = useState(0);
  const [deviceLockoutTime, setDeviceLockoutTime] = useState<number | null>(null);
  const [memberFailedAttempts, setMemberFailedAttempts] = useState(0);
  const [memberLockoutTime, setMemberLockoutTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Retrieve active lockout remaining seconds from server on component mount
  useEffect(() => {
    fetch('/api/auth/rate-limit-status')
      .then(res => res.json())
      .then(data => {
        const now = Date.now();
        if (data.deviceLockoutRemaining > 0) {
          setDeviceLockoutTime(now + data.deviceLockoutRemaining * 1000);
        }
        if (data.memberLockoutRemaining > 0) {
          setMemberLockoutTime(now + data.memberLockoutRemaining * 1000);
        }
      })
      .catch(err => console.error('Failed to fetch rate limit status:', err));
  }, []);

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

  // Lockout countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const updateCountdown = () => {
      const now = Date.now();
      const activeLockout = deviceLockoutTime || memberLockoutTime;
      if (activeLockout) {
        const remaining = Math.max(0, Math.ceil((activeLockout - now) / 1000));
        setCountdown(remaining);
        if (remaining <= 0) {
          if (deviceLockoutTime) {
            setDeviceLockoutTime(null);
            setDeviceFailedAttempts(0);
          }
          if (memberLockoutTime) {
            setMemberLockoutTime(null);
            setMemberFailedAttempts(0);
          }
        } else {
          timer = setTimeout(updateCountdown, 1000);
        }
      } else {
        setCountdown(0);
      }
    };

    updateCountdown();
    return () => clearTimeout(timer);
  }, [deviceLockoutTime, memberLockoutTime]);

  const handleDeviceLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (deviceLockoutTime && Date.now() < deviceLockoutTime) {
      const rem = Math.ceil((deviceLockoutTime - Date.now()) / 1000);
      setErrorMsg(`Too many failed attempts. Locked out. Try again in ${rem}s.`);
      return;
    }

    if (username.trim().length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      setIsLoggingIn(false);
      return;
    }

    setIsLoggingIn(true);
    try {
      await loginSystem(username, password);
      setDeviceFailedAttempts(0);
      setDeviceLockoutTime(null);
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('Locked out')) {
        setDeviceLockoutTime(Date.now() + 60000);
        setErrorMsg(errMsg);
      } else {
        const nextAttempts = deviceFailedAttempts + 1;
        setDeviceFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          const lockUntil = Date.now() + 60000;
          setDeviceLockoutTime(lockUntil);
          setErrorMsg('Too many failed attempts. Locked out for 60 seconds.');
        } else {
          setErrorMsg(`${errMsg} (Attempt ${nextAttempts}/5)`);
        }
      }
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
        id: currentUser?.username || 'device-leader',
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
      if (memberLockoutTime && Date.now() < memberLockoutTime) {
        const rem = Math.ceil((memberLockoutTime - Date.now()) / 1000);
        setErrorMsg(`Too many failed attempts. Locked out. Try again in ${rem}s.`);
        return;
      }

      if (!memberName.trim()) {
        setErrorMsg('Member Name is required.');
        return;
      }

      setIsLoggingIn(true);
      try {
        const res = await fetch('/api/auth/verify-member-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            factory: selectedFactory,
            machineId: selectedMachineId,
            pin: pin
          })
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const errMsg = body.error || 'PIN verification failed.';

          if (errMsg.includes('Locked out')) {
            setMemberLockoutTime(Date.now() + 60000);
            throw new Error(errMsg);
          } else {
            const nextAttempts = memberFailedAttempts + 1;
            setMemberFailedAttempts(nextAttempts);
            if (nextAttempts >= 5) {
              setMemberLockoutTime(Date.now() + 60000);
              throw new Error('Too many failed attempts. Locked out for 60 seconds.');
            } else {
              throw new Error(`${errMsg}`);
            }
          }
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
          setMemberFailedAttempts(0);
          setMemberLockoutTime(null);
          setRole('member');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Verification failed.');
      } finally {
        setIsLoggingIn(false);
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
      visible: userRole !== 'member'
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
        <div className="w-full sm:absolute sm:top-8 sm:left-0 sm:px-8 flex items-center justify-center sm:justify-start gap-3 mb-6 sm:mb-0 z-20">
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
                <label className={`text-[10px] font-black uppercase tracking-widest block ${styles.textDesc}`}>Username</label>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                disabled={isLoggingIn || !!(deviceLockoutTime && Date.now() < deviceLockoutTime)}
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
      <div className="w-full sm:absolute sm:top-8 sm:left-0 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sm:mb-0 z-20">
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
          <span className={`text-[10px] font-black uppercase tracking-wider ${styles.textDesc}`}>
            Device Active: <b className={`${styles.textTitle}`}>{currentUser?.name}</b>
          </span>
          <button
            onClick={logoutSystem}
            className={`px-4 py-2 border ${styles.badgeBorder} ${styles.textSub} hover:bg-slate-200/50 dark:hover:bg-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] cursor-pointer`}
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
          <div className={`grid grid-cols-1 gap-6 w-full max-w-4xl ${visiblePortals.length === 1 ? 'max-w-sm' :
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
                  disabled={!!(memberLockoutTime && Date.now() < memberLockoutTime)}
                  className={`w-full px-3.5 py-3 ${styles.inputBg} border ${styles.inputBorder} ${styles.focusBorder} ${styles.inputText} font-mono font-black rounded-xl outline-none text-center text-lg tracking-widest transition-all shadow-inner disabled:opacity-50`}
                  required
                />
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
                  disabled={!!(memberLockoutTime && Date.now() < memberLockoutTime)}
                  className={`flex-1 py-3.5 text-white font-black uppercase text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] tracking-widest flex items-center justify-center gap-2 cursor-pointer ${styles.buttonBg} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Unlock className="w-4 h-4" /> Enter Portal
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
