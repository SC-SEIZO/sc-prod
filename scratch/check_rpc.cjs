const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Testing common RPC names for SQL execution...");
  
  const rpcs = ['exec_sql', 'run_sql', 'execute_sql', 'sql'];
  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc, { query_text: 'SELECT 1;', sql: 'SELECT 1;' });
    if (error) {
      console.log(`RPC '${rpc}': NOT FOUND or failed (${error.message})`);
    } else {
      console.log(`RPC '${rpc}': EXISTS! Result:`, data);
    }
  }
}

run();
