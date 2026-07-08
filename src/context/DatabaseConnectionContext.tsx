import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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
    try {
      const response = await fetch('/api/production-plans');
      if (response.ok) {
        setDbStatus('connected');
      } else {
        setDbStatus('disconnected');
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
