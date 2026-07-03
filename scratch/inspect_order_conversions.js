import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Fetching order_conversions...");
  const { data, error } = await supabase
    .from('order_conversions')
    .select('*');
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${data.length} order conversion records:`);
  data.forEach(row => {
    // We check if the target date is June 15 or if the homeLine matches F2 MC 2
    const etaStr = row.eta || '';
    if (etaStr.includes('2026-06-15') || (row.home_line && row.home_line.includes('MC 2'))) {
      console.log(`- ID: ${row.id}, Part: ${row.part_number || row.sebango}, Qty: ${row.qty}, HomeLine: ${row.home_line}, ETA: ${row.eta}, Channel: ${row.channel}`);
    }
  });
}

run();
