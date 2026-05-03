const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://olmissmcnqzzfvygeqtg.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbWlzc21jbnF6emZ2eWdlcXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTE1NjQsImV4cCI6MjA5MzM4NzU2NH0.jkG6BzJ4x56pZjFa4QXEHhrXbJOWnt2BQC_QFc9Tyus';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
