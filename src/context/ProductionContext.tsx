import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParts } from './PartsContext';
import { supabase } from '../lib/supabase';

export type JobStatus = 'completed' | 'dandori' | 'running' | 'queued';

export interface Job {
  id: string;
  seq: number;
  customer: string;
  model: string; // Part Number/Model Code
  partName: string;
  qtyDay: number;
  qtyLot: number; // Target quantity
  actualQty: number; // Actual progress quantity!
  mold: string;
  material: string;
  kav: number;
  ct: number; // Cycle time
  spec?: number; // Qty per Kanban (used to round qtyLot to nearest multiple)
  dandori: number;
  time: number;
  status: JobStatus;
  timeRange: string;
  dandoriTimeRange?: string; // Dandori time range performed after production
  shift: 'day' | 'night' | 'overflow';
  spansOffHours?: boolean;
  triggerTime?: string; // Target reverse trigger time
  eta?: string;         // Customer delivery ETA
  actualDandoriStart?: string;
  actualDandoriEnd?: string;
  actualProductionStart?: string;
  actualProductionEnd?: string;
  downtimeMinutes?: number;
  // Leader sign-off qty confirmation
  closedNgQty?: number;
  closedOkQty?: number;
}

export interface AbnormalityLog {
  id: string;
  machineId: string;
  date: string;
  time: string;
  type: string;
  message: string;
}

export interface ActiveAbnormality {
  isAbnormal: boolean;
  type: string;
  start: string;
}

export interface ActiveNg {
  isNg: boolean;
  type: string;
  start: string;
}

interface ProductionContextType {
  machineJobs: Record<string, Job[]>;
  machineAvgJobs: Record<string, Job[]>;
  logs: Record<string, AbnormalityLog[]>;
  dayOTs: Record<string, string>;
  nightOTs: Record<string, string>;
  activeAbnormalities: Record<string, ActiveAbnormality>;
  activeNgs: Record<string, ActiveNg>;
  setMachineAbnormal: (
    machineId: string, 
    isAbnormal: boolean, 
    type?: string, 
    start?: string, 
    dateStr?: string, 
    logMessage?: { type: string; note: string; timeStr?: string },
    downtimeMins?: number,
    downtimeJobId?: string
  ) => void;
  setMachineNg: (
    machineId: string,
    isNg: boolean,
    type?: string,
    start?: string,
    dateStr?: string,
    logMessage?: { type: string; note: string; timeStr?: string }
  ) => void;
  incrementJobProgress: (
    machineId: string, 
    jobId: string, 
    qty: number, 
    dateStr?: string, 
    customParts?: any[],
    logMessage?: { type: string; note: string }
  ) => void;
  updateJobStatus: (
    machineId: string, 
    jobId: string, 
    action: 'complete-running' | 'complete-dandori', 
    dateStr?: string, 
    customParts?: any[],
    logMessage?: { type: string; note: string },
    closedNgQty?: number,
    closedOkQty?: number
  ) => void;
  reviseJobNgQty: (
    machineId: string,
    jobId: string,
    newNgQty: number,
    newOkQty: number,
    dateStr?: string,
    logMessage?: { type: string; note: string }
  ) => void;
  reorderMachineJobs: (machineId: string, jobs: Job[], dateStr?: string) => void;
  reorderMachineAvgJobs: (machineId: string, jobs: Job[], dateStr?: string) => void;
  resetAllMachines: (dateStr?: string) => void;
  updateOTSettings: (machineId: string, dayOT: string, nightOT: string, dateStr?: string) => void;
  addAbnormalityRecord: (machineId: string, type: string, note: string, timeStr?: string, dateStr?: string) => void;
  initializeMachineIfEmpty: (machineId: string, dateStr?: string) => void;
  closeShiftProduction: (machineId: string, shift: 'day' | 'night', dateStr?: string) => void;
  addJobDowntime: (
    machineId: string, 
    jobId: string, 
    downtimeMins: number, 
    dateStr?: string, 
    customParts?: any[],
    logMessage?: { type: string; note: string }
  ) => void;
}

export const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

// Heijunka Timeline and Generation Helpers
function getWorkingBlocks(dayOT?: string, nightOT?: string) {
  const blocks: [number, number][] = [];
  
  // Day Shift Working Blocks (07:15 - 19:00, paused only by Sugity break hours)
  blocks.push([435, 570]);   // 07:15 - 09:30
  blocks.push([580, 715]);   // 09:40 - 11:55
  blocks.push([755, 965]);   // 12:35 - 16:05
  blocks.push([980, 1140]);  // 16:20 - 19:00 (ends at 19:00, break gap 18:20 - 18:40 removed)
  
  // Night Shift Working Blocks (21:00 - 07:15 the next day, paused only by Sugity break hours)
  blocks.push([1260, 1440]); // 21:00 - 00:00 (before midnight)
  blocks.push([0, 60]);      // 00:00 - 01:00 (after midnight before break)
  blocks.push([100, 280]);   // 01:40 - 04:40 (break gap is 01:00 - 01:40)
  blocks.push([295, 435]);   // 04:55 - 07:15 (break gap is 04:40 - 04:55)
  
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

export function addWorkingMinutes(current: Date, minutesToAdd: number, dayOT: string, nightOT: string): Date {
  let result = new Date(current);
  let remaining = minutesToAdd;
  let iterations = 0;
  while (remaining > 0 && iterations < 100) {
    iterations++;
    const blocks = getWorkingBlocks(dayOT, nightOT);
    const timeInMins = result.getHours() * 60 + result.getMinutes() + result.getSeconds() / 60;
    
    let foundBlock = false;
    for (const block of blocks) {
      if (timeInMins >= block[0] && timeInMins < block[1]) {
        const available = block[1] - timeInMins;
        if (remaining <= available) {
          result.setMinutes(result.getMinutes() + remaining);
          remaining = 0;
          foundBlock = true;
          break;
        } else {
          remaining -= available;
          result.setHours(Math.floor(block[1] / 60), block[1] % 60, 0, 0);
          foundBlock = true;
          break; 
        }
      } else if (timeInMins < block[0]) {
        result.setHours(Math.floor(block[0] / 60), block[0] % 60, 0, 0);
        foundBlock = true;
        break;
      }
    }
    if (!foundBlock) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
    }
  }
  return result;
}

