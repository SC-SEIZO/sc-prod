import React from 'react';
import { Card } from '../components/ui/card';
import { AlertCircle, Upload } from 'lucide-react';

const materialCategories = [
  { id: 'resin', name: 'Resin Material', stock: '2,450 kg', status: 'Healthy', color: 'text-blue-600', valClass: 'text-slate-800' },
  { id: 'paint', name: 'Painting Material', stock: '850 L', status: 'Warning', color: 'text-amber-600', valClass: 'text-slate-800' },
  { id: 'import', name: 'Import Part', stock: '2.4 Days', status: 'Critical', color: 'text-red-600', valClass: 'text-red-600' },
  { id: 'outhouse', name: 'Outhouse Part', stock: '12 Days', status: 'Healthy', color: 'text-emerald-600', valClass: 'text-slate-800' },
];

export function MaterialsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Material Logistics</h2>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-1">Manage ordering for Resin, Paint, Import and Outhouse</p>
        </div>
        
        <button className="bg-slate-800 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded hover:bg-slate-700 transition-colors flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          Upload Part List
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {materialCategories.map((cat) => (
          <Card key={cat.id} className="p-4 bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
              {cat.name}
              {cat.status === 'Critical' && <span className="text-red-500">CRITICAL</span>}
            </div>
            <div className={`text-2xl font-black ${cat.valClass}`}>{cat.stock}</div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3">
              <div className={`h-1.5 rounded-full ${cat.status === 'Critical' ? 'bg-red-500 w-[15%]' : cat.status === 'Warning' ? 'bg-amber-500 w-[45%]' : 'bg-emerald-500 w-[85%]'}`}></div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col overflow-hidden p-0 border border-slate-200 shadow-sm bg-white">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
           <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
             <AlertCircle className="w-4 h-4 text-amber-500" />
             Pending Purchase Orders
           </h2>
           <button className="text-[10px] text-blue-600 font-bold uppercase tracking-wider hover:text-blue-800">Generate All POs</button>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Part Number / Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Shortage</th>
                <th className="p-4">Required Date</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {(() => {
                // Use dynamic dates relative to today so they're always in the future (not stale)
                const d = (daysFromNow: number) => {
                  const dt = new Date();
                  dt.setDate(dt.getDate() + daysFromNow);
                  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                };
                return [
                  { name: 'IM-BRACKET-X2', cat: 'Import Part', shortage: '4,500 pcs', date: d(2), c: 'text-red-600' },
                  { name: 'PAINT-RED-BASE', cat: 'Painting Material', shortage: '120 L', date: d(3), c: 'text-amber-600' },
                  { name: 'PAINT-CLEAR-01', cat: 'Painting Material', shortage: '50 L', date: d(5), c: 'text-slate-900' },
                  { name: 'OUT-SENSOR-Y', cat: 'Outhouse Part', shortage: '800 pcs', date: d(7), c: 'text-slate-900' },
                ];
              })().map((item, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-bold text-slate-900">{item.name}</td>
                  <td className="p-4 font-medium text-slate-600">{item.cat}</td>
                  <td className={`p-4 font-mono font-bold ${item.c}`}>{item.shortage}</td>
                  <td className="p-4 text-slate-600 font-medium">{item.date}</td>
                  <td className="p-4 text-right">
                    <button className="px-3 py-1 bg-slate-800 text-white text-[9px] font-bold uppercase tracking-wider rounded hover:bg-slate-700 transition">
                      Create PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
