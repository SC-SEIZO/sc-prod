const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Querying production_plans to check schema...");
  const { data, error } = await supabase
    .from('production_plans')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("Error querying table:", error);
  } else if (data && data.length > 0) {
    console.log("Found row. Column keys:");
    console.log(Object.keys(data[0]));
    console.log("\nSample row content:");
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log("Table is empty. Checking table OpenAPI definitions...");
    const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`;
    const https = require('https');
    https.get(url, { headers: { 'Accept': 'application/openapi+json' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const schema = JSON.parse(body);
          if (schema.definitions && schema.definitions.production_plans) {
            console.log("Schema properties for production_plans:");
            console.log(JSON.stringify(schema.definitions.production_plans.properties, null, 2));
          } else {
            console.log("production_plans definition not found.");
          }
        } catch (e) {
          console.error("Failed to parse OpenAPI JSON:", e);
        }
      });
    });
  }
}

run();
