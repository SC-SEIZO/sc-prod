const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const todayStr = '2026-06-12';
  const { data, error } = await supabase
    .from('production_plans')
    .select('*')
    .eq('date_key', todayStr);
    
  if (error) {
    console.error("Error querying:", error);
  } else {
    data.forEach(row => {
      console.log(`\n=================== ROW ID: ${row.id} ===================`);
      console.log(`is_abnormal: ${row.is_abnormal}, abnormal_type: ${row.abnormal_type}`);
      if (row.jobs) {
        row.jobs.forEach((j, i) => {
          console.log(`Job ${i+1}: ID: ${j.id}, Model: ${j.model}, Status: ${j.status}, Actual Qty: ${j.actualQty}/${j.qtyLot}`);
        });
      } else {
        console.log("No jobs in this row.");
      }
    });
  }
}

run();
