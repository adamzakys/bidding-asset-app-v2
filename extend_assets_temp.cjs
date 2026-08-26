const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  // Let's check profiles
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  console.log('Profiles error:', pError);
  console.log('Profiles length:', profiles ? profiles.length : null);
  
  // Let's check assets
  const { data: assets, error: aError } = await supabase.from('assets').select('*');
  console.log('Assets error:', aError);
  console.log('Assets length:', assets ? assets.length : null);
  
  // Let's check categories
  const { data: cats, error: cError } = await supabase.from('categories').select('*');
  console.log('Categories error:', cError);
  console.log('Categories length:', cats ? cats.length : null);
}

main();
