import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Upload, Sparkles, Loader2, Box, CalendarDays, Activity, Check, AlertCircle, Clipboard, Search, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useParts } from '../../context/PartsContext';
import { resolveMachineKey } from '../../context/ProductionContext';

interface PartForecast {
  sebango: string;
  partNumber: string;
  partName: string;
  modelCode: string;
  machineId: string;
  factory: string;
  area: string;
  cycleTime: number;
  cavity: number;
  monthN: number;
  monthN1: number;
  monthN2: number;
  monthN3: number;
  dailyRequirementN: number;
  dailyRequirementN1: number;
  dailyRequirementN2: number;
  dailyRequirementN3: number;
}

const MACHINE_CONFIG = {
  injection: [
    { factory: 'FACT 2', machines: ['MC 1', 'MC 2', 'MC 3', 'MC 4', 'MC 5', 'MC 6', 'MC 7', 'MC 8'] },
    { factory: 'FACT 3', machines: ['MC 1', 'MC 2', 'MC 3', 'MC 4', 'MC 5', 'MC 6', 'MC 7', 'MC 8', 'MC 9', 'MC 10', 'MC 11', 'MC 13', 'MC 14'] },
    { factory: 'FACT 4', machines: ['MC 1', 'MC 7', 'MC 8', 'MC B1', 'MC B2', 'MC B3'] },
    { factory: 'SC2 Resin', machines: ['MC 1', 'MC 2', 'MC 3', 'MC 4', 'MC 5'] }
  ]
};

// Robust helper to get the factory name from home line prefixes in the database
const getFactoryFromHomeLine = (homeLine: string): string => {
  const clean = (homeLine || '').toUpperCase().trim();
  if (clean.startsWith('F2')) return 'FACT 2';
  if (clean.startsWith('F3')) return 'FACT 3';
  if (clean.startsWith('F4')) return 'FACT 4';
  if (clean.startsWith('SC2')) return 'SC2 Resin';
  return 'Unknown';
};

const normalizeArea = (area: string): string => {
  const clean = (area || '').toUpperCase().trim();
  if (clean === 'P2' || clean === 'SC2') return 'sc2';
  return clean.toLowerCase(); // 'f2', 'f3', 'f4'
};

const getForecastMonthNames = () => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();
  const currentMonthIdx = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  const getMonthAndYear = (offset: number) => {
    const targetMonthIdx = (currentMonthIdx + offset) % 12;
    const targetYear = currentYear + Math.floor((currentMonthIdx + offset) / 12);
    return `${months[targetMonthIdx]} ${targetYear}`;
  };
  
  return {
    monthN: getMonthAndYear(0),
    monthN1: getMonthAndYear(1),
    monthN2: getMonthAndYear(2),
    monthN3: getMonthAndYear(3),
  };
};

