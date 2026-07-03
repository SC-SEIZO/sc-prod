import React, { useContext, useState, useMemo } from 'react';
import { Card } from '../components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { CheckCircle2 } from 'lucide-react';
import { ProductionContext, ALL_ACTIVE_MACHINES, getHeijunkaJobsForMachine, getTodayDateString } from '../context/ProductionContext';
import { useParts } from '../context/PartsContext';

const achievementData = [
  { name: 'Injection 1', target: 200, actual: 180, oee: 85 },
  { name: 'Injection 2', target: 150, actual: 160, oee: 92 },
  { name: 'Injection 3', target: 120, actual: 110, oee: 88 },
  { name: 'Injection 4', target: 300, actual: 250, oee: 80 },
  { name: 'Assy Line 1', target: 500, actual: 490, oee: 96 },
];

const materialData = [
  { name: 'Resin', stock: 85, required: 100 },
  { name: 'Painting', stock: 92, required: 80 },
  { name: 'Import Part', stock: 45, required: 50 },
  { name: 'Outhouse', stock: 110, required: 90 },
];

const manpowerData = [
  { name: 'Shift 1', present: 145, absent: 5 },
  { name: 'Shift 2', present: 140, absent: 10 },
  { name: 'Shift 3', present: 148, absent: 2 },
];

