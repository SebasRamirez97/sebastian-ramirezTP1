import { createClient } from '@supabase/supabase-js';

// ⚠️ Estos valores los sacás de la sección "API" en tu proyecto Supabase
// Lo ideal es que en producción los guardes en variables de entorno (.env)
const supabaseUrl: string = 'https://cmhmtzwozcfjfuwddmsg.supabase.co';
const supabaseKey: string = 'sb_publishable_aU0uiHYy5nCBwbK5EIfn6w_AxdbYiw6';

// Cliente único de Supabase para toda la app
export const supabase = createClient(supabaseUrl, supabaseKey);