const recalculateTimelineHelper = (items: Job[], dOT: string, nOT: string): Job[] => {
  const firstDayIdx = items.findIndex(item => item.shift === 'day');
  const firstNightIdx = items.findIndex(item => item.shift === 'night');

  let currentTime = new Date();
  currentTime.setHours(7, 15, 0, 0); // Start of Day Shift (07:15)
  
  const dayStart = new Date(currentTime);
  const nightPrepStart = new Date(dayStart);
  nightPrepStart.setHours(21, 0, 0, 0); // Night Prep starts at 21:00
  
  let lastDayEndTime = new Date(dayStart);
  // Set day production start after 15 min prepare (07:15 - 07:30)
  lastDayEndTime.setMinutes(lastDayEndTime.getMinutes() + 15); // 07:30

  let lastNightEndTime = new Date(nightPrepStart);
  lastNightEndTime.setMinutes(lastNightEndTime.getMinutes() + 10); // Night production starts at 21:10

  let isFirstNight = true;

  return items.map((item, index) => {
    let jobShift = item.shift || 'day';
    let jobStartClock = new Date();

    if (jobShift === 'day') {
      jobStartClock = new Date(lastDayEndTime);
    } else if (jobShift === 'night') {
      if (isFirstNight) {
        let nightStart = new Date(nightPrepStart);
        if (lastDayEndTime.getTime() > nightStart.getTime()) {
          nightStart = new Date(lastDayEndTime);
        }
        jobStartClock = new Date(nightStart);
        jobStartClock.setMinutes(jobStartClock.getMinutes() + 10); // starts after 10 min prep
        isFirstNight = false;
      } else {
        jobStartClock = new Date(lastNightEndTime);
      }
    } else {
      jobStartClock = new Date(lastNightEndTime);
    }

    const startStr = jobStartClock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const startTimeStamp = jobStartClock.getTime();

    let endJobClock = addWorkingMinutes(jobStartClock, item.time, dOT, nOT);
    const endStr = endJobClock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const endTimeStamp = endJobClock.getTime();

    // Dandori is ALWAYS at the end of production of every part
    const actualDandori = item.dandori !== undefined ? item.dandori : 15;

    let dandoriStartStr = '';
    let dandoriEndStr = '';
    let dandoriRangeStr = '';
    let runningClock = new Date(endJobClock);
    
    if (actualDandori > 0 && jobShift !== 'overflow') {
      const dandoriStartClock = new Date(endJobClock);
      const dandoriEndClock = addWorkingMinutes(dandoriStartClock, actualDandori, dOT, nOT);
      dandoriStartStr = dandoriStartClock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      dandoriEndStr = dandoriEndClock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      dandoriRangeStr = `${endStr} - ${dandoriEndStr}`;
      runningClock = dandoriEndClock;
    }

    // Update running clocks
    if (jobShift === 'day') {
      lastDayEndTime = new Date(runningClock);
    } else {
      lastNightEndTime = new Date(runningClock);
    }

    const elapsedMins = Math.round((endTimeStamp - startTimeStamp) / 60000);
    const spansOffHours = elapsedMins > item.time;

    let status = item.status;
    if (status !== 'completed' && status !== 'running') {
      if (index === firstDayIdx || index === firstNightIdx) {
        status = 'dandori';
      } else if (index > 0 && items[index - 1].status === 'completed') {
        status = 'dandori';
      } else {
        status = 'queued';
      }
    }

    let actualDandoriStart = item.actualDandoriStart;
    let actualDandoriEnd = item.actualDandoriEnd;
    let actualProductionStart = item.actualProductionStart;
    let actualProductionEnd = item.actualProductionEnd;

    if (status === 'queued') {
      actualDandoriStart = undefined;
      actualDandoriEnd = undefined;
      actualProductionStart = undefined;
      actualProductionEnd = undefined;
    } else if (status === 'dandori' && !actualDandoriStart) {
      actualDandoriStart = jobShift === 'night' ? '21:00' : '07:15';
    }

    if (status === 'running') {
      if (!actualDandoriStart) {
        actualDandoriStart = jobShift === 'night' ? '21:00' : '07:15';
      }
      if (!actualDandoriEnd) {
        // Only fallback to hardcoded time for dandori display —
        // but prefer actualProductionStart if already stored (prevents '07:30' overwrite)
        actualDandoriEnd = actualProductionStart || (jobShift === 'night' ? '21:10' : '07:30');
      }
      if (!actualProductionStart) {
        // If actualDandoriEnd was already stored (e.g. from complete-dandori action),
        // use it. Otherwise this job started without proper dandori recording.
        actualProductionStart = actualDandoriEnd;
      }
    }

    if (status === 'completed') {
      if (!actualDandoriStart) {
        actualDandoriStart = jobShift === 'night' ? '21:00' : '07:15';
      }
      if (!actualDandoriEnd) {
        actualDandoriEnd = jobShift === 'night' ? '21:10' : '07:30';
      }
      if (!actualProductionStart) {
        actualProductionStart = actualDandoriEnd;
      }
      if (!actualProductionEnd) {
        const [shStr, smStr] = actualProductionStart.split(':');
        const sh = parseInt(shStr, 10);
        const sm = parseInt(smStr, 10);
        const startClock = new Date();
        startClock.setHours(sh, sm, 0, 0);
        const endClock = new Date(startClock.getTime() + item.time * 60000);
        actualProductionEnd = endClock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }
    }

    return {
      ...item,
      seq: index + 1,
      timeRange: `${startStr} - ${endStr}`,
      dandoriTimeRange: dandoriRangeStr,
      shift: jobShift,
      dandori: actualDandori,
      status,
      spansOffHours,
      actualDandoriStart,
      actualDandoriEnd,
      actualProductionStart,
      actualProductionEnd
    };
  });
};

