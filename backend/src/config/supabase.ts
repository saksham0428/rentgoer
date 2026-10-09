import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'property-images';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided for storage operations.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder'
);
