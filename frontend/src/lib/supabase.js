import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://lwpblqvieqvfkvrbvtwi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGJscXZpZXF2Zmt2cmJ2dHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTQwMDUsImV4cCI6MjA5OTIzMDAwNX0.gTgjavi7n_LuP7bFvDDMoOcwCiYNReAET9IOZMc_8jg',
  {
    auth: {
      flowType: 'implicit',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);
