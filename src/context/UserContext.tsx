import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'planner' | 'member' | 'leader' | 'viewer' | 'production-board' | 'guest';
export type AppTheme = 'sugity' | 'carbon' | 'ocean' | 'sakura' | 'light';

export interface Leader {
  id?: string;
  name: string;
  created_at?: string;
}

// Session key holding the PIN the planner authenticated with. It doubles as
// the authorization header for planner-only leader endpoints (register,
// delete, reveal PINs) which the server validates against PLANNER_PIN.
const PLANNER_ADMIN_PIN_KEY = 'sugity_planner_admin_pin';

export const getPlannerAdminPin = (): string => {
  return localStorage.getItem(PLANNER_ADMIN_PIN_KEY) || '';
};

export const setPlannerAdminPin = (pin: string) => {
  localStorage.setItem(PLANNER_ADMIN_PIN_KEY, pin);
};

interface UserContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  leaders: Leader[];
  refreshLeaders: () => Promise<void>;
  addLeader: (name: string, pin: string) => Promise<void>;
  deleteLeader: (id: string) => Promise<void>;
  verifyLeaderPin: (pin: string) => Promise<Leader | null>;
  isLeaderDbConnected: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  // Persistence for session role
  const [role, setRoleState] = useState<UserRole>(() => {
    let saved = localStorage.getItem('sugity_active_role');
    if (saved === 'operator') {
      saved = 'member';
      localStorage.setItem('sugity_active_role', 'member');
    }
    if (saved === 'sachou') {
      // Legacy name for the fullscreen board role
      saved = 'production-board';
      localStorage.setItem('sugity_active_role', 'production-board');
    }
    if (saved === 'planner' || saved === 'member' || saved === 'leader' || saved === 'viewer' || saved === 'production-board' || saved === 'guest') {
      return saved as UserRole;
    }
    return 'guest'; // Default to guest (Front Login Page)
  });

  // Persistence for app theme
  const [theme, setThemeState] = useState<AppTheme>('light');

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [isLeaderDbConnected, setIsLeaderDbConnected] = useState<boolean>(false);

  // Leaders are managed exclusively through the app server API so PINs are
  // never exposed to the browser. Only names are ever listed client-side.
  const refreshLeaders = async () => {
    try {
      const res = await fetch('/api/leaders');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setLeaders(Array.isArray(body.leaders) ? body.leaders : []);
      setIsLeaderDbConnected(true);
    } catch (e) {
      setIsLeaderDbConnected(false);
    }
  };

  useEffect(() => {
    // Clean up the legacy plaintext PIN cache from older app versions
    localStorage.removeItem('sugity_leaders');

    refreshLeaders();

    // Re-sync leader names every 30 seconds to stay fresh across devices
    const syncInterval = setInterval(refreshLeaders, 30000);
    return () => clearInterval(syncInterval);
  }, []);

  const addLeader = async (name: string, pin: string) => {
    const res = await fetch('/api/leaders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getPlannerAdminPin()
      },
      body: JSON.stringify({ name, pin })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to register leader.');
    }
    await refreshLeaders();
  };

  const deleteLeader = async (id: string) => {
    const res = await fetch(`/api/leaders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': getPlannerAdminPin() }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to delete leader.');
    }
    await refreshLeaders();
  };

  const verifyLeaderPin = async (pinCode: string): Promise<Leader | null> => {
    const cleanPin = pinCode.trim();
    if (!cleanPin) return null;
    try {
      const res = await fetch('/api/leaders/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin })
      });
      if (!res.ok) return null;
      const body = await res.json();
      return body.leader || null;
    } catch (e) {
      return null;
    }
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('sugity_active_role', newRole);
  };

  const setTheme = (newTheme: AppTheme) => {
    setThemeState('light');
    localStorage.setItem('sugity_active_theme', 'light');
  };

  // Shift cutoff auto-logout checker (Day Shift: 07:00 - 21:00, Night Shift: 21:00 - 07:00)
  useEffect(() => {
    const getShiftForTime = (timestamp: number): 'day' | 'night' => {
      const date = new Date(timestamp);
      const hours = date.getHours();
      // Day shift: 07:00 to 21:00. Night shift: 21:00 to 07:00
      if (hours >= 7 && hours < 21) {
        return 'day';
      }
      return 'night';
    };

    const checkShiftCutoff = () => {
      // Only run if the user is currently authenticated as a member or leader
      const currentRole = localStorage.getItem('sugity_active_role');
      if (currentRole !== 'member' && currentRole !== 'leader') return;

      // 1. Check member session
      const savedMember = localStorage.getItem('sugity_member_machine_login');
      if (savedMember) {
        try {
          const parsed = JSON.parse(savedMember);
          if (parsed.loginTimestamp) {
            const loginShift = getShiftForTime(parsed.loginTimestamp);
            const currentShift = getShiftForTime(Date.now());
            if (loginShift !== currentShift) {
              localStorage.removeItem('sugity_member_machine_login');
              localStorage.removeItem('sugity_operator_machine_login');
              setRoleState('guest');
              localStorage.setItem('sugity_active_role', 'guest');
            }
          } else {
            // Seed legacy logins with current timestamp so tracking starts
            parsed.loginTimestamp = Date.now();
            localStorage.setItem('sugity_member_machine_login', JSON.stringify(parsed));
          }
        } catch (e) {
          // ignore
        }
      }

      // 2. Check leader session
      const savedLeader = localStorage.getItem('sugity_active_leader_session');
      if (savedLeader) {
        try {
          const parsed = JSON.parse(savedLeader);
          if (parsed.loginTimestamp) {
            const loginShift = getShiftForTime(parsed.loginTimestamp);
            const currentShift = getShiftForTime(Date.now());
            if (loginShift !== currentShift) {
              localStorage.removeItem('sugity_active_leader_session');
              setRoleState('guest');
              localStorage.setItem('sugity_active_role', 'guest');
            }
          } else {
            parsed.loginTimestamp = Date.now();
            localStorage.setItem('sugity_active_leader_session', JSON.stringify(parsed));
          }
        } catch (e) {
          // ignore
        }
      }
    };

    checkShiftCutoff();
    const interval = setInterval(checkShiftCutoff, 10000); // Poll shift boundary every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <UserContext.Provider value={{ 
      role, 
      setRole, 
      theme, 
      setTheme, 
      leaders,
      refreshLeaders,
      addLeader,
      deleteLeader,
      verifyLeaderPin,
      isLeaderDbConnected
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserProvider');
  }
  return {
    ...context,
    canEditMaster: context.role === 'planner',
    canEditPattern: context.role === 'planner' || context.role === 'leader',
    canExecute: context.role === 'member' || context.role === 'leader' || context.role === 'planner',
  };
}
