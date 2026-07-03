import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type DbStatus = 'checking' | 'connected' | 'disconnected';

interface DatabaseConnectionContextType {
  dbStatus: DbStatus;
  isConnected: boolean;
  lastChecked: Date | null;
  recheckConnection: () => Promise<void>;
}

const DatabaseConnectionContext = createContext<DatabaseConnectionContextType>({
  dbStatus: 'checking',
  isConnected: false,
  lastChecked: null,
  recheckConnection: async () => {},
});

const CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function DatabaseConnectionProvider({ children }: { children: ReactNode }) {
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = useCallback(async () => {
    // If supabase client was never initialized (missing env vars), mark as disconnected immediately
    if (!supabase) {
      setDbStatus('disconnected');
      setLastChecked(new Date());
      return;
    }

    try {
      // A lightweight ping: select 1 row limit from production_plans (or any table)
      const { error } = await supabase
        .from('production_plans')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        // If table doesn't exist or is a connection error, treat as disconnected
        console.warn('[DB] Connection check failed:', error.message);
        setDbStatus('disconnected');
      } else {
        setDbStatus('connected');
      }
    } catch (err) {
      console.warn('[DB] Connection check threw:', err);
      setDbStatus('disconnected');
    }

    setLastChecked(new Date());
  }, []);

  // Check immediately on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Periodic re-check
  useEffect(() => {
    const interval = setInterval(() => {
      checkConnection();
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [checkConnection]);

  return (
    <DatabaseConnectionContext.Provider
      value={{
        dbStatus,
        isConnected: dbStatus === 'connected',
        lastChecked,
        recheckConnection: checkConnection,
      }}
    >
      {children}
    </DatabaseConnectionContext.Provider>
  );
}

export function useDbConnection() {
  return useContext(DatabaseConnectionContext);
}
