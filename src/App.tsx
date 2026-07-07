import React, { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductionPage } from './pages/ProductionPage';
import { ManpowerPage } from './pages/ManpowerPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { DatabasePage } from './pages/DatabasePage';
import { UserProvider, useUserRole } from './context/UserContext';
import { PartsProvider } from './context/PartsContext';
import { ProductionProvider } from './context/ProductionContext';
import { OrdersProvider } from './context/OrdersContext';
import { DatabaseConnectionProvider, useDbConnection } from './context/DatabaseConnectionContext';
import { MemberPortal } from './components/production/MemberPortal';
import { LoginPage } from './components/auth/LoginPage';
import { ProductionBoardPage } from './pages/ProductionBoardPage';

// Offline / DB-disconnected warning banner
function OfflineBanner() {
  const { dbStatus, lastChecked, recheckConnection } = useDbConnection();
  const [dismissed, setDismissed] = useState(false);

  // Re-show the banner whenever connection is lost again
  useEffect(() => {
    if (dbStatus === 'disconnected') setDismissed(false);
  }, [dbStatus]);

  if (dbStatus === 'connected' || dbStatus === 'checking') return null;
  if (dismissed) return null;

  const timeStr = lastChecked
    ? lastChecked.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '-';

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center gap-3 bg-amber-500 text-amber-950 px-4 py-2.5 shadow-xl border-b-2 border-amber-600 text-xs font-bold"
    >
      <span className="text-lg leading-none flex-shrink-0">⚠️</span>
      <span className="flex-1">
        <strong>OFFLINE MODE</strong> — Koneksi ke database Supabase terputus. Data yang dimasukkan{' '}
        <u>tidak akan tersinkron</u> ke device lain. Pastikan koneksi internet aktif.
        <span className="ml-2 opacity-70 font-medium">Terakhir dicek: {timeStr}</span>
      </span>
      <button
        onClick={() => recheckConnection()}
        className="px-3 py-1 bg-amber-900/20 hover:bg-amber-900/40 rounded-md text-amber-950 font-black uppercase tracking-wider text-[10px] transition-colors cursor-pointer border border-amber-700/30"
      >
        Coba Lagi
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="px-2 py-1 hover:bg-amber-900/20 rounded-md text-amber-950 font-black text-sm transition-colors cursor-pointer"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// Global Error Boundary to catch and diagnose runtime crashes (e.g. blank screen on role switch)
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught a React runtime error:", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-100 p-6 text-slate-800 font-sans text-left select-none">
          <div className="w-full max-w-3xl bg-white border border-rose-200 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 text-rose-600">
              <span className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-xl font-bold">⚠️</span>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider">Application Runtime Exception</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">PT. Sugity Creatives Shopfloor Integration</p>
              </div>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs overflow-auto max-h-[350px] text-rose-700 whitespace-pre-wrap leading-relaxed shadow-inner">
              <div className="font-extrabold text-slate-900 text-sm border-b border-slate-200 pb-2 mb-2">
                {(this as any).state.error?.name || 'Error'}: {(this as any).state.error?.message}
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Stack Trace:</div>
              <div className="text-slate-600 text-[10px] leading-normal">{(this as any).state.error?.stack || 'No stack trace available'}</div>
            </div>

            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-md shadow-rose-950/20 cursor-pointer"
              >
                Clear Cache & Hard Reset
              </button>
              <button 
                onClick={() => {
                  window.location.reload();
                }}
                className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-350 transition-all hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

interface AuthenticatedAppProps {
  role: string;
  dbStatus: string;
  currentView: string;
  setCurrentView: (view: string) => void;
}

function AuthenticatedApp({ role, dbStatus, currentView, setCurrentView }: AuthenticatedAppProps) {
  // Redirect to Member Portal if role is member
  if (role === 'member') {
    return <MemberPortal />;
  }

  // Production Board: fullscreen single-page production monitor, no sidebar/layout
  if (role === 'production-board') {
    return (
      <>
        <OfflineBanner />
        <ProductionBoardPage />
      </>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage />;
      case 'orders':
        return <OrdersPage />;
      case 'production':
        return <ProductionPage />;
      case 'manpower':
        return <ManpowerPage />;
      case 'materials':
        return <MaterialsPage />;
      case 'delivery':
        return <DeliveryPage />;
      case 'database':
        return <DatabasePage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <>
      <OfflineBanner />
      {/* Push content down when offline banner is showing */}
      {dbStatus === 'disconnected' && <div className="h-[46px] flex-shrink-0" />}
      <Layout currentView={currentView} onChangeView={setCurrentView}>
        {renderView()}
      </Layout>
    </>
  );
}

function AppContent() {
  const { dbStatus } = useDbConnection();
  const [currentView, setCurrentView] = useState('dashboard');
  const { role, isLoadingAuth, isAuthenticated } = useUserRole();

  // Role security guard: if role is changed away from planner/super-admin while in Database manager, redirect immediately
  useEffect(() => {
    if (currentView === 'database' && role !== 'planner' && role !== 'super-admin') {
      setCurrentView('dashboard');
    }
  }, [role, currentView]);

  // Redirect Super Admin directly to Database Manager on entry
  useEffect(() => {
    if (role === 'super-admin') {
      setCurrentView('database');
    }
  }, [role]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-sans select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#008d51] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Workspace...</span>
        </div>
      </div>
    );
  }

  // Redirect to Front Login Page if no role selected (guest) or not authenticated
  if (!isAuthenticated || role === 'guest') {
    return (
      <>
        <OfflineBanner />
        <LoginPage />
      </>
    );
  }

  // Mount database data providers conditionally ONLY after the device has authenticated
  return (
    <PartsProvider>
      <ProductionProvider>
        <OrdersProvider>
          <AuthenticatedApp 
            role={role} 
            dbStatus={dbStatus} 
            currentView={currentView} 
            setCurrentView={setCurrentView} 
          />
        </OrdersProvider>
      </ProductionProvider>
    </PartsProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DatabaseConnectionProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </DatabaseConnectionProvider>
    </ErrorBoundary>
  );
}



