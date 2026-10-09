import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'property-images';

if (!url || !key) {
  console.log('Missing credentials');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError.message);
    process.exit(1);
  }

  const exists = buckets.find(b => b.name === bucketName);
  if (exists) {
    console.log(`Bucket ${bucketName} already exists.`);
    
    // Attempt to make it public if it's not (Supabase API can update bucket)
    if (!exists.public) {
      console.log('Bucket is not public. Attempting to update...');
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true,
      });
      if (updateError) {
        console.error('Error updating bucket to public:', updateError.message);
      } else {
        console.log('Bucket updated to public successfully.');
      }
    }
  } else {
    console.log(`Bucket ${bucketName} does not exist. Creating...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
      fileSizeLimit: 5 * 1024 * 1024
    });
    if (createError) {
      console.error('Error creating bucket:', createError.message);
      process.exit(1);
    }
    console.log(`Bucket ${bucketName} created successfully and set to public.`);
  }
}

checkBucket().catch(err => {
  console.error(err);
  process.exit(1);
});
