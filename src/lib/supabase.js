import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://odlssmfmsykgkufmgbpz.supabase.co"
const supabaseAnonKey = "sb_publishable_GvTkva8eRTLravYF7EOpGQ_J20nnLcU"

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
