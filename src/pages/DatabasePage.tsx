import React, { useState, useMemo, useRef, useContext, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { 
  Database, 
  Upload, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  ArrowRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Cpu,
  Layers,
  Settings,
  HelpCircle,
  Undo,
  Edit2,
  X,
  FileText,
  BarChart2,
  Tag
} from 'lucide-react';
import { LabelPreviewModal } from '../components/production/LabelPreviewModal';
import { useParts } from '../context/PartsContext';
import { useOrders } from '../context/OrdersContext';
import { useUserRole, getPlannerAdminPin } from '../context/UserContext';
import { ProductionContext } from '../context/ProductionContext';
import { getInitials } from '../lib/utils';

export function DatabasePage() {
  const { parts, addPart, deletePart, importParts, clearParts, isLoading, setParts, updatePart } = useParts();
  const { conversions, addConversion, deleteConversion, updateConversion, clearConversions } = useOrders();
  const { role, leaders, addLeader, deleteLeader, isLeaderDbConnected } = useUserRole();
  const prodContext = useContext(ProductionContext);
  
  // Top level page tab control: switches between Master Parts database, Data Converter, and Leader Registry
  const [pageTab, setPageTab] = useState<'parts' | 'converter' | 'leaders' | 'reports'>('parts');

  const [leaderName, setLeaderName] = useState('');
  const [leaderPin, setLeaderPin] = useState('');

  // Planner-only PIN reveal: decrypted server-side (AES-256-GCM) and fetched
  // on demand, so PINs are never part of the general leaders listing.
  const [leaderPins, setLeaderPins] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pageTab !== 'leaders' || role !== 'planner') return;
    let cancelled = false;
    const fetchPins = async () => {
      try {
        const res = await fetch('/api/leaders/pins', {
          headers: { 'x-admin-pin': getPlannerAdminPin() }
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        const map: Record<string, string> = {};
        (body.pins || []).forEach((p: any) => {
          if (p.id && p.pin) map[p.id] = p.pin;
        });
        setLeaderPins(map);
      } catch (e) {
        // Server unreachable — PINs simply stay masked
      }
    };
    fetchPins();
    return () => { cancelled = true; };
  }, [pageTab, role, leaders]);

  // Master Parts Form Tab control
  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('csv');

  // Conversion Search & Filters
  const [convSearch, setConvSearch] = useState('');
  const [convPage, setConvPage] = useState(1);
  const convItemsPerPage = 10;

  // New conversion form states
  const [convCustPart, setConvCustPart] = useState('');
  const [convCustSebango, setConvCustSebango] = useState('');
  const [convProdSebango, setConvProdSebango] = useState('');
  const [convPartCategory, setConvPartCategory] = useState<'big' | 'small'>('big');

  // Edit conversion state
  const [selectedConversionForEdit, setSelectedConversionForEdit] = useState<any | null>(null);
  const [editConvForm, setEditConvForm] = useState({
    custPartNumber: '',
    custSebango: '',
    prodSebango: '',
    partCategory: 'big' as 'big' | 'small'
  });
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [lineFilter, setLineFilter] = useState('ALL');
  const [modelFilter, setModelFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // CSV Drag/Drop & Import States
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [parsedCount, setParsedCount] = useState(0);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conversion CSV Drag/Drop & Import States
  const [convActiveTab, setConvActiveTab] = useState<'csv' | 'manual'>('csv');
  const [convImportMethod, setConvImportMethod] = useState<'file' | 'paste'>('file');
  const [convPasteText, setConvPasteText] = useState('');
  const [convIsDragOver, setConvIsDragOver] = useState(false);
  const [convParsedPreview, setConvParsedPreview] = useState<any[]>([]);
  const [convParsedCount, setConvParsedCount] = useState(0);
  const [convCsvError, setConvCsvError] = useState<string | null>(null);
  const [convIsUploading, setConvIsUploading] = useState(false);
  const convFileInputRef = useRef<HTMLInputElement>(null);

  // Reports tab state & filters
  const [repSearch, setRepSearch] = useState('');
  const [repFactory, setRepFactory] = useState('All');
  const [repShift, setRepShift] = useState('All');
  const [repStartDate, setRepStartDate] = useState('');
  const [repEndDate, setRepEndDate] = useState('');
  const [repPage, setRepPage] = useState(1);
  const repItemsPerPage = 15;

  const handleExportCSV = (dataToExport: any[]) => {
    if (dataToExport.length === 0) return;
    const headers = ['Date', 'Shift', 'Factory', 'Machine ID', 'Part Number', 'Part Name', 'Target Plan', 'OK Qty', 'NG Qty', 'Total Output', 'Scrap Rate %', 'Approved By', 'Initials'];
    const csvRows = [
      headers.join(','),
      ...dataToExport.map(row => [
        row.date,
        row.shift,
        row.factory,
        row.machineId,
        `"${row.partNumber}"`,
        `"${row.partName.replace(/"/g, '""')}"`,
        row.targetQty,
        row.okQty,
        row.ngQty,
        row.totalQty,
        row.scrapRate.toFixed(1) + '%',
        `"${row.approvedBy}"`,
        row.initials
      ].join(','))
    ];
    
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sugity_Lot_SignOff_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportsData = useMemo(() => {
    if (!prodContext) return [];
    const { machineJobs, logs } = prodContext;
    const list: any[] = [];
    
    Object.keys(machineJobs).forEach(key => {
      const parts = key.split('_');
      if (parts.length < 3) return;
      const date = parts[0];
      const factory = parts[1];
      const machineId = parts[2];
      
      const jobsList = machineJobs[key] || [];
      const logsList = logs[key] || [];
      
      jobsList.forEach(job => {
        if (job.status === 'completed') {
          const compLog = logsList.find(l => 
            l.message.includes('Production Completed!') && 
            l.message.includes(job.partNumber)
          );
          
          let okQty = job.actualQty || 0;
          let ngQty = 0;
          let approvedBy = 'N/A';
          let initials = '';
          
          if (compLog) {
            const logStr = compLog.message;
            const okMatch = logStr.match(/OK:\s*(\d+)/);
            const ngMatch = logStr.match(/NG:\s*(\d+)/);
            const leaderMatch = logStr.match(/Approved by Leader:\s*([^\(]+)/);
            const initialsMatch = logStr.match(/\(([A-Z]{2})\)/);
            
            if (okMatch) okQty = parseInt(okMatch[1], 10);
            if (ngMatch) ngQty = parseInt(ngMatch[1], 10);
            if (leaderMatch) approvedBy = leaderMatch[1].trim();
            if (initialsMatch) initials = initialsMatch[1];
          }
          
          const totalQty = okQty + ngQty;
          const scrapRate = totalQty > 0 ? (ngQty / totalQty) * 100 : 0;
          
          list.push({
            id: job.id,
            date,
            shift: job.shift ? job.shift.toUpperCase() : 'N/A',
            factory,
            machineId,
            partNumber: job.partNumber || job.model || 'N/A',
            partName: job.partName || 'N/A',
            targetQty: job.qtyLot || 0,
            okQty,
            ngQty,
            totalQty,
            scrapRate,
            approvedBy,
            initials
          });
        }
      });
    });
    
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [prodContext]);

  const filteredReports = useMemo(() => {
    return reportsData.filter(row => {
      const q = repSearch.trim().toLowerCase();
      if (q) {
        const matchesSearch = 
          row.partNumber.toLowerCase().includes(q) || 
          row.partName.toLowerCase().includes(q) || 
          row.approvedBy.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      
      if (repFactory !== 'All' && row.factory !== repFactory) {
        return false;
      }
      
      if (repShift !== 'All' && row.shift !== repShift) {
        return false;
      }
      
      if (repStartDate && row.date < repStartDate) return false;
      if (repEndDate && row.date > repEndDate) return false;
      
      return true;
    });
  }, [reportsData, repSearch, repFactory, repShift, repStartDate, repEndDate]);

  const paginatedReports = useMemo(() => {
    const startIdx = (repPage - 1) * repItemsPerPage;
    return filteredReports.slice(startIdx, startIdx + repItemsPerPage);
  }, [filteredReports, repPage]);

  const totalRepPages = Math.ceil(filteredReports.length / repItemsPerPage);

  // Label Preview Modal State
  const [labelPreviewPart, setLabelPreviewPart] = useState<any | null>(null);

  // Edit / Revision Modal State
  const [selectedPartForEdit, setSelectedPartForEdit] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    area: '',
    tonnage: '',
    backupLine: '',
    homeLine: '',
    sebango: '',
    customer: '',
    model: '',
    partNumber: '',
    partName: '',
    material: '',
    weight: '',
    mold: '',
    cavity: '',
    cycleTime: '',
    shikake: '2',
    customerPno: '',
    customerSebango: '',
    spec: '24'
  });

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    area: '',
    tonnage: '',
    backupLine: '',
    homeLine: '',
    sebango: '',
    customer: '',
    model: '',
    partNumber: '',
    partName: '',
    material: '',
    weight: '',
    mold: '',
    cavity: '',
    cycleTime: '',
    shikake: '2',
    customerPno: '',
    customerSebango: '',
    spec: '24'
  });

  // Action feedback notifications
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | null;
  }>({ message: '', type: null });

  // Clear confirmation toggle state
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Last deleted part for undo
  const [lastDeletedPart, setLastDeletedPart] = useState<any | null>(null);

  // Display notification
  const triggerNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: null });
    }, 4000);
  };

  // Quote-aware CSV parser matching the exact 14 columns
  const parseCSVContent = (text: string) => {
    const mergeList = (existingStr?: string, newStr?: string) => {
      const set = new Set<string>();
      if (existingStr) {
        existingStr.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) set.add(trimmed);
        });
      }
      if (newStr) {
        newStr.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) set.add(trimmed);
        });
      }
      return Array.from(set).join(', ');
    };

    const parseLine = (line: string) => {
      let insideQuote = false;
      const cols: string[] = [];
      let current = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
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
    if (lines.length === 0) throw new Error("The uploaded CSV is empty.");

    const headers = parseLine(lines[0]);

    const parsedList: any[] = [];
    const uniqueParts = new Map();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length < 2) continue;

      // Extract values by matching spreadsheet header columns exactly
      const getVal = (fieldName: string) => {
        const normalizedField = fieldName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const idx = headers.findIndex(h => h.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedField);
        return idx !== -1 ? cols[idx] : undefined;
      };

      // Header matching
      const area = getVal('AREA') || '';
      const tonnage = getVal('TONNASE') || getVal('TONNAGE') || '';
      const backupLine = getVal('BACKUP_LINE') || '';
      const homeLine = getVal('HOME_LINE') || '';
      const sebango = getVal('SEBANGO') || '';
      const customer = getVal('CUSTOMER') || '';
      const model = getVal('MODEL') || '';
      const partNumber = getVal('PART_NUMBER') || getVal('PART_NO') || cols[7] || '';
      const partName = getVal('PART_NAME') || cols[8] || '';
      const material = getVal('MATERIAL_NAME') || getVal('MATERIAL') || '';
      const weightStr = getVal('WEIGHT_KG') || getVal('WEIGHT') || '';
      const mold = getVal('MOLD_NO') || getVal('MOLD') || '';
      const cavityStr = getVal('CAVITY') || '';
      const cycleTimeStr = getVal('CYCLE_TIME_SEC') || getVal('CYCLE_TIME') || '';
      const shikakeStr = getVal('SHIKAKE') || '';
      const customerPno = getVal('CUSTOMER_PNO') || getVal('CUSTOMER PNO') || getVal('CUSTOMER PART NUMBER') || getVal('CUST_PNO') || '';
      const customerSebango = getVal('CUSTOMER_SEBANGO') || getVal('CUSTOMER SEBANGO') || getVal('CUST_SEBANGO') || '';

      let finalPartNumber = partNumber.trim();
      const finalPartName = partName.trim();
      const finalSebango = sebango.trim();

      // Fallback: If Part Number is empty but Sebango is not, use Sebango as Part Number
      if (finalPartNumber === '' && finalSebango !== '') {
        finalPartNumber = finalSebango;
      }

      if (finalPartNumber !== '') {
        const partKey = finalPartNumber;
        const existing = uniqueParts.get(partKey);

        const newPart = {
          area: area.trim(),
          tonnage: tonnage.trim().toUpperCase().endsWith('T') ? tonnage.trim().toUpperCase() : (tonnage.trim() ? `${tonnage.trim().toUpperCase()}T` : ''),
          backupLine: backupLine.trim() || homeLine.trim(),
          homeLine: homeLine.trim(),
          sebango: finalSebango || finalPartNumber,
          customer: customer.trim(),
          model: model.trim(),
          partNumber: finalPartNumber,
          partName: finalPartName,
          material: material.trim(),
          weight: parseFloat(weightStr) || 0,
          mold: mold.trim(),
          cavity: parseFloat(cavityStr) || 1,
          cycleTime: parseFloat(cycleTimeStr) || 60,
          shikake: parseInt(shikakeStr) || 2,
          customerPno: customerPno.trim(),
          customerSebango: customerSebango.trim(),
          spec: 1 // Default kanban spec
        };

        if (!existing) {
          uniqueParts.set(partKey, newPart);
        } else {
          // Merge machine info if present in subsequent rows
          uniqueParts.set(partKey, {
            ...existing,
            homeLine: newPart.homeLine || existing.homeLine,
            backupLine: newPart.backupLine || existing.backupLine || newPart.homeLine,
            tonnage: newPart.tonnage || existing.tonnage,
            area: newPart.area || existing.area,
            sebango: newPart.sebango !== partKey ? newPart.sebango : existing.sebango,
            material: newPart.material || existing.material,
            weight: newPart.weight || existing.weight,
            mold: newPart.mold || existing.mold,
            cavity: newPart.cavity || existing.cavity,
            cycleTime: newPart.cycleTime || existing.cycleTime,
            shikake: newPart.shikake || existing.shikake,
            customerPno: mergeList(existing.customerPno, newPart.customerPno),
            customerSebango: mergeList(existing.customerSebango, newPart.customerSebango)
          });
        }
      }
    }

    return Array.from(uniqueParts.values());
  };

  // Handling CSV Uploads
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setCsvError('Only CSV files (.csv) are supported.');
      return;
    }

    setCsvError(null);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSVContent(text);
        
        if (parsed.length === 0) {
          setCsvError('No valid parts found. Make sure headers match spreadsheet format.');
          setParsedPreview([]);
          setParsedCount(0);
        } else {
          setParsedPreview(parsed);
          setParsedCount(parsed.length);
          triggerNotification(`Parsed ${parsed.length} master parts successfully!`, 'success');
        }
      } catch (err: any) {
        setCsvError(err.message || 'Error parsing CSV file.');
        setParsedPreview([]);
        setParsedCount(0);
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setCsvError('Failed to read file.');
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  // Drag-and-Drop handles
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Save imported CSV parts to production state
  const handleApplyCSV = () => {
    if (parsedPreview.length === 0) return;
    // Merge/upsert: new parts are appended, existing part numbers are updated,
    // and parts not present in the CSV stay untouched.
    importParts(parsedPreview);
    triggerNotification(`Successfully merged ${parsedPreview.length} parts into the database!`, 'success');
    setParsedPreview([]);
    setParsedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle manual form input
  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setManualForm(prev => ({ ...prev, [name]: value }));
  };

  // Form submission (Manual Register)
  const handleAddManualPart = (e: React.FormEvent) => {
    e.preventDefault();
    
    const {
      area,
      tonnage,
      backupLine,
      homeLine,
      sebango,
      customer,
      model,
      partNumber,
      partName,
      material,
      weight,
      mold,
      cavity,
      cycleTime,
      shikake,
      customerPno,
      customerSebango,
      spec
    } = manualForm;

    // Validate inputs
    if (!partNumber || !partName || !model || !customer || !sebango) {
      triggerNotification('Please fill in all required identity fields (*).', 'error');
      return;
    }

    const newPart = {
      area: area.trim(),
      tonnage: tonnage.trim() ? (tonnage.trim().toUpperCase().endsWith('T') ? tonnage.trim().toUpperCase() : `${tonnage.trim().toUpperCase()}T`) : '',
      backupLine: backupLine.trim() || homeLine.trim(),
      homeLine: homeLine.trim(),
      sebango: sebango.trim(),
      customer: customer.trim(),
      model: model.trim(),
      partNumber: partNumber.trim(),
      partName: partName.trim(),
      material: material.trim(),
      weight: parseFloat(weight) || 0,
      mold: mold.trim(),
      cavity: parseFloat(cavity) || 1,
      cycleTime: parseFloat(cycleTime) || 60,
      shikake: parseInt(shikake) || 2,
      customerPno: customerPno.trim(),
      customerSebango: customerSebango.trim(),
      spec: parseInt(spec) || 24
    };

    addPart(newPart);
    triggerNotification(`Part ${partNumber} successfully registered!`, 'success');

    // Reset Form
    setManualForm({
      area: '',
      tonnage: '',
      backupLine: '',
      homeLine: '',
      sebango: '',
      customer: '',
      model: '',
      partNumber: '',
      partName: '',
      material: '',
      weight: '',
      mold: '',
      cavity: '',
      cycleTime: '',
      shikake: '2',
      customerPno: '',
      customerSebango: '',
      spec: '24'
    });
  };

  // Open Edit modal and prefill data
  const handleOpenEditModal = (part: any) => {
    setSelectedPartForEdit(part);
    setEditForm({
      area: part.area || '',
      tonnage: part.tonnage || '',
      backupLine: part.backupLine || '',
      homeLine: part.homeLine || '',
      sebango: part.sebango || '',
      customer: part.customer || '',
      model: part.model || '',
      partNumber: part.partNumber || '',
      partName: part.partName || '',
      material: part.material || '',
      weight: part.weight?.toString() || '0',
      mold: part.mold || '',
      cavity: part.cavity?.toString() || '1',
      cycleTime: part.cycleTime?.toString() || '60',
      shikake: part.shikake?.toString() || '2',
      customerPno: part.customerPno || '',
      customerSebango: part.customerSebango || '',
      spec: part.spec?.toString() || '24'
    });
  };

  // Handle Edit form inputs
  const handleEditInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  // Submit revised part details
  const handleSaveRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.partNumber || !editForm.partName || !editForm.customer || !editForm.model || !editForm.sebango) {
      triggerNotification('Please fill in all required identity fields (*).', 'error');
      return;
    }

    const revisedPart = {
      area: editForm.area.trim(),
      tonnage: editForm.tonnage.trim() ? (editForm.tonnage.trim().toUpperCase().endsWith('T') ? editForm.tonnage.trim().toUpperCase() : `${editForm.tonnage.trim().toUpperCase()}T`) : '',
      backupLine: editForm.backupLine.trim() || editForm.homeLine.trim(),
      homeLine: editForm.homeLine.trim(),
      sebango: editForm.sebango.trim(),
      customer: editForm.customer.trim(),
      model: editForm.model.trim(),
      partNumber: editForm.partNumber.trim(),
      partName: editForm.partName.trim(),
      material: editForm.material.trim(),
      weight: parseFloat(editForm.weight) || 0,
      mold: editForm.mold.trim(),
      cavity: parseFloat(editForm.cavity) || 1,
      cycleTime: parseFloat(editForm.cycleTime) || 60,
      shikake: parseInt(editForm.shikake) || 2,
      customerPno: editForm.customerPno.trim(),
      customerSebango: editForm.customerSebango.trim(),
      spec: parseInt(editForm.spec) || 24
    };

    updatePart(selectedPartForEdit.partNumber, revisedPart);

    triggerNotification(`Revised part ${revisedPart.partNumber} successfully!`, 'success');
    setSelectedPartForEdit(null); // Close Modal
  };

  // Trigger file dialog
  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Stats calculation
  const stats = useMemo(() => {
    const linesSet = new Set(parts.map(p => p.homeLine).filter(Boolean));
    const modelsSet = new Set(parts.map(p => p.model).filter(Boolean));
    return {
      totalParts: parts.length,
      totalLines: linesSet.size,
      totalModels: modelsSet.size
    };
  }, [parts]);

  // Unique Home Lines for filter
  const uniqueLines = useMemo(() => {
    const lines = Array.from(new Set(parts.map(p => p.homeLine).filter(Boolean)));
    return lines.sort();
  }, [parts]);

  // Unique Models for filter
  const uniqueModels = useMemo(() => {
    const models = Array.from(new Set(parts.map(p => p.model).filter(Boolean)));
    return models.sort();
  }, [parts]);

  // Conversions Filter & Search Logic
  const filteredConversions = useMemo(() => {
    return conversions.filter(c => {
      const matchesSearch = 
        c.custPartNumber.toLowerCase().includes(convSearch.toLowerCase()) ||
        c.custSebango.toLowerCase().includes(convSearch.toLowerCase()) ||
        c.prodSebango.toLowerCase().includes(convSearch.toLowerCase());
      return matchesSearch;
    });
  }, [conversions, convSearch]);

  // Conversions Pagination Logic
  const totalConvPages = Math.ceil(filteredConversions.length / convItemsPerPage) || 1;
  const paginatedConversions = useMemo(() => {
    const startIndex = (convPage - 1) * convItemsPerPage;
    return filteredConversions.slice(startIndex, startIndex + convItemsPerPage);
  }, [filteredConversions, convPage]);

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
    if (lines.length === 0) throw new Error("The uploaded CSV is empty.");

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

      // Header matching based on the requested format:
      // Customer Part Number | Customer Sebango Code | Production Sebango (Master Part) | Part Category
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

  // Handling CSV Uploads for Conversion Rules
  const handleConvCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processConvFile(file);
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
          setConvCsvError('No valid conversion rules found. Make sure headers match exactly.');
          setConvParsedPreview([]);
          setConvParsedCount(0);
        } else {
          setConvParsedPreview(parsed);
          setConvParsedCount(parsed.length);
          triggerNotification(`Parsed ${parsed.length} conversion rules successfully!`, 'success');
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

  // Drag-and-Drop handles for Converter CSV
  const handleConvDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setConvIsDragOver(true);
  };

  const handleConvDragLeave = () => {
    setConvIsDragOver(false);
  };

  const handleConvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setConvIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processConvFile(file);
  };

  const triggerConvFileDialog = () => {
    convFileInputRef.current?.click();
  };

  const handleConvPasteSubmit = () => {
    if (!convPasteText.trim()) {
      triggerNotification('Pasted content is empty.', 'error');
      return;
    }
    
    setConvCsvError(null);
    try {
      const parsed = parseConvCSVContent(convPasteText);
      if (parsed.length === 0) {
        setConvCsvError('No valid conversion rules found. Make sure headers match exactly: Customer Part Number, Customer Sebango Code, Production Sebango (Master Part), Part Category');
        setConvParsedPreview([]);
        setConvParsedCount(0);
      } else {
        setConvParsedPreview(parsed);
        setConvParsedCount(parsed.length);
        triggerNotification(`Parsed ${parsed.length} conversion rules successfully!`, 'success');
      }
    } catch (err: any) {
      setConvCsvError(err.message || 'Error parsing pasted spreadsheet content.');
      setConvParsedPreview([]);
      setConvParsedCount(0);
    }
  };

  // Save imported CSV rules to conversions context
  const handleApplyConvCSV = async () => {
    if (convParsedPreview.length === 0) return;
    
    // We can loop through each rule and add/update it
    for (const rule of convParsedPreview) {
      const exists = conversions.some(c => c.custPartNumber.toUpperCase() === rule.custPartNumber.toUpperCase());
      if (!exists) {
        addConversion(rule);
      } else {
        const existing = conversions.find(c => c.custPartNumber.toUpperCase() === rule.custPartNumber.toUpperCase());
        if (existing) {
          updateConversion(existing.id, rule);
        }
      }
    }
    
    triggerNotification(`Successfully updated converter with ${convParsedPreview.length} rules!`, 'success');
    setConvParsedPreview([]);
    setConvParsedCount(0);
    if (convFileInputRef.current) convFileInputRef.current.value = '';
  };

  // Handle adding a new conversion rule
  const handleAddConversion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convCustPart.trim() || !convProdSebango) {
      triggerNotification('Please specify a Customer Part Number and a Production Sebango.', 'error');
      return;
    }

    addConversion({
      custPartNumber: convCustPart.trim(),
      custSebango: convCustSebango.trim() || 'CUST-SEB',
      prodSebango: convProdSebango,
      partCategory: convPartCategory
    });

    triggerNotification(`Conversion rule registered successfully!`, 'success');
    
    // Clear inputs
    setConvCustPart('');
    setConvCustSebango('');
    setConvProdSebango('');
  };

  // Open Edit Conversion modal and prefill data
  const handleOpenEditConvModal = (conv: any) => {
    setSelectedConversionForEdit(conv);
    setEditConvForm({
      custPartNumber: conv.custPartNumber || '',
      custSebango: conv.custSebango || '',
      prodSebango: conv.prodSebango || '',
      partCategory: conv.partCategory || 'big'
    });
  };

  // Handle Edit Conversion form inputs
  const handleEditConvInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditConvForm(prev => ({ ...prev, [name]: value }));
  };

  // Submit revised conversion rule
  const handleSaveConvRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editConvForm.custPartNumber.trim() || !editConvForm.prodSebango) {
      triggerNotification('Please specify a Customer Part Number and a Production Sebango.', 'error');
      return;
    }

    updateConversion(selectedConversionForEdit.id, {
      custPartNumber: editConvForm.custPartNumber.trim(),
      custSebango: editConvForm.custSebango.trim() || 'CUST-SEB',
      prodSebango: editConvForm.prodSebango,
      partCategory: editConvForm.partCategory
    });

    triggerNotification(`Revised conversion rule successfully!`, 'success');
    setSelectedConversionForEdit(null); // Close Modal
  };

  // Conversion stats
  const convStats = useMemo(() => {
    const bigCount = conversions.filter(c => c.partCategory === 'big').length;
    const smallCount = conversions.filter(c => c.partCategory === 'small').length;
    return {
      total: conversions.length,
      big: bigCount,
      small: smallCount
    };
  }, [conversions]);

  // Filtering + Searching logic
  const filteredParts = useMemo(() => {
    return parts.filter(part => {
      // Use safe null coercion to prevent crash if any field is null/undefined
      const matchesSearch = 
        (part.partNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (part.partName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (part.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (part.sebango || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLine = lineFilter === 'ALL' || part.homeLine === lineFilter;
      const matchesModel = modelFilter === 'ALL' || part.model === modelFilter;
      
      return matchesSearch && matchesLine && matchesModel;
    });
  }, [parts, searchTerm, lineFilter, modelFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredParts.length / itemsPerPage) || 1;
  const paginatedParts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredParts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredParts, currentPage]);



  const handleDelete = (partNo: string) => {
    const partObj = parts.find(p => p.partNumber === partNo);
    if (partObj) {
      setLastDeletedPart(partObj);
    }
    deletePart(partNo);
    triggerNotification(`Part ${partNo} deleted.`, 'success');
  };

  const handleUndoDelete = () => {
    if (lastDeletedPart) {
      addPart(lastDeletedPart);
      triggerNotification(`Restored part ${lastDeletedPart.partNumber}!`, 'success');
      setLastDeletedPart(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification.type && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border backdrop-blur-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100/50' 
            : 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100/50'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-xs font-bold">{notification.message}</span>
          {notification.message.includes('deleted') && lastDeletedPart && (
            <button 
              onClick={handleUndoDelete}
              className="ml-3 flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded hover:bg-emerald-200 transition-colors cursor-pointer"
            >
              <Undo className="w-3 h-3 animate-pulse" />
              Undo
            </button>
          )}
        </div>
      )}

      {/* REVISION EDIT MODAL */}
      {selectedPartForEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <Card className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 bg-[#037233] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-4.5 h-4.5" />
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Revise Part Routing & Specifications</h3>
                  <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider mt-0.5 font-mono">{selectedPartForEdit.partNumber}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPartForEdit(null)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRevision} className="p-6 space-y-5 overflow-y-auto">
              
              {/* Part Identity Group */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                <div className="text-[10px] font-extrabold text-[#037233] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  Part Identity
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Part Number *</label>
                    <input
                      type="text"
                      name="partNumber"
                      required
                      value={editForm.partNumber}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Sebango / Unique ID *</label>
                    <input
                      type="text"
                      name="sebango"
                      required
                      value={editForm.sebango}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Part Name *</label>
                  <input
                    type="text"
                    name="partName"
                    required
                    value={editForm.partName}
                    onChange={handleEditInput}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Vehicle Model *</label>
                    <input
                      type="text"
                      name="model"
                      required
                      value={editForm.model}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Customer *</label>
                    <input
                      type="text"
                      name="customer"
                      required
                      value={editForm.customer}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white"
                    />
                  </div>
                </div>

                {/* Customer Mappings */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Customer Part Number</label>
                    <input
                      type="text"
                      name="customerPno"
                      value={editForm.customerPno}
                      onChange={handleEditInput}
                      placeholder="e.g. 52119-BZ120"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Customer Sebango</label>
                    <input
                      type="text"
                      name="customerSebango"
                      value={editForm.customerSebango}
                      onChange={handleEditInput}
                      placeholder="e.g. ADM-03"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#037233] transition-colors bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Machine Routing Group */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                <div className="text-[10px] font-extrabold text-[#E76114] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5" />
                  Machine Routing
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Home Line</label>
                    <input
                      type="text"
                      name="homeLine"
                      value={editForm.homeLine}
                      onChange={handleEditInput}
                      placeholder="e.g., F4 #B1"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-bold text-[#E76114]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Backup Line</label>
                    <input
                      type="text"
                      name="backupLine"
                      value={editForm.backupLine}
                      onChange={handleEditInput}
                      placeholder="e.g., F4 #B3"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Machine Area</label>
                    <input
                      type="text"
                      name="area"
                      value={editForm.area}
                      onChange={handleEditInput}
                      placeholder="e.g., F4"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Machine Tonnase</label>
                    <input
                      type="text"
                      name="tonnage"
                      value={editForm.tonnage}
                      onChange={handleEditInput}
                      placeholder="e.g., 3500T"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Mold Parameters Group */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-1.5 mb-1">
                  <Cpu className="w-3.5 h-3.5" />
                  Molding & Parameters
                </div>
                <div className="grid grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Cycle Time Sec</label>
                    <input
                      type="number"
                      name="cycleTime"
                      value={editForm.cycleTime}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-bold font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Cavity</label>
                    <input
                      type="number"
                      name="cavity"
                      value={editForm.cavity}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Shikake (Runs/Day)</label>
                    <input
                      type="number"
                      name="shikake"
                      value={editForm.shikake}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Mold No</label>
                    <input
                      type="text"
                      name="mold"
                      value={editForm.mold}
                      onChange={handleEditInput}
                      placeholder="e.g., MOLD-01"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Weight (KG)</label>
                    <input
                      type="text"
                      name="weight"
                      value={editForm.weight}
                      onChange={handleEditInput}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-bold font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Qty per Kanban</label>
                    <input
                      type="number"
                      name="spec"
                      value={editForm.spec}
                      onChange={handleEditInput}
                      placeholder="24"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-bold font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Material Name</label>
                  <input
                    type="text"
                    name="material"
                    value={editForm.material}
                    onChange={handleEditInput}
                    placeholder="PP RESIN TSOP7"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end pt-3.5 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedPartForEdit(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#037233] hover:bg-[#025c27] text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-950/15 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Save Revision
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}



      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/50 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#E76114]" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
              Database Manager
            </h2>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 uppercase font-semibold">
          Maintain injection molding parts parameters, machine routings, and customer order mapping codes.
        </p>
      </div>

      {/* Tab bar selection */}
      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-0.5 select-none shrink-0 overflow-x-auto max-w-full w-fit">
        <button 
          onClick={() => setPageTab('parts')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all duration-150 cursor-pointer ${
            pageTab === 'parts' ? 'bg-[#E76114] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-255/40'
          }`}
        >
          Master Parts Database
        </button>
        <button 
          onClick={() => setPageTab('converter')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all duration-150 cursor-pointer ${
            pageTab === 'converter' ? 'bg-[#E76114] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-255/40'
          }`}
        >
          Data Converter
        </button>
        <button 
          onClick={() => setPageTab('leaders')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all duration-150 cursor-pointer ${
            pageTab === 'leaders' ? 'bg-[#E76114] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-255/40'
          }`}
        >
          Leader PIN Registry
        </button>
        <button 
          onClick={() => setPageTab('reports')}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-md transition-all duration-150 cursor-pointer ${
            pageTab === 'reports' ? 'bg-[#E76114] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-255/40'
          }`}
        >
          Lot Sign-off Reports
        </button>
      </div>

      {pageTab === 'parts' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card className="p-5 bg-gradient-to-br from-[#E76114]/5 to-transparent border-[#E76114]/15 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Cpu className="w-14 h-14 text-[#E76114]" />
              </div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total Master Parts</div>
              <div className="text-3xl font-black text-[#E76114] mt-2 tracking-tight">
                {stats.totalParts}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-1">Registered Injection parts</div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-[#037233]/5 to-transparent border-[#037233]/15 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Layers className="w-14 h-14 text-[#037233]" />
              </div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Production Lines Mapped</div>
              <div className="text-3xl font-black text-[#037233] mt-2 tracking-tight">
                {stats.totalLines}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-1">Active production lines mapped</div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/15 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <FileSpreadsheet className="w-14 h-14 text-blue-500" />
              </div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Car Models Mapped</div>
              <div className="text-3xl font-black text-blue-600 mt-2 tracking-tight">
                {stats.totalModels}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-1">Unique car models mapped</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Import / Input Form */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="overflow-hidden border-slate-200 shadow-md">
                {/* Tabs Trigger */}
                <div className="flex bg-slate-50 border-b border-slate-200/60 p-1.5 gap-1">
                  <button
                    onClick={() => setActiveTab('csv')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9.5px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
                      activeTab === 'csv'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    CSV Import
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9.5px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
                      activeTab === 'manual'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Manual Form
                  </button>
                </div>

                <div className="p-6">
                  {/* CSV Upload Area */}
                  {activeTab === 'csv' && (
                    <div className="space-y-5">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">Spreadsheet Headers Alignment</h4>
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                            CSV columns are automatically mapped to your spreadsheet:
                          </p>
                          <div className="bg-slate-200 p-2 rounded text-[8px] font-mono text-slate-700 mt-1 leading-relaxed break-all">
                            AREA, TONNASE, BACKUP_LINE, HOME_LINE, SEBANGO, CUSTOMER, MODEL, PART_NUMBER, PART_NAME, MATERIAL_NAME, WEIGHT_KG, MOLD_NO, CAVITY, CYCLE_TIME_SEC
                          </div>
                        </div>
                      </div>

                      {/* Dropzone */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleCSVUpload}
                        accept=".csv"
                        className="hidden"
                      />
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={triggerFileDialog}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                          isDragOver
                            ? 'border-[#037233] bg-emerald-50/40 shadow-inner'
                            : parsedPreview.length > 0
                            ? 'border-emerald-300 bg-emerald-50/10'
                            : 'border-slate-300 hover:border-[#E76114] hover:bg-slate-50/50'
                        }`}
                      >

                        {isUploading ? (
                          <div className="space-y-3">
                            <RefreshCw className="w-10 h-10 text-slate-400 animate-spin mx-auto" />
                            <p className="text-xs font-bold text-slate-600">Analyzing file content...</p>
                          </div>
                        ) : parsedPreview.length > 0 ? (
                          <div className="space-y-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#037233] flex items-center justify-center mx-auto animate-bounce">
                              <CheckCircle className="w-6 h-6" />
                            </div>
                            <h4 className="text-xs font-extrabold text-slate-800">CSV Loaded Successfully</h4>
                            <p className="text-[10px] text-slate-500 uppercase font-semibold">
                              {parsedCount} unique parts mapped
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="w-12 h-12 rounded-full bg-[#E76114]/10 text-[#E76114] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                              <Upload className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">Drag & drop your CSV file here</p>
                              <p className="text-[10px] text-slate-400 mt-1">or click to browse local files</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {csvError && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-800 text-[11px] font-medium flex items-center gap-2.5">
                          <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                          <span>{csvError}</span>
                        </div>
                      )}

                      {/* CSV Parsed Preview List */}
                      {parsedPreview.length > 0 && (
                        <div className="space-y-4 pt-1 animate-in fade-in duration-300">
                          <div className="flex justify-between items-center">
                            <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Preview (First 5 parts)</h5>
                            <span className="text-[9px] bg-[#E76114]/10 text-[#E76114] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Ready to Commit
                            </span>
                          </div>
                          
                          <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
                            {parsedPreview.slice(0, 5).map((part, index) => (
                              <div key={index} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center text-[10px]">
                                <div className="flex flex-col gap-0.5 text-left">
                                  <span className="font-extrabold text-slate-800">{part.partNumber}</span>
                                  <span className="text-slate-500 font-medium max-w-[200px] truncate">{part.partName}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-extrabold text-[#037233] bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                    {part.homeLine || 'UNASSIGNED'}
                                  </span>
                                  <div className="text-slate-400 text-[8px] mt-0.5 font-bold uppercase tracking-wider font-mono">
                                    Cavity: {part.cavity} | Shikake: {part.shikake || 2}x | Weight: {part.weight}kg
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={handleApplyCSV}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#037233] hover:bg-[#025c27] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-colors shadow-md shadow-emerald-900/10 cursor-pointer"
                          >
                            Commit Imported Parts ({parsedCount})
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual Input Form */}
                  {activeTab === 'manual' && (
                    <form onSubmit={handleAddManualPart} className="space-y-4 text-left">
                      
                      {/* Identity Grid */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center">
                            Part Number <span className="text-rose-500 ml-0.5">*</span>
                          </label>
                          <input
                            type="text"
                            name="partNumber"
                            required
                            value={manualForm.partNumber}
                            onChange={handleManualInput}
                            placeholder="e.g., 52159-BZ290"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Sebango / ID <span className="text-rose-500 ml-0.5">*</span>
                          </label>
                          <input
                            type="text"
                            name="sebango"
                            required
                            value={manualForm.sebango}
                            onChange={handleManualInput}
                            placeholder="e.g., U0-4511"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                          Part Name <span className="text-rose-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          name="partName"
                          required
                          value={manualForm.partName}
                          onChange={handleManualInput}
                          placeholder="e.g., COVER, RR BUMPER"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Model Code <span className="text-rose-500 ml-0.5">*</span>
                          </label>
                          <input
                            type="text"
                            name="model"
                            required
                            value={manualForm.model}
                            onChange={handleManualInput}
                            placeholder="e.g., D40D"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Customer <span className="text-rose-500 ml-0.5">*</span>
                          </label>
                          <input
                            type="text"
                            name="customer"
                            required
                            value={manualForm.customer}
                            onChange={handleManualInput}
                            placeholder="e.g., ADM / TMMIN"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white"
                          />
                        </div>
                      </div>

                      {/* Customer Mappings */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Customer Part Number (Cust PNO)
                          </label>
                          <input
                            type="text"
                            name="customerPno"
                            value={manualForm.customerPno}
                            onChange={handleManualInput}
                            placeholder="e.g., 52119-BZ120"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Customer Sebango Code
                          </label>
                          <input
                            type="text"
                            name="customerSebango"
                            value={manualForm.customerSebango}
                            onChange={handleManualInput}
                            placeholder="e.g., ADM-03"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Routing Grid */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Home Line (Mesin)
                          </label>
                          <input
                            type="text"
                            name="homeLine"
                            value={manualForm.homeLine}
                            onChange={handleManualInput}
                            placeholder="e.g., F2 #6"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Backup Line
                          </label>
                          <input
                            type="text"
                            name="backupLine"
                            value={manualForm.backupLine}
                            onChange={handleManualInput}
                            placeholder="e.g., F4 #B3"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Area / Tonnase
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              name="area"
                              value={manualForm.area}
                              onChange={handleManualInput}
                              placeholder="F2"
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white text-center"
                            />
                            <input
                              type="text"
                              name="tonnage"
                              value={manualForm.tonnage}
                              onChange={handleManualInput}
                              placeholder="2500T"
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white text-center font-bold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Material Name
                          </label>
                          <input
                            type="text"
                            name="material"
                            value={manualForm.material}
                            onChange={handleManualInput}
                            placeholder="PP TSOP7 R1G3"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white"
                          />
                        </div>
                      </div>

                      {/* Molding parameters */}
                      <div className="grid grid-cols-3 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Cycle Time Sec
                          </label>
                          <input
                            type="number"
                            name="cycleTime"
                            value={manualForm.cycleTime}
                            onChange={handleManualInput}
                            placeholder="72"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-bold font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Cavity
                          </label>
                          <input
                            type="number"
                            name="cavity"
                            value={manualForm.cavity}
                            onChange={handleManualInput}
                            placeholder="1"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Shikake (Runs/Day)
                          </label>
                          <input
                            type="number"
                            name="shikake"
                            value={manualForm.shikake}
                            onChange={handleManualInput}
                            placeholder="2"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Mold No
                          </label>
                          <input
                            type="text"
                            name="mold"
                            value={manualForm.mold}
                            onChange={handleManualInput}
                            placeholder="e.g., MOLD-GT01"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Weight KG
                          </label>
                          <input
                            type="text"
                            name="weight"
                            value={manualForm.weight}
                            onChange={handleManualInput}
                            placeholder="1.25"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                            Qty per Kanban
                          </label>
                          <input
                            type="number"
                            name="spec"
                            value={manualForm.spec}
                            onChange={handleManualInput}
                            placeholder="24"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-bold font-mono"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#E76114] hover:bg-[#c95411] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-colors shadow-md shadow-orange-950/10 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Register Master Part
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column: Database Explorer / List */}
            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-md">
                {/* Header + Search */}
                <div className="p-6 border-b border-slate-100 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 font-bold">Master Parts Explorer</h4>
                    <div className="flex items-center gap-2">
                      {showConfirmClear ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                          <span className="text-[10px] text-rose-600 font-bold">Erase entire database?</span>
                          <button
                            type="button"
                            onClick={() => {
                              clearParts();
                              setShowConfirmClear(false);
                              triggerNotification('Master parts database completely cleared.', 'success');
                            }}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] uppercase tracking-wider rounded transition-colors cursor-pointer"
                          >
                            Yes, Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowConfirmClear(false)}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[9px] uppercase tracking-wider rounded transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {parts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowConfirmClear(true)}
                              className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-extrabold text-rose-600 hover:text-white hover:bg-rose-50 hover:border-rose-300 border border-slate-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              Clear Database
                            </button>
                          )}
                          <div className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 font-mono">
                            Total Items: {filteredParts.length}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Filters grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {/* Search Bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search Part, Name, Model..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] focus:bg-white transition-all text-slate-800 font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Line Filter */}
                    <div className="relative">
                      <select
                        value={lineFilter}
                        onChange={(e) => {
                          setLineFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] focus:bg-white transition-all text-slate-700 font-semibold cursor-pointer appearance-none animate-none"
                      >
                        <option value="ALL">All Machine Lines</option>
                        {uniqueLines.map(line => (
                          <option key={line} value={line}>{line || 'UNASSIGNED (Blank)'}</option>
                        ))}
                      </select>
                      <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Model Filter */}
                    <div className="relative">
                      <select
                        value={modelFilter}
                        onChange={(e) => {
                          setModelFilter(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] focus:bg-white transition-all text-slate-700 font-semibold cursor-pointer appearance-none animate-none"
                      >
                        <option value="ALL">All Vehicle Models</option>
                        {uniqueModels.map(model => (
                          <option key={model} value={model}>{model || 'BLANK'}</option>
                        ))}
                      </select>
                      <Settings className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto min-h-[445px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <RefreshCw className="w-8 h-8 text-[#E76114] animate-spin" />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Updating database state...</p>
                    </div>
                  ) : paginatedParts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <Database className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-700">No Master Parts Found</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[280px] leading-relaxed">
                        We couldn't find any parts matching your filters. Try clearing your search keyword or selecting a different machine routing.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-100 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                          <th className="py-3.5 px-5">Part Number / Name</th>
                          <th className="py-3.5 px-4 text-center">Model / Cust</th>
                          <th className="py-3.5 px-4 text-center">Cust PNO / Sebango</th>
                          <th className="py-3.5 px-4 text-center">mesin routing</th>
                          <th className="py-3.5 px-4 text-center">Mold / Cav</th>
                          <th className="py-3.5 px-4 text-center">C/T (sec)</th>
                          <th className="py-3.5 px-4 text-center">Weight</th>
                          <th className="py-3.5 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paginatedParts.map((part) => (
                          <tr key={part.partNumber} className="hover:bg-slate-50/50 group transition-colors">
                            <td className="py-3 px-5 text-left">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-extrabold text-slate-800 font-mono tracking-tight">{part.partNumber}</span>
                                <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[170px]" title={part.partName}>
                                  {part.partName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col gap-0.5 items-center">
                                <span className="font-extrabold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[9px]">
                                  {part.model || 'N/A'}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{part.customer}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col gap-0.5 items-center">
                                {part.customerPno ? (
                                  <span className="font-extrabold text-slate-700 font-mono tracking-tight text-[10px]">
                                    {part.customerPno}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-300 italic font-semibold">No PNO</span>
                                )}
                                {part.customerSebango && (
                                  <span className="text-[8px] font-bold text-[#E76114] bg-orange-50 border border-orange-100 px-1 rounded font-mono tracking-tight">
                                    {part.customerSebango}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {part.homeLine ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[10px] font-black text-[#037233] bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 rounded">
                                    {part.homeLine}
                                  </span>
                                  {part.backupLine && part.backupLine !== part.homeLine && (
                                    <span className="text-[8px] font-bold text-slate-400 italic">
                                      Backup: {part.backupLine}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[9px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col gap-0.5 items-center">
                                <span className="font-bold text-slate-700 text-[10px] font-mono">{part.mold || 'N/A'}</span>
                                <span className="text-[8px] font-bold text-slate-400">CAV: {part.cavity || 1} | SHK: {part.shikake || 2}x</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-extrabold text-slate-700 font-mono">
                              {part.cycleTime}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-500 text-[10px] font-mono">
                              {part.weight ? `${part.weight} kg` : '--'}
                            </td>
                            <td className="py-3 px-5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setLabelPreviewPart(part)}
                                  className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                                  title="Preview Label"
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditModal(part)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                                  title="Revise / Edit Part"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(part.partNumber)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                                  title="Delete part routing"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination footer */}
                {filteredParts.length > itemsPerPage && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider font-mono">
                      Page {currentPage} of {totalPages}
                    </span>

                    <div className="flex gap-1.5">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      {pageTab === 'converter' && (
        <>
          {/* Data Converter Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card className="p-5 bg-gradient-to-br from-[#E76114]/5 to-transparent border-[#E76114]/15 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <RefreshCw className="w-14 h-14 text-[#E76114]" />
              </div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total Rules</div>
              <div className="text-3xl font-black text-[#E76114] mt-2 tracking-tight">
                {convStats.total}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-1">Active order mapping filters</div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-emerald-600/5 to-transparent border-emerald-600/15 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle className="w-14 h-14 text-emerald-600" />
              </div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Big Parts Rules (8h)</div>
              <div className="text-3xl font-black text-emerald-600 mt-2 tracking-tight">
                {convStats.big}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-1">Lead time subtraction enabled</div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-indigo-500/5 to-transparent border-indigo-500/15 relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute right-3 top-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Settings className="w-14 h-14 text-indigo-500" />
              </div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Small Parts Rules (12h)</div>
              <div className="text-3xl font-black text-indigo-600 mt-2 tracking-tight">
                {convStats.small}
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-1">Lead time subtraction enabled</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
            {/* Left Column: Import / Input Form for Mappings */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="overflow-hidden border-slate-200 shadow-md">
                {/* Tabs Trigger */}
                <div className="flex bg-slate-50 border-b border-slate-200/60 p-1.5 gap-1">
                  <button
                    onClick={() => setConvActiveTab('csv')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9.5px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
                      convActiveTab === 'csv'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    CSV Import
                  </button>
                  <button
                    onClick={() => setConvActiveTab('manual')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9.5px] font-extrabold uppercase tracking-wider transition-all duration-200 ${
                      convActiveTab === 'manual'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Manual Form
                  </button>
                </div>

                <div className="p-6">
                  {/* CSV Upload Area for Mappings */}
                  {convActiveTab === 'csv' && (
                    <div className="space-y-5">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">Spreadsheet Headers Alignment</h4>
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed text-left">
                            CSV columns are automatically mapped to conversion rules. Make sure headers are exact:
                          </p>
                          <div className="bg-slate-200 p-2 rounded text-[8px] font-mono text-slate-700 mt-1 leading-relaxed break-all text-left">
                            Customer Part Number, Customer Sebango Code, Production Sebango (Master Part), Part Category
                          </div>
                        </div>
                      </div>

                      {/* Import Method Toggle Pills */}
                      <div className="flex border-b border-slate-200/60 p-1 bg-slate-100 rounded-lg gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConvImportMethod('file');
                            setConvParsedPreview([]);
                            setConvParsedCount(0);
                            setConvCsvError(null);
                          }}
                          className={`flex-1 py-1.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            convImportMethod === 'file'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40'
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
                          className={`flex-1 py-1.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            convImportMethod === 'paste'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40'
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
                            onClick={triggerConvFileDialog}
                            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                              convIsDragOver
                                ? 'border-[#E76114] bg-orange-50/40 shadow-inner'
                                : convParsedPreview.length > 0
                                ? 'border-emerald-300 bg-emerald-50/10'
                                : 'border-slate-300 hover:border-[#E76114] hover:bg-slate-50/50'
                            }`}
                          >

                          {convIsUploading ? (
                            <div className="space-y-3">
                              <RefreshCw className="w-10 h-10 text-slate-400 animate-spin mx-auto" />
                              <p className="text-xs font-bold text-slate-600">Analyzing file content...</p>
                            </div>
                          ) : convParsedPreview.length > 0 ? (
                            <div className="space-y-3">
                              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                                <CheckCircle className="w-6 h-6" />
                              </div>
                              <h4 className="text-xs font-extrabold text-slate-800">CSV Loaded Successfully</h4>
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">
                                {convParsedCount} mapping rules parsed
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="w-12 h-12 rounded-full bg-[#E76114]/10 text-[#E76114] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                                <Upload className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700">Drag & drop your CSV file here</p>
                                <p className="text-[10px] text-slate-400 mt-1">or click to browse local files</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                        /* Paste Spreadsheet Clipboard */
                        <div className="space-y-3 text-left animate-in fade-in duration-200">
                          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Copy-Paste Spreadsheet Cells
                          </label>
                          <textarea
                            value={convPasteText}
                            onChange={(e) => setConvPasteText(e.target.value)}
                            rows={5}
                            placeholder="Customer Part Number	Customer Sebango Code	Production Sebango (Master Part)	Part Category&#10;67613/4-BZ050/80	ADM-01	U0-5600-BLCK	big&#10;62631/2-BZ030	ADM-02	U0-5604-BLCK	big"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#E76114] transition-all bg-white font-mono leading-relaxed"
                          />
                          <button
                            type="button"
                            onClick={handleConvPasteSubmit}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                          >
                            Parse & Preview
                          </button>
                        </div>
                      )}

                      {convCsvError && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-800 text-[11px] font-medium flex items-center gap-2.5">
                          <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                          <span className="text-left">{convCsvError}</span>
                        </div>
                      )}

                      {/* CSV Parsed Preview List */}
                      {convParsedPreview.length > 0 && (
                        <div className="space-y-4 pt-1 animate-in fade-in duration-300">
                          <div className="flex justify-between items-center">
                            <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Preview (First 5 rules)</h5>
                            <span className="text-[9px] bg-[#E76114]/10 text-[#E76114] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Ready to Commit
                            </span>
                          </div>
                          
                          <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
                            {convParsedPreview.slice(0, 5).map((rule, index) => (
                              <div key={index} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center text-[10px]">
                                <div className="flex flex-col gap-0.5 text-left">
                                  <span className="font-extrabold text-slate-800 font-mono">{rule.custPartNumber}</span>
                                  <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider font-mono">
                                    CUST ID: {rule.custSebango || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-right">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="font-extrabold text-[#037233] bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded text-[9px] font-mono">
                                      {rule.prodSebango}
                                    </span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                      Category: {rule.partCategory}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={handleApplyConvCSV}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#E76114] hover:bg-[#c95411] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-colors shadow-md shadow-orange-950/10 cursor-pointer"
                          >
                            Commit Mapped Rules ({convParsedCount})
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual Input Form for Mappings */}
                  {convActiveTab === 'manual' && (
                    <form onSubmit={handleAddConversion} className="space-y-4 text-left">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center">
                          Customer Part Number <span className="text-rose-500 ml-0.5">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={convCustPart}
                          onChange={(e) => setConvCustPart(e.target.value)}
                          placeholder="e.g., 52119-BZ120"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 font-bold">
                          Customer Sebango Code
                        </label>
                        <input
                          type="text"
                          value={convCustSebango}
                          onChange={(e) => setConvCustSebango(e.target.value)}
                          placeholder="e.g., ADM-03"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center">
                          Production Sebango (Master Part) <span className="text-rose-500 ml-0.5">*</span>
                        </label>
                        <select
                          required
                          value={convProdSebango}
                          onChange={(e) => setConvProdSebango(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="">Select Production Sebango</option>
                          {parts.map((p) => (
                            <option key={p.partNumber} value={p.sebango || p.partNumber}>
                              {p.sebango} ({p.partNumber} - {p.partName})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 block font-bold">
                          Part Category / Lead Time Constraint
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setConvPartCategory('big')}
                            className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              convPartCategory === 'big'
                                ? 'bg-[#E76114]/10 border-[#E76114]/30 text-[#E76114]'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            Big Part (8h)
                          </button>
                          <button
                            type="button"
                            onClick={() => setConvPartCategory('small')}
                            className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              convPartCategory === 'small'
                                ? 'bg-[#E76114]/10 border-[#E76114]/30 text-[#E76114]'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            Small Part (12h)
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#E76114] hover:bg-[#c95411] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-colors shadow-md shadow-orange-950/10 cursor-pointer animate-none"
                      >
                        <Plus className="w-4 h-4" />
                        Register Mapped Rule
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column: Conversion Rules Explorer */}
            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-md">
                {/* Explorer Header */}
                <div className="p-6 border-b border-slate-100 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 font-bold">Data Conversion Mappings</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Rules that translate delivery order part numbers to Sugity's internal Sebango molding IDs.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                        Mapped: {filteredConversions.length}
                      </div>
                      {conversions.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm("Are you sure you want to delete all conversion mapping rules? This cannot be undone.")) {
                              await clearConversions();
                              triggerNotification("Successfully cleared all conversion mapping rules!", "success");
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-extrabold uppercase rounded-lg transition-colors cursor-pointer"
                          title="Delete all mapping rules"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear Rules
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      value={convSearch}
                      onChange={(e) => {
                        setConvSearch(e.target.value);
                        setConvPage(1);
                      }}
                      placeholder="Search Customer Part, Sebango Mappings..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] focus:bg-white transition-all text-slate-800 font-medium"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Mapping Grid / Table Area */}
                <div className="overflow-x-auto min-h-[400px]">
                  {paginatedConversions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 animate-pulse">
                        <RefreshCw className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-700">No Conversion Rules Found</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[280px] leading-relaxed">
                        There are no rules matching your filter. Register a new one on the left to activate order-to-production translating.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-100 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider font-bold">
                          <th className="py-3.5 px-5">Customer Code</th>
                          <th className="py-3.5 px-4 text-center">Translation Flow</th>
                          <th className="py-3.5 px-4">Internal Sebango</th>
                          <th className="py-3.5 px-4 text-center">Lead Time Type</th>
                          <th className="py-3.5 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paginatedConversions.map((conv) => {
                          // Find part details for preview
                          const matchedPart = parts.find(
                            (p) => 
                              p.sebango.trim().toUpperCase() === conv.prodSebango.trim().toUpperCase() ||
                              p.partNumber.trim().toUpperCase() === conv.prodSebango.trim().toUpperCase()
                          );
                          
                          return (
                            <tr key={conv.id} className="hover:bg-slate-50/50 group transition-colors">
                              <td className="py-3.5 px-5 text-left">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-extrabold text-slate-800 font-mono tracking-tight">{conv.custPartNumber}</span>
                                  <span className="text-[10px] text-slate-500 font-bold font-mono">
                                    CUST ID: {conv.custSebango || 'N/A'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#E76114]/10 text-[#E76114] border border-[#E76114]/15">
                                  <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-left">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-extrabold text-slate-800 font-mono tracking-tight text-[#037233] bg-emerald-50 px-1.5 py-0.5 border border-emerald-100/50 rounded w-fit">
                                    {conv.prodSebango}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[180px]" title={matchedPart?.partName}>
                                    {matchedPart ? matchedPart.partName : 'Loading part metadata...'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {conv.partCategory === 'big' ? (
                                  <span className="text-[9px] font-black text-[#E76114] bg-orange-50 border border-orange-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Big Part (8h)
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Small Part (12h)
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditConvModal(conv)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                                    title="Edit Translation Rule"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteConversion(conv.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                                    title="Delete Mapping Rule"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination footer */}
                {filteredConversions.length > convItemsPerPage && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider font-mono">
                      Page {convPage} of {totalConvPages}
                    </span>

                    <div className="flex gap-1.5">
                      <button
                        disabled={convPage === 1}
                        onClick={() => setConvPage((prev) => Math.max(prev - 1, 1))}
                        className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={convPage === totalConvPages}
                        onClick={() => setConvPage((prev) => Math.min(prev + 1, totalConvPages))}
                        className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      {/* EDIT CONVERSION MODAL */}
      {selectedConversionForEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <Card className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-[#E76114] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-4.5 h-4.5" />
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Edit Conversion Rule</h3>
                  <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider mt-0.5 font-mono">
                    {selectedConversionForEdit.custPartNumber}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedConversionForEdit(null)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer animate-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConvRevision} className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Customer Part Number *</label>
                  <input
                    type="text"
                    name="custPartNumber"
                    required
                    value={editConvForm.custPartNumber}
                    onChange={handleEditConvInput}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 font-bold">Customer Sebango Code</label>
                  <input
                    type="text"
                    name="custSebango"
                    value={editConvForm.custSebango}
                    onChange={handleEditConvInput}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-[#037233] flex items-center gap-1 font-bold">
                    Production Sebango (Master Part) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="prodSebango"
                    required
                    value={editConvForm.prodSebango}
                    onChange={handleEditConvInput}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#E76114] transition-colors bg-white font-mono font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="">Select Production Sebango</option>
                    {parts.map(p => (
                      <option key={p.partNumber} value={p.sebango || p.partNumber}>
                        {p.sebango} ({p.partNumber} - {p.partName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 block font-bold">
                    Part Category / Lead Time Constraint
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditConvForm(prev => ({ ...prev, partCategory: 'big' }))}
                      className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        editConvForm.partCategory === 'big'
                          ? 'bg-[#E76114]/10 border-[#E76114]/30 text-[#E76114]'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Big Part (8h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditConvForm(prev => ({ ...prev, partCategory: 'small' }))}
                      className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        editConvForm.partCategory === 'small'
                          ? 'bg-[#E76114]/10 border-[#E76114]/30 text-[#E76114]'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Small Part (12h)
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedConversionForEdit(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#E76114] hover:bg-[#c95411] text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-orange-950/15 cursor-pointer animate-none"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Save Revision
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {pageTab === 'leaders' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200 text-left">
          {/* Status Alert */}
          <div className={`p-4 border rounded-xl flex items-start gap-3 ${
            isLeaderDbConnected 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400'
          }`}>
            <span className="text-lg">{isLeaderDbConnected ? '🟢' : '💡'}</span>
            <div className="text-xs">
              <span className="font-extrabold uppercase tracking-wide block mb-1">
                {isLeaderDbConnected ? 'Database Connected' : 'Running in Local Mode'}
              </span>
              {isLeaderDbConnected
                ? 'The Leader Registry is synchronized via the app server. PINs are stored hashed + encrypted and are only revealed here for planners.'
                : 'The leader service is unreachable. Verify the app server is running, Supabase credentials are set in .env, and the SQL migration below has been executed.'
              }
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* List panel */}
            <div className="md:col-span-2">
              <Card className="flex flex-col p-0 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Registered Leaders</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                    {leaders.length} Active
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider bg-slate-50/50">
                        <th className="px-4 py-3">Leader Name</th>
                        <th className="px-4 py-3">Initials</th>
                        <th className="px-4 py-3 font-mono">PIN Code</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaders.map(l => (
                        <tr key={l.id || l.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-800">{l.name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 font-black rounded uppercase text-[9px]">
                              {getInitials(l.name)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-600">
                            {(l.id && leaderPins[l.id]) || '••••'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (!l.id) return;
                                if (confirm(`Are you sure you want to delete leader ${l.name}?`)) {
                                  try {
                                    await deleteLeader(l.id);
                                    triggerNotification(`Leader ${l.name} deleted successfully.`, 'success');
                                  } catch (err: any) {
                                    triggerNotification(err.message || 'Failed to delete leader.', 'error');
                                  }
                                }
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Leader"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {leaders.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium italic">
                            No registered leaders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Add panel */}
            <div className="space-y-6">
              <Card className="p-5">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                  Register New Leader
                </h3>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!leaderName.trim()) return;
                    if (leaderPin.trim().length !== 4) {
                      triggerNotification('PIN must be exactly 4 characters.', 'error');
                      return;
                    }
                    try {
                      // Duplicate PIN check happens server-side against hashed PINs
                      await addLeader(leaderName.trim(), leaderPin.trim());
                      triggerNotification(`Leader ${leaderName} added successfully.`, 'success');
                      setLeaderName('');
                      setLeaderPin('');
                    } catch (err: any) {
                      triggerNotification(err.message || 'Failed to register leader.', 'error');
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ahmad Pratama"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">4-Digit PIN Code</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="e.g. 8855"
                      value={leaderPin}
                      onChange={(e) => setLeaderPin(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 transition-colors bg-white font-mono font-bold"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#E76114] hover:bg-[#c95411] text-white font-extrabold text-[10px] uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-orange-950/10 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Register Leader
                  </button>
                </form>
              </Card>

              {/* SQL Script block */}
              {!isLeaderDbConnected && (
                <Card className="p-4 bg-slate-900 border border-white/5 text-white/90">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-[#E76114] mb-2">Supabase SQL Schema</h4>
                  <p className="text-[9px] text-slate-400 mb-3 leading-relaxed">Execute this query in your Supabase SQL Editor to enable cross-terminal sync:</p>
                  <div className="relative">
                    <pre className="text-[9px] font-mono bg-slate-950 p-2.5 rounded border border-white/10 overflow-x-auto text-slate-300 max-h-[140px] select-all cursor-pointer">
{`CREATE TABLE IF NOT EXISTS public.leaders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  pin text,
  pin_hash text,
  pin_encrypted text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Lock the table away from browser (anon) clients.
-- The app server accesses it with SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.leaders;
DROP POLICY IF EXISTS "Allow public write" ON public.leaders;

-- See migration_leader_pins.sql in the project root for the
-- full migration from an existing plaintext pin column.`}
                    </pre>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {pageTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">Lot Closure & Jiritsuka Quality Reports</h3>
              <p className="text-[10px] text-slate-400 mt-1">Audit log of leader approvals, production output pieces, and quality scrap rate percentages.</p>
            </div>
            
            <button
              onClick={() => handleExportCSV(filteredReports)}
              disabled={filteredReports.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/10 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export to CSV
            </button>
          </div>

          {/* Filter Bar */}
          <Card className="p-4 border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end text-xs">
            <div className="flex-1 space-y-1">
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Search Part / Leader</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Part Number, Name, or Leader..."
                  value={repSearch}
                  onChange={(e) => { setRepSearch(e.target.value); setRepPage(1); }}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="w-full md:w-36 space-y-1">
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Factory</label>
              <select
                value={repFactory}
                onChange={(e) => { setRepFactory(e.target.value); setRepPage(1); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 transition-colors bg-white font-bold"
              >
                <option value="All">All Factories</option>
                <option value="FACT 2">FACT 2</option>
                <option value="FACT 3">FACT 3</option>
                <option value="FACT 4">FACT 4</option>
                <option value="SC2 Resin">SC2 Resin</option>
              </select>
            </div>

            <div className="w-full md:w-28 space-y-1">
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Shift</label>
              <select
                value={repShift}
                onChange={(e) => { setRepShift(e.target.value); setRepPage(1); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 transition-colors bg-white font-bold"
              >
                <option value="All">All Shifts</option>
                <option value="DAY">Day Shift</option>
                <option value="NIGHT">Night Shift</option>
              </select>
            </div>

            <div className="w-full md:w-36 space-y-1">
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Start Date</label>
              <input
                type="date"
                value={repStartDate}
                onChange={(e) => { setRepStartDate(e.target.value); setRepPage(1); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="w-full md:w-36 space-y-1">
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">End Date</label>
              <input
                type="date"
                value={repEndDate}
                onChange={(e) => { setRepEndDate(e.target.value); setRepPage(1); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-orange-500 transition-colors"
              />
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden border-slate-200 shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="p-4">Date</th>
                    <th className="p-4">Shift</th>
                    <th className="p-4">Factory / Machine</th>
                    <th className="p-4">Part Details</th>
                    <th className="p-4 text-right">Target</th>
                    <th className="p-4 text-right">OK Qty</th>
                    <th className="p-4 text-right">NG Qty</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-right">Scrap Rate</th>
                    <th className="p-4">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {paginatedReports.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 font-extrabold uppercase tracking-wider">
                        No Lot Closures Match Filters
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono text-slate-600">{row.date}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider ${
                            row.shift === 'DAY' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {row.shift}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-extrabold text-slate-800">{row.factory}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Machine: {row.machineId}</div>
                        </td>
                        <td className="p-4 max-w-[200px]">
                          <div className="font-mono text-slate-800 truncate">{row.partNumber}</div>
                          <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{row.partName}</div>
                        </td>
                        <td className="p-4 text-right font-mono">{row.targetQty}</td>
                        <td className="p-4 text-right text-emerald-600 font-mono">{row.okQty}</td>
                        <td className="p-4 text-right text-rose-600 font-mono">{row.ngQty}</td>
                        <td className="p-4 text-right font-mono">{row.totalQty}</td>
                        <td className="p-4 text-right font-mono">
                          <span className={`px-1.5 py-0.5 rounded ${
                            row.scrapRate > 5 
                              ? 'bg-rose-50 text-rose-700 font-black' 
                              : row.scrapRate > 0 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'text-slate-500'
                          }`}>
                            {row.scrapRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-extrabold text-slate-800">{row.approvedBy}</div>
                          {row.initials && <div className="text-[10px] text-slate-400 font-mono mt-0.5">({row.initials})</div>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalRepPages > 1 && (
              <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between text-xs select-none">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                  Page {repPage} of {totalRepPages} ({filteredReports.length} rows)
                </span>
                
                <div className="flex gap-2">
                  <button
                    disabled={repPage === 1}
                    onClick={() => setRepPage(prev => prev - 1)}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={repPage === totalRepPages}
                    onClick={() => setRepPage(prev => prev + 1)}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Label Preview Modal */}
      {labelPreviewPart && (
        <LabelPreviewModal
          part={labelPreviewPart}
          onClose={() => setLabelPreviewPart(null)}
        />
      )}
    </div>
  );
}
