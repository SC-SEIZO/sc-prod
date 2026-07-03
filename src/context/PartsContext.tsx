import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

interface PartsContextType {
  parts: any[];
  isLoading: boolean;
  fetchParts: () => Promise<void>;
  setParts: React.Dispatch<React.SetStateAction<any[]>>;
  addPart: (newPart: any) => void;
  deletePart: (partNumber: string) => void;
  importParts: (newParts: any[]) => Promise<void>;
  clearParts: () => Promise<void>;
  updatePart: (oldPartNumber: string, revisedPart: any) => void;
  forecastHistory: any[];
  addHistoryRecord: (items: any[]) => Promise<void>;
  fetchHistory: () => Promise<void>;
}

const PartsContext = createContext<PartsContextType>({
  parts: [],
  isLoading: false,
  fetchParts: async () => {},
  setParts: () => {},
  addPart: () => {},
  deletePart: () => {},
  importParts: async () => {},
  clearParts: async () => {},
  updatePart: () => {},
  forecastHistory: [],
  addHistoryRecord: async () => {},
  fetchHistory: async () => {},
});

let detectedCycleTimeColumn = 'cycle_time';
let hasForecastColumns = false;
let hasMonthlyForecastsColumn = false;

const getForecastMonthKeys = () => {
  const now = new Date();
  const currentMonthIdx = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  const getKey = (offset: number) => {
    const targetMonthIdx = (currentMonthIdx + offset) % 12;
    const targetYear = currentYear + Math.floor((currentMonthIdx + offset) / 12);
    const mm = String(targetMonthIdx + 1).padStart(2, '0');
    return `${targetYear}-${mm}`;
  };
  
  return {
    monthN: getKey(0),
    monthN1: getKey(1),
    monthN2: getKey(2),
    monthN3: getKey(3),
  };
};

