import React, { useState, useRef, useMemo } from 'react';
import { Card } from '../components/ui/card';
import { useOrders, OrderConversion, DailyOrder, ProductionCommand } from '../context/OrdersContext';
import { useParts } from '../context/PartsContext';
import { useUserRole } from '../context/UserContext';
import { MonthlyOrdersView } from '../components/orders/MonthlyOrdersView';
import {
  Calendar,
  CalendarDays,
  CalendarClock,
  Upload,
  ArrowRight,
  Sparkles,
  Loader2,
  Database,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Undo,
  RefreshCw
} from 'lucide-react';

export function OrdersPage() {
  const [activeTab, setActiveTab] = useState<'annual' | 'monthly' | 'daily'>('daily');
  const [activeChannel, setActiveChannel] = useState<'TMMIN' | 'ADM' | 'TBINA' | 'Others'>('TMMIN');
  const [showDbManager, setShowDbManager] = useState(false);
  const [dbSearch, setDbSearch] = useState('');
  const [csvPasteText, setCsvPasteText] = useState('');
  const [showCsvPasteArea, setShowCsvPasteArea] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // New conversion form states
  const [newCustPart, setNewCustPart] = useState('');
  const [newCustSebango, setNewCustSebango] = useState('');
  const [newProdSebango, setNewProdSebango] = useState('');
  const [newPartCategory, setNewPartCategory] = useState<'big' | 'small'>('big');

  // Manual single order states
  const [manualPartNo, setManualPartNo] = useState('');
  const [manualSebango, setManualSebango] = useState('');
  const [manualQty, setManualQty] = useState<number | ''>('');
  const [manualEta, setManualEta] = useState(() => {
    // Tomorrow at 18:00 default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const hh = String(tomorrow.getHours()).padStart(2, '0');
    const min = String(tomorrow.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { parts, updatePart } = useParts();
  const { role } = useUserRole();

  const {
    dailyOrders,
    commands,
    injectedCommandIds,
    uploadDailyOrders,
    clearDailyOrders,
    injectCommandsToShopfloor,
    resetInjections
  } = useOrders();

  // Derived conversions list from Master Parts that have customer mappings defined
  const conversions = useMemo(() => {
    return parts
      .filter(p => p.customerPno || p.customerSebango)
      .map(p => ({
        id: p.partNumber, // Use partNumber as the unique ID for routing edits
        custPartNumber: p.customerPno || '',
        custSebango: p.customerSebango || '',
        prodSebango: p.sebango || p.partNumber,
        partCategory: (parseInt(p.tonnage) >= 2000 || (p.partName || '').toUpperCase().includes('BUMPER') || (p.partName || '').toUpperCase().includes('PANEL') || (p.partName || '').toUpperCase().includes('BOARD') || (p.partName || '').toUpperCase().includes('INSTRUMENT')) ? ('big' as const) : ('small' as const)
      }));
  }, [parts]);

  const addConversion = (conv: any) => {
    const part = parts.find(p => p.sebango === conv.prodSebango || p.partNumber === conv.prodSebango);
    if (part) {
      updatePart(part.partNumber, {
        ...part,
        customerPno: conv.custPartNumber,
        customerSebango: conv.custSebango
      });
    } else {
      alert(`Master Part with Production Sebango "${conv.prodSebango}" not found in Database! Mappings can only be added to registered master parts.`);
    }
  };

  const deleteConversion = (id: string) => {
    const part = parts.find(p => p.partNumber === id);
    if (part) {
      updatePart(part.partNumber, {
        ...part,
        customerPno: '',
        customerSebango: ''
      });
    }
  };

  const updateConversion = (id: string, conv: any) => {
    const part = parts.find(p => p.partNumber === id);
    if (part) {
      updatePart(part.partNumber, {
        ...part,
        customerPno: conv.custPartNumber,
        customerSebango: conv.custSebango
      });
    }
  };

  const clearConversions = async () => {
    for (const p of parts) {
      if (p.customerPno || p.customerSebango) {
        await updatePart(p.partNumber, {
          ...p,
          customerPno: '',
          customerSebango: ''
        });
      }
    }
  };

  // Conversion Database Drag/Drop & Excel Paste States
  const [convView, setConvView] = useState<'list' | 'upload'>('list');
  const [convImportMethod, setConvImportMethod] = useState<'file' | 'paste'>('file');
  const [convPasteText, setConvPasteText] = useState('');
  const [convIsDragOver, setConvIsDragOver] = useState(false);
  const [convParsedPreview, setConvParsedPreview] = useState<any[]>([]);
  const [convParsedCount, setConvParsedCount] = useState(0);
  const [convCsvError, setConvCsvError] = useState<string | null>(null);
  const [convIsUploading, setConvIsUploading] = useState(false);
  const convFileInputRef = useRef<HTMLInputElement>(null);

  // Quote-aware CSV parser matching the exact conversion rules columns
  const parseConvCSVContent = (text: string) => {
    const parseLine = (line: string) => {
      let insideQuote = false;
      const cols: string[] = [];
      let current = '';
      const separator = line.includes('\t') ? '\t' : ',';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === separator && !insideQuote) {
          cols.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim());
      return cols;
    };

    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) throw new Error("Content is empty.");
    const headers = parseLine(lines[0]);
    const parsedList: any[] = [];
    const uniqueConvs = new Map();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length < 2) continue;

      const getVal = (fieldName: string) => {
        const idx = headers.findIndex(h => {
          if (!h) return false;
          return h.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') === fieldName.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        });
        return idx !== -1 ? cols[idx] : undefined;
      };

      const custPartNumber = getVal('Customer Part Number') || getVal('CustomerPartNumber') || getVal('CUST_PART_NUMBER') || cols[0] || '';
      const custSebango = getVal('Customer Sebango Code') || getVal('CustomerSebangoCode') || getVal('CUST_SEBANGO') || cols[1] || '';
      const prodSebango = getVal('Production Sebango (Master Part)') || getVal('ProductionSebango') || getVal('PROD_SEBANGO') || cols[2] || '';
      const categoryStr = getVal('Part Category') || getVal('PartCategory') || getVal('CATEGORY') || cols[3] || 'big';

      const finalCustPart = (custPartNumber || '').trim();
      const finalProdSebango = (prodSebango || '').trim();
      
      if (finalCustPart !== '' && finalProdSebango !== '') {
        const partCategory = (categoryStr || '').trim().toLowerCase() === 'small' ? 'small' : 'big';
        const key = finalCustPart.toUpperCase();
        
        uniqueConvs.set(key, {
          custPartNumber: finalCustPart,
          custSebango: (custSebango || '').trim() || 'CUST-SEB',
          prodSebango: finalProdSebango,
          partCategory: partCategory
        });
      }
    }

    return Array.from(uniqueConvs.values());
  };

  const handleConvDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setConvIsDragOver(true);
  };

  const handleConvDragLeave = () => {
    setConvIsDragOver(false);
  };

  const processConvFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setConvCsvError('Only CSV files (.csv) are supported.');
      return;
    }
    setConvCsvError(null);
    setConvIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseConvCSVContent(text);
        if (parsed.length === 0) {
          setConvCsvError('No valid conversion rules found. Make sure headers are exact.');
          setConvParsedPreview([]);
          setConvParsedCount(0);
        } else {
          setConvParsedPreview(parsed);
          setConvParsedCount(parsed.length);
        }
      } catch (err: any) {
        setConvCsvError(err.message || 'Error parsing CSV file.');
        setConvParsedPreview([]);
        setConvParsedCount(0);
      } finally {
        setConvIsUploading(false);
      }
    };
    reader.onerror = () => {
      setConvCsvError('Failed to read file.');
      setConvIsUploading(false);
    };
    reader.readAsText(file);
  };

  const handleConvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setConvIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processConvFile(file);
  };

  const handleConvCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processConvFile(file);
  };

  const handleConvPasteSubmit = () => {
    if (!convPasteText.trim()) {
      alert('Pasted content is empty.');
      return;
    }
    setConvCsvError(null);
    try {
      const parsed = parseConvCSVContent(convPasteText);
      if (parsed.length === 0) {
        setConvCsvError('No valid conversion rules found. Make sure headers match exactly.');
        setConvParsedPreview([]);
        setConvParsedCount(0);
      } else {
        setConvParsedPreview(parsed);
        setConvParsedCount(parsed.length);
      }
    } catch (err: any) {
      setConvCsvError(err.message || 'Error parsing pasted clipboard content.');
      setConvParsedPreview([]);
      setConvParsedCount(0);
    }
  };

  const handleApplyConvCSV = () => {
    if (convParsedPreview.length === 0) return;
    convParsedPreview.forEach(rule => {
      const ruleCustPart = (rule.custPartNumber || '').trim().toUpperCase();
      if (!ruleCustPart) return; // Skip invalid records
      
      const exists = conversions.some(c => {
        const cCustPart = (c.custPartNumber || '').trim().toUpperCase();
        return cCustPart === ruleCustPart;
      });
      
      if (!exists) {
        addConversion(rule);
      } else {
        const existing = conversions.find(c => {
          const cCustPart = (c.custPartNumber || '').trim().toUpperCase();
          return cCustPart === ruleCustPart;
        });
        if (existing) {
          updateConversion(existing.id, rule);
        }
      }
    });
    alert(`Successfully imported ${convParsedPreview.length} mapping rules!`);
    setConvParsedPreview([]);
    setConvParsedCount(0);
    setConvView('list');
    if (convFileInputRef.current) convFileInputRef.current.value = '';
  };

  // Search/Filter Conversions
  const filteredConversions = useMemo(() => {
    if (!dbSearch) return conversions;
    const s = dbSearch.trim().toLowerCase();
    return conversions.filter(
      c =>
        (c.custPartNumber || '').toLowerCase().includes(s) ||
        (c.custSebango || '').toLowerCase().includes(s) ||
        (c.prodSebango || '').toLowerCase().includes(s)
    );
  }, [conversions, dbSearch]);

  // Filter commands by active channel
  const channelCommands = useMemo(() => {
    return commands.filter(c => c.channel === activeChannel);
  }, [commands, activeChannel]);

  // Active channel orders count
  const activeChannelOrdersCount = useMemo(() => {
    return dailyOrders.filter(o => o.channel === activeChannel).length;
  }, [dailyOrders, activeChannel]);

  // Handle Manual Order Submission
  const handleManualOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPartNo.trim() || !manualQty) {
      alert('Please provide a customer Part Number and Quantity.');
      return;
    }

    // Format ETA
    const formattedEta = manualEta.replace('T', ' ');

    uploadDailyOrders(activeChannel, [
      {
        custPartNumber: manualPartNo.trim(),
        custSebango: manualSebango.trim() || 'CUST-SEB',
        qty: Number(manualQty),
        eta: formattedEta
      }
    ]);

    // Reset manual form fields
    setManualPartNo('');
    setManualSebango('');
    setManualQty('');
  };

  // Parse pasted CSV data
  const handleCsvPasteSubmit = () => {
    if (!csvPasteText.trim()) {
      alert('Pasted content is empty.');
      return;
    }

    setIsImporting(true);
    setTimeout(() => {
      const rows = csvPasteText.split('\n').map(r => r.trim()).filter(r => r.length > 0);
      const parsedOrders: Omit<DailyOrder, 'id' | 'channel'>[] = [];

      rows.forEach((row, i) => {
        // Detect and skip headers
        if (i === 0 && (row.toLowerCase().includes('part') || row.toLowerCase().includes('sebango') || row.toLowerCase().includes('qty'))) {
          return;
        }

        // Try comma, tab or semicolon splits
        let cols = row.split(',');
        if (cols.length < 3) cols = row.split('\t');
        if (cols.length < 3) cols = row.split(';');

        if (cols.length >= 3) {
          const custPartNumber = cols[0]?.trim() || '';
          const custSebango = cols[1]?.trim() || '';
          const qty = parseInt(cols[2]?.trim()) || 0;
          let eta = cols[3]?.trim() || '';

          // Format ETA
          if (!eta) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(18, 0, 0, 0);
            eta = tomorrow.toISOString().slice(0, 16).replace('T', ' ');
          } else {
            eta = eta.replace('T', ' ');
          }

          if (custPartNumber && qty > 0) {
            parsedOrders.push({
              custPartNumber,
              custSebango: custSebango || 'CUST-SEB',
              qty,
              eta
            });
          }
        }
      });

      if (parsedOrders.length > 0) {
        uploadDailyOrders(activeChannel, parsedOrders);
        setCsvPasteText('');
        setShowCsvPasteArea(false);
      } else {
        alert('Could not parse any valid order rows. Formatting template:\nPART_NO, CUSTOMER_SEBANGO, QTY, ETA');
      }
      setIsImporting(false);
    }, 800);
  };

  // CSV File Uploader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const rows = text.split('\n').map(r => r.trim()).filter(r => r.length > 0);
      const parsedOrders: Omit<DailyOrder, 'id' | 'channel'>[] = [];

      rows.forEach((row, i) => {
        if (i === 0 && (row.toLowerCase().includes('part') || row.toLowerCase().includes('sebango') || row.toLowerCase().includes('qty'))) {
          return;
        }

        let cols = row.split(',');
        if (cols.length < 3) cols = row.split('\t');
        if (cols.length < 3) cols = row.split(';');

        if (cols.length >= 3) {
          const custPartNumber = cols[0]?.trim() || '';
          const custSebango = cols[1]?.trim() || '';
          const qty = parseInt(cols[2]?.trim()) || 0;
          let eta = cols[3]?.trim() || '';

          if (!eta) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(18, 0, 0, 0);
            eta = tomorrow.toISOString().slice(0, 16).replace('T', ' ');
          } else {
            eta = eta.replace('T', ' ');
          }

          if (custPartNumber && qty > 0) {
            parsedOrders.push({
              custPartNumber,
              custSebango: custSebango || 'CUST-SEB',
              qty,
              eta
            });
          }
        }
      });

      if (parsedOrders.length > 0) {
        uploadDailyOrders(activeChannel, parsedOrders);
      } else {
        alert('Invalid CSV structure. Please use columns: PART_NO, CUST_SEBANGO, QTY, ETA');
      }
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Handle conversion registration
  const handleAddConversionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustPart.trim() || !newProdSebango) {
      alert('Please fill out Customer Part Number and select a Production Sebango.');
      return;
    }

    addConversion({
      custPartNumber: newCustPart.trim(),
      custSebango: newCustSebango.trim() || 'CUST-SEB',
      prodSebango: newProdSebango,
      partCategory: newPartCategory
    });

    // Reset fields
    setNewCustPart('');
    setNewCustSebango('');
    setNewProdSebango('');
  };

  // Color mappings for channels
  const channelStyles = {
    TMMIN: {
      activeBg: 'bg-blue-600 text-white',
      inactiveText: 'text-blue-600 border-blue-200 hover:bg-blue-50',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      accent: 'border-blue-500'
    },
    ADM: {
      activeBg: 'bg-emerald-600 text-white',
      inactiveText: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accent: 'border-emerald-500'
    },
    TBINA: {
      activeBg: 'bg-amber-600 text-white',
      inactiveText: 'text-amber-600 border-amber-200 hover:bg-amber-50',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      accent: 'border-amber-500'
    },
    Others: {
      activeBg: 'bg-slate-700 text-white',
      inactiveText: 'text-slate-600 border-slate-200 hover:bg-slate-50',
      badge: 'bg-slate-50 text-slate-700 border-slate-200',
      accent: 'border-slate-500'
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Order Management Workbench</h2>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-1">
            Convert customer daily orders to shopfloor schedules with real-time SUGITY shift offsets
          </p>
        </div>
        
        {/* Reset / Testing Actions */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => resetInjections()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase rounded border border-slate-200 transition-colors"
          >
            <Undo className="w-3.5 h-3.5" />
            Reset Injection Flags
          </button>
        </div>
      </div>

      {/* Primary Category Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-md border border-slate-200">
        {[
          { id: 'annual', label: 'Annual Plan', icon: Calendar },
          { id: 'monthly', label: 'Monthly Forecast', icon: CalendarDays },
          { id: 'daily', label: 'Daily Orders', icon: CalendarClock }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'annual' && (
        <Card className="p-8 text-center bg-slate-50 border-slate-200">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Annual Production Plan</h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
            Annual forecasting schedules can be uploaded here. Curated by long-term planning teams.
          </p>
        </Card>
      )}

      {activeTab === 'monthly' && <MonthlyOrdersView />}

      {activeTab === 'daily' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDE: Operations, Upload, Mappings (5 cols) */}
          <div className="xl:col-span-5 space-y-6 min-w-0">
            
            {/* 1. Channel Select & Upload Workbench */}
            <Card className="p-5 border-slate-200 flex flex-col space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Customer PO Intake</h3>
                <span className="text-[9px] font-mono text-slate-400">Step 1: Upload or Register PO</span>
              </div>

              {/* Channel Pill Selectors */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200">
                {(['TMMIN', 'ADM', 'TBINA', 'Others'] as const).map(ch => {
                  const isActive = activeChannel === ch;
                  const activeStyle = channelStyles[ch].activeBg;
                  return (
                    <button
                      key={ch}
                      onClick={() => {
                        setActiveChannel(ch);
                        setShowCsvPasteArea(false);
                      }}
                      className={`py-1.5 text-[10px] font-bold rounded uppercase transition-all tracking-wider text-center ${
                        isActive ? activeStyle : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>

              {/* Intake Methods */}
              <div className="space-y-4">
                <div className="flex gap-2 justify-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                  />
                  <button
                    disabled={isImporting}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-50 text-[10px] font-bold uppercase border border-slate-200 text-slate-700 rounded shadow-sm transition-colors"
                  >
                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload CSV
                  </button>
                  <button
                    onClick={() => setShowCsvPasteArea(!showCsvPasteArea)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-[10px] font-bold uppercase border rounded shadow-sm transition-colors ${
                      showCsvPasteArea
                        ? 'bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Paste Excel Rows
                  </button>
                </div>

                {/* Excel Paste Area */}
                {showCsvPasteArea && (
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-left space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-250">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-700 uppercase">Excel copy-paste input</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        Copy grid columns from Excel and paste here. Columns should match exactly: 
                        <code className="bg-slate-200 px-1 py-0.5 rounded font-mono ml-1 text-slate-600">PartNo, CustSebango, Qty, ETA</code>
                      </p>
                    </div>
                    <textarea
                      value={csvPasteText}
                      onChange={e => setCsvPasteText(e.target.value)}
                      placeholder={`67613/4-BZ050/80,ADM-01,150,2026-05-29 18:00\n62631/2-BZ030,ADM-02,180,2026-05-29 20:00`}
                      rows={5}
                      className="w-full p-2 bg-white text-[10px] font-mono border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCsvPasteSubmit}
                        disabled={isImporting}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold uppercase text-[9px] rounded flex items-center justify-center gap-1 transition-colors"
                      >
                        {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Process Paste Data
                      </button>
                      <button
                        onClick={() => setShowCsvPasteArea(false)}
                        className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-[9px] font-bold uppercase text-slate-600 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual Order Entry Form */}
                <form onSubmit={handleManualOrderSubmit} className="pt-3 border-t border-slate-100 text-left space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-700 uppercase">Single PO Entry</h4>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Cust Part Number</label>
                      <input
                        type="text"
                        value={manualPartNo}
                        onChange={e => setManualPartNo(e.target.value)}
                        placeholder="e.g. 67613/4-BZ050/80"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Customer Sebango</label>
                      <input
                        type="text"
                        value={manualSebango}
                        onChange={e => setManualSebango(e.target.value)}
                        placeholder="e.g. ADM-01"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Quantity (Pcs)</label>
                      <input
                        type="number"
                        value={manualQty}
                        onChange={e => setManualQty(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 150"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        min="1"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Delivery ETA</label>
                      <input
                        type="datetime-local"
                        value={manualEta}
                        onChange={e => setManualEta(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold uppercase text-[9px] rounded flex items-center justify-center gap-1 transition-colors`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add PO to Queue
                  </button>
                </form>
              </div>

              {/* Clear Intake Actions */}
              {activeChannelOrdersCount > 0 && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => clearDailyOrders(activeChannel)}
                    className="text-[9px] font-bold text-rose-600 hover:text-rose-800 uppercase flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear {activeChannel} Queue ({activeChannelOrdersCount})
                  </button>
                </div>
              )}
            </Card>

            {/* 2. Order Conversion Database Settings */}
            <Card className="p-5 border-slate-200 flex flex-col space-y-4">
              <button
                onClick={() => setShowDbManager(!showDbManager)}
                className="w-full flex items-center justify-between text-slate-800 border-b border-slate-100 pb-2 focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-left">
                    Conversion Database ({conversions.length})
                  </h3>
                </div>
                {showDbManager ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showDbManager && (
                <div className="space-y-4 text-left animate-in fade-in duration-200">
                  
                  {/* View Selector Pills */}
                  <div className="flex bg-slate-100 p-1 rounded border border-slate-200/50 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setConvView('list');
                        setConvParsedPreview([]);
                        setConvParsedCount(0);
                        setConvCsvError(null);
                      }}
                      className={`flex-1 py-1.5 rounded text-[9px] font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                        convView === 'list'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40 font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      List & Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConvView('upload');
                        setConvParsedPreview([]);
                        setConvParsedCount(0);
                        setConvCsvError(null);
                      }}
                      className={`flex-1 py-1.5 rounded text-[9px] font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                        convView === 'upload'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40 font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Excel / CSV Upload
                    </button>
                  </div>

                  {convView === 'list' ? (
                    <>
                      {/* Search Mappings */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search conversion rules..."
                          value={dbSearch}
                          onChange={e => setDbSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                      </div>

                      {/* Registered Rules Grid */}
                      <div className="max-h-48 overflow-y-auto border border-slate-100 rounded divide-y divide-slate-100 bg-white">
                        {filteredConversions.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-[10px]">
                            No matching conversion mappings found.
                          </div>
                        ) : (
                          filteredConversions.map(conv => (
                            <div key={conv.id} className="p-2.5 flex items-center justify-between text-[10px] hover:bg-slate-50">
                              <div className="space-y-1 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800">{conv.custPartNumber}</span>
                                  <span className="text-slate-400 font-mono text-[8px] bg-slate-100 px-1 py-0.5 rounded">
                                    Sebango: {conv.custSebango}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                  <span className="font-mono text-slate-600 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[8px]">
                                    {conv.prodSebango}
                                  </span>
                                  <span className={`px-1 rounded uppercase font-bold text-[8px] border ${
                                    conv.partCategory === 'big' 
                                      ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {conv.partCategory} Part
                                  </span>
                                </div>
                              </div>
                              
                              <button
                                onClick={() => deleteConversion(conv.id)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                title="Delete conversion mapping"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {conversions.length > 0 && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm("Are you sure you want to clear all conversion mapping rules? This cannot be undone.")) {
                                await clearConversions();
                                alert("Successfully cleared all conversion rules!");
                              }
                            }}
                            className="text-[9px] font-bold text-rose-600 hover:text-rose-800 uppercase flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear Mappings ({conversions.length})
                          </button>
                        </div>
                      )}

                      {/* Add New Mapping Form */}
                      <form onSubmit={handleAddConversionSubmit} className="pt-3 border-t border-slate-100 space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-700 uppercase">Create Conversion Rule</h4>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Customer Part Number</label>
                            <input
                              type="text"
                              value={newCustPart}
                              onChange={e => setNewCustPart(e.target.value)}
                              placeholder="e.g. 67613/4-BZ050/80"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Customer Sebango</label>
                            <input
                              type="text"
                              value={newCustSebango}
                              onChange={e => setNewCustSebango(e.target.value)}
                              placeholder="e.g. ADM-01"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Production Part (Master Dropdown)</label>
                            <select
                              value={newProdSebango}
                              onChange={e => setNewProdSebango(e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                              required
                            >
                              <option value="">-- Choose Sebango --</option>
                              {parts.map(p => (
                                <option key={p.partNumber} value={p.sebango || p.partNumber}>
                                  {p.sebango || p.partNumber} ({p.partName.slice(0, 20)})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Part Category</label>
                            <select
                              value={newPartCategory}
                              onChange={e => setNewPartCategory(e.target.value as any)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                              <option value="big">Big Part (8h offset)</option>
                              <option value="small">Small Part (12h offset)</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold uppercase text-[9px] rounded flex items-center justify-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Register Conversion Mapping
                        </button>
                      </form>
                    </>
                  ) : (
                    /* Conversion Upload / Paste Sub-View */
                    <div className="space-y-4 animate-in fade-in duration-200">
                      
                      {/* Import Method Toggle Pills */}
                      <div className="flex border-b border-slate-200/60 p-1 bg-slate-50 rounded gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConvImportMethod('file');
                            setConvParsedPreview([]);
                            setConvParsedCount(0);
                            setConvCsvError(null);
                          }}
                          className={`flex-1 py-1 rounded text-[8.5px] font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            convImportMethod === 'file'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40 font-black'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConvImportMethod('paste');
                            setConvParsedPreview([]);
                            setConvParsedCount(0);
                            setConvCsvError(null);
                          }}
                          className={`flex-1 py-1 rounded text-[8.5px] font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            convImportMethod === 'paste'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40 font-black'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Excel Paste
                        </button>
                      </div>

                      {convImportMethod === 'file' ? (
                        <>
                          <input
                            type="file"
                            ref={convFileInputRef}
                            onChange={handleConvCSVUpload}
                            accept=".csv"
                            className="hidden"
                          />
                          {/* Dropzone */}
                          <div
                            onDragOver={handleConvDragOver}
                            onDragLeave={handleConvDragLeave}
                            onDrop={handleConvDrop}
                            onClick={() => convFileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                              convIsDragOver
                                ? 'border-[#E76114] bg-orange-50/40 shadow-inner'
                                : convParsedPreview.length > 0
                                ? 'border-emerald-300 bg-emerald-50/10'
                                : 'border-slate-200 hover:border-[#E76114] hover:bg-slate-50/50'
                            }`}
                          >

                          {convIsUploading ? (
                            <div className="space-y-2">
                              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
                              <p className="text-[10px] font-bold text-slate-600">Analyzing file...</p>
                            </div>
                          ) : convParsedPreview.length > 0 ? (
                            <div className="space-y-2">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <h4 className="text-[10px] font-extrabold text-slate-800">CSV Loaded</h4>
                              <p className="text-[9px] text-slate-500 uppercase font-semibold">
                                {convParsedCount} rules parsed
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="w-10 h-10 rounded-full bg-[#E76114]/10 text-[#E76114] flex items-center justify-center mx-auto group-hover:scale-105 transition-transform duration-300">
                                <Upload className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-700">Drag & drop CSV here</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">or click to browse files</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      /* Paste Spreadsheet Clipboard */
                        <div className="space-y-2 text-left animate-in fade-in duration-200">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            Copy-Paste Spreadsheet Cells
                          </label>
                          <textarea
                            value={convPasteText}
                            onChange={(e) => setConvPasteText(e.target.value)}
                            rows={4}
                            placeholder="Customer Part Number	Customer Sebango Code	Production Sebango (Master Part)	Part Category&#10;67613/4-BZ050/80	ADM-01	U0-5600-BLCK	big&#10;62631/2-BZ030	ADM-02	U0-5604-BLCK	big"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[9.5px] outline-none focus:border-[#E76114] transition-all bg-white font-mono leading-relaxed"
                          />
                          <button
                            type="button"
                            onClick={handleConvPasteSubmit}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-[9px] font-extrabold uppercase tracking-wider rounded transition-all shadow-sm cursor-pointer"
                          >
                            Parse & Preview
                          </button>
                        </div>
                      )}

                      {convCsvError && (
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-rose-700 text-[9.5px] font-medium leading-relaxed">
                          {convCsvError}
                        </div>
                      )}

                      {convParsedPreview.length > 0 && (
                        <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="font-extrabold text-slate-500 uppercase">Preview (First 3)</span>
                            <span className="bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200">
                              Ready
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100 border border-slate-150 rounded bg-white max-h-24 overflow-y-auto">
                            {convParsedPreview.slice(0, 3).map((rule, idx) => (
                              <div key={idx} className="p-2 flex justify-between items-center text-[9px]">
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-slate-800">{rule.custPartNumber}</span>
                                  <span className="text-[7.5px] text-slate-400 font-mono">SEB: {rule.custSebango}</span>
                                </div>
                                <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                                  {rule.prodSebango}
                                </span>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleApplyConvCSV}
                            className="w-full py-2 bg-[#E76114] hover:bg-[#c95411] text-white text-[9.5px] font-bold uppercase tracking-wider rounded transition-colors shadow-sm cursor-pointer"
                          >
                            Commit Mapped Rules ({convParsedCount})
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}
            </Card>
          </div>

          {/* RIGHT SIDE: Solved Commands & Timeline Offset Trigger (7 cols) */}
          <div className="xl:col-span-7 space-y-6 min-w-0">
            
            {/* Live Commands Workbench */}
            <Card className="overflow-hidden flex flex-col p-0 border-slate-200">
              <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${channelStyles[activeChannel].badge}`}>
                      {activeChannel}
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">Resolved Production Commands</h3>
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-1 uppercase font-semibold">
                    Step 2: Review working hour offsets and trigger shopfloor lineups
                  </p>
                </div>

                {channelCommands.some(c => c.status === 'pending' && c.prodSebango !== 'NO MAPPING') && (
                  <button
                    onClick={() => {
                      const pendingIds = channelCommands.filter(c => c.status === 'pending' && c.prodSebango !== 'NO MAPPING').map(c => c.id);
                      injectCommandsToShopfloor(pendingIds);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-wider rounded shadow transition-colors`}
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Inject All Pending ({channelCommands.filter(c => c.status === 'pending' && c.prodSebango !== 'NO MAPPING').length})
                  </button>
                )}
              </div>

              {/* Grid/Table view */}
              <div className="flex-1 overflow-x-auto">
                {channelCommands.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                    <Clock className="w-8 h-8 text-slate-300" />
                    <div>
                      <h4 className="font-bold text-slate-700 text-xs">Queue is Empty</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Please upload or add customer orders to trigger reverse lead-time solving!
                      </p>
                    </div>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="p-3">Part Details & Machine</th>
                        <th className="p-3 text-center">Category / Lead Time</th>
                        <th className="p-3">Order Delivery ETA</th>
                        <th className="p-3 text-emerald-700 bg-emerald-50/50">Production Start Trigger</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[10.5px]">
                      {channelCommands.map(cmd => {
                        const isInjected = cmd.status === 'injected';
                        return (
                          <tr key={cmd.id} className="hover:bg-slate-50/50">
                            
                            {/* Part & Line */}
                            <td className="p-3">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                {cmd.custPartNumber}
                                <span className="font-mono text-[8px] text-slate-400">({cmd.custSebango})</span>
                              </div>
                              <div className="font-medium text-slate-500 text-[8.5px] uppercase mt-0.5 line-clamp-1">{cmd.partName}</div>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {cmd.prodSebango === 'NO MAPPING' ? (
                                  <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase rounded bg-rose-50 text-rose-600 border border-rose-200 font-mono">
                                    NO MAPPING
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                                    {cmd.prodSebango}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 text-[8.5px] font-bold uppercase rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  Line: {cmd.homeLine}
                                </span>
                              </div>
                            </td>

                            {/* Qty & Category */}
                            <td className="p-3 text-center">
                              <div className="font-bold font-mono text-slate-800 text-[11px]">{cmd.qty} pcs</div>
                              {cmd.cavity !== undefined && (
                                <div className="text-[9px] text-slate-500 font-semibold font-mono mt-0.5">
                                  {cmd.shots} shots (Cav: {cmd.cavity})
                                </div>
                              )}
                              <div className="mt-1 flex justify-center">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                                  cmd.category === 'big'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-teal-50 text-teal-700 border-teal-200'
                                }`}>
                                  {cmd.category === 'big' ? 'Big (-8h)' : 'Small (-12h)'}
                                </span>
                              </div>
                            </td>

                            {/* Delivery ETA */}
                            <td className="p-3 font-mono text-slate-600 text-[10px]">
                              {cmd.eta}
                            </td>

                            {/* Target Trigger Production Time (Solved backwards!) */}
                            <td className="p-3 font-mono font-bold text-emerald-700 bg-emerald-50/20 text-[10px]">
                              {cmd.triggerTime}
                            </td>

                            {/* Action Status */}
                            <td className="p-3 text-center">
                              {cmd.prodSebango === 'NO MAPPING' ? (
                                <div className="flex flex-col items-center justify-center text-slate-400 gap-0.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-extrabold uppercase border border-slate-200 tracking-wide">
                                    Dummy
                                  </span>
                                  <span className="text-[7.5px] font-bold text-slate-400 uppercase mt-0.5">Non-Sugity</span>
                                </div>
                              ) : isInjected ? (
                                <div className="flex flex-col items-center justify-center text-emerald-600 gap-0.5">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="text-[8px] font-extrabold uppercase tracking-wide">Injected</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <button
                                    onClick={() => injectCommandsToShopfloor([cmd.id])}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[8px] uppercase tracking-wider rounded transition-colors shadow-sm"
                                  >
                                    Inject
                                  </button>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">Pending</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            {/* Shift Rules Card */}
            <Card className="p-4 bg-slate-50 border-slate-200 flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[10px] font-bold text-slate-700 uppercase">SUGITY Shopfloor Timeline Solver Rules</h4>
                <p className="text-[9.5px] text-slate-500 mt-1 leading-relaxed">
                  Offset timings (Big parts: <strong>8 working hours / 480 minutes</strong>, Small parts: <strong>12 working hours / 720 minutes</strong>) are calculated specifically by traversing backward through the actual shopfloor working minutes of the target home machine. The solver automatically jumps over lunch blocks (<code className="bg-slate-200 px-0.5 rounded">11:55 - 12:35</code>), rest breaks, shift overlaps, and off-hour gaps.
                </p>
              </div>
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}
