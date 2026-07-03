const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Fetching production plans from public.production_plans...");
  
  const { data, error } = await supabase
    .from('production_plans')
    .select('*');
    
  if (error) {
    console.error("Error fetching plans:", error);
    return;
  }
  
  console.log(`Found ${data.length} plan records in Supabase:`);
  data.forEach(row => {
    console.log(`- ID: "${row.id}", Type: "${row.plan_type}", Jobs Count: ${row.jobs ? row.jobs.length : 0}`);
    if (row.id.includes('MC 3') || row.id.includes('MC_3') || row.id.includes('MC-3')) {
      console.log(`  Matching Record Details:`);
      console.log(JSON.stringify(row, null, 2));
    }
  });
}

run();