const savePlanToSupabase = async (
  id: string,
  planType: 'daily' | 'avg',
  machineId: string,
  dateKey: string,
  jobs: Job[],
  dayOT?: string,
  nightOT?: string,
  logsArray?: AbnormalityLog[]
) => {
  if (!supabase) return;
  try {
    const payload: any = {
      id,
      plan_type: planType,
      machine_id: machineId,
      date_key: dateKey,
      jobs,
      day_ot: dayOT || 'teiji',
      night_ot: nightOT || 'teiji',
      logs: logsArray || [],
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('production_plans')
      .upsert(payload, { onConflict: 'id' });

    if (error && error.message && error.message.includes("Could not find the 'logs' column")) {
      console.warn("Supabase does not have 'logs' column. Retrying upsert without 'logs'...");
      delete payload.logs;
      const retry = await supabase
        .from('production_plans')
        .upsert(payload, { onConflict: 'id' });
      error = retry.error;
    }

    if (error) {
      console.error(`Failed to upsert plan ${id} to Supabase:`, error);
    }
  } catch (e) {
    console.error(`Error saving plan ${id} to Supabase:`, e);
  }
};

export const ALL_ACTIVE_MACHINES = [
  // Fact 2
  'F2 MC 1', 'F2 MC 2', 'F2 MC 3', 'F2 MC 4', 'F2 MC 5', 'F2 MC 6', 'F2 MC 7', 'F2 MC 8',
  // Fact 3
  'F3 MC 1', 'F3 MC 2', 'F3 MC 3', 'F3 MC 4', 'F3 MC 5', 'F3 MC 6', 'F3 MC 7', 'F3 MC 8', 'F3 MC 9', 'F3 MC 10', 'F3 MC 10B', 'F3 MC 11', 'F3 MC 13', 'F3 MC 14',
  // Fact 4
  'F4 MC 1', 'F4 MC 7', 'F4 MC 8', 'F4 MC B1', 'F4 MC B2', 'F4 MC B3',
  // SC2 Resin
  'SC2 MC 1', 'SC2 MC 2', 'SC2 MC 3', 'SC2 MC 4', 'SC2 MC 5'
];

export const normalizeLineName = (line: string): string => {
  if (!line) return '';
  return line.trim().toUpperCase().replace(/\s+/g, '').replace(/#/g, '').replace(/MC/g, '').replace(/-?\d+T$/g, '');
};

interface ParsedMachine {
  factory: 'F2' | 'F3' | 'F4' | 'SC2' | 'UNKNOWN';
  machine: string;
}

export const parseMachineIdentifier = (str: string): ParsedMachine => {
  if (!str) return { factory: 'UNKNOWN', machine: '' };
  
  const upper = str.toUpperCase().replace(/\s+/g, '');
  
  // 1. Resolve Factory
  let factory: ParsedMachine['factory'] = 'UNKNOWN';
  if (upper.includes('FACT2') || upper.includes('F2') || upper.includes('FACTORY2')) {
    factory = 'F2';
  } else if (upper.includes('FACT3') || upper.includes('F3') || upper.includes('FACTORY3')) {
    factory = 'F3';
  } else if (upper.includes('FACT4') || upper.includes('F4') || upper.includes('FACTORY4')) {
    factory = 'F4';
  } else if (upper.includes('SC2')) {
    factory = 'SC2';
  }
  
  // 2. Resolve Machine identifier
  let remaining = upper
    .replace(/FACTORY\s*\d?/g, '')
    .replace(/FACT\s*\d?/g, '')
    .replace(/F\s*\d/g, '') // Strip F2, F3, F4 completely
    .replace(/SC\s*\d?/g, '') // Strip SC2
    .replace(/RESIN/g, '')
    .replace(/M\/C/g, '')
    .replace(/MC/g, '')
    .replace(/MACHINE/g, '')
    .replace(/#/g, '')
    .replace(/-?\d+T$/i, '') // strip tonnage suffixes
    .replace(/-/g, '');
    
  const match = remaining.match(/([B]?[0-9]+[B]?)/);
  const machine = match ? match[1] : remaining;
  
  return { factory, machine };
};

export const machinesMatch = (nameA: string, nameB: string): boolean => {
  const pA = parseMachineIdentifier(nameA);
  const pB = parseMachineIdentifier(nameB);
  if (pA.factory === 'UNKNOWN' || pB.factory === 'UNKNOWN') {
    const normA = normalizeLineName(nameA);
    const normB = normalizeLineName(nameB);
    return normA.includes(normB) || normB.includes(normA);
  }
  return pA.factory === pB.factory && pA.machine === pB.machine;
};

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

export const resolveMachineKey = (homeLine: string): string => {
  if (!homeLine) return 'Unassigned Machine';
  
  // Find standard machine key that matches
  const matched = ALL_ACTIVE_MACHINES.find(m => machinesMatch(homeLine, m));
  
  return matched || homeLine; // Fallback to raw if no match
};

export const getUniqueMachineKey = (factory: string, machine: string): string => {
  const cleanFact = factory.trim().toUpperCase();
  const cleanMc = machine.trim();
  
  if (cleanFact.includes('FACT 2') || cleanFact === 'F2') return `F2 ${cleanMc}`;
  if (cleanFact.includes('FACT 3') || cleanFact === 'F3') return `F3 ${cleanMc}`;
  if (cleanFact.includes('FACT 4') || cleanFact === 'F4') return `F4 ${cleanMc}`;
  if (cleanFact.includes('SC2') || cleanFact === 'SC2') return `SC2 ${cleanMc}`;
  
  return `${factory} ${machine}`;
};

export const getHeijunkaJobsForMachine = (
  machineId: string, 
  dOT = 'teiji', 
  nOT = 'teiji',
  dateStr?: string,
  customParts?: any[]
): Job[] => {
  // No hardcoded fallback data — callers must supply parts from the database
  const parts = customParts || [];

  if (!parts || !Array.isArray(parts) || parts.length === 0) return [];

  const machineParts = parts.filter(p => {
    if (!p.homeLine) return false;
    return machinesMatch(p.homeLine, machineId);
  });

  if (machineParts.length === 0) return [];

  const targetMonthKey = dateStr ? dateStr.substring(0, 7) : getTodayDateString().substring(0, 7);
  const monthKeys = getForecastMonthKeys();

  // Generate Heijunka Leveled Pattern based on SHIKAKE and Daily Requirements
  // Default pattern rules: Shikake 2 = Day 1x + Night 1x, Shikake 1 = Day 1x (di siang)
  const activeJobs: Job[] = [];
  
  // Group runs by part
  const partRuns: Job[][] = machineParts.map((part, pIdx) => {
    const dbForecasts = part.monthly_forecasts || {};
    const monthForecast = dbForecasts[targetMonthKey];
    
    let qtyDay = 400;
    if (monthForecast && monthForecast.daily !== undefined) {
      qtyDay = Number(monthForecast.daily);
    } else {
      if (targetMonthKey === monthKeys.monthN) {
        qtyDay = part.dailyRequirementN !== undefined ? Number(part.dailyRequirementN) : (part.qtyDay || 400);
      } else if (targetMonthKey === monthKeys.monthN1) {
        qtyDay = part.dailyRequirementN1 !== undefined ? Number(part.dailyRequirementN1) : 400;
      } else if (targetMonthKey === monthKeys.monthN2) {
        qtyDay = part.dailyRequirementN2 !== undefined ? Number(part.dailyRequirementN2) : 400;
      } else if (targetMonthKey === monthKeys.monthN3) {
        qtyDay = part.dailyRequirementN3 !== undefined ? Number(part.dailyRequirementN3) : 400;
      } else {
        qtyDay = part.dailyRequirementN !== undefined ? Number(part.dailyRequirementN) : (part.qtyDay || 400);
      }
    }

    // Skip parts with 0 requirement for this planning month
    if (qtyDay <= 0) {
      return [];
    }

    const runs = part.shikake || 2;
    const kanban = part.spec && Number(part.spec) > 0 ? Number(part.spec) : 0;
    const rawQtyLot = qtyDay / runs;
    const qtyLot = kanban > 0
      ? Math.ceil(rawQtyLot / kanban) * kanban
      : Math.round(rawQtyLot) || 200;
    const cavity = part.cavity || ((part.partNumber?.includes('75851/2-BZ130') || part.model?.includes('75851/2-BZ130') || part.sebango?.includes('BZ130')) ? 2 : 1);
    const ct = part.cycleTime || 60;
    const runtimeMins = Math.round(((qtyLot / cavity) * ct) / 60);

    const jobsList: Job[] = [];
    for (let r = 0; r < runs; r++) {
      jobsList.push({
        id: `job-init-${machineId}-${part.partNumber || part.sebango || pIdx}-${r}`,
        seq: 0, // will be set during leveling
        customer: part.customer || 'Unknown',
        model: part.partNumber || part.sebango,
        partName: part.partName || 'No Name',
        qtyDay: qtyDay,
        qtyLot: qtyLot,
        actualQty: 0,
        mold: part.mold || 'MOLD-01',
        material: part.material || 'PP RESIN',
        kav: cavity,
        ct: ct,
        spec: kanban > 0 ? kanban : undefined,
        dandori: 15, // Default dandori is 15 mins
        time: runtimeMins,
        status: 'queued',
        timeRange: '',
        shift: r === 0 ? 'day' : 'night',
      });
    }
    return jobsList;
  }).filter(runs => runs.length > 0);

  // Interleave the runs (Heijunka leveling)
  let hasMore = true;
  let iteration = 0;
  while (hasMore) {
    hasMore = false;
    for (let pIdx = 0; pIdx < partRuns.length; pIdx++) {
      if (iteration < partRuns[pIdx].length) {
        activeJobs.push(partRuns[pIdx][iteration]);
        hasMore = true;
      }
    }
    iteration++;
  }

  // Group jobs by shift (day first, then night, then overflow) and set sequence
  const sortedJobs: Job[] = [
    ...activeJobs.filter(j => j.shift === 'day'),
    ...activeJobs.filter(j => j.shift === 'night'),
    ...activeJobs.filter(j => j.shift === 'overflow')
  ];

  if (sortedJobs.length > 0) {
    sortedJobs.forEach((job, idx) => {
      job.seq = idx + 1;
      job.dandori = job.dandori !== undefined ? job.dandori : 15;
    });
  }

  return recalculateTimelineHelper(sortedJobs, dOT, nOT);
};

export const getTodayDateString = () => {
  const d = new Date();
  
  // Shift starts at 07:00 AM. Any time before 07:00 AM belongs to yesterday's production date.
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const currentMins = hours * 60 + minutes;
  
  if (currentMins < 420) {
    d.setDate(d.getDate() - 1);
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export function ProductionProvider({ children }: { children: React.ReactNode }) {
  // One-time cleanup of local storage pollution to ensure all devices start from clean database truth.
  // Bump version (v2 -> v3) to force a fresh wipe on all existing devices so they re-pull from Supabase.
  useEffect(() => {
    try {
      const cleaned = localStorage.getItem('sugity_ls_cleaned_v3');
      if (!cleaned) {
        localStorage.removeItem('sugity_machine_jobs');
        localStorage.removeItem('sugity_machine_avg_jobs');
        localStorage.removeItem('sugity_logs');
        localStorage.removeItem('sugity_day_ots');
        localStorage.removeItem('sugity_night_ots');
        // Also remove the old v2 flag so this version takes precedence
        localStorage.removeItem('sugity_ls_cleaned_v2');
        localStorage.setItem('sugity_ls_cleaned_v3', 'true');
        // Verify the write succeeded before reloading to avoid infinite reload loop
        if (localStorage.getItem('sugity_ls_cleaned_v3') === 'true') {
          window.location.reload();
        }
      }
    } catch (e) {
      // localStorage unavailable (private mode / quota exceeded) — skip migration
      console.warn('localStorage migration skipped:', e);
    }
  }, []);

  const [machineJobs, setMachineJobs] = useState<Record<string, Job[]>>({});
  const [machineAvgJobs, setMachineAvgJobs] = useState<Record<string, Job[]>>({});
  const [logs, setLogs] = useState<Record<string, AbnormalityLog[]>>({});

  const logsRef = React.useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const lastLocalWriteRef = React.useRef<Record<string, number>>({});

  const [dayOTs, setDayOTs] = useState<Record<string, string>>({});
  const [nightOTs, setNightOTs] = useState<Record<string, string>>({});
  const [activeAbnormalities, setActiveAbnormalities] = useState<Record<string, ActiveAbnormality>>({});
  const [activeNgs, setActiveNgs] = useState<Record<string, ActiveNg>>({});

  // Load initial plans from Supabase on mount and expose sync function
  const syncFromSupabase = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('production_plans')
        .select('*');
      
      if (error) {
        console.error('Failed to select production_plans from Supabase:', error);
        return;
      }

      const loadedJobs: Record<string, Job[]> = {};
      const loadedAvgJobs: Record<string, Job[]> = {};
      const loadedDayOTs: Record<string, string> = {};
      const loadedNightOTs: Record<string, string> = {};
      const loadedAbnormalities: Record<string, ActiveAbnormality> = {};
      const loadedNgs: Record<string, ActiveNg> = {};

      const loadedLogs: Record<string, AbnormalityLog[]> = {};
      const hasAbnormalColumns = data && data.length > 0 && 'is_abnormal' in data[0];
      const hasNgColumns = data && data.length > 0 && 'is_ng' in data[0];
      const hasLogsColumn = data && data.length > 0 && 'logs' in data[0];

      if (data && data.length > 0) {
        data.forEach(row => {
          if (row.plan_type === 'daily') {
            loadedJobs[row.id] = row.jobs || [];
          } else if (row.plan_type === 'avg') {
            loadedAvgJobs[row.id] = row.jobs || [];
          }
          if (row.day_ot) loadedDayOTs[row.id] = row.day_ot;
          if (row.night_ot) loadedNightOTs[row.id] = row.night_ot;
          if (hasLogsColumn && row.logs) {
            loadedLogs[row.id] = row.logs;
          }

          if (hasAbnormalColumns) {
            const isAbnormal = !!row.is_abnormal;
            const type = row.abnormal_type || '';
            const start = row.abnormal_start || '';
            loadedAbnormalities[row.id] = { isAbnormal, type, start };
          }

          if (hasNgColumns) {
            const isNg = !!row.is_ng;
            const type = row.ng_type || '';
            const start = row.ng_start || '';
            loadedNgs[row.id] = { isNg, type, start };
          }
        });
      }

      // Helper to merge database truth with local states respecting 5s lockout window
      function filterStateByLockout<T>(prev: Record<string, T>, loaded: Record<string, T>): Record<string, T> {
        const next = { ...prev };
        // 1. Update/Add keys from database if not locked
        Object.keys(loaded).forEach(key => {
          const lastWrite = lastLocalWriteRef.current[key];
          if (!lastWrite || Date.now() - lastWrite >= 5000) {
            next[key] = loaded[key];
          }
        });
        // 2. Remove keys deleted in database if not locked
        Object.keys(prev).forEach(key => {
          if (loaded[key] === undefined) {
            const lastWrite = lastLocalWriteRef.current[key];
            if (!lastWrite || Date.now() - lastWrite >= 5000) {
              delete next[key];
            }
          }
        });
        return next;
      }

      setMachineJobs(prev => filterStateByLockout(prev, loadedJobs));
      setMachineAvgJobs(prev => filterStateByLockout(prev, loadedAvgJobs));
      setDayOTs(prev => filterStateByLockout(prev, loadedDayOTs));
      setNightOTs(prev => filterStateByLockout(prev, loadedNightOTs));
      setLogs(prev => filterStateByLockout(prev, loadedLogs));
      
      if (hasAbnormalColumns) {
        setActiveAbnormalities(prev => filterStateByLockout(prev, loadedAbnormalities));
      } else {
        setActiveAbnormalities({});
      }

      if (hasNgColumns) {
        setActiveNgs(prev => filterStateByLockout(prev, loadedNgs));
      } else {
        setActiveNgs({});
      }
    } catch (err) {
      console.error('Error fetching plans from Supabase:', err);
    }
  };

  useEffect(() => {
    syncFromSupabase();

    if (!supabase) return; // Guard: skip realtime subscription if Supabase is not configured

    // Subscribe to realtime changes in production_plans table
    const channel = supabase
      .channel('realtime_production_plans')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_plans'
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            
            const lastWrite = lastLocalWriteRef.current[row.id];
            if (lastWrite && Date.now() - lastWrite < 5000) {
              return; // Skip realtime update during lockout
            }

            if (row.plan_type === 'daily') {
              setMachineJobs(prev => ({ ...prev, [row.id]: row.jobs || [] }));
            } else if (row.plan_type === 'avg') {
              setMachineAvgJobs(prev => ({ ...prev, [row.id]: row.jobs || [] }));
            }
            if (row.day_ot) setDayOTs(prev => ({ ...prev, [row.id]: row.day_ot }));
            if (row.night_ot) setNightOTs(prev => ({ ...prev, [row.id]: row.night_ot }));
            if ('logs' in row && row.logs) {
              setLogs(prev => ({ ...prev, [row.id]: row.logs }));
            }

            if ('is_abnormal' in row) {
              const isAbnormal = !!row.is_abnormal;
              const type = row.abnormal_type || '';
              const start = row.abnormal_start || '';
              
              setActiveAbnormalities(prev => ({
                ...prev,
                [row.id]: { isAbnormal, type, start }
              }));
            }

            if ('is_ng' in row) {
              const isNg = !!row.is_ng;
              const type = row.ng_type || '';
              const start = row.ng_start || '';

              setActiveNgs(prev => ({
                ...prev,
                [row.id]: { isNg, type, start }
              }));
            }
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old;
            
            const lastWrite = lastLocalWriteRef.current[row.id];
            if (lastWrite && Date.now() - lastWrite < 5000) {
              return; // Skip realtime delete during lockout
            }

            setMachineJobs(prev => {
              const updated = { ...prev };
              delete updated[row.id];
              return updated;
            });
            setMachineAvgJobs(prev => {
              const updated = { ...prev };
              delete updated[row.id];
              return updated;
            });
            setActiveAbnormalities(prev => {
              const updated = { ...prev };
              delete updated[row.id];
              return updated;
            });
            setActiveNgs(prev => {
              const updated = { ...prev };
              delete updated[row.id];
              return updated;
            });
            setLogs(prev => {
              const updated = { ...prev };
              delete updated[row.id];
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, []);

  // Periodic polling every 10 seconds for auto-refresh and database fallback sync
  useEffect(() => {
    const interval = setInterval(() => {
      syncFromSupabase();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initialize for major machines if empty
  const initializeMachineIfEmpty = (machineId: string, dateStr?: string) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;

    setMachineJobs(prev => {
      if (prev[finalKey] !== undefined) return prev;
      return {
        ...prev,
        [finalKey]: []
      };
    });
    setDayOTs(prev => {
      if (prev[finalKey] !== undefined) return prev;
      return { ...prev, [finalKey]: 'teiji' };
    });
    setNightOTs(prev => {
      if (prev[finalKey] !== undefined) return prev;
      return { ...prev, [finalKey]: 'teiji' };
    });
    setLogs(prev => {
      if (prev[finalKey] !== undefined) return prev;
      return { ...prev, [finalKey]: [] };
    });
  };

  const incrementJobProgress = (
    machineId: string, 
    jobId: string, 
    qty: number, 
    dateStr?: string, 
    customParts?: any[],
    logMessage?: { type: string; note: string }
  ) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const date = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    // Prepare log record if provided
    let nextLogs = logsRef.current[finalKey] || [];
    if (logMessage) {
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const recordDate = new Date().toLocaleDateString();
      const newRecord: AbnormalityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        machineId: parsedMachineId,
        date: recordDate,
        time,
        type: logMessage.type,
        message: `[${logMessage.type.toUpperCase()}] ${logMessage.note}`
      };
      nextLogs = [newRecord, ...nextLogs].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      setLogs(prev => ({ ...prev, [finalKey]: nextLogs }));
    }

    setMachineJobs(prev => {
      let list = (prev[finalKey] !== undefined && prev[finalKey].length > 0) ? prev[finalKey] : [];
      if (list.length === 0) {
        const monthStr = date.substring(0, 7);
        const avgKey = `${monthStr}_avg_${parsedMachineId}`;
        const savedAvg = machineAvgJobs[avgKey] || [];
        list = savedAvg.length > 0 
          ? savedAvg 
          : getHeijunkaJobsForMachine(parsedMachineId, dayOTs[finalKey] || 'teiji', nightOTs[finalKey] || 'teiji', date, customParts);
      }
      const updated = list.map(j => {
        if (j.id === jobId) {
          const newQty = Math.min(j.qtyLot, j.actualQty + qty);
          return { ...j, actualQty: newQty };
        }
        return j;
      });

      // Save to Supabase
      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';
      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, date, updated, dOT, nOT, nextLogs);
      }, 0);

      return { ...prev, [finalKey]: updated };
    });
  };

  const updateJobStatus = (
    machineId: string, 
    jobId: string, 
    action: 'complete-running' | 'complete-dandori', 
    dateStr?: string, 
    customParts?: any[],
    logMessage?: { type: string; note: string },
    closedNgQty?: number,
    closedOkQty?: number
  ) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const date = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    // Prepare log record if provided
    let nextLogs = logsRef.current[finalKey] || [];
    if (logMessage) {
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const recordDate = new Date().toLocaleDateString();
      const newRecord: AbnormalityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        machineId: parsedMachineId,
        date: recordDate,
        time,
        type: logMessage.type,
        message: `[${logMessage.type.toUpperCase()}] ${logMessage.note}`
      };
      nextLogs = [newRecord, ...nextLogs].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      setLogs(prev => ({ ...prev, [finalKey]: nextLogs }));
    }

    setMachineJobs(prev => {
      let list = (prev[finalKey] !== undefined && prev[finalKey].length > 0) ? prev[finalKey] : [];
      if (list.length === 0) {
        const monthStr = date.substring(0, 7);
        const avgKey = `${monthStr}_avg_${parsedMachineId}`;
        const savedAvg = machineAvgJobs[avgKey] || [];
        list = savedAvg.length > 0 
          ? savedAvg 
          : getHeijunkaJobsForMachine(parsedMachineId, dayOTs[finalKey] || 'teiji', nightOTs[finalKey] || 'teiji', date, customParts);
      }
      const idx = list.findIndex(j => j.id === jobId);
      if (idx === -1) return prev;

      const updated = [...list];
      const nowTimeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      if (action === 'complete-running') {
        const completedJob = { 
          ...updated[idx], 
          status: 'completed' as const,
          actualProductionEnd: nowTimeStr,
          closedNgQty: closedNgQty ?? updated[idx].closedNgQty,
          closedOkQty: closedOkQty ?? updated[idx].closedOkQty,
        };
        updated[idx] = completedJob;
        
        // Carry over any shortage/surplus to the next scheduled lot of the same part model
        const shortage = completedJob.qtyLot - completedJob.actualQty;
        if (shortage !== 0) {
          const nextSameIdx = updated.findIndex((j, fIdx) => fIdx > idx && j.model === completedJob.model && j.status !== 'completed');
          if (nextSameIdx !== -1) {
            const targetJob = updated[nextSameIdx];
            const newQtyLot = Math.max(0, targetJob.qtyLot + shortage);
            
            // Recalculate duration time for this next job
            const cavity = targetJob.kav || 1;
            const ct = targetJob.ct || 60;
            const newTime = Math.round(((newQtyLot / cavity) * ct) / 60);
            
            updated[nextSameIdx] = {
              ...targetJob,
              qtyLot: newQtyLot,
              time: newTime
            };
          }
        }

        if (idx + 1 < updated.length) {
          updated[idx + 1] = { 
            ...updated[idx + 1], 
            status: 'dandori',
            actualDandoriStart: nowTimeStr
          };
        }
      } else if (action === 'complete-dandori') {
        updated[idx] = { 
          ...updated[idx], 
          status: 'running',
          actualDandoriEnd: nowTimeStr,
          actualProductionStart: nowTimeStr
        };
      }

      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';
      const solved = recalculateTimelineHelper(updated, dOT, nOT);

      // Save to Supabase
      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, date, solved, dOT, nOT, nextLogs);
      }, 0);

      return { ...prev, [finalKey]: solved };
    });
  };

  const closeShiftProduction = (machineId: string, shift: 'day' | 'night', dateStr?: string) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const date = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const recordDate = new Date().toLocaleDateString();
    const newRecord: AbnormalityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      machineId: parsedMachineId,
      date: recordDate,
      time,
      type: 'success',
      message: `[SHIFT CLOSED] ${shift.toUpperCase()} shift production closed by member.`
    };
    const nextLogs = [newRecord, ...(logsRef.current[finalKey] || [])].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
    setLogs(prev => ({ ...prev, [finalKey]: nextLogs }));

    setMachineJobs(prev => {
      let list = (prev[finalKey] !== undefined && prev[finalKey].length > 0) ? prev[finalKey] : [];
      if (list.length === 0) {
        const monthStr = date.substring(0, 7);
        const avgKey = `${monthStr}_avg_${parsedMachineId}`;
        const savedAvg = machineAvgJobs[avgKey] || [];
        list = savedAvg.length > 0 
          ? savedAvg 
          : getHeijunkaJobsForMachine(parsedMachineId, dayOTs[finalKey] || 'teiji', nightOTs[finalKey] || 'teiji', date);
      }

      const updated = list.map(j => {
        if (j.shift === shift && j.status !== 'completed') {
          return {
            ...j,
            status: 'completed' as const,
            actualProductionEnd: j.actualProductionEnd || time
          };
        }
        return j;
      });

      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';
      const solved = recalculateTimelineHelper(updated, dOT, nOT);

      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, date, solved, dOT, nOT, nextLogs);
      }, 0);

      return { ...prev, [finalKey]: solved };
    });
  };

  const addJobDowntime = (
    machineId: string, 
    jobId: string, 
    downtimeMins: number, 
    dateStr?: string, 
    customParts?: any[],
    logMessage?: { type: string; note: string }
  ) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const date = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    // Prepare log record if provided
    let nextLogs = logsRef.current[finalKey] || [];
    if (logMessage) {
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const recordDate = new Date().toLocaleDateString();
      const newRecord: AbnormalityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        machineId: parsedMachineId,
        date: recordDate,
        time,
        type: logMessage.type,
        message: `[${logMessage.type.toUpperCase()}] ${logMessage.note}`
      };
      nextLogs = [newRecord, ...nextLogs].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      setLogs(prev => ({ ...prev, [finalKey]: nextLogs }));
    }

    setMachineJobs(prev => {
      let list = (prev[finalKey] !== undefined && prev[finalKey].length > 0) ? prev[finalKey] : [];
      if (list.length === 0) {
        const monthStr = date.substring(0, 7);
        const avgKey = `${monthStr}_avg_${parsedMachineId}`;
        const savedAvg = machineAvgJobs[avgKey] || [];
        list = savedAvg.length > 0 
          ? savedAvg 
          : getHeijunkaJobsForMachine(parsedMachineId, dayOTs[finalKey] || 'teiji', nightOTs[finalKey] || 'teiji', date, customParts);
      }
      const updated = list.map(j => {
        if (j.id === jobId) {
          const currentDowntime = j.downtimeMinutes || 0;
          return { ...j, downtimeMinutes: currentDowntime + downtimeMins };
        }
        return j;
      });

      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';

      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, date, updated, dOT, nOT, nextLogs);
      }, 0);

      return { ...prev, [finalKey]: updated };
    });
  };

  const reorderMachineJobs = (machineId: string, jobs: Job[], dateStr?: string) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const dateKey = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    setMachineJobs(prev => {
      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';
      const solved = recalculateTimelineHelper(jobs, dOT, nOT);

      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, dateKey, solved, dOT, nOT, logsRef.current[finalKey] || []);
      }, 0);

      return {
        ...prev,
        [finalKey]: solved
      };
    });
  };

  const reorderMachineAvgJobs = (machineId: string, jobs: Job[], dateStr?: string) => {
    const selectedDate = dateStr || getTodayDateString();
    const monthStr = selectedDate.substring(0, 7);
    const avgKey = `${monthStr}_avg_${machineId}`;

    lastLocalWriteRef.current[avgKey] = Date.now();

    setMachineAvgJobs(prev => {
      const solved = recalculateTimelineHelper(jobs, 'teiji', 'teiji');

      setTimeout(() => {
        savePlanToSupabase(avgKey, 'avg', machineId, monthStr, solved, 'teiji', 'teiji', []);
      }, 0);

      return {
        ...prev,
        [avgKey]: solved
      };
    });
  };

  const resetAllMachines = (dateStr?: string) => {
    const date = dateStr || getTodayDateString();
    const monthStr = date.substring(0, 7);

    setMachineJobs(prev => {
      const next = { ...prev };
      for (const machine of ALL_ACTIVE_MACHINES) {
        const finalKey = `${date}_${machine}`;
        lastLocalWriteRef.current[finalKey] = Date.now();
        next[finalKey] = [];
        // Persist empty daily plan to Supabase
        setTimeout(() => {
          savePlanToSupabase(finalKey, 'daily', machine, date, [], 'teiji', 'teiji', []);
        }, 0);
      }
      return next;
    });

    setMachineAvgJobs(prev => {
      const next = { ...prev };
      for (const machine of ALL_ACTIVE_MACHINES) {
        const avgKey = `${monthStr}_avg_${machine}`;
        lastLocalWriteRef.current[avgKey] = Date.now();
        next[avgKey] = [];
        // Persist empty avg plan to Supabase
        setTimeout(() => {
          savePlanToSupabase(avgKey, 'avg', machine, monthStr, [], 'teiji', 'teiji', []);
        }, 0);
      }
      return next;
    });
  };

  const updateOTSettings = (machineId: string, dayOT: string, nightOT: string, dateStr?: string) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const date = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    setDayOTs(prev => ({ ...prev, [finalKey]: dayOT }));
    setNightOTs(prev => ({ ...prev, [finalKey]: nightOT }));
    setMachineJobs(prev => {
      const list = (prev[finalKey] !== undefined) ? prev[finalKey] : [];
      const solved = recalculateTimelineHelper(list, dayOT, nightOT);

      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, date, solved, dayOT, nightOT, logsRef.current[finalKey] || []);
      }, 0);

      return { ...prev, [finalKey]: solved };
    });
  };

  const addAbnormalityRecord = (machineId: string, type: string, note: string, timeStr?: string, dateStr?: string) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const time = timeStr || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const date = new Date().toLocaleDateString();
    const id = `log-${Date.now()}`;
    const newRecord: AbnormalityLog = {
      id,
      machineId: finalKey.length > 11 ? finalKey.substring(11) : finalKey,
      date,
      time,
      type,
      message: `[${type.toUpperCase()}] ${note}`
    };

    let updatedLogs: AbnormalityLog[] = [];
    setLogs(prev => {
      const currentLogs = prev[finalKey] || [];
      const newLogs = [newRecord, ...currentLogs].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      updatedLogs = newLogs;
      return { ...prev, [finalKey]: newLogs };
    });

    if (supabase) {
      const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
      const dateKey = finalKey.substring(0, 10);
      const currentJobs = machineJobs[finalKey] || [];
      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';

      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, dateKey, currentJobs, dOT, nOT, updatedLogs);
      }, 0);
    }
  };

  const setMachineNg = (
    machineId: string,
    isNg: boolean,
    type?: string,
    start?: string,
    dateStr?: string,
    logMessage?: { type: string; note: string; timeStr?: string }
  ) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;

    lastLocalWriteRef.current[finalKey] = Date.now();

    const typeStr = type || '';
    const startStr = start || '';

    // Prepare log record if provided
    let nextLogs = logsRef.current[finalKey] || [];
    if (logMessage) {
      const time = logMessage.timeStr || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const recordDate = new Date().toLocaleDateString();
      const newRecord: AbnormalityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        machineId: parsedMachineId,
        date: recordDate,
        time,
        type: logMessage.type,
        message: `[${logMessage.type.toUpperCase()}] ${logMessage.note}`
      };
      nextLogs = [newRecord, ...nextLogs].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      setLogs(prev => ({ ...prev, [finalKey]: nextLogs }));
    }

    setActiveNgs(prev => ({
      ...prev,
      [finalKey]: { isNg, type: typeStr, start: startStr }
    }));

    // Persist NG state to Supabase as part of the daily plan payload
    if (supabase) {
      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';
      const date = finalKey.substring(0, 10);
      const currentJobs = machineJobs[finalKey] || [];

      const payload: any = {
        id: finalKey,
        plan_type: 'daily',
        machine_id: parsedMachineId,
        date_key: date,
        is_ng: isNg,
        ng_type: typeStr,
        ng_start: startStr,
        jobs: currentJobs,
        day_ot: dOT,
        night_ot: nOT,
        logs: nextLogs,
        updated_at: new Date().toISOString()
      };

      supabase
        .from('production_plans')
        .upsert(payload, { onConflict: 'id' })
        .then(async ({ error }) => {
          if (error) {
            // Graceful fallback: retry without optional columns if they don't exist yet
            delete payload.is_ng;
            delete payload.ng_type;
            delete payload.ng_start;
            delete payload.logs;
            await supabase.from('production_plans').upsert(payload, { onConflict: 'id' });
          }
        })
        .catch(() => {});
    }
  };

  const reviseJobNgQty = (
    machineId: string,
    jobId: string,
    newNgQty: number,
    newOkQty: number,
    dateStr?: string,
    logMessage?: { type: string; note: string }
  ) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const date = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    let nextLogs = logsRef.current[finalKey] || [];
    if (logMessage) {
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const recordDate = new Date().toLocaleDateString();
      const newRecord: AbnormalityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        machineId: parsedMachineId,
        date: recordDate,
        time,
        type: logMessage.type,
        message: `[${logMessage.type.toUpperCase()}] ${logMessage.note}`
      };
      nextLogs = [newRecord, ...nextLogs].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      setLogs(prev => ({ ...prev, [finalKey]: nextLogs }));
    }

    setMachineJobs(prev => {
      const list = prev[finalKey] || [];
      const updated = list.map(j => {
        if (j.id === jobId) {
          return { ...j, closedNgQty: newNgQty, closedOkQty: newOkQty };
        }
        return j;
      });
      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';
      setTimeout(() => {
        savePlanToSupabase(finalKey, 'daily', parsedMachineId, date, updated, dOT, nOT, nextLogs);
      }, 0);
      return { ...prev, [finalKey]: updated };
    });
  };

  const setMachineAbnormal = (
    machineId: string, 
    isAbnormal: boolean, 
    type?: string, 
    start?: string, 
    dateStr?: string,
    logMessage?: { type: string; note: string; timeStr?: string },
    downtimeMins?: number,
    downtimeJobId?: string
  ) => {
    let finalKey = machineId;
    if (!machineId.includes('_')) {
      const date = dateStr || getTodayDateString();
      finalKey = `${date}_${machineId}`;
    }
    const parsedMachineId = finalKey.length > 11 ? finalKey.substring(11) : finalKey;
    const date = finalKey.substring(0, 10);

    lastLocalWriteRef.current[finalKey] = Date.now();

    const typeStr = type || '';
    const startStr = start || '';

    // Prepare log record if provided
    let nextLogs = logsRef.current[finalKey] || [];
    if (logMessage) {
      const time = logMessage.timeStr || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const recordDate = new Date().toLocaleDateString();
      const newRecord: AbnormalityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        machineId: parsedMachineId,
        date: recordDate,
        time,
        type: logMessage.type,
        message: `[${logMessage.type.toUpperCase()}] ${logMessage.note}`
      };
      nextLogs = [newRecord, ...nextLogs].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      setLogs(prev => ({ ...prev, [finalKey]: nextLogs }));
    }

    // Prepare jobs if downtime is resolved
    let nextJobs = machineJobs[finalKey] || [];
    if (downtimeMins && downtimeMins > 0 && downtimeJobId) {
      nextJobs = nextJobs.map(j => {
        if (j.id === downtimeJobId) {
          const currentDowntime = j.downtimeMinutes || 0;
          return { ...j, downtimeMinutes: currentDowntime + downtimeMins };
        }
        return j;
      });
      setMachineJobs(prev => ({ ...prev, [finalKey]: nextJobs }));
    }

    // 1. Update React state immediately
    setActiveAbnormalities(prev => ({
      ...prev,
      [finalKey]: { isAbnormal, type: typeStr, start: startStr }
    }));

    // 3. Upsert state to Supabase production_plans table
    if (supabase) {
      const dOT = dayOTs[finalKey] || 'teiji';
      const nOT = nightOTs[finalKey] || 'teiji';

      const payload: any = {
        id: finalKey,
        plan_type: 'daily',
        machine_id: parsedMachineId,
        date_key: date,
        is_abnormal: isAbnormal,
        abnormal_type: typeStr,
        abnormal_start: startStr,
        jobs: nextJobs,
        day_ot: dOT,
        night_ot: nOT,
        logs: nextLogs,
        updated_at: new Date().toISOString()
      };

      supabase
        .from('production_plans')
        .upsert(payload, { onConflict: 'id' })
        .then(async ({ error }) => {
          if (error && error.message && error.message.includes("Could not find the 'logs' column")) {
            console.warn("Supabase does not have 'logs' column. Retrying abnormality upsert without 'logs'...");
            delete payload.logs;
            const { error: retryError } = await supabase
              .from('production_plans')
              .upsert(payload, { onConflict: 'id' });
            if (retryError) {
              console.error(`Failed to retry upserting abnormality state for plan ${finalKey}:`, retryError);
            }
          } else if (error) {
            console.error(`Failed to upsert abnormality state for plan ${finalKey}:`, error);
          }
        })
        .catch(err => {
          console.error(`Error upserting abnormality state for plan ${finalKey}:`, err);
        });
    }
  };

  return (
    <ProductionContext.Provider value={{
      machineJobs,
      machineAvgJobs,
      logs,
      dayOTs,
      nightOTs,
      activeAbnormalities,
      activeNgs,
      setMachineAbnormal,
      setMachineNg,
      incrementJobProgress,
      updateJobStatus,
      reviseJobNgQty,
      reorderMachineJobs,
      reorderMachineAvgJobs,
      resetAllMachines,
      updateOTSettings,
      addAbnormalityRecord,
      initializeMachineIfEmpty,
      closeShiftProduction,
      addJobDowntime,
    }}>
      {children}
    </ProductionContext.Provider>
  );
}

