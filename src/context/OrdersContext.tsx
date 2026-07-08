import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParts } from './PartsContext';
import { ProductionContext, Job, resolveMachineKey, getTodayDateString, getHeijunkaJobsForMachine } from './ProductionContext';

export interface OrderConversion {
  id: string;
  custPartNumber: string; // Delivery Part Number
  custSebango: string;    // Customer's Sebango code
  prodSebango: string;    // Production Sebango (links to master_parts.sebango!)
  partCategory: 'big' | 'small'; // Big part (8h lead time) vs Small part (12h lead time)
}

export interface DailyOrder {
  id: string;
  channel: 'TMMIN' | 'ADM' | 'TBINA' | 'Others';
  custPartNumber: string;
  custSebango: string;
  qty: number;
  eta: string; // Format: 'YYYY-MM-DD HH:MM' or time string
}

export interface ProductionCommand {
  id: string;
  channel: 'TMMIN' | 'ADM' | 'TBINA' | 'Others';
  custPartNumber: string;
  custSebango: string;
  prodSebango: string;
  partName: string;
  homeLine: string;
  qty: number;
  category: 'big' | 'small';
  eta: string;         // Customer ETA
  triggerTime: string; // Solved production start time: ETA - 8h (Big) or ETA - 12h (Small) working hours
  status: 'pending' | 'injected';
  cavity: number;
  shots: number;
}

interface OrdersContextType {
  conversions: OrderConversion[];
  dailyOrders: DailyOrder[];
  commands: ProductionCommand[];
  injectedCommandIds: string[];
  addConversion: (conv: Omit<OrderConversion, 'id'>) => void;
  deleteConversion: (id: string) => void;
  updateConversion: (id: string, conv: Omit<OrderConversion, 'id'>) => void;
  uploadDailyOrders: (channel: 'TMMIN' | 'ADM' | 'TBINA' | 'Others', newOrders: Omit<DailyOrder, 'id' | 'channel'>[]) => void;
  clearDailyOrders: (channel?: 'TMMIN' | 'ADM' | 'TBINA' | 'Others') => void;
  injectCommandsToShopfloor: (commandIds: string[]) => void;
  resetInjections: () => void;
  fetchConversions: () => Promise<void>;
  clearConversions: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

// Helper to construct working hours block of SUGITY from ProductionContext
function getWorkingBlocks(dayOT: string, nightOT: string) {
  const blocks: [number, number][] = [];
  blocks.push([0, 60]); // 00:00 - 01:00
  blocks.push([100, 280]); // 01:40 - 04:40
  if (nightOT === '1h') blocks.push([295, 355]); // 04:55 - 05:55
  if (nightOT === '2h') blocks.push([295, 475]); // 04:55 - 07:55
  blocks.push([435, 570]); // 07:15 - 09:30
  blocks.push([580, 715]); // 09:40 - 11:55
  blocks.push([755, 965]); // 12:35 - 16:05
  if (dayOT === '1h') blocks.push([980, 1040]); // 16:20 - 17:20
  if (dayOT === '2h') blocks.push([980, 1100]); // 16:20 - 18:20
  if (dayOT === '3h') { blocks.push([980, 1100]); blocks.push([1120, 1180]); }
  if (dayOT === '4h') { blocks.push([980, 1100]); blocks.push([1120, 1240]); }
  blocks.push([1260, 1440]); // 21:00 - 00:00
  
  blocks.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const block of blocks) {
    if (merged.length === 0) {
      merged.push([...block]);
    } else {
      const last = merged[merged.length - 1];
      if (block[0] <= last[1]) {
        last[1] = Math.max(last[1], block[1]);
      } else {
        merged.push([...block]);
      }
    }
  }
  return merged;
}

