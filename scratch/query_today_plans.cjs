const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const todayStr = '2026-06-12';
  console.log(`Querying production_plans for date_key = ${todayStr}...`);
  const { data, error } = await supabase
    .from('production_plans')
    .select('*')
    .eq('date_key', todayStr);
    
  if (error) {
    console.error("Error querying table:", error);
  } else {
    console.log(`Found ${data.length} row(s) for today:`);
    data.forEach(row => {
      console.log(`- ID: ${row.id}, Machine: ${row.machine_id}, Jobs Count: ${row.jobs?.length}, is_abnormal: ${row.is_abnormal}, abnormal_type: ${row.abnormal_type}`);
    });
  }
}

run();
