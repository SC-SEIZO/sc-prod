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

  console.log("Testing savePlanToSupabase...");
  const { data, error } = await supabase
    .from('production_plans')
    .upsert({
      id: finalKey,
      plan_type: 'daily',
      machine_id: parsedMachineId,
      date_key: date,
      jobs: testJobs,
      day_ot: 'teiji',
      night_ot: 'teiji',
      logs: [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select('*');

  if (error) {
    console.error("UPSERT FAILED:", error);
  } else {
    console.log("UPSERT SUCCESSFUL. Returned data:");
    console.log(data);
    
    // Clean up
    console.log("Cleaning up test row...");
    const { error: delError } = await supabase
      .from('production_plans')
      .delete()
      .eq('id', finalKey);
    if (delError) {
      console.error("Clean up failed:", delError);
    } else {
      console.log("Clean up successful.");
    }
  }
}

run();
