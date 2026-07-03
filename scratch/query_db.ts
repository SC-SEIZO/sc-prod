import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching production plans...");
  const { data, error } = await supabase
    .from('production_plans')
    .select('*');

  if (error) {
    console.error("Error fetching production plans:", error);
    return;
  }

  console.log(`Found ${data.length} plan records in Supabase:`);
  for (const row of data) {
    const isAbnormal = row.is_abnormal;
    const abnormalType = row.abnormal_type;
    const jobsCount = row.jobs ? row.jobs.length : 0;
    console.log(`- ID: "${row.id}", Type: "${row.plan_type}", Jobs Count: ${jobsCount}, IsAbnormal: ${isAbnormal} (${abnormalType})`);
    if (row.id.includes('F2 MC 2') || row.id.includes('MC 2')) {
      console.log(`  Matching Record Details for MC 2:`);
      console.log(JSON.stringify({
        id: row.id,
        plan_type: row.plan_type,
        is_abnormal: row.is_abnormal,
        abnormal_type: row.abnormal_type,
        abnormal_start: row.abnormal_start,
        jobs: row.jobs?.map((j: any) => ({
          id: j.id,
          model: j.model,
          qtyLot: j.qtyLot,
          actualQty: j.actualQty,
          status: j.status,
          shift: j.shift
        }))
      }, null, 2));
    }
  }
}

run();