export function PartsProvider({ children }: { children: React.ReactNode }) {
  // Parts are loaded exclusively from Supabase — no hardcoded fallback data
  const [parts, setParts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchParts = async () => {
    if ((import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY) {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('master_parts').select('*');
        if (!error && data) {
          if (data.length === 0) {
            setParts([]);
          } else {
            if (data.length > 0) {
              if ('cycletime' in data[0]) {
                detectedCycleTimeColumn = 'cycletime';
              } else {
                detectedCycleTimeColumn = 'cycle_time';
              }
              hasForecastColumns = 'daily_requirement_n' in data[0];
              hasMonthlyForecastsColumn = 'monthly_forecasts' in data[0];
            }

            // Normalize data mapping to support camelCase format used by UI
            const parsed = data.map(p => {
              const partNumber = p.part_number || p.partNumber || '';
              const sebango = p.sebango || p.id || '';
              
              // Load from JSONB monthly_forecasts
              const dbForecasts = p.monthly_forecasts || {};
              const monthKeys = getForecastMonthKeys();
              const fN = dbForecasts[monthKeys.monthN] || {};
              const fN1 = dbForecasts[monthKeys.monthN1] || {};
              const fN2 = dbForecasts[monthKeys.monthN2] || {};
              const fN3 = dbForecasts[monthKeys.monthN3] || {};

              // Safe parsing of numeric properties
              const cavity = p.cavity !== undefined && p.cavity !== null ? Number(p.cavity) : (p.kav !== undefined ? Number(p.kav) : 1);
              const mold = p.mold || 'MOLD-01';
              const weight = p.weight !== undefined && p.weight !== null ? Number(p.weight) : 0;

              // Monthly Forecast and Daily Requirements
              const dailyRequirementN = fN.daily !== undefined ? Number(fN.daily) : (p.daily_requirement_n !== undefined && p.daily_requirement_n !== null ? Number(p.daily_requirement_n) : 0);
              const dailyRequirementN1 = fN1.daily !== undefined ? Number(fN1.daily) : (p.daily_requirement_n1 !== undefined && p.daily_requirement_n1 !== null ? Number(p.daily_requirement_n1) : 0);
              const dailyRequirementN2 = fN2.daily !== undefined ? Number(fN2.daily) : (p.daily_requirement_n2 !== undefined && p.daily_requirement_n2 !== null ? Number(p.daily_requirement_n2) : 0);
              const dailyRequirementN3 = fN3.daily !== undefined ? Number(fN3.daily) : (p.daily_requirement_n3 !== undefined && p.daily_requirement_n3 !== null ? Number(p.daily_requirement_n3) : 0);
              
              const monthN = fN.volume !== undefined ? Number(fN.volume) : (p.month_n_forecast !== undefined && p.month_n_forecast !== null ? Number(p.month_n_forecast) : 0);
              const monthN1 = fN1.volume !== undefined ? Number(fN1.volume) : (p.month_n1_forecast !== undefined && p.month_n1_forecast !== null ? Number(p.month_n1_forecast) : 0);
              const monthN2 = fN2.volume !== undefined ? Number(fN2.volume) : (p.month_n2_forecast !== undefined && p.month_n2_forecast !== null ? Number(p.month_n2_forecast) : 0);
              const monthN3 = fN3.volume !== undefined ? Number(fN3.volume) : (p.month_n3_forecast !== undefined && p.month_n3_forecast !== null ? Number(p.month_n3_forecast) : 0);

              return {
                ...p,
                partNumber,
                partName: p.part_name || p.partName,
                homeLine: p.home_line || p.homeLine,
                backupLine: p.backup_line || p.backupLine,
                model: p.model_code || p.model,
                cycleTime: p.cycle_time || p.cycletime || p.cycleTime || 60,
                sebango,
                customer: p.customer || '',
                customerPno: p.customer_pno || p.customerPno || '',
                customerSebango: p.customer_sebango || p.customerSebango || '',
                cavity,
                mold,
                weight,
                shikake: p.shikake !== undefined && p.shikake !== null ? Number(p.shikake) : 2,
                spec: p.spec || 1,
                dailyRequirementN,
                dailyRequirementN1,
                dailyRequirementN2,
                dailyRequirementN3,
                monthN,
                monthN1,
                monthN2,
                monthN3,
                monthly_forecasts: dbForecasts
              };
            });
            setParts(parsed);
          }
        }
      } catch (err) {
        console.error('Error fetching parts:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const addPart = async (newPart: any) => {
    setParts(prev => {
      const filtered = prev.filter(p => (p.partNumber || '').trim().toUpperCase() !== (newPart.partNumber || '').trim().toUpperCase());
      const updated = [newPart, ...filtered];
      return updated;
    });

    // 2. Sync with Supabase
    if (supabase) {
      try {
        const payload: any = {
          part_number: (newPart.partNumber || '').trim(),
          part_name: (newPart.partName || '').trim(),
          home_line: (newPart.homeLine || '').trim(),
          backup_line: (newPart.backupLine || '').trim(),
          model: (newPart.model || '').trim(),
          sebango: (newPart.sebango || '').trim(),
          material: (newPart.material || '').trim(),
          area: (newPart.area || '').trim(),
          tonnage: (newPart.tonnage || '').trim(),
          cavity: parseFloat(newPart.cavity) || 1,
          mold: newPart.mold ? (newPart.mold || '').trim() : 'MOLD-01',
          weight: parseFloat(newPart.weight) || 0,
          shikake: parseInt(newPart.shikake) || 2,
          spec: newPart.spec || 1,
          process: 'injection',
          customer: newPart.customer ? (newPart.customer || '').trim() : '',
          customer_pno: newPart.customerPno ? (newPart.customerPno || '').trim() : '',
          customer_sebango: newPart.customerSebango ? (newPart.customerSebango || '').trim() : ''
        };

        if (detectedCycleTimeColumn === 'cycletime') {
          payload.cycletime = parseFloat(newPart.cycleTime) || 60;
        } else {
          payload.cycle_time = parseFloat(newPart.cycleTime) || 60;
        }

        if (hasForecastColumns) {
          payload.daily_requirement_n = parseFloat(newPart.dailyRequirementN) || 0;
          payload.daily_requirement_n1 = parseFloat(newPart.dailyRequirementN1) || 0;
          payload.daily_requirement_n2 = parseFloat(newPart.dailyRequirementN2) || 0;
          payload.daily_requirement_n3 = parseFloat(newPart.dailyRequirementN3) || 0;
          payload.month_n_forecast = parseFloat(newPart.monthN) || 0;
          payload.month_n1_forecast = parseFloat(newPart.monthN1) || 0;
          payload.month_n2_forecast = parseFloat(newPart.monthN2) || 0;
          payload.month_n3_forecast = parseFloat(newPart.monthN3) || 0;
        }

        if (hasMonthlyForecastsColumn) {
          payload.monthly_forecasts = newPart.monthly_forecasts || {};
        }

        const { data: existing, error: selectError } = await supabase
          .from('master_parts')
          .select('id')
          .eq('part_number', (newPart.partNumber || '').trim());

        if (!selectError) {
          if (existing && existing.length > 0) {
            const { error: updateError } = await supabase
              .from('master_parts')
              .update(payload)
              .eq('id', existing[0].id);
            if (updateError) console.error('Supabase addPart update error:', updateError);
          } else {
            const { error: insertError } = await supabase
              .from('master_parts')
              .insert(payload);
            if (insertError) console.error('Supabase addPart insert error:', insertError);
          }
        }
      } catch (err) {
        console.error('Supabase addPart exception:', err);
      }
    }
  };

  const deletePart = async (partNumber: string) => {
    setParts(prev => {
      const updated = prev.filter(p => (p.partNumber || '').trim().toUpperCase() !== (partNumber || '').trim().toUpperCase());
      return updated;
    });

    // 2. Sync with Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('master_parts')
          .delete()
          .eq('part_number', (partNumber || '').trim());
        if (error) console.error('Supabase deletePart error:', error);
      } catch (err) {
        console.error('Supabase deletePart exception:', err);
      }
    }
  };

  // Merge/upsert import: parts in the list are added if new, or updated if a
  // part with the same part_number already exists. Existing parts NOT present
  // in the list are left untouched (no more destructive delete-all-reinsert).
  const importParts = async (newPartsList: any[]) => {
    if (newPartsList.length === 0) return;

    // 1. Update local state (merge by part_number)
    setParts(prev => {
      const incomingKeys = new Set(
        newPartsList.map(p => (p.partNumber || '').trim().toUpperCase())
      );
      const untouched = prev.filter(
        p => !incomingKeys.has((p.partNumber || '').trim().toUpperCase())
      );
      return [...newPartsList, ...untouched];
    });

    // 2. Sync with Supabase via upsert on the unique part_number column
    if (supabase) {
      try {
        const payloads = newPartsList.map(p => {
          const payload: any = {
            part_number: (p.partNumber || '').trim(),
            part_name: (p.partName || '').trim(),
            home_line: (p.homeLine || '').trim(),
            backup_line: (p.backupLine || '').trim(),
            model: (p.model || '').trim(),
            sebango: (p.sebango || '').trim(),
            material: (p.material || '').trim(),
            area: (p.area || '').trim(),
            tonnage: (p.tonnage || '').trim(),
            cavity: parseFloat(p.cavity) || 1,
            mold: p.mold ? (p.mold || '').trim() : 'MOLD-01',
            weight: parseFloat(p.weight) || 0,
            shikake: parseInt(p.shikake) || 2,
            spec: p.spec || 1,
            process: 'injection',
            customer: p.customer ? (p.customer || '').trim() : '',
            customer_pno: p.customerPno ? (p.customerPno || '').trim() : '',
            customer_sebango: p.customerSebango ? (p.customerSebango || '').trim() : ''
          };

          if (detectedCycleTimeColumn === 'cycletime') {
            payload.cycletime = parseFloat(p.cycleTime) || 60;
          } else {
            payload.cycle_time = parseFloat(p.cycleTime) || 60;
          }

          if (hasForecastColumns) {
            payload.daily_requirement_n = parseFloat(p.dailyRequirementN) || 0;
            payload.daily_requirement_n1 = parseFloat(p.dailyRequirementN1) || 0;
            payload.daily_requirement_n2 = parseFloat(p.dailyRequirementN2) || 0;
            payload.daily_requirement_n3 = parseFloat(p.dailyRequirementN3) || 0;
            payload.month_n_forecast = parseFloat(p.monthN) || 0;
            payload.month_n1_forecast = parseFloat(p.monthN1) || 0;
            payload.month_n2_forecast = parseFloat(p.monthN2) || 0;
            payload.month_n3_forecast = parseFloat(p.monthN3) || 0;
          }

          if (hasMonthlyForecastsColumn) {
            payload.monthly_forecasts = p.monthly_forecasts || {};
          }
          return payload;
        });

        // Upsert: insert new part numbers, update existing ones in place
        const { error: upsertError } = await supabase
          .from('master_parts')
          .upsert(payloads, { onConflict: 'part_number' });

        if (upsertError) {
          console.error('Supabase bulk upsert error:', upsertError);
        }
      } catch (err) {
        console.error('Supabase bulk sync exception:', err);
      }
    }
  };

  // Explicit full wipe — only used by the "Clear Database" action.
  const clearParts = async () => {
    setParts([]);
    if (supabase) {
      try {
        const { error } = await supabase
          .from('master_parts')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) console.error('Supabase clear master_parts error:', error);
      } catch (err) {
        console.error('Supabase clearParts exception:', err);
      }
    }
  };

  const updatePart = async (oldPartNumber: string, revisedPart: any) => {
    setParts(prev => {
      const filtered = prev.filter(
        p => (p.partNumber || '').trim().toUpperCase() !== (oldPartNumber || '').trim().toUpperCase() && 
             (p.partNumber || '').trim().toUpperCase() !== (revisedPart.partNumber || '').trim().toUpperCase()
      );
      const updated = [revisedPart, ...filtered];
      return updated;
    });

    // 2. Sync with Supabase
    if (supabase) {
      try {
        const payload: any = {
          part_number: (revisedPart.partNumber || '').trim(),
          part_name: (revisedPart.partName || '').trim(),
          home_line: (revisedPart.homeLine || '').trim(),
          backup_line: (revisedPart.backupLine || '').trim(),
          model: (revisedPart.model || '').trim(),
          sebango: (revisedPart.sebango || '').trim(),
          material: (revisedPart.material || '').trim(),
          area: (revisedPart.area || '').trim(),
          tonnage: (revisedPart.tonnage || '').trim(),
          cavity: parseFloat(revisedPart.cavity) || 1,
          mold: revisedPart.mold ? (revisedPart.mold || '').trim() : 'MOLD-01',
          weight: parseFloat(revisedPart.weight) || 0,
          shikake: parseInt(revisedPart.shikake) || 2,
          spec: revisedPart.spec || 1,
          process: 'injection',
          customer: revisedPart.customer ? (revisedPart.customer || '').trim() : '',
          customer_pno: revisedPart.customerPno ? (revisedPart.customerPno || '').trim() : '',
          customer_sebango: revisedPart.customerSebango ? (revisedPart.customerSebango || '').trim() : ''
        };

        if (detectedCycleTimeColumn === 'cycletime') {
          payload.cycletime = parseFloat(revisedPart.cycleTime) || 60;
        } else {
          payload.cycle_time = parseFloat(revisedPart.cycleTime) || 60;
        }

        if (hasForecastColumns) {
          payload.daily_requirement_n = parseFloat(revisedPart.dailyRequirementN) || 0;
          payload.daily_requirement_n1 = parseFloat(revisedPart.dailyRequirementN1) || 0;
          payload.daily_requirement_n2 = parseFloat(revisedPart.dailyRequirementN2) || 0;
          payload.daily_requirement_n3 = parseFloat(revisedPart.dailyRequirementN3) || 0;
          payload.month_n_forecast = parseFloat(revisedPart.monthN) || 0;
          payload.month_n1_forecast = parseFloat(revisedPart.monthN1) || 0;
          payload.month_n2_forecast = parseFloat(revisedPart.monthN2) || 0;
          payload.month_n3_forecast = parseFloat(revisedPart.monthN3) || 0;
        }

        if (hasMonthlyForecastsColumn) {
          payload.monthly_forecasts = revisedPart.monthly_forecasts || {};
        }

        const isRenamed = (oldPartNumber || '').trim().toUpperCase() !== (revisedPart.partNumber || '').trim().toUpperCase();
        if (isRenamed) {
          const { error: delError } = await supabase
            .from('master_parts')
            .delete()
            .eq('part_number', (oldPartNumber || '').trim());
          if (delError) console.error('Supabase updatePart delete error:', delError);
        }

        const { data: existing, error: selectError } = await supabase
          .from('master_parts')
          .select('id')
          .eq('part_number', (revisedPart.partNumber || '').trim());

        if (!selectError) {
          if (existing && existing.length > 0) {
            const { error: updateError } = await supabase
              .from('master_parts')
              .update(payload)
              .eq('id', existing[0].id);
            if (updateError) console.error('Supabase updatePart update error:', updateError);
          } else {
            const { error: insertError } = await supabase
              .from('master_parts')
              .insert(payload);
            if (insertError) console.error('Supabase updatePart insert error:', insertError);
          }
        }
      } catch (err) {
        console.error('Supabase updatePart exception:', err);
      }
    }
  };

  const [forecastHistory, setForecastHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('history_orders')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.log('history_orders fetch skipped (table may not exist in Supabase yet):', error.message);
          return;
        }

        if (data && data.length > 0) {
          // Group by batch_id
          const groups: Record<string, any> = {};
          data.forEach(row => {
            const bId = row.batch_id || 'unknown';
            if (!groups[bId]) {
              groups[bId] = {
                id: bId,
                created_at: row.created_at || new Date().toISOString(),
                items: []
              };
            }
            groups[bId].items.push({
              sebango: row.sebango,
              partNumber: row.part_number,
              partName: row.part_name,
              monthN: Number(row.month_n_volume || 0),
              monthN1: Number(row.month_n1_volume || 0),
              monthN2: Number(row.month_n2_volume || 0),
              monthN3: Number(row.month_n3_volume || 0),
              dailyRequirementN: Number(row.daily_requirement_n || 0),
              dailyRequirementN1: Number(row.daily_requirement_n1 || 0),
              dailyRequirementN2: Number(row.daily_requirement_n2 || 0),
              dailyRequirementN3: Number(row.daily_requirement_n3 || 0)
            });
          });
          
          const historyRecords = Object.values(groups).map((g: any) => ({
            ...g,
            itemCount: g.items.length
          })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          setForecastHistory(historyRecords);
        }
      } catch (err) {
        console.error('Error fetching history_orders:', err);
      }
    }
  };

  const addHistoryRecord = async (items: any[]) => {
    const record = {
      id: `hist-${Date.now()}`,
      created_at: new Date().toISOString(),
      itemCount: items.length,
      items: items.map(item => ({
        sebango: item.sebango,
        partNumber: item.partNumber,
        partName: item.partName,
        monthN: item.monthN,
        monthN1: item.monthN1,
        monthN2: item.monthN2,
        monthN3: item.monthN3,
        dailyRequirementN: item.dailyRequirementN,
        dailyRequirementN1: item.dailyRequirementN1,
        dailyRequirementN2: item.dailyRequirementN2,
        dailyRequirementN3: item.dailyRequirementN3
      }))
    };
    
    setForecastHistory(prev => {
      const updated = [record, ...prev];
      return updated;
    });
    
    // Sync with Supabase history_orders table (if table exists)
    if (supabase) {
      try {
        const batchTimestamp = record.created_at;
        const rows = items.map(item => ({
          batch_id: record.id,
          created_at: batchTimestamp,
          sebango: item.sebango,
          part_number: item.partNumber,
          part_name: item.partName,
          month_n_volume: item.monthN,
          month_n1_volume: item.monthN1,
          month_n2_volume: item.monthN2,
          month_n3_volume: item.monthN3,
          daily_requirement_n: item.dailyRequirementN,
          daily_requirement_n1: item.dailyRequirementN1,
          daily_requirement_n2: item.dailyRequirementN2,
          daily_requirement_n3: item.dailyRequirementN3
        }));
        
        const { error } = await supabase.from('history_orders').insert(rows);
        if (error) {
          console.log('history_orders sync skipped (table may not exist in Supabase yet):', error.message);
        }
      } catch (err) {
        console.error('history_orders sync exception:', err);
      }
    }
  };

  useEffect(() => {
    fetchParts();
    fetchHistory();
  }, []);

  const reactiveParts = useMemo(() => {
    if (parts.length === 0) return [];
    const latestHistory = forecastHistory && forecastHistory.length > 0 ? forecastHistory[0] : null;
    if (!latestHistory) return parts;
    
    return parts.map(p => {
      const histItem = latestHistory.items?.find((it: any) => (it.sebango || '').trim().toUpperCase() === (p.sebango || '').trim().toUpperCase());
      if (!histItem) return p;
      
      return {
        ...p,
        dailyRequirementN: Number(histItem.dailyRequirementN || 0),
        dailyRequirementN1: Number(histItem.dailyRequirementN1 || 0),
        dailyRequirementN2: Number(histItem.dailyRequirementN2 || 0),
        dailyRequirementN3: Number(histItem.dailyRequirementN3 || 0),
        monthN: Number(histItem.monthN || 0),
        monthN1: Number(histItem.monthN1 || 0),
        monthN2: Number(histItem.monthN2 || 0),
        monthN3: Number(histItem.monthN3 || 0)
      };
    });
  }, [parts, forecastHistory]);

  return (
    <PartsContext.Provider value={{ parts: reactiveParts, isLoading, fetchParts, setParts, addPart, deletePart, importParts, clearParts, updatePart, forecastHistory, addHistoryRecord, fetchHistory }}>
      {children}
    </PartsContext.Provider>
  );
}

export function useParts() {
  return useContext(PartsContext);
}