export function DashboardPage() {
  const prodContext = useContext(ProductionContext);
  const { machineJobs, machineAvgJobs, dayOTs, nightOTs } = prodContext ?? {
    machineJobs: {}, machineAvgJobs: {}, dayOTs: {}, nightOTs: {}
  };
  const { parts } = useParts();
  const todayStr = getTodayDateString();

  const [activeFactory, setActiveFactory] = useState<string>('F2');

  // Calculate live machine load values
  const machineLoads = useMemo(() => {
    return ALL_ACTIVE_MACHINES.map(machineId => {
      const compositeKey = `${todayStr}_${machineId}`;
      const rawJobs = machineJobs[compositeKey];
      const monthStr = todayStr.substring(0, 7);
      const avgKey = `${monthStr}_avg_${machineId}`;
      const rawAvgJobs = machineAvgJobs[avgKey];
      
      const avgJobs = (rawAvgJobs && rawAvgJobs.length > 0)
        ? rawAvgJobs
        : getHeijunkaJobsForMachine(machineId, dayOTs[compositeKey] || 'teiji', nightOTs[compositeKey] || 'teiji', todayStr, parts);
        
      const jobs = (rawJobs && rawJobs.length > 0)
        ? rawJobs
        : avgJobs;

      const totalMins = jobs.reduce((sum, job) => sum + (job.time || 0) + (job.dandori || 0), 0);
      // 21-hour effective working window (day 07:15-19:00 + night 21:00-07:15 = ~1260 min, excl. break gaps)
      const loadPercent = Math.min(150, Math.round((totalMins / 1260) * 100)); // cap visually at 150%

      const partsArr = machineId.split(' ');
      const fact = partsArr[0]; // 'F2', 'F3', 'F4', 'SC2'
      const mcShortName = partsArr.slice(1).join(' '); // 'MC 1', 'MC B1', etc.

      return {
        name: machineId,
        shortName: mcShortName,
        factory: fact,
        load: loadPercent,
        mins: totalMins,
        hours: parseFloat((totalMins / 60).toFixed(1))
      };
    });
  }, [machineJobs, machineAvgJobs, dayOTs, nightOTs, todayStr, parts]);

  // Overall factory utilization calculation (21-hour effective working window per machine)
  const overallUtilization = useMemo(() => {
    const totalScheduledMins = machineLoads.reduce((sum, m) => sum + m.mins, 0);
    const totalAvailableMins = ALL_ACTIVE_MACHINES.length * 1260; // 21h × 60 min per machine
    return totalAvailableMins > 0 
      ? Math.min(100, Math.round((totalScheduledMins / totalAvailableMins) * 100)) 
      : 0;
  }, [machineLoads]);

  // Dynamic status styling based on overall utilization percentage
  const utilizationStatus = useMemo(() => {
    if (overallUtilization >= 85) return { text: 'High Efficiency', color: 'text-emerald-600', barColor: 'bg-emerald-500' };
    if (overallUtilization >= 70) return { text: 'Optimal Load', color: 'text-blue-600', barColor: 'bg-blue-500' };
    if (overallUtilization >= 50) return { text: 'Moderate Load', color: 'text-amber-600', barColor: 'bg-amber-500' };
    return { text: 'Low Utilization', color: 'text-rose-600', barColor: 'bg-rose-500' };
  }, [overallUtilization]);

  // Filtered load profile data for the chart
  const chartData = useMemo(() => {
    if (activeFactory === 'ALL') {
      return [...machineLoads]
        .sort((a, b) => b.load - a.load)
        .slice(0, 12);
    } else {
      return machineLoads.filter(item => item.factory === activeFactory);
    }
  }, [machineLoads, activeFactory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Dashboard: Integrated Planning Control</h2>
        </div>
        <div className="flex gap-2 shrink-0">
           <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase bg-emerald-100 border border-emerald-200 text-emerald-700">
             <CheckCircle2 className="w-3 h-3" /> System Healthy
           </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 border border-amber-200">Demo</span>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Material Availability</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-800">82.5%</span>
            <span className="text-[10px] text-amber-600 font-bold mb-1 uppercase">Import Critical</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3">
            <div className="bg-amber-500 h-1.5 rounded-full w-[82.5%]"></div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Machine Utilization</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-800">{overallUtilization}%</span>
            <span className={`text-[10px] ${utilizationStatus.color} font-bold mb-1 uppercase`}>{utilizationStatus.text}</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3">
            <div className={`${utilizationStatus.barColor} h-1.5 rounded-full`} style={{ width: `${overallUtilization}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 border border-amber-200">Demo</span>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Manhour Coverage</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-800">96.2%</span>
            <span className="text-[10px] text-blue-600 font-bold mb-1 uppercase">Sufficient</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3">
            <div className="bg-blue-500 h-1.5 rounded-full w-[96.2%]"></div>
          </div>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 border border-amber-200">Demo</span>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Delivery Ritase</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-black text-slate-800">42/65</span>
            <span className="text-[10px] text-slate-500 font-bold mb-1 uppercase">Ongoing</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3">
            <div className="bg-slate-400 h-1.5 rounded-full w-[64%]"></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material Chart */}
        <Card className="flex flex-col h-[320px] p-0">
          <div className="p-4 border-b border-slate-100">
             <h3 className="font-bold text-slate-800 text-sm">Material vs Requirement</h3>
          </div>
          <div className="flex-1 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materialData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <RechartsTooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '11px', fontWeight: 'bold'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                <Bar dataKey="stock" name="Actual Stock" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="required" name="Required" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Machine Chart */}
        <Card className="flex flex-col h-[320px] p-0">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center select-none">
             <h3 className="font-bold text-slate-800 text-sm">Machine Load Profile</h3>
             <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner gap-0.5 text-[9px] font-bold">
               {['ALL', 'F2', 'F3', 'F4', 'SC2'].map(fact => (
                 <button
                   key={fact}
                   onClick={() => setActiveFactory(fact)}
                   className={`px-1.5 py-0.5 rounded transition-colors uppercase cursor-pointer ${
                     activeFactory === fact ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                   }`}
                 >
                   {fact === 'ALL' ? 'Top 12' : fact}
                 </button>
               ))}
             </div>
          </div>
          <div className="flex-1 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey={activeFactory === 'ALL' ? 'name' : 'shortName'} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis unit="%" domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <RechartsTooltip formatter={(value, name, props) => [`${value}% (${props.payload.hours} hrs)`, 'Load']} contentStyle={{borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '11px', fontWeight: 'bold'}} />
                <Area type="monotone" dataKey="load" name="Machine Load %" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorLoad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Manpower Chart */}
        <Card className="flex flex-col lg:col-span-1 h-[320px] p-0">
          <div className="p-4 border-b border-slate-100">
             <h3 className="font-bold text-slate-800 text-sm">Manpower Distribution by Shift</h3>
          </div>
          <div className="flex-1 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={manpowerData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase'}} />
                <RechartsTooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '11px', fontWeight: 'bold'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                <Bar dataKey="present" name="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" name="Absent" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Production Achievement Chart */}
        <Card className="flex flex-col lg:col-span-1 h-[320px] p-0">
          <div className="p-4 border-b border-slate-100">
             <h3 className="font-bold text-slate-800 text-sm">Target vs Actual Production</h3>
          </div>
          <div className="flex-1 p-6">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={achievementData} margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase'}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#10b981', fontSize: 10, fontWeight: 700}} />
                <RechartsTooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '11px', fontWeight: 'bold'}} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                <Bar yAxisId="left" dataKey="target" name="Target Qty" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="actual" name="Actual Qty" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="oee" name="OEE %" stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
