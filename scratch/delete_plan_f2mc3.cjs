const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Deleting saved daily plan for '2026-06-10_F2 MC 3' in Supabase...");
  const { data, error } = await supabase
    .from('production_plans')
    .delete()
    .eq('id', '2026-06-10_F2 MC 3');
    
  if (error) {
    console.error("Error deleting plan:", error);
    return;
  }
  
  console.log("Deleted successfully! The page should now fallback dynamically to the new Heijunka template.");
}

run();
