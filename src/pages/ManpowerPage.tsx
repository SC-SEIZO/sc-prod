import React from 'react';
import { Card } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const manHourData = [
  { name: 'Line A', required: 450, available: 420 },
  { name: 'Line B', required: 320, available: 320 },
  { name: 'Line C', required: 280, available: 290 },
  { name: 'Inspect', required: 150, available: 145 },
];

export function ManpowerPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Manpower Allocation</h2>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-1">Calculate and monitor man-hours</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="col-span-1 sm:col-span-2 p-4 bg-slate-50 grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
               <div className="text-2xl font-black text-slate-800">142</div>
               <div className="text-[9px] text-slate-400 uppercase font-bold mt-1">Assigned</div>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
               <div className="text-2xl font-black text-slate-800">08</div>
               <div className="text-[9px] text-slate-400 uppercase font-bold mt-1">Absence</div>
            </div>
         </Card>
         
         <Card className="p-4 bg-slate-50 flex flex-col justify-center">
            <div className="text-2xl font-black text-slate-800">12.5k</div>
            <div className="text-[9px] text-slate-400 uppercase font-bold mt-1">MH Needed</div>
         </Card>

         <Card className="p-4 bg-slate-50 flex flex-col justify-center">
            <div className="text-2xl font-black text-slate-800">13.2k</div>
            <div className="text-[9px] text-slate-400 uppercase font-bold mt-1">MH Available</div>
         </Card>
      </div>

      <Card className="flex flex-col h-[400px] p-0">
         <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Man-Hour Breakdown by Line</h3>
            <button className="text-[10px] text-blue-600 font-bold uppercase tracking-wider hover:text-blue-800 flex items-center gap-1">
              Apply OT Request
            </button>
         </div>
         <div className="flex-1 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={manHourData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <RechartsTooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '11px', fontWeight: 'bold'}} />
                <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                <Bar dataKey="required" name="Required Hours" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="available" name="Available Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
         </div>
      </Card>
    </div>
  );
}