export function useProduction(machineId: string, dateStr?: string) {
  const context = useContext(ProductionContext);
  if (context === undefined) {
    throw new Error('useProduction must be used within a ProductionProvider');
  }

  const { parts } = useParts();
  const selectedDate = dateStr || getTodayDateString();
  const compositeKey = `${selectedDate}_${machineId}`;

  // Auto initialize machine state when a hook is called
  useEffect(() => {
    context.initializeMachineIfEmpty(machineId, selectedDate);
  }, [machineId, selectedDate]);

  const rawJobs = (context.machineJobs[compositeKey] !== undefined)
    ? context.machineJobs[compositeKey]
    : [];
  const monthStr = selectedDate.substring(0, 7);
  const avgKey = `${monthStr}_avg_${machineId}`;
  const rawAvgJobs = (context.machineAvgJobs[avgKey] !== undefined)
    ? context.machineAvgJobs[avgKey]
    : [];
  const logList = context.logs[compositeKey] || [];
  const dayOT = context.dayOTs[compositeKey] || 'teiji';
  const nightOT = context.nightOTs[compositeKey] || 'teiji';

  // Resolve average plan (either adjusted avgJobs or default from parts)
  const avgJobs = rawAvgJobs.length > 0
    ? rawAvgJobs
    : getHeijunkaJobsForMachine(machineId, dayOT, nightOT, selectedDate, parts);

  // Resolve daily plan (either rawJobs daily upload/execution or fallback to avgJobs)
  const jobs = rawJobs.length > 0 
    ? rawJobs 
    : avgJobs;

  // Find currently running job for the current shift
  const runningJob = (() => {
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    const currentMins = currentHour * 60 + currentMinute;
    const isNightShiftTime = currentMins < 435 || currentMins >= 1260;
    const activeShift = isNightShiftTime ? 'night' : 'day';

    // Focus active job finder exclusively on the current shift's jobs (ignore leftovers from previous shifts in the UI)
    const shiftJobs = jobs.filter(j => j.shift === activeShift || (activeShift === 'night' && j.shift === 'overflow'));
    if (shiftJobs.length === 0) return undefined;

    const running = shiftJobs.find(j => j.status === 'running');
    if (running) return running;

    const dandori = shiftJobs.find(j => j.status === 'dandori');
    if (dandori) return dandori;

    return shiftJobs.find(j => j.status !== 'completed') || shiftJobs[shiftJobs.length - 1];
  })();

  // Resolve active abnormality from context
  const activeAbnormal = context.activeAbnormalities[compositeKey];
  const isAbnormalActive = activeAbnormal ? activeAbnormal.isAbnormal : false;
  const activeAbnormalType = activeAbnormal ? activeAbnormal.type : '';
  const activeAbnormalStart = activeAbnormal ? activeAbnormal.start : '';

  // Resolve active NG from context
  const activeNg = context.activeNgs[compositeKey];
  const isNgActive = activeNg ? activeNg.isNg : false;
  const activeNgType = activeNg ? activeNg.type : '';
  const activeNgStart = activeNg ? activeNg.start : '';

  return {
    jobs,
    avgJobs,
    logList,
    dayOT,
    nightOT,
    runningJob,
    isAbnormalActive,
    activeAbnormalType,
    activeAbnormalStart,
    isNgActive,
    activeNgType,
    activeNgStart,
    setMachineAbnormal: (
      isAbnormal: boolean, 
      type?: string, 
      start?: string, 
      logMessage?: { type: string; note: string; timeStr?: string },
      downtimeMins?: number,
      downtimeJobId?: string
    ) => 
      context.setMachineAbnormal(machineId, isAbnormal, type, start, selectedDate, logMessage, downtimeMins, downtimeJobId),
    setMachineNg: (
      isNg: boolean,
      type?: string,
      start?: string,
      logMessage?: { type: string; note: string; timeStr?: string }
    ) =>
      context.setMachineNg(machineId, isNg, type, start, selectedDate, logMessage),
    incrementJobProgress: (jobId: string, qty: number, logMessage?: { type: string; note: string }) => 
      context.incrementJobProgress(machineId, jobId, qty, selectedDate, parts, logMessage),
    updateJobStatus: (jobId: string, action: 'complete-running' | 'complete-dandori', logMessage?: { type: string; note: string }, closedNgQty?: number, closedOkQty?: number) => 
      context.updateJobStatus(machineId, jobId, action, selectedDate, parts, logMessage, closedNgQty, closedOkQty),
    reviseJobNgQty: (jobId: string, newNgQty: number, newOkQty: number, logMessage?: { type: string; note: string }) =>
      context.reviseJobNgQty(machineId, jobId, newNgQty, newOkQty, selectedDate, logMessage),
    reorderMachineJobs: (newJobs: Job[]) => context.reorderMachineJobs(machineId, newJobs, selectedDate),
    reorderMachineAvgJobs: (newAvgJobs: Job[]) => context.reorderMachineAvgJobs(machineId, newAvgJobs, selectedDate),
    updateOTSettings: (dOT: string, nOT: string) => context.updateOTSettings(machineId, dOT, nOT, selectedDate),
    addAbnormalityRecord: (type: string, note: string, timeStr?: string) => context.addAbnormalityRecord(machineId, type, note, timeStr, selectedDate),
    addJobDowntime: (jobId: string, downtimeMins: number, logMessage?: { type: string; note: string }) => 
      context.addJobDowntime(machineId, jobId, downtimeMins, selectedDate, parts, logMessage),
    closeShiftProduction: (shift: 'day' | 'night') => 
      context.closeShiftProduction(machineId, shift, selectedDate),
  };
}