const getShortMonthName = (longMonthName: string) => {
  const parts = longMonthName.split(' ');
  if (parts.length === 2) {
    const month = parts[0];
    const year = parts[1];
    return `${month.substring(0, 3)} ${year}`;
  }
  return longMonthName;
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

export function MonthlyOrdersView() {
  const { parts, importParts, isLoading: partsLoading, forecastHistory, addHistoryRecord, fetchHistory, updatePart, deletePart } = useParts();
  const [importMode, setImportMode] = useState<'csv' | 'paste' | 'manual'>('csv');
  const [viewState, setViewState] = useState<'active' | 'preview'>('active');
  const [subTab, setSubTab] = useState<'active' | 'history'>('active');
  const [pasteData, setPasteData] = useState('');
  
  // Manual Input states
  const [selectedManualPartNo, setSelectedManualPartNo] = useState('');
  const [manualMonthN, setManualMonthN] = useState('');
  const [manualMonthN1, setManualMonthN1] = useState('');
  const [manualMonthN2, setManualMonthN2] = useState('');
  const [manualMonthN3, setManualMonthN3] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);
  
  const monthNames = useMemo(() => getForecastMonthNames(), []);
  
  const [partsForecast, setPartsForecast] = useState<PartForecast[]>([]);
  const [tempForecast, setTempForecast] = useState<PartForecast[]>([]);
  const [fukaFilter, setFukaFilter] = useState<'monthN' | 'monthN1' | 'monthN2' | 'monthN3'>('monthN');

  // Title-based sort states
  const [sortField, setSortField] = useState<string>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Per-column filter states
  const [columnFilters, setColumnFilters] = useState({
    sebango: '',
    partNumber: '',
    modelCode: '',
    machineId: '',
    monthN: '',
    monthN1: '',
    monthN2: '',
    monthN3: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format machine display cleanly without showing tonnage
  const cleanMachineDisplay = (mc: string) => {
    if (!mc) return '';
    let clean = mc.replace(/-\d+T/i, '').trim();
    // If it starts with factory name, e.g. SC2#4, insert space: SC2 #4
    clean = clean.replace(/([A-Za-z0-9]+)#([A-Za-z0-9]+)/, '$1 #$2');
    return clean;
  };

  // Sort handler for column titles
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Default to descending for volumes, ascending for codes/strings
      setSortDirection(field.startsWith('month') || field.startsWith('daily') ? 'desc' : 'asc');
    }
  };

  // Click-to-sort column header renderer
  const renderSortHeader = (field: string, label: string, alignRight = false) => {
    const isActive = sortField === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`w-full px-3 py-3.5 flex items-center font-black tracking-wider text-[9px] hover:bg-slate-100/50 hover:text-slate-800 focus:outline-none group cursor-pointer transition-colors ${
          alignRight ? 'justify-end text-right' : 'justify-between text-left'
        }`}
      >
        {alignRight ? (
          <>
            <span className="mr-1.5 shrink-0 text-slate-400 group-hover:text-slate-600 font-mono text-[8px]">
              {isActive ? (
                sortDirection === 'asc' ? '▲' : '▼'
              ) : (
                '↕'
              )}
            </span>
            <span>{label}</span>
          </>
        ) : (
          <>
            <span>{label}</span>
            <span className="ml-1.5 shrink-0 text-slate-400 group-hover:text-slate-600 font-mono text-[8px]">
              {isActive ? (
                sortDirection === 'asc' ? '▲' : '▼'
              ) : (
                '↕'
              )}
            </span>
          </>
        )}
      </button>
    );
  };

  // Sync forecast list with parts list when parts change and we are in active view
  useEffect(() => {
    if (parts.length > 0 && viewState === 'active') {
      const workingDays = 20;
      // Retrieve the latest committed history record to restore default forecast values if available
      const latestHistory = forecastHistory && forecastHistory.length > 0 ? forecastHistory[0] : null;

      const initial = parts.map(p => {
        const histItem = latestHistory?.items?.find((it: any) => it.sebango.trim().toUpperCase() === p.sebango.trim().toUpperCase());
        
        const dailyN = histItem ? Number(histItem.dailyRequirementN || 0) : (p.dailyRequirementN || p.qtyDay || 0);
        const dailyN1 = histItem ? Number(histItem.dailyRequirementN1 || 0) : (p.dailyRequirementN1 || 0);
        const dailyN2 = histItem ? Number(histItem.dailyRequirementN2 || 0) : (p.dailyRequirementN2 || 0);
        const dailyN3 = histItem ? Number(histItem.dailyRequirementN3 || 0) : (p.dailyRequirementN3 || 0);
        
        const monthNVal = histItem ? Number(histItem.monthN || 0) : (p.monthN || (dailyN * workingDays));
        const monthN1Val = histItem ? Number(histItem.monthN1 || 0) : (p.monthN1 || (dailyN1 * workingDays));
        const monthN2Val = histItem ? Number(histItem.monthN2 || 0) : (p.monthN2 || (dailyN2 * workingDays));
        const monthN3Val = histItem ? Number(histItem.monthN3 || 0) : (p.monthN3 || (dailyN3 * workingDays));

        return {
          sebango: p.sebango || '',
          partNumber: p.partNumber || '',
          partName: p.partName || '',
          modelCode: p.model || '',
          machineId: p.homeLine || '',
          factory: getFactoryFromHomeLine(p.homeLine),
          area: p.area || '',
          cycleTime: p.cycleTime || 60,
          cavity: p.cavity || 1,
          monthN: monthNVal,
          monthN1: monthN1Val,
          monthN2: monthN2Val,
          monthN3: monthN3Val,
          dailyRequirementN: dailyN,
          dailyRequirementN1: dailyN1,
          dailyRequirementN2: dailyN2,
          dailyRequirementN3: dailyN3
        };
      });
      setPartsForecast(initial);
    }
  }, [parts, viewState, forecastHistory]);

  const handleMachineChange = async (partNumber: string, newMachine: string) => {
    const originalPart = parts.find(pt => pt.partNumber === partNumber);
    if (!originalPart) return;
    
    try {
      await updatePart(partNumber, {
        ...originalPart,
        homeLine: newMachine
      });
    } catch (err) {
      console.error('Failed to change machine:', err);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Robust parsing of CSV/Tab text based on Sebango code matching
  const parseForecastCSVContent = (content: string, allParts: any[]): PartForecast[] => {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    
    // Parse headers
    const separator = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toUpperCase());
    
    const monthNames = getForecastMonthNames();
    const cleanN = monthNames.monthN.toUpperCase();
    const cleanN1 = monthNames.monthN1.toUpperCase();
    const cleanN2 = monthNames.monthN2.toUpperCase();
    const cleanN3 = monthNames.monthN3.toUpperCase();

    let sebIndex = headers.findIndex(h => h.includes('SEBANGO') || h.includes('CODE') || h.includes('PART'));
    let nIndex = headers.findIndex(h => h === 'N' || h.includes('MONTH N') || h.includes('FORECAST N') || h.includes('MONTH_N') || h.includes('M.N') || h === 'MONTH_N_FORECAST' || h.includes(cleanN));
    let n1Index = headers.findIndex(h => h.includes('N+1') || h.includes('MONTH N+1') || h.includes('MONTH_N1') || h.includes('M.N1') || h === 'MONTH_N1_FORECAST' || h.includes(cleanN1));
    let n2Index = headers.findIndex(h => h.includes('N+2') || h.includes('MONTH N+2') || h.includes('MONTH_N2') || h.includes('M.N2') || h === 'MONTH_N2_FORECAST' || h.includes(cleanN2));
    let n3Index = headers.findIndex(h => h.includes('N+3') || h.includes('MONTH N+3') || h.includes('MONTH_N3') || h.includes('M.N3') || h === 'MONTH_N3_FORECAST' || h.includes(cleanN3));
    
    // Fallbacks if not found by name
    if (sebIndex === -1) sebIndex = 0;
    if (nIndex === -1) nIndex = 1;
    if (n1Index === -1) n1Index = 2;
    if (n2Index === -1) n2Index = 3;
    if (n3Index === -1) n3Index = 4;
    
    const results: PartForecast[] = [];
    const workingDays = 20;
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map(c => c.trim());
      if (cols.length <= Math.max(sebIndex, nIndex)) continue;
      
      const rawSebango = cols[sebIndex];
      if (!rawSebango) continue;
      
      const cleanSeb = rawSebango.toUpperCase();
      const matchedPart = allParts.find(p => 
        (p.sebango && p.sebango.trim().toUpperCase() === cleanSeb) ||
        (p.partNumber && p.partNumber.trim().toUpperCase() === cleanSeb)
      );
      
      if (!matchedPart) continue; // Skip if part is not in our database
      
      const dailyRequirementN = Math.round(parseFloat(cols[nIndex]?.replace(/[^0-9.-]/g, '')) || 0);
      const dailyRequirementN1 = Math.round(parseFloat(cols[n1Index]?.replace(/[^0-9.-]/g, '')) || 0);
      const dailyRequirementN2 = Math.round(parseFloat(cols[n2Index]?.replace(/[^0-9.-]/g, '')) || 0);
      const dailyRequirementN3 = Math.round(parseFloat(cols[n3Index]?.replace(/[^0-9.-]/g, '')) || 0);
      
      const monthN = dailyRequirementN * workingDays;
      const monthN1 = dailyRequirementN1 * workingDays;
      const monthN2 = dailyRequirementN2 * workingDays;
      const monthN3 = dailyRequirementN3 * workingDays;
      
      results.push({
        sebango: matchedPart.sebango,
        partNumber: matchedPart.partNumber,
        partName: matchedPart.partName,
        modelCode: matchedPart.model,
        machineId: matchedPart.homeLine,
        factory: getFactoryFromHomeLine(matchedPart.homeLine),
        area: matchedPart.area || '',
        cycleTime: matchedPart.cycleTime,
        cavity: matchedPart.cavity || 1,
        monthN,
        monthN1,
        monthN2,
        monthN3,
        dailyRequirementN,
        dailyRequirementN1,
        dailyRequirementN2,
        dailyRequirementN3
      });
    }
    
    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseForecastCSVContent(text, parts);
        if (parsed.length === 0) {
          setErrorMsg('No matching Sebango codes found in the uploaded file. Check headers and matching master parts.');
          setIsProcessing(false);
          return;
        }
        setTempForecast(parsed);
        setViewState('preview');
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 2000);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to parse file content.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!pasteData.trim()) return;
    setIsProcessing(true);
    setErrorMsg('');
    
    setTimeout(() => {
      try {
        const parsed = parseForecastCSVContent(pasteData, parts);
        if (parsed.length === 0) {
          setErrorMsg('No matching Sebango codes found in the pasted text. Verify tab separators.');
          setIsProcessing(false);
          return;
        }
        setTempForecast(parsed);
        setViewState('preview');
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 2000);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to parse pasted text.');
      } finally {
        setIsProcessing(false);
      }
    }, 800);
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      const monthKeys = getForecastMonthKeys();
      const newForecastData = [...tempForecast];
      
      // Update parts list locally and sync with Supabase
      const updatedParts = parts.map(p => {
        const item = newForecastData.find(tf => tf.sebango.trim().toUpperCase() === p.sebango.trim().toUpperCase());
        const existingForecasts = p.monthly_forecasts || {};
        let updatedForecasts = { ...existingForecasts };
        
        if (item) {
          updatedForecasts = {
            ...existingForecasts,
            [monthKeys.monthN]: { volume: item.monthN, daily: item.dailyRequirementN },
            [monthKeys.monthN1]: { volume: item.monthN1, daily: item.dailyRequirementN1 },
            [monthKeys.monthN2]: { volume: item.monthN2, daily: item.dailyRequirementN2 },
            [monthKeys.monthN3]: { volume: item.monthN3, daily: item.dailyRequirementN3 }
          };
          
          return {
            ...p,
            dailyRequirementN: item.dailyRequirementN,
            dailyRequirementN1: item.dailyRequirementN1,
            dailyRequirementN2: item.dailyRequirementN2,
            dailyRequirementN3: item.dailyRequirementN3,
            monthN: item.monthN,
            monthN1: item.monthN1,
            monthN2: item.monthN2,
            monthN3: item.monthN3,
            monthly_forecasts: updatedForecasts
          };
        }
        
        // If not in the uploaded file, still keep existing monthly forecasts but resolve correct fields
        const fN = existingForecasts[monthKeys.monthN] || {};
        const fN1 = existingForecasts[monthKeys.monthN1] || {};
        const fN2 = existingForecasts[monthKeys.monthN2] || {};
        const fN3 = existingForecasts[monthKeys.monthN3] || {};
        
        return {
          ...p,
          dailyRequirementN: fN.daily !== undefined ? Number(fN.daily) : (p.dailyRequirementN || 0),
          dailyRequirementN1: fN1.daily !== undefined ? Number(fN1.daily) : (p.dailyRequirementN1 || 0),
          dailyRequirementN2: fN2.daily !== undefined ? Number(fN2.daily) : (p.dailyRequirementN2 || 0),
          dailyRequirementN3: fN3.daily !== undefined ? Number(fN3.daily) : (p.dailyRequirementN3 || 0),
          monthN: fN.volume !== undefined ? Number(fN.volume) : (p.monthN || 0),
          monthN1: fN1.volume !== undefined ? Number(fN1.volume) : (p.monthN1 || 0),
          monthN2: fN2.volume !== undefined ? Number(fN2.volume) : (p.monthN2 || 0),
          monthN3: fN3.volume !== undefined ? Number(fN3.volume) : (p.monthN3 || 0),
          monthly_forecasts: existingForecasts
        };
      });
      
      await importParts(updatedParts);
      
      // Save snapshot to history
      await addHistoryRecord(newForecastData);
      
      setPartsForecast(newForecastData);
      setViewState('active');
      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to commit forecast values to Master Parts.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRestoreHistory = async (record: any) => {
    if (!window.confirm(`Are you sure you want to restore the forecast snapshot from ${new Date(record.created_at).toLocaleString()}? This will overwrite your active average plan forecast values.`)) {
      return;
    }
    
    setIsCommitting(true);
    try {
      const items = record.items;
      const monthKeys = getForecastMonthKeys();
      
      const restoredParts = parts.map(p => {
        const item = items.find((it: any) => it.sebango.trim().toUpperCase() === p.sebango.trim().toUpperCase());
        const existingForecasts = p.monthly_forecasts || {};
        let updatedForecasts = { ...existingForecasts };
        
        if (item) {
          updatedForecasts = {
            ...existingForecasts,
            [monthKeys.monthN]: { volume: item.monthN, daily: item.dailyRequirementN },
            [monthKeys.monthN1]: { volume: item.monthN1, daily: item.dailyRequirementN1 },
            [monthKeys.monthN2]: { volume: item.monthN2, daily: item.dailyRequirementN2 },
            [monthKeys.monthN3]: { volume: item.monthN3, daily: item.dailyRequirementN3 }
          };
          
          return {
            ...p,
            dailyRequirementN: item.dailyRequirementN,
            dailyRequirementN1: item.dailyRequirementN1,
            dailyRequirementN2: item.dailyRequirementN2,
            dailyRequirementN3: item.dailyRequirementN3,
            monthN: item.monthN,
            monthN1: item.monthN1,
            monthN2: item.monthN2,
            monthN3: item.monthN3,
            monthly_forecasts: updatedForecasts
          };
        }
        
        return {
          ...p,
          dailyRequirementN: 0,
          dailyRequirementN1: 0,
          dailyRequirementN2: 0,
          dailyRequirementN3: 0,
          monthN: 0,
          monthN1: 0,
          monthN2: 0,
          monthN3: 0,
          monthly_forecasts: {
            ...existingForecasts,
            [monthKeys.monthN]: { volume: 0, daily: 0 },
            [monthKeys.monthN1]: { volume: 0, daily: 0 },
            [monthKeys.monthN2]: { volume: 0, daily: 0 },
            [monthKeys.monthN3]: { volume: 0, daily: 0 }
          }
        };
      });
      
      await importParts(restoredParts);
      
      // Update local state
      const workingDays = 20;
      const initial = restoredParts.map(p => {
        return {
          sebango: p.sebango || '',
          partNumber: p.partNumber || '',
          partName: p.partName || '',
          modelCode: p.model || '',
          machineId: p.homeLine || '',
          factory: getFactoryFromHomeLine(p.homeLine),
          area: p.area || '',
          cycleTime: p.cycleTime || 60,
          cavity: p.cavity || 1,
          monthN: p.monthN || ((p.dailyRequirementN || p.qtyDay || 0) * workingDays),
          monthN1: p.monthN1 || ((p.dailyRequirementN1 || 0) * workingDays),
          monthN2: p.monthN2 || ((p.dailyRequirementN2 || 0) * workingDays),
          monthN3: p.monthN3 || ((p.dailyRequirementN3 || 0) * workingDays),
          dailyRequirementN: p.dailyRequirementN || p.qtyDay || 0,
          dailyRequirementN1: p.dailyRequirementN1 || 0,
          dailyRequirementN2: p.dailyRequirementN2 || 0,
          dailyRequirementN3: p.dailyRequirementN3 || 0
        };
      });
      setPartsForecast(initial);
      setSubTab('active');
      
      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to restore forecast values.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleManualPartSelect = (partNo: string) => {
    setSelectedManualPartNo(partNo);
    if (!partNo) {
      setManualMonthN('');
      setManualMonthN1('');
      setManualMonthN2('');
      setManualMonthN3('');
      return;
    }
    const currentForecast = partsForecast.find(p => p.partNumber === partNo);
    if (currentForecast) {
      setManualMonthN(String(currentForecast.monthN || 0));
      setManualMonthN1(String(currentForecast.monthN1 || 0));
      setManualMonthN2(String(currentForecast.monthN2 || 0));
      setManualMonthN3(String(currentForecast.monthN3 || 0));
    } else {
      setManualMonthN('0');
      setManualMonthN1('0');
      setManualMonthN2('0');
      setManualMonthN3('0');
    }
  };

  const handleManualSubmit = async () => {
    if (!selectedManualPartNo) return;
    
    const originalPart = parts.find(pt => pt.partNumber === selectedManualPartNo);
    if (!originalPart) return;
    
    setIsCommitting(true);
    try {
      const monthKeys = getForecastMonthKeys();
      const workingDays = 20;
      
      const vN = Math.max(0, parseFloat(manualMonthN) || 0);
      const vN1 = Math.max(0, parseFloat(manualMonthN1) || 0);
      const vN2 = Math.max(0, parseFloat(manualMonthN2) || 0);
      const vN3 = Math.max(0, parseFloat(manualMonthN3) || 0);

      const dN = Math.round(vN / workingDays);
      const dN1 = Math.round(vN1 / workingDays);
      const dN2 = Math.round(vN2 / workingDays);
      const dN3 = Math.round(vN3 / workingDays);

      const existingForecasts = originalPart.monthly_forecasts || {};
      const updatedForecasts = {
        ...existingForecasts,
        [monthKeys.monthN]: { volume: vN, daily: dN },
        [monthKeys.monthN1]: { volume: vN1, daily: dN1 },
        [monthKeys.monthN2]: { volume: vN2, daily: dN2 },
        [monthKeys.monthN3]: { volume: vN3, daily: dN3 }
      };

      const revisedPart = {
        ...originalPart,
        dailyRequirementN: dN,
        dailyRequirementN1: dN1,
        dailyRequirementN2: dN2,
        dailyRequirementN3: dN3,
        monthN: vN,
        monthN1: vN1,
        monthN2: vN2,
        monthN3: vN3,
        monthly_forecasts: updatedForecasts
      };

      // Call updatePart context method to save to state and Supabase
      await updatePart(selectedManualPartNo, revisedPart);



      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 2000);
      handleManualPartSelect(''); // reset
    } catch (err) {
      console.error(err);
      alert('Failed to save manual forecast adjustment.');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDeleteForecastItem = async (item: PartForecast) => {
    if (viewState === 'preview') {
      setTempForecast(prev => prev.filter(p => p.partNumber !== item.partNumber));
      return;
    }

    if (!window.confirm(`Are you sure you want to delete part "${item.partNumber}" [${item.sebango}] from the master database? This action cannot be undone.`)) {
      return;
    }
    
    setIsCommitting(true);
    try {
      await deletePart(item.partNumber);
      
      // Update local state forecast list as well
      setPartsForecast(prev => prev.filter(p => p.partNumber !== item.partNumber));
      

    } catch (err) {
      console.error('Failed to delete part:', err);
      alert('Failed to delete part from database.');
    } finally {
      setIsCommitting(false);
    }
  };

  // Grouped machine workload chart calculations (FUKA Load hours per day)
  const fukaChartData = useMemo(() => {
    const activeList = viewState === 'preview' ? tempForecast : partsForecast;
    if (activeList.length === 0) return {};
    
    // We pre-populate map with ACTUAL configurations from database keys:
    const map: Record<string, Record<string, { machineId: string; hours: number }>> = {
      'FACT 2': { 'MC 1': { machineId: 'MC 1', hours: 0 }, 'MC 2': { machineId: 'MC 2', hours: 0 }, 'MC 3': { machineId: 'MC 3', hours: 0 }, 'MC 4': { machineId: 'MC 4', hours: 0 }, 'MC 5': { machineId: 'MC 5', hours: 0 }, 'MC 6': { machineId: 'MC 6', hours: 0 }, 'MC 7': { machineId: 'MC 7', hours: 0 }, 'MC 8': { machineId: 'MC 8', hours: 0 } },
      'FACT 3': { 'MC 1': { machineId: 'MC 1', hours: 0 }, 'MC 2': { machineId: 'MC 2', hours: 0 }, 'MC 3': { machineId: 'MC 3', hours: 0 }, 'MC 4': { machineId: 'MC 4', hours: 0 }, 'MC 5': { machineId: 'MC 5', hours: 0 }, 'MC 6': { machineId: 'MC 6', hours: 0 }, 'MC 7': { machineId: 'MC 7', hours: 0 }, 'MC 8': { machineId: 'MC 8', hours: 0 }, 'MC 9': { machineId: 'MC 9', hours: 0 }, 'MC 10': { machineId: 'MC 10', hours: 0 }, 'MC 11': { machineId: 'MC 11', hours: 0 }, 'MC 13': { machineId: 'MC 13', hours: 0 }, 'MC 14': { machineId: 'MC 14', hours: 0 } },
      'FACT 4': { 'MC 1': { machineId: 'MC 1', hours: 0 }, 'MC 7': { machineId: 'MC 7', hours: 0 }, 'MC 8': { machineId: 'MC 8', hours: 0 }, 'MC B1': { machineId: 'MC B1', hours: 0 }, 'MC B2': { machineId: 'MC B2', hours: 0 }, 'MC B3': { machineId: 'MC B3', hours: 0 } },
      'SC2 Resin': { 'MC 1': { machineId: 'MC 1', hours: 0 }, 'MC 2': { machineId: 'MC 2', hours: 0 }, 'MC 3': { machineId: 'MC 3', hours: 0 }, 'MC 4': { machineId: 'MC 4', hours: 0 }, 'MC 5': { machineId: 'MC 5', hours: 0 } }
    };
    
    activeList.forEach(p => {
      const factoryKey = getFactoryFromHomeLine(p.machineId);
      if (factoryKey === 'Unknown' || !map[factoryKey]) return;
      
      // Clean machine ID to match keys like "MC 6", "MC B3", "MC 1"
      let cleanMcKey = p.machineId;
      cleanMcKey = cleanMcKey.replace(/^(F2|F3|F4|SC2|SC1|FACT\s*[2-4]|SC2\s*RESIN)\s*/i, '').trim();
      cleanMcKey = cleanMcKey.replace(/#/g, '');
      cleanMcKey = cleanMcKey.replace(/MC/i, '');
      cleanMcKey = cleanMcKey.replace(/-\d+T/i, '').trim();
      cleanMcKey = `MC ${cleanMcKey}`;
      
      if (!map[factoryKey][cleanMcKey]) {
        map[factoryKey][cleanMcKey] = { machineId: cleanMcKey, hours: 0 };
      }
      
      let reqDaily = 0;
      if (fukaFilter === 'monthN') reqDaily = p.dailyRequirementN;
      else if (fukaFilter === 'monthN1') reqDaily = p.dailyRequirementN1;
      else if (fukaFilter === 'monthN2') reqDaily = p.dailyRequirementN2;
      else if (fukaFilter === 'monthN3') reqDaily = p.dailyRequirementN3;
      
      const loadHours = ((reqDaily / (p.cavity || 1)) * (p.cycleTime || 60)) / 3600;
      map[factoryKey][cleanMcKey].hours += loadHours;
    });
    
    const result: Record<string, any[]> = {};
    Object.keys(map).forEach(factory => {
      result[factory] = Object.values(map[factory])
        .map(d => ({
          machineId: d.machineId,
          hours: Number(d.hours.toFixed(1))
        }))
        .sort((a, b) => a.machineId.localeCompare(b.machineId));
    });
    
    return result;
  }, [partsForecast, tempForecast, viewState, fukaFilter]);

  const activeDisplayList = viewState === 'preview' ? tempForecast : partsForecast;

  // Search & Filter List processing
  const processedDisplayList = useMemo(() => {
    let list = [...activeDisplayList];
    
    // 1. Search Query filter (global search)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qClean = q.replace(/\s+/g, '');
      list = list.filter(item => {
        const sebango = (item.sebango || '').toLowerCase();
        const partNumber = (item.partNumber || '').toLowerCase();
        const partName = (item.partName || '').toLowerCase();
        const rawMachine = (item.machineId || '').toLowerCase();
        const resolvedMachine = resolveMachineKey(item.machineId || '').toLowerCase();
        
        let machineMatch = rawMachine.replace(/\s+/g, '').includes(qClean) ||
                           resolvedMachine.replace(/\s+/g, '').includes(qClean);
        
        return (
          sebango.includes(q) ||
          partNumber.includes(q) ||
          partName.includes(q) ||
          machineMatch
        );
      });
    }
    
    // 2. Column-specific filters
    if (columnFilters.sebango.trim()) {
      const f = columnFilters.sebango.toLowerCase().trim();
      list = list.filter(item => item.sebango.toLowerCase().includes(f));
    }
    if (columnFilters.partNumber.trim()) {
      const f = columnFilters.partNumber.toLowerCase().trim();
      list = list.filter(item => 
        item.partNumber.toLowerCase().includes(f) || 
        item.partName.toLowerCase().includes(f)
      );
    }
    if (columnFilters.modelCode.trim()) {
      const f = columnFilters.modelCode.toLowerCase().trim();
      list = list.filter(item => item.modelCode.toLowerCase().includes(f));
    }
    if (columnFilters.machineId.trim()) {
      const f = columnFilters.machineId.toLowerCase().trim();
      const fClean = f.replace(/\s+/g, '');
      list = list.filter(item => {
        const raw = (item.machineId || '').toLowerCase();
        const resolved = resolveMachineKey(item.machineId || '').toLowerCase();
        const rawClean = raw.replace(/\s+/g, '');
        const resolvedClean = resolved.replace(/\s+/g, '');
        return rawClean.includes(fClean) || resolvedClean.includes(fClean);
      });
    }
    
    const filterVolume = (val: number, filterStr: string) => {
      const f = filterStr.trim();
      if (!f) return true;
      if (f.startsWith('>=')) {
        const num = parseFloat(f.slice(2));
        return isNaN(num) ? true : val >= num;
      }
      if (f.startsWith('>')) {
        const num = parseFloat(f.slice(1));
        return isNaN(num) ? true : val > num;
      }
      if (f.startsWith('<=')) {
        const num = parseFloat(f.slice(2));
        return isNaN(num) ? true : val <= num;
      }
      if (f.startsWith('<')) {
        const num = parseFloat(f.slice(1));
        return isNaN(num) ? true : val < num;
      }
      const num = parseFloat(f);
      return isNaN(num) ? val.toString().includes(f) : val >= num;
    };

    if (columnFilters.monthN.trim()) {
      list = list.filter(item => filterVolume(item.monthN, columnFilters.monthN));
    }
    if (columnFilters.monthN1.trim()) {
      list = list.filter(item => filterVolume(item.monthN1, columnFilters.monthN1));
    }
    if (columnFilters.monthN2.trim()) {
      list = list.filter(item => filterVolume(item.monthN2, columnFilters.monthN2));
    }
    if (columnFilters.monthN3.trim()) {
      list = list.filter(item => filterVolume(item.monthN3, columnFilters.monthN3));
    }
    
    // 3. Sort by field and direction (Click-to-sort columns)
    if (sortField !== 'default') {
      list.sort((a, b) => {
        let valA = a[sortField as keyof PartForecast];
        let valB = b[sortField as keyof PartForecast];
        
        // Handle string sorting (case insensitive)
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        
        // Handle numeric sorting
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        
        return 0;
      });
    }
    
    return list;
  }, [activeDisplayList, searchQuery, columnFilters, sortField, sortDirection]);

  return (
    <div className="space-y-4">
      {/* Upload Forecast / Excel Paste Controls */}
      <Card className={`p-6 border-slate-200 bg-slate-50 transition-all shadow-sm ${isProcessing ? 'opacity-80' : ''}`}>
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-green-700 animate-pulse" />
              Upload Monthly Forecast ({monthNames.monthN} to {monthNames.monthN3})
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Upload monthly forecast values directly based on <strong>Sebango</strong>. The uploaded values should already represent the <strong>average daily volume (Volume Average / Day)</strong>.
            </p>
          </div>
          
          <div className="bg-slate-200/60 p-0.5 rounded-full flex gap-1 select-none shrink-0 self-center lg:self-start border border-slate-300/30">
            <button
              onClick={() => { setImportMode('csv'); setErrorMsg(''); }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                importMode === 'csv' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-350'
              }`}
            >
              CSV/Excel File
            </button>
            <button
              onClick={() => { setImportMode('paste'); setErrorMsg(''); }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                importMode === 'paste' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-350'
              }`}
            >
              Excel Paste
            </button>
            <button
              onClick={() => { setImportMode('manual'); setErrorMsg(''); }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                importMode === 'manual' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-350'
              }`}
            >
              Manual Input
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-200/60 pt-5">
          {importMode === 'csv' && (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white rounded-lg transition-colors relative">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv,.txt" 
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
              <Upload className="w-10 h-10 mb-2.5 text-slate-400" />
              <button 
                onClick={handleTriggerUpload}
                disabled={isProcessing}
                className="px-4 py-2 bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'Processing File...' : 'Select CSV/Text File'}
              </button>
              <span className="text-[10px] text-slate-400 mt-2">CSV columns: Sebango, {monthNames.monthN} (Avg/Day), {monthNames.monthN1} (Avg/Day), {monthNames.monthN2} (Avg/Day), {monthNames.monthN3} (Avg/Day)</span>
            </div>
          )}

          {importMode === 'paste' && (
            <div className="space-y-3">
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder={`Paste your copied Excel table columns here... (Example: Sebango [Tab] ${monthNames.monthN} (Avg/Day) [Tab] ${monthNames.monthN1} (Avg/Day) [Tab] ${monthNames.monthN2} (Avg/Day) [Tab] ${monthNames.monthN3} (Avg/Day))`}
                className="w-full h-32 p-3 text-xs font-mono border border-slate-300 focus:border-green-600 outline-none rounded bg-white shadow-inner resize-y leading-relaxed"
                disabled={isProcessing}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPasteData('')}
                  className="px-4 py-2 border border-slate-200 bg-white text-slate-650 rounded text-[10px] font-bold uppercase hover:bg-slate-50 cursor-pointer"
                >
                  Clear Text
                </button>
                <button
                  onClick={handlePasteSubmit}
                  disabled={isProcessing || !pasteData.trim()}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-bold uppercase tracking-wider shadow disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? 'Processing Paste...' : 'Submit Paste Data'}
                </button>
              </div>
            </div>
          )}

          {importMode === 'manual' && (
            <div className="space-y-4 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Pilih Part (Sebango / Part No / Name)</label>
                  <select
                    value={selectedManualPartNo}
                    onChange={(e) => handleManualPartSelect(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-bold text-slate-700 outline-none focus:border-green-650 cursor-pointer shadow-sm"
                  >
                    <option value="">-- Pilih Part untuk di-adjust --</option>
                    {parts.map(p => (
                      <option key={p.partNumber} value={p.partNumber}>
                        {p.sebango ? `[${p.sebango}] ` : ''}{p.partNumber} - {p.partName || ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedManualPartNo && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-blue-50/30 border border-blue-200/50 p-3 rounded-lg">
                      <label className="block text-[9px] font-extrabold uppercase text-blue-700 mb-1.5">{getShortMonthName(monthNames.monthN)}</label>
                      <input
                        type="number"
                        value={manualMonthN}
                        onChange={(e) => setManualMonthN(e.target.value)}
                        placeholder="Volume"
                        className="w-full px-2 py-1.5 border border-slate-200 focus:border-blue-500 outline-none rounded text-xs font-mono font-bold bg-white"
                      />
                      <span className="text-[9px] text-blue-500 font-bold block mt-1">
                        Daily: {Math.round((parseFloat(manualMonthN) || 0) / 20).toLocaleString()} / day
                      </span>
                    </div>

                    <div className="bg-indigo-50/30 border border-indigo-200/50 p-3 rounded-lg">
                      <label className="block text-[9px] font-extrabold uppercase text-indigo-700 mb-1.5">{getShortMonthName(monthNames.monthN1)}</label>
                      <input
                        type="number"
                        value={manualMonthN1}
                        onChange={(e) => setManualMonthN1(e.target.value)}
                        placeholder="Volume"
                        className="w-full px-2 py-1.5 border border-slate-200 focus:border-indigo-500 outline-none rounded text-xs font-mono font-bold bg-white"
                      />
                      <span className="text-[9px] text-indigo-500 font-bold block mt-1">
                        Daily: {Math.round((parseFloat(manualMonthN1) || 0) / 20).toLocaleString()} / day
                      </span>
                    </div>

                    <div className="bg-emerald-50/30 border border-emerald-200/50 p-3 rounded-lg">
                      <label className="block text-[9px] font-extrabold uppercase text-emerald-700 mb-1.5">{getShortMonthName(monthNames.monthN2)}</label>
                      <input
                        type="number"
                        value={manualMonthN2}
                        onChange={(e) => setManualMonthN2(e.target.value)}
                        placeholder="Volume"
                        className="w-full px-2 py-1.5 border border-slate-200 focus:border-emerald-500 outline-none rounded text-xs font-mono font-bold bg-white"
                      />
                      <span className="text-[9px] text-emerald-500 font-bold block mt-1">
                        Daily: {Math.round((parseFloat(manualMonthN2) || 0) / 20).toLocaleString()} / day
                      </span>
                    </div>

                    <div className="bg-amber-50/30 border border-amber-200/50 p-3 rounded-lg">
                      <label className="block text-[9px] font-extrabold uppercase text-amber-700 mb-1.5">{getShortMonthName(monthNames.monthN3)}</label>
                      <input
                        type="number"
                        value={manualMonthN3}
                        onChange={(e) => setManualMonthN3(e.target.value)}
                        placeholder="Volume"
                        className="w-full px-2 py-1.5 border border-slate-200 focus:border-amber-500 outline-none rounded text-xs font-mono font-bold bg-white"
                      />
                      <span className="text-[9px] text-amber-500 font-bold block mt-1">
                        Daily: {Math.round((parseFloat(manualMonthN3) || 0) / 20).toLocaleString()} / day
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleManualPartSelect('')}
                      className="px-4 py-2 border border-slate-250 bg-white text-slate-605 hover:bg-slate-50 text-[10px] font-bold uppercase rounded cursor-pointer transition-all"
                    >
                      Reset / Cancel
                    </button>
                    <button
                      onClick={handleManualSubmit}
                      disabled={isCommitting}
                      className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded shadow flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Save Adjustment
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-150 text-rose-700 rounded text-[11px] font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {errorMsg}
            </div>
          )}

          {uploadSuccess && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded text-[11px] font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 animate-bounce" />
              File parsed successfully! Review the forecast preview below.
            </div>
          )}
        </div>
      </Card>

      {/* Preview Action Header (If in Preview State) */}
      {viewState === 'preview' && (
        <Card className="p-4 border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              ?
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">Forecast Preview Mode</h4>
              <p className="text-[10px] text-amber-700 font-medium">Please review the parsed daily requirements before committing to the Master Parts list.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => { setViewState('active'); setTempForecast([]); }}
              className="w-full sm:w-auto px-4 py-2 border border-slate-250 bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-bold uppercase rounded cursor-pointer"
            >
              Cancel Preview
            </button>
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded shadow flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Commit Forecast
            </button>
          </div>
        </Card>
      )}

      {commitSuccess && (
        <div className="p-4 bg-emerald-600 text-white rounded-lg font-black text-center text-xs tracking-wider flex items-center justify-center gap-2 shadow animate-in fade-in duration-300">
          <Check className="w-5 h-5 animate-bounce" /> FORECAST COMMITTED SUCCESSFULLY TO DATABASE MASTER PARTS!
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Parts Forecast List Table */}
        <div className="xl:col-span-2 space-y-4 min-w-0">
          <Card className={`overflow-hidden border-slate-200 flex flex-col p-0 bg-white shadow-sm h-[720px]`}>
            {/* Table Header with Search and Sort indicators */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 shrink-0">
                  <Box className="w-4 h-4 text-[#008d51]" />
                  {viewState === 'preview' ? 'Temporary Upload Preview' : 'Active Average Plan Forecast'}
                </h3>
                
                {viewState === 'active' && (
                  <div className="bg-slate-200/50 p-0.5 rounded-lg flex gap-1 select-none shrink-0 border border-slate-350/20">
                    <button
                      onClick={() => setSubTab('active')}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        subTab === 'active' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-300/50'
                      }`}
                    >
                      Active Plan
                    </button>
                    <button
                      onClick={() => setSubTab('history')}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        subTab === 'history' ? 'bg-[#008d51] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-300/50'
                      }`}
                    >
                      Upload History
                    </button>
                  </div>
                )}
              </div>
              
              {(viewState === 'preview' || (viewState === 'active' && subTab === 'active')) && activeDisplayList.length > 0 && (
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end sm:ml-auto shrink-0">
                  {(Object.values(columnFilters).some(v => v !== '') || searchQuery.trim() !== '') && (
                    <button
                      onClick={() => {
                        setColumnFilters({
                          sebango: '',
                          partNumber: '',
                          modelCode: '',
                          machineId: '',
                          monthN: '',
                          monthN1: '',
                          monthN2: '',
                          monthN3: ''
                        });
                        setSearchQuery('');
                      }}
                      className="px-2.5 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search parts (Sebango, Part No, Name)..."
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded text-[10px] outline-none focus:border-green-500 bg-white shadow-sm"
                    />
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-extrabold px-2.5 py-1.5 rounded-full uppercase tracking-wider shrink-0 select-none">
                    {processedDisplayList.length} / {activeDisplayList.length} Parts
                  </span>
                </div>
              )}
            </div>
            
            {/* Scrollable Container (max 20 items = aligned height) */}
            <div className="overflow-x-auto flex-1 overflow-y-auto pr-1">
              {subTab === 'history' && viewState === 'active' ? (
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500 font-bold">List of previously committed forecast uploads.</span>
                    <button 
                      onClick={fetchHistory}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded cursor-pointer transition-colors"
                    >
                      Refresh History
                    </button>
                  </div>
                  
                  <div className="divide-y divide-slate-150 max-h-[550px] overflow-y-auto pr-1">
                    {forecastHistory.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-bold">
                        No committed forecast history records found.
                      </div>
                    ) : (
                      forecastHistory.map((record, index) => (
                        <div key={record.id || index} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800 text-xs font-mono">
                                {new Date(record.created_at).toLocaleString('en-US', { 
                                  year: 'numeric', month: 'long', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit', second: '2-digit' 
                                })}
                              </span>
                              <span className="bg-slate-100 text-slate-700 text-[9px] font-black px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                                {record.itemCount} Parts
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold">
                              Batch ID: {record.id}
                            </p>
                            
                            {/* Micro preview of first few parts in the batch */}
                            <div className="flex flex-wrap gap-1 mt-1.5 max-w-xl">
                              {record.items && record.items.slice(0, 5).map((it: any, itIdx: number) => (
                                <span key={itIdx} className="bg-slate-50 text-slate-600 text-[9px] px-1.5 py-0.5 rounded border border-slate-200 font-mono font-bold">
                                  {it.sebango}: {it.monthN?.toLocaleString() || 0}
                                </span>
                              ))}
                              {record.items && record.items.length > 5 && (
                                <span className="text-[9px] text-slate-400 font-extrabold self-center ml-1">
                                  +{record.items.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2 self-end sm:self-center shrink-0">
                            <button
                              onClick={() => handleRestoreHistory(record)}
                              disabled={isCommitting}
                              className="px-4 py-2 bg-[#008d51] hover:bg-[#007040] text-white text-[10px] font-black uppercase rounded shadow tracking-wider flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              Restore Plan
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[900px] relative">
                  <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)] text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    <tr className="bg-slate-50/20">
                      <th className="p-0" style={{ width: '9%' }}>
                        {renderSortHeader('sebango', 'Sebango')}
                      </th>
                      <th className="p-0" style={{ width: '18%' }}>
                        {renderSortHeader('partNumber', 'Part Number / Name')}
                      </th>
                      <th className="p-0" style={{ width: '11%' }}>
                        {renderSortHeader('modelCode', 'Model')}
                      </th>
                      <th className="p-0" style={{ width: '11%' }}>
                        {renderSortHeader('machineId', 'M/C')}
                      </th>
                      <th className="p-0 text-right bg-blue-50/20" style={{ width: '11%' }}>
                        {renderSortHeader('monthN', getShortMonthName(monthNames.monthN), true)}
                      </th>
                      <th className="p-0 text-right bg-indigo-50/20" style={{ width: '11%' }}>
                        {renderSortHeader('monthN1', getShortMonthName(monthNames.monthN1), true)}
                      </th>
                      <th className="p-0 text-right bg-emerald-50/20" style={{ width: '11%' }}>
                        {renderSortHeader('monthN2', getShortMonthName(monthNames.monthN2), true)}
                      </th>
                      <th className="p-0 text-right bg-amber-50/20" style={{ width: '11%' }}>
                        {renderSortHeader('monthN3', getShortMonthName(monthNames.monthN3), true)}
                      </th>
                      <th className="px-3 py-3.5 text-center text-slate-400" style={{ width: '7%' }}>
                        Action
                      </th>
                    </tr>
                    {/* Inline search and filters per column */}
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="p-1 bg-slate-50/40" style={{ width: '9%' }}>
                        <input
                          type="text"
                          value={columnFilters.sebango}
                          onChange={e => setColumnFilters(prev => ({ ...prev, sebango: e.target.value }))}
                          placeholder="Filter..."
                          className="w-full px-2 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white"
                        />
                      </th>
                      <th className="p-1 bg-slate-50/40" style={{ width: '18%' }}>
                        <input
                          type="text"
                          value={columnFilters.partNumber}
                          onChange={e => setColumnFilters(prev => ({ ...prev, partNumber: e.target.value }))}
                          placeholder="Filter Part..."
                          className="w-full px-2 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white"
                        />
                      </th>
                      <th className="p-1 bg-slate-50/40" style={{ width: '11%' }}>
                        <input
                          type="text"
                          value={columnFilters.modelCode}
                          onChange={e => setColumnFilters(prev => ({ ...prev, modelCode: e.target.value }))}
                          placeholder="Filter Model..."
                          className="w-full px-2 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white"
                        />
                      </th>
                      <th className="p-1 bg-slate-50/40" style={{ width: '11%' }}>
                        <input
                          type="text"
                          value={columnFilters.machineId}
                          onChange={e => setColumnFilters(prev => ({ ...prev, machineId: e.target.value }))}
                          placeholder="Filter M/C..."
                          className="w-full px-2 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white"
                        />
                      </th>
                      <th className="p-1 bg-blue-50/10 text-right" style={{ width: '11%' }}>
                        <input
                          type="text"
                          value={columnFilters.monthN}
                          onChange={e => setColumnFilters(prev => ({ ...prev, monthN: e.target.value }))}
                          placeholder="Min..."
                          className="w-full px-1 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white text-right"
                        />
                      </th>
                      <th className="p-1 bg-indigo-50/10 text-right" style={{ width: '11%' }}>
                        <input
                          type="text"
                          value={columnFilters.monthN1}
                          onChange={e => setColumnFilters(prev => ({ ...prev, monthN1: e.target.value }))}
                          placeholder="Min..."
                          className="w-full px-1 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white text-right"
                        />
                      </th>
                      <th className="p-1 bg-emerald-50/10 text-right" style={{ width: '11%' }}>
                        <input
                          type="text"
                          value={columnFilters.monthN2}
                          onChange={e => setColumnFilters(prev => ({ ...prev, monthN2: e.target.value }))}
                          placeholder="Min..."
                          className="w-full px-1 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white text-right"
                        />
                      </th>
                      <th className="p-1 bg-amber-50/10 text-right" style={{ width: '11%' }}>
                        <input
                          type="text"
                          value={columnFilters.monthN3}
                          onChange={e => setColumnFilters(prev => ({ ...prev, monthN3: e.target.value }))}
                          placeholder="Min..."
                          className="w-full px-1 py-1 border border-slate-200 rounded text-[9px] font-medium outline-none focus:border-green-500 bg-white text-right"
                        />
                      </th>
                      <th className="p-1 bg-slate-50/40" style={{ width: '7%' }}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {processedDisplayList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                          {searchQuery || Object.values(columnFilters).some(v => v !== '') ? 'No parts matched your active filters.' : 'No forecast records found. Paste or upload monthly forecast data.'}
                        </td>
                      </tr>
                    ) : (
                      processedDisplayList.map((p, idx) => (
                        <tr key={`${p.sebango}-${idx}`} className="hover:bg-slate-50/50 transition-colors animate-in fade-in duration-100">
                          <td className="p-3 font-mono font-black text-[#008d51]" style={{ width: '9%' }}>
                            {p.sebango}
                          </td>
                          <td className="p-3" style={{ width: '18%' }}>
                            <div className="font-bold text-slate-800">{p.partNumber}</div>
                            <div className="text-[9px] text-slate-400 truncate max-w-[170px]">{p.partName}</div>
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[10px]" style={{ width: '11%' }}>
                            {p.modelCode}
                          </td>
                          <td className="p-2 text-slate-755" style={{ width: '11%' }}>
                            <select
                              value={resolveMachineKey(p.machineId)}
                              onChange={(e) => handleMachineChange(p.partNumber, e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#008d51] cursor-pointer transition-colors"
                            >
                              <optgroup label="SC1 - FACTORY 2">
                                <option value="F2 MC 1">F2 MC 1</option>
                                <option value="F2 MC 2">F2 MC 2</option>
                                <option value="F2 MC 3">F2 MC 3</option>
                                <option value="F2 MC 4">F2 MC 4</option>
                                <option value="F2 MC 5">F2 MC 5</option>
                                <option value="F2 MC 6">F2 MC 6</option>
                                <option value="F2 MC 7">F2 MC 7</option>
                                <option value="F2 MC 8">F2 MC 8</option>
                              </optgroup>
                              <optgroup label="SC1 - FACTORY 3">
                                <option value="F3 MC 1">F3 MC 1</option>
                                <option value="F3 MC 2">F3 MC 2</option>
                                <option value="F3 MC 3">F3 MC 3</option>
                                <option value="F3 MC 4">F3 MC 4</option>
                                <option value="F3 MC 5">F3 MC 5</option>
                                <option value="F3 MC 6">F3 MC 6</option>
                                <option value="F3 MC 7">F3 MC 7</option>
                                <option value="F3 MC 8">F3 MC 8</option>
                                <option value="F3 MC 9">F3 MC 9</option>
                                <option value="F3 MC 10">F3 MC 10</option>
                                <option value="F3 MC 10B">F3 MC 10B</option>
                                <option value="F3 MC 11">F3 MC 11</option>
                                <option value="F3 MC 13">F3 MC 13</option>
                                <option value="F3 MC 14">F3 MC 14</option>
                              </optgroup>
                              <optgroup label="SC1 - FACTORY 4">
                                <option value="F4 MC 1">F4 MC 1</option>
                                <option value="F4 MC 7">F4 MC 7</option>
                                <option value="F4 MC 8">F4 MC 8</option>
                                <option value="F4 MC B1">F4 MC B1</option>
                                <option value="F4 MC B2">F4 MC B2</option>
                                <option value="F4 MC B3">F4 MC B3</option>
                              </optgroup>
                              <optgroup label="SC2 - KARAWANG">
                                <option value="SC2 MC 1">SC2 MC 1</option>
                                <option value="SC2 MC 2">SC2 MC 2</option>
                                <option value="SC2 MC 3">SC2 MC 3</option>
                                <option value="SC2 MC 4">SC2 MC 4</option>
                                <option value="SC2 MC 5">SC2 MC 5</option>
                              </optgroup>
                            </select>
                          </td>
                          
                          {/* Month N */}
                          <td className="p-3 text-right bg-blue-50/10 border-l border-slate-100" style={{ width: '11%' }}>
                            <div className="font-mono font-bold text-blue-700">{p.monthN.toLocaleString()}</div>
                            <div className="text-[8px] text-blue-500 font-extrabold">{p.dailyRequirementN.toLocaleString()} / day</div>
                          </td>
                          
                          {/* Month N+1 */}
                          <td className="p-3 text-right bg-indigo-50/10 border-l border-slate-100" style={{ width: '11%' }}>
                            <div className="font-mono font-bold text-indigo-700">{p.monthN1.toLocaleString()}</div>
                            <div className="text-[8px] text-indigo-500 font-extrabold">{p.dailyRequirementN1.toLocaleString()} / day</div>
                          </td>

                          {/* Month N+2 */}
                          <td className="p-3 text-right bg-emerald-50/10 border-l border-slate-100" style={{ width: '11%' }}>
                            <div className="font-mono font-bold text-emerald-700">{p.monthN2.toLocaleString()}</div>
                            <div className="text-[8px] text-emerald-500 font-extrabold">{p.dailyRequirementN2.toLocaleString()} / day</div>
                          </td>

                          {/* Month N+3 */}
                          <td className="p-3 text-right bg-amber-50/10 border-l border-slate-100" style={{ width: '11%' }}>
                            <div className="font-mono font-bold text-amber-700">{p.monthN3.toLocaleString()}</div>
                            <div className="text-[8px] text-amber-500 font-extrabold">{p.dailyRequirementN3.toLocaleString()} / day</div>
                          </td>

                          {/* Action - Delete Button */}
                          <td className="p-3 text-center border-l border-slate-100" style={{ width: '7%' }}>
                            <button
                              onClick={() => handleDeleteForecastItem(p)}
                              title={viewState === 'preview' ? "Remove from Preview List" : "Delete Part from Master Database"}
                              disabled={isCommitting}
                              className="p-1.5 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* FUKA Workload / Hours Machine Chart (Scrollable, matching table height) */}
        <div className="space-y-4 min-w-0">
          <Card className="p-5 border-slate-200 bg-white flex flex-col shadow-sm h-[720px]">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <span className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-green-700 animate-pulse" />
                FUKA Load (Daily M/C Hours)
              </span>
              
              <select 
                className="text-[10px] font-black border border-slate-200 rounded px-2.5 py-1.5 bg-slate-50 text-slate-700 outline-none focus:border-green-500 uppercase select-none cursor-pointer"
                value={fukaFilter}
                onChange={e => setFukaFilter(e.target.value as any)}
              >
                <option value="monthN">{monthNames.monthN}</option>
                <option value="monthN1">{monthNames.monthN1}</option>
                <option value="monthN2">{monthNames.monthN2}</option>
                <option value="monthN3">{monthNames.monthN3}</option>
              </select>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-1">
              {Object.keys(fukaChartData).length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-12">
                  No workload hours to plot.
                </div>
              ) : (
                Object.keys(fukaChartData).map(factory => {
                  const data = fukaChartData[factory];
                  return (
                    <div key={`${fukaFilter}-${factory}`} className="border border-slate-100 rounded p-3 bg-slate-50/30 shadow-inner">
                      <div className="font-black text-slate-800 text-[11px] mb-2 uppercase tracking-wide">
                        {factory}
                      </div>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="machineId" tick={{ fontSize: 9, fill: '#64748B', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis type="number" domain={[0, 24]} ticks={[0, 8, 16, 24]} tick={{ fontSize: 8, fill: '#64748B' }} axisLine={false} tickLine={false} />
                            <Tooltip 
                              cursor={{ fill: '#F1F5F9' }}
                              contentStyle={{ borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '10px', fontWeight: 'bold' }}
                            />
                            <Bar dataKey="hours" name="Hrs/Day" fill="#008d51" barSize={16} radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
