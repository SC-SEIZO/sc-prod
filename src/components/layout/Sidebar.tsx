import React from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Factory, 
  Users, 
  PackageSearch, 
  Truck,
  Settings,
  UserCog,
  Database,
  LogOut,
  X,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUserRole } from '../../context/UserContext';
import { useDbConnection } from '../../context/DatabaseConnectionContext';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { id: 'dashboard', label: '3M Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'manpower', label: 'Manpower', icon: Users },
  { id: 'materials', label: 'Materials', icon: PackageSearch },
  { id: 'delivery', label: 'Delivery', icon: Truck },
];

export function Sidebar({ currentView, onChangeView, isMobileOpen, onClose }: SidebarProps) {
  const { role, setRole } = useUserRole();
  const { dbStatus, recheckConnection } = useDbConnection();

  const allNavItems = [...navItems];
  if (role === 'planner' || role === 'super-admin') {
    allNavItems.push({ id: 'database', label: 'Database Manager', icon: Database });
  }

  return (
    <aside className={cn(
      "w-64 bg-gradient-to-b from-[#E76114] via-[#f77020] to-[#C95411] text-white flex flex-col shadow-[8px_0_30px_rgba(231,97,20,0.35)] border-r border-[#ff8c47]/30 h-screen transition-transform duration-300 ease-in-out",
      "fixed lg:static top-0 bottom-0 left-0 z-50",
      isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-6 bg-transparent shrink-0 shadow-sm gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-[66px] h-[43px] bg-gradient-to-b from-white via-slate-50 to-slate-100 rounded-xl flex items-center justify-center p-1.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.2),_0_0_15px_rgba(255,255,255,0.15),_inset_0_1px_2px_rgba(255,255,255,0.8)] border border-white/80 shrink-0 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer animate-logo-float">
            <img 
              src="/logo.png" 
              alt="SC Logo" 
              className="max-h-full max-w-full object-contain transition-transform duration-300"
            />
          </div>
          <div className="flex flex-col justify-center text-left min-w-0">
            <span className="text-white text-[13px] font-black tracking-tight uppercase leading-none mb-1 truncate">PT. SUGITY CREATIVES</span>
            <span className="text-white text-[9.5px] font-medium tracking-wide uppercase leading-none opacity-80 truncate">PRODUCTION PLANNING</span>
          </div>
        </div>
        
        {/* Close Button on Mobile Drawer */}
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-white hover:bg-white/10 lg:hidden transition-colors cursor-pointer shrink-0"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] font-bold text-white/60 uppercase px-3 mb-3 tracking-widest">Menu</div>
        {allNavItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'materials') {
                  window.open('https://sugity-material-ews.vercel.app/', '_blank', 'noopener,noreferrer');
                } else {
                  onChangeView(item.id);
                }
                if (onClose) onClose();
              }}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left group overflow-hidden relative",
                active 
                  ? "bg-white/25 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-white/20 backdrop-blur-sm" 
                  : "hover:bg-white/10 hover:text-white text-white/90 hover:shadow-sm"
              )}
            >
              {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full shadow-[0_0_8px_white]"></div>}
              <item.icon className={cn("w-4 h-4 shrink-0 transition-transform duration-200", active ? "scale-110 drop-shadow-md" : "group-hover:scale-110 opacity-70 group-hover:opacity-100")} />
              <span className="text-xs font-bold uppercase tracking-wide truncate pr-1 flex-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-5 border-t border-white/10 bg-black/5 backdrop-blur-sm">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-xs text-[#E76114]">
            {role === 'super-admin' ? 'SA' :
             role === 'planner' ? 'PL' : 
             role === 'leader' ? 'LD' : 
             role === 'member' ? 'MB' : 'VW'}
          </div>
          <div className="text-left flex-1">
            <div className="text-[13px] text-white font-bold leading-tight capitalize">{role}</div>
            <div className="text-[10px] text-white/70 font-medium mt-0.5">PT. Sugity Creatives</div>
          </div>
        </div>

        {/* DB Connection Status Indicator */}
        <button
          onClick={() => recheckConnection()}
          title="Klik untuk refresh status koneksi database"
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
            dbStatus === 'connected'
              ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-200"
              : dbStatus === 'disconnected'
              ? "bg-amber-400/20 border-amber-400/30 text-amber-300 animate-pulse"
              : "bg-white/10 border-white/20 text-white/60"
          )}
        >
          {dbStatus === 'connected' && <Wifi className="w-3 h-3 shrink-0" />}
          {dbStatus === 'disconnected' && <WifiOff className="w-3 h-3 shrink-0" />}
          {dbStatus === 'checking' && <Loader2 className="w-3 h-3 shrink-0 animate-spin" />}
          <span>
            {dbStatus === 'connected' && 'Database Synced'}
            {dbStatus === 'disconnected' && 'Offline — Klik Refresh'}
            {dbStatus === 'checking' && 'Connecting...'}
          </span>
          {dbStatus === 'connected' && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => {
            setRole('guest');
            if (onClose) onClose();
          }}
          className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 shadow-sm flex items-center justify-center gap-2 cursor-pointer border border-white/10"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout Portal
        </button>
      </div>
    </aside>
  );
}