// Custom solver that moves BACKWARD through SUGITY working blocks specifically
export function subtractWorkingMinutes(current: Date, minutesToSubtract: number, dayOT: string, nightOT: string): Date {
  let result = new Date(current);
  let remaining = minutesToSubtract;
  let iterations = 0;
  
  while (remaining > 0 && iterations < 1000) {
    iterations++;
    const blocks = getWorkingBlocks(dayOT, nightOT);
    const timeInMins = result.getHours() * 60 + result.getMinutes() + result.getSeconds() / 60;
    
    let foundBlock = false;
    
    // Iterate backwards through the working blocks
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (timeInMins > block[0] && timeInMins <= block[1]) {
        const available = timeInMins - block[0];
        if (remaining <= available) {
          result.setMinutes(result.getMinutes() - remaining);
          remaining = 0;
          foundBlock = true;
          break;
        } else {
          remaining -= available;
          result.setHours(Math.floor(block[0] / 60), block[0] % 60, 0, 0);
          foundBlock = true;
          break;
        }
      } else if (timeInMins > block[1]) {
        result.setHours(Math.floor(block[1] / 60), block[1] % 60, 0, 0);
        foundBlock = true;
        break;
      }
    }
    
    if (!foundBlock) {
      // Step to previous day and snap to 23:59:59.999
      result.setDate(result.getDate() - 1);
      result.setHours(23, 59, 59, 999);
    }
  }
  
  return result;
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { parts } = useParts();
  const prodContext = useContext(ProductionContext);

  // Conversion rules come exclusively from Supabase — no hardcoded seed data
  const [conversions, setConversions] = useState<OrderConversion[]>([]);

  const [dailyOrders, setDailyOrders] = useState<DailyOrder[]>([]);
  const [injectedCommandIds, setInjectedCommandIds] = useState<string[]>([]);

  const [commands, setCommands] = useState<ProductionCommand[]>([]);

  // 1. Fetch conversions on start (local memory only)
  const fetchConversions = async () => {
    // Under local SQLite/PostgreSQL setup, order conversions are not implemented yet
  };

  useEffect(() => {
    fetchConversions();
  }, []);

  // Compute production commands using merged master parts parameters and reverse lead-time solver
  useEffect(() => {
    // Helper to get earliest ETA string
    const getEarliestEta = (eta1: string, eta2: string) => {
      if (!eta1) return eta2;
      if (!eta2) return eta1;
      const d1 = new Date(eta1.replace(' ', 'T'));
      const d2 = new Date(eta2.replace(' ', 'T'));
      if (isNaN(d1.getTime())) return eta2;
      if (isNaN(d2.getTime())) return eta1;
      return d1.getTime() < d2.getTime() ? eta1 : eta2;
    };

    // 1. Map each daily order to its master part and gather details
    const mappedOrders = dailyOrders.map(order => {
      const orderPartNo = order.custPartNumber.trim().toUpperCase();
      const orderSebango = order.custSebango.trim().toUpperCase();

      const matchedPart = parts.find(p => {
        const matchCustPno = p.customerPno && typeof p.customerPno === 'string' && p.customerPno.split(',').some((pno: string) => pno.trim().toUpperCase() === orderPartNo);
        const matchCustSeb = p.customerSebango && typeof p.customerSebango === 'string' && p.customerSebango.split(',').some((seb: string) => seb.trim().toUpperCase() === orderSebango);
        const matchInternalPno = p.partNumber && p.partNumber.trim().toUpperCase() === orderPartNo;
        const matchInternalSeb = p.sebango && p.sebango.trim().toUpperCase() === orderSebango;
        return matchCustPno || matchCustSeb || matchInternalPno || matchInternalSeb;
      });

      return {
        order,
        matchedPart,
        prodSebango: matchedPart ? matchedPart.sebango : 'NO MAPPING'
      };
    });

    // 2. Group the mapped orders
    // Group by prodSebango + channel + date (ignoring time) if mapped.
    // If not mapped, keep separate by grouping by NOMAP + custPartNumber + channel + eta.
    const groups: Record<string, {
      prodSebango: string;
      channel: 'TMMIN' | 'ADM' | 'TBINA' | 'Others';
      eta: string;
      qty: number;
      custPartNumbers: string[];
      custSebangos: string[];
      matchedPart: any | null;
    }> = {};

    mappedOrders.forEach(({ order, matchedPart, prodSebango }) => {
      let key = '';
      if (prodSebango !== 'NO MAPPING') {
        const dateKey = order.eta.split(' ')[0] || order.eta;
        key = `${prodSebango}_${order.channel}_${dateKey}`;
      } else {
        key = `NOMAP_${order.custPartNumber}_${order.channel}_${order.eta}`;
      }

      if (!groups[key]) {
        groups[key] = {
          prodSebango,
          channel: order.channel,
          eta: order.eta,
          qty: 0,
          custPartNumbers: [],
          custSebangos: [],
          matchedPart
        };
      }

      groups[key].qty += order.qty;
      groups[key].eta = getEarliestEta(groups[key].eta, order.eta);
      if (!groups[key].custPartNumbers.includes(order.custPartNumber)) {
        groups[key].custPartNumbers.push(order.custPartNumber);
      }
      if (!groups[key].custSebangos.includes(order.custSebango)) {
        groups[key].custSebangos.push(order.custSebango);
      }
    });

    // 3. Convert groups into ProductionCommands
    const resolved = Object.entries(groups).map(([key, group]): ProductionCommand => {
      const { prodSebango, channel, eta, qty, custPartNumbers, custSebangos, matchedPart } = group;
      
      let category: 'big' | 'small' = 'big';
      let partName = 'Unknown Part (No Mapping)';
      let homeLine = 'Unassigned Machine';
      let cavity = 1;

      if (matchedPart) {
        cavity = matchedPart.cavity || matchedPart.kav || 1;
        const tonnage = matchedPart.tonnage || '';
        const name = (matchedPart.partName || '').toUpperCase();
        if (parseInt(tonnage) >= 2000 || name.includes('BUMPER') || name.includes('PANEL') || name.includes('BOARD') || name.includes('INSTRUMENT')) {
          category = 'big';
        } else {
          category = 'small';
        }
        partName = matchedPart.partName;
        homeLine = resolveMachineKey(matchedPart.homeLine);
      }

      // Calculate reverse trigger time
      let triggerTime = eta;
      if (matchedPart) {
        const minutesToSubtract = category === 'big' ? 480 : 720;
        
        let dOT = 'teiji';
        let nOT = 'teiji';
        if (prodContext) {
          dOT = prodContext.dayOTs[homeLine] || 'teiji';
          nOT = prodContext.nightOTs[homeLine] || 'teiji';
        }
        
        let etaDate = new Date(eta.replace(' ', 'T'));
        if (isNaN(etaDate.getTime())) {
          etaDate = new Date(eta);
        }
        if (!isNaN(etaDate.getTime())) {
          const triggerDate = subtractWorkingMinutes(etaDate, minutesToSubtract, dOT, nOT);
          const yyyy = triggerDate.getFullYear();
          const mm = String(triggerDate.getMonth() + 1).padStart(2, '0');
          const dd = String(triggerDate.getDate()).padStart(2, '0');
          const hh = String(triggerDate.getHours()).padStart(2, '0');
          const min = String(triggerDate.getMinutes()).padStart(2, '0');
          triggerTime = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        }
      }

      const cmdId = `cmd-${channel}-${prodSebango !== 'NO MAPPING' ? prodSebango : 'NOMAP_' + custPartNumbers.join('_')}-${eta.replace(/[^A-Za-z0-9]/g, '_')}`;
      const isInjected = injectedCommandIds.includes(cmdId);

      return {
        id: cmdId,
        channel,
        custPartNumber: custPartNumbers.join(', '),
        custSebango: custSebangos.join(', '),
        prodSebango,
        partName,
        homeLine,
        qty,
        category,
        eta,
        triggerTime,
        status: isInjected ? 'injected' : 'pending',
        cavity,
        shots: Math.ceil(qty / cavity)
      };
    });

    setCommands(resolved);
  }, [dailyOrders, parts, prodContext, injectedCommandIds]);

  // Auto-inject newly resolved valid commands reactively upon upload or manual order entry
  useEffect(() => {
    const uninjectedValidCommands = commands.filter(
      c => c.prodSebango !== 'NO MAPPING' && !injectedCommandIds.includes(c.id)
    );
    
    if (uninjectedValidCommands.length > 0) {
      const ids = uninjectedValidCommands.map(c => c.id);
      injectCommandsToShopfloor(ids);
    }
  }, [commands, injectedCommandIds]);

  const addConversion = async (conv: Omit<OrderConversion, 'id'>) => {
    const tempId = `conv-${Date.now()}`;
    const newConv: OrderConversion = {
      ...conv,
      id: tempId
    };
    
    setConversions(prev => [newConv, ...prev]);
  };

  const deleteConversion = async (id: string) => {
    setConversions(prev => prev.filter(c => c.id !== id));
  };

  const updateConversion = async (id: string, updatedFields: Omit<OrderConversion, 'id'>) => {
    setConversions(prev => prev.map(c => c.id === id ? { ...c, ...updatedFields } : c));
  };

  const uploadDailyOrders = (channel: 'TMMIN' | 'ADM' | 'TBINA' | 'Others', newOrders: Omit<DailyOrder, 'id' | 'channel'>[]) => {
    const parsedOrders: DailyOrder[] = newOrders.map((o, idx) => ({
      ...o,
      id: `do-${channel}-${Date.now()}-${idx}`,
      channel
    }));
    setDailyOrders(prev => [...parsedOrders, ...prev]);
  };

  const clearDailyOrders = (channel?: 'TMMIN' | 'ADM' | 'TBINA' | 'Others') => {
    if (channel) {
      setDailyOrders(prev => prev.filter(o => o.channel !== channel));
      setInjectedCommandIds(prev => prev.filter(id => !id.startsWith(`cmd-${channel}-`)));
      if (prodContext) {
        Object.keys(prodContext.machineJobs).forEach(compositeKey => {
          const current = prodContext.machineJobs[compositeKey] || [];
          const filtered = current.filter(j => !j.id.startsWith(`cmd-${channel}-`));
          const parts = compositeKey.split('_');
          if (parts.length >= 2) {
            const targetDate = parts[0];
            const mId = parts.slice(1).join('_');
            prodContext.reorderMachineJobs(mId, filtered, targetDate);
          } else {
            prodContext.reorderMachineJobs(compositeKey, filtered);
          }
        });
      }
    } else {
      setDailyOrders([]);
      setInjectedCommandIds([]);
      if (prodContext) {
        Object.keys(prodContext.machineJobs).forEach(compositeKey => {
          const parts = compositeKey.split('_');
          if (parts.length >= 2) {
            const targetDate = parts[0];
            const mId = parts.slice(1).join('_');
            prodContext.reorderMachineJobs(mId, [], targetDate);
          } else {
            prodContext.reorderMachineJobs(compositeKey, []);
          }
        });
      }
    }
  };

  const injectCommandsToShopfloor = (commandIds: string[]) => {
    if (!prodContext) return;
    const { machineJobs, machineAvgJobs, reorderMachineJobs, dayOTs, nightOTs } = prodContext;
    
    const dailyQuantitiesByMachine: Record<string, Record<string, number>> = {};
    const dailyCustomersByMachine: Record<string, Record<string, string>> = {};
    const newlyInjected: string[] = [];
    
    commandIds.forEach(id => {
      if (injectedCommandIds.includes(id)) return;
      
      const cmd = commands.find(c => c.id === id);
      if (!cmd) return;
      
      const part = parts.find(
        p => 
          p.sebango.trim().toUpperCase() === cmd.prodSebango.trim().toUpperCase() || 
          p.partNumber.trim().toUpperCase() === cmd.prodSebango.trim().toUpperCase()
      );
      if (!part) return;
      
      const machineId = resolveMachineKey(cmd.homeLine);
      if (!machineId || machineId.includes('Unassigned') || machineId.trim().toUpperCase() === 'MACHINE') return;
      
      // Determine target date from cmd.eta (e.g. "2026-06-05 08:00")
      let targetDate = getTodayDateString();
      if (cmd.eta) {
        const match = cmd.eta.trim().match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) {
          targetDate = match[1];
        }
      }
      const compositeKey = `${targetDate}_${machineId}`;
      
      if (!dailyQuantitiesByMachine[compositeKey]) {
        dailyQuantitiesByMachine[compositeKey] = {};
        dailyCustomersByMachine[compositeKey] = {};
      }
      
      const modelKey = part.partNumber || part.sebango;
      dailyQuantitiesByMachine[compositeKey][modelKey] = (dailyQuantitiesByMachine[compositeKey][modelKey] || 0) + cmd.qty;
      if (cmd.channel) {
        dailyCustomersByMachine[compositeKey][modelKey] = cmd.channel;
      }
      newlyInjected.push(id);
    });

    // Map each compositeKey to the Average Plan sequence but with Daily Order quantities
    Object.entries(dailyQuantitiesByMachine).forEach(([compKey, quantities]) => {
      const keyParts = compKey.split('_');
      const targetDate = keyParts[0];
      const mId = keyParts.slice(1).join('_');
      
      const monthStr = targetDate.substring(0, 7);
      const avgKey = `${monthStr}_avg_${mId}`;
      const dayOT = dayOTs[compKey] || 'teiji';
      const nightOT = nightOTs[compKey] || 'teiji';
      
      // Retrieve the base average plan jobs sequence
      const avgJobsList = machineAvgJobs[avgKey] && machineAvgJobs[avgKey].length > 0
        ? machineAvgJobs[avgKey]
        : getHeijunkaJobsForMachine(mId, dayOT, nightOT, targetDate, parts);

      if (avgJobsList.length === 0) {
        reorderMachineJobs(mId, [], targetDate);
        return;
      }

      // Count occurrences of each model in the Average Plan sequence
      const occurrences: Record<string, number> = {};
      avgJobsList.forEach(job => {
        occurrences[job.model] = (occurrences[job.model] || 0) + 1;
      });

      // Build daily plan jobs following the exact average plan sequence but using daily quantities
      const dailyJobs = avgJobsList.map((job, idx) => {
        const model = job.model;
        let qtyLot = 0;
        
        if (quantities[model] !== undefined) {
          const count = occurrences[model] || 1;
          const kanban = job.spec && job.spec > 0 ? job.spec : 0;
          const rawQtyLot = quantities[model] / count;
          qtyLot = kanban > 0
            ? Math.ceil(rawQtyLot / kanban) * kanban
            : Math.round(rawQtyLot);
        } else {
          // If this part is NOT in the uploaded daily orders, QTY is 0
          qtyLot = 0;
        }

        // Recalculate runtime duration using cycle time and cavity
        const cavity = job.kav || 1;
        const ct = job.ct || 60;
        const runtimeMins = qtyLot > 0 ? Math.round(((qtyLot / cavity) * ct) / 60) : 0;

        return {
          ...job,
          id: `job-inj-${job.id}-${Date.now()}-${idx}`,
          qtyLot: qtyLot,
          time: runtimeMins,
          customer: dailyCustomersByMachine[compKey]?.[model] || job.customer,
          status: 'queued' as const,
          actualQty: 0,
          actualDandoriStart: undefined,
          actualDandoriEnd: undefined,
          actualProductionStart: undefined,
          actualProductionEnd: undefined,
          downtimeMinutes: undefined
        };
      });

      // Filter out jobs with QTY = 0 so they don't clutter the timeline
      const activeDailyJobs = dailyJobs.filter(j => j.qtyLot > 0);

      reorderMachineJobs(mId, activeDailyJobs, targetDate);
    });

    setInjectedCommandIds(prev => [...prev, ...newlyInjected]);
  };

  const resetInjections = () => {
    setInjectedCommandIds([]);
    if (prodContext) {
      Object.keys(prodContext.machineJobs).forEach(compositeKey => {
        const parts = compositeKey.split('_');
        if (parts.length >= 2) {
          const targetDate = parts[0];
          const mId = parts.slice(1).join('_');
          prodContext.reorderMachineJobs(mId, [], targetDate);
        } else {
          prodContext.reorderMachineJobs(compositeKey, []);
        }
      });
    }
  };

  const clearConversions = async () => {
    setConversions([]);
  };

  return (
    <OrdersContext.Provider value={{
      conversions,
      dailyOrders,
      commands,
      injectedCommandIds,
      addConversion,
      deleteConversion,
      updateConversion,
      uploadDailyOrders,
      clearDailyOrders,
      injectCommandsToShopfloor,
      resetInjections,
      fetchConversions,
      clearConversions
    }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}
