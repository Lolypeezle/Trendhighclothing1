// TRENDHIGHCLOTHING - Supabase Configuration & Initialization
const SUPABASE_URL = "https://xbgohwvxrvvrbjbzbwkx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29od3Z4cnZ2cmJqYnpid2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjM3MTUsImV4cCI6MjA5OTQ5OTcxNX0.dXu3T78fRhOBx2NEN54Fp_p4Vd-5zZg3zIfbT70TrhE";



window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var supabase = window.supabase;
