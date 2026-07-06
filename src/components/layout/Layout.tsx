import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { useDbConnection } from '../../context/DatabaseConnectionContext';

import { TabletControls } from './TabletControls';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: string) => void;
}

export function Layout({ children, currentView, onChangeView }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { dbStatus } = useDbConnection();

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentView={currentView} 
        onChangeView={onChangeView} 
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 overflow-y-auto w-full flex flex-col bg-slate-50/50">
        <header className="h-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#037233] via-[#04873c] to-[#025c27] text-white sticky top-0 z-30 shrink-0 shadow-[0_8px_30px_-4px_rgba(3,114,51,0.4)] border-b border-[#04873c]/50">
          <div className="flex items-center min-w-0">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 mr-3 -ml-2 rounded-lg text-white hover:bg-white/10 lg:hidden transition-colors cursor-pointer shrink-0"
              title="Open menu"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight capitalize drop-shadow-sm truncate">
                {currentView.replace('-', ' ')}
              </h1>
              <p className="text-white/80 text-[9px] sm:text-[11px] uppercase font-bold tracking-widest mt-0.5 truncate">
                3M Monitoring & Resource Alignment
              </p>
            </div>
          </div>
            
          <div className="flex items-center space-x-3 sm:space-x-5 shrink-0">
            {/* Tablet Mode Standby & Fullscreen Controls */}
            <TabletControls />

            <div className="hidden sm:flex space-x-3 items-center">
              {/* Live DB Connection Status Badge */}
              {dbStatus === 'checking' && (
                <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-white/60 mr-2 animate-pulse flex-shrink-0"></span>
                  Connecting...
                </div>
              )}
              {dbStatus === 'connected' && (
                <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md border border-emerald-400/30 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 mr-2 animate-pulse flex-shrink-0 shadow-[0_0_6px_#6ee7b7]"></span>
                  DB Synced
                </div>
              )}
              {dbStatus === 'disconnected' && (
                <div className="px-3 py-1.5 bg-amber-400/90 backdrop-blur-md border border-amber-300/40 text-amber-950 text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-900 mr-2 flex-shrink-0"></span>
                  Offline
                </div>
              )}
            </div>
            <div className="hidden sm:block h-10 w-px bg-white/20"></div>
            <div className="text-right flex flex-col items-end">
              <div className="text-[9px] sm:text-[10px] text-white/80 uppercase tracking-widest font-bold mb-0.5">OEE Status</div>
              <div className="text-[10px] sm:text-xs font-black text-white px-2 py-0.5 sm:px-2.5 sm:py-0.5 bg-emerald-500/30 border border-emerald-400/30 rounded tracking-wide shadow-sm backdrop-blur-sm">STABLE (94.2%)</div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
