const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:\\Users\\alfin.armadani\\.gemini\\antigravity\\scratch\\production-planning-integration-system\\.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const planId = "2026-06-12_F2 MC 3";
  console.log(`Testing plan upsert for "${planId}"...`);

  // First fetch the current row
  const { data: current, error: fetchErr } = await supabase
    .from('production_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (fetchErr) {
    console.error("Error fetching plan:", fetchErr);
    return;
  }

  console.log("Current jobs length:", current.jobs ? current.jobs.length : 0);
  
  // Try to upsert the same row back to test write permission and policies
  const payload = {
    ...current,
    updated_at: new Date().toISOString()
  };

  const { data: upsertResult, error: upsertErr } = await supabase
    .from('production_plans')
    .upsert(payload, { onConflict: 'id' })
    .select('*');

  if (upsertErr) {
    console.error("UPSERT FAILED!");
    console.error("Message:", upsertErr.message);
    console.error("Details:", upsertErr.details);
    console.error("Hint:", upsertErr.hint);
    console.error("Code:", upsertErr.code);
  } else {
    console.log("UPSERT SUCCEEDED!");
    console.log("Result updated_at:", upsertResult[0].updated_at);
  }
}

run();
