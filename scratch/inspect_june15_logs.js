import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('production_plans')
    .select('logs')
    .eq('id', '2026-06-15_F2 MC 2')
    .single();
    
  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }
  
  console.log("Logs for 2026-06-15_F2 MC 2:");
  console.log(JSON.stringify(data.logs, null, 2));
}

run();
