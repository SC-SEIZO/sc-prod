const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const finalKey = '2026-06-12_F2 MC 1';
  const parsedMachineId = 'F2 MC 1';
  const date = '2026-06-12';
  const testJobs = [
    {
      id: 'job-init-F2 MC 1-test-0',
      model: 'TEST-MODEL',
      partName: 'Test Part',
      qtyLot: 100,
      actualQty: 0,
      status: 'running',
      shift: 'day',
      ct: 60,
      kav: 1,
      time: 100,
      mold: 'TEST-MOLD',
      material: 'TEST-MAT',
      customer: 'TEST-CUST',
      timeRange: '07:30 - 09:10'
    }
  ];

  const payload = {
    id: finalKey,
    plan_type: 'daily',
    machine_id: parsedMachineId,
    date_key: date,
    jobs: testJobs,
    day_ot: 'teiji',
    night_ot: 'teiji',
    logs: [],
    updated_at: new Date().toISOString()
  };

  console.log("Testing self-healing upsert...");
  let { data, error } = await supabase
    .from('production_plans')
    .upsert(payload, { onConflict: 'id' })
    .select('*');

  if (error) {
    console.log("Initial upsert failed as expected:", error.message);
    if (error.message.includes("Could not find the 'logs' column")) {
      console.log("Triggering fallback: deleting logs column from payload...");
      delete payload.logs;
      const retry = await supabase
        .from('production_plans')
        .upsert(payload, { onConflict: 'id' })
        .select('*');
      error = retry.error;
      data = retry.data;
    }
  }

  if (error) {
    console.error("Fallback upsert also failed:", error);
  } else {
    console.log("Fallback upsert SUCCEEDED! Returned data:");
    console.log(data);
    
    // Clean up
    console.log("Cleaning up test row...");
    await supabase.from('production_plans').delete().eq('id', finalKey);
    console.log("Clean up done.");
  }
}

run();
