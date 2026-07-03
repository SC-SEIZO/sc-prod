import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Fetching plans for F2 MC 2 on June 15...");
  
  // 1. Fetch daily plan
  const { data: dailyData, error: dailyError } = await supabase
    .from('production_plans')
    .select('*')
    .eq('id', '2026-06-15_F2 MC 2')
    .single();
    
  // 2. Fetch average plan
  const { data: avgData, error: avgError } = await supabase
    .from('production_plans')
    .select('*')
    .eq('id', '2026-06_avg_F2 MC 2')
    .single();
    
  if (dailyError) {
    console.log("Daily plan for 2026-06-15_F2 MC 2 not found or error:", dailyError.message);
  } else {
    console.log("\n===================================");
    console.log(`DAILY PLAN ID: ${dailyData.id}`);
    console.log(`Jobs Count: ${dailyData.jobs ? dailyData.jobs.length : 0}`);
    if (dailyData.jobs) {
      dailyData.jobs.forEach(j => {
        console.log(`  - Job: ${j.model}, Seq: ${j.seq}, Shift: ${j.shift}, QtyLot: ${j.qtyLot}, ActualQty: ${j.actualQty}, Status: ${j.status}`);
      });
    }
  }
  
  if (avgError) {
    console.log("Average plan not found or error:", avgError.message);
  } else {
    console.log("\n===================================");
    console.log(`AVERAGE PLAN ID: ${avgData.id}`);
    console.log(`Jobs Count: ${avgData.jobs ? avgData.jobs.length : 0}`);
    if (avgData.jobs) {
      avgData.jobs.forEach(j => {
        console.log(`  - Job: ${j.model}, Seq: ${j.seq}, Shift: ${j.shift}, QtyLot: ${j.qtyLot}, Status: ${j.status}`);
      });
    }
  }
}

run();
