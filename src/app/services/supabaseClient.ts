import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cmhmtzwozcfjfuwddmsg.supabase.co';
const supabaseKey = 'sb_publishable_aU0uiHYy5nCBwbK5EIfn6w_AxdbYiw6';
export const supabase = createClient(supabaseUrl, supabaseKey);

