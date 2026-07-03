import React from 'react';
import { Card } from '../components/ui/card';
import { ArrowRight } from 'lucide-react';

export function DeliveryPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Delivery Ritase</h2>
          <p className="text-[11px] text-slate-500 uppercase font-semibold mt-1">Calculate and schedule trips based on output</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-blue-600 rounded-xl shadow-sm p-5 text-white col-span-1 sm:col-span-2 flex flex-col justify-between">
            <div className="text-[11px] font-bold opacity-80 uppercase mb-3">Ritase Forecast Today</div>
            <div className="flex items-baseline space-x-2">
               <span className="text-4xl font-black italic">65</span>
               <span className="text-xs font-bold opacity-80 uppercase">Trips Required</span>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-500 flex justify-between items-center text-[10px] font-bold">
               <span className="opacity-80">Regular Delivery Schedule</span>
            </div>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col justify-center gap-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase">Completed</div>
            <div className="text-3xl font-black text-slate-800">42</div>
         </div>
         <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col justify-center gap-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase">In Transit</div>
            <div className="text-3xl font-black text-emerald-600">08</div>
         </div>
      </div>

      <Card className="flex flex-col overflow-hidden p-0">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
           <h3 className="font-bold text-slate-800 text-sm">Scheduled Deliveries</h3>
           <button className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hover:text-slate-800 px-3 py-1 border border-slate-200 rounded">
             Today
           </button>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Trip ID</th>
                <th className="p-4">Destination</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4 text-center">Load Capacity</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {[
                { id: 'TRP-001', dest: 'Customer A Plant', vehicle: 'Truck Hino #12', load: '95%', status: 'In Transit', c: 'bg-blue-100 text-blue-700' },
                { id: 'TRP-002', dest: 'Customer B WH', vehicle: 'Truck Isuzu #08', load: '100%', status: 'Loading', c: 'bg-amber-100 text-amber-700' },
                { id: 'TRP-003', dest: 'Customer A Plant', vehicle: 'Box Truck #03', load: '80%', status: 'Scheduled', c: 'bg-slate-100 text-slate-700' },
                { id: 'TRP-004', dest: 'Warehouse East', vehicle: 'Truck Hino #15', load: '90%', status: 'Scheduled', c: 'bg-slate-100 text-slate-700' },
              ].map((item, i) => (
                <tr key={i} className="hover:bg-slate-50 cursor-pointer">
                  <td className="p-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                    {item.status === 'In Transit' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                    {item.id}
                  </td>
                  <td className="p-4 font-medium text-slate-700">{item.dest}</td>
                  <td className="p-4 text-slate-600">{item.vehicle}</td>
                  <td className="p-4 text-center">
                     <span className="font-mono text-slate-700 font-bold">{item.load}</span>
                  </td>
                  <td className="p-4">
                     <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${item.c}`}>
                       {item.status}
                     </span>
                  </td>
                  <td className="p-4 text-right">
                    <button className="text-slate-400 hover:text-slate-600 transition-colors">
                      <ArrowRight className="w-4 h-4" />
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
