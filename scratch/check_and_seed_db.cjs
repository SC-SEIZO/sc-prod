require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Connecting to Supabase at:', supabaseUrl);
  
  // Fetch users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role, name, password_hash')
    .limit(10);

  if (error) {
    console.error('Error fetching users (probably column password_hash is missing):');
    console.error(error);
    console.log('\n--> ACTION REQUIRED: Please execute migration_users_auth.sql in your Supabase SQL Editor.');
    process.exit(1);
  }

  console.log('Successfully queried users table. Current users count:', users.length);
  console.table(users);

  // Check if seed users are present
  const seedUsers = [
    {
      uid: 'uid-superadmin-seed',
      email: 'superadmin@sugity.co.id',
      role: 'super-admin',
      name: 'Default Super Admin',
      password_hash: 'scrypt:22a5b1fc57b60fd955a04bb57283080b:e6aaf33039ca0496e0e651b408228ff095d12426ca8e417ecb755ae0ba3c24abe848c56132eba13fa33c73afbbd391606b0bfada1fb193b4934b2481721f7cd7'
    },
    {
      uid: 'uid-planner-seed',
      email: 'planner@sugity.co.id',
      role: 'planner',
      name: 'Default Planner',
      password_hash: 'scrypt:db53c1479b23481f5d0200d8397567d4:973daed16dd4cd157753bba0c5f36f87f8926f598606b367d3837abcb322fe844734e19afb95d3e4bf396adb4afa521329e1544bdfef4aaea29ae12e3fb67ad2'
    },
    {
      uid: 'uid-leader-seed',
      email: 'leader@sugity.co.id',
      role: 'leader',
      name: 'Default Leader',
      password_hash: 'scrypt:3075111d64f95bd3de11b71ea91b7924:3fc257e6c25c9afaebff077d6f73fa1574a7189b7988621e8e6e5cdb2d188e251c92363e1bd84a411c613822dd4ba22252fdc49f4f8655c4599f3b37868b4d0f'
    },
    {
      uid: 'uid-operator-seed',
      email: 'operator@sugity.co.id',
      role: 'member',
      name: 'Default Operator',
      password_hash: 'scrypt:1aeceaf89045b26f4260f07adf24b3b7:421474baa242d64d2ce1f51e1f4ad5117222ee0e8349cd0ed8ec597b521fb5c3fff54412e50b693f60e175368a2eb1e9e742896e6c8cdd59770d42c87683e413'
    },
    {
      uid: 'uid-board-seed',
      email: 'board@sugity.co.id',
      role: 'production-board',
      name: 'Default Production Board',
      password_hash: 'scrypt:7bfa7795b8e1195afd18700b563d4256:382afcddc625063ee33ab0c9162616a140d458c06e68922b09ea0247cf672470ade64dd0b363c245055c5e8ffc6c059fa0a440a9b8a93a740ebb7da56e7e5eb9'
    }
  ];

  for (const user of seedUsers) {
    const existing = users.find(u => u.email === user.email);
    if (!existing) {
      console.log(`Seeding missing user: ${user.email} (${user.role})...`);
      const { error: insertError } = await supabase
        .from('users')
        .insert(user);
      if (insertError) {
        console.error(`Failed to insert ${user.email}:`, insertError.message);
      } else {
        console.log(`Successfully seeded ${user.email}`);
      }
    } else {
      console.log(`User ${user.email} already exists.`);
    }
  }

  console.log('Seeding completed.');
}

run();
