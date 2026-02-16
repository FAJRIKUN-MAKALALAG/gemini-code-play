import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing! Please check your .env file.");
}

export const supabase = createClient(
  supabaseUrl || 'https://hiarbjpgiwxcyinhmzyo.supabase.co', 
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpYXJianBnaXd4Y3lpbmhtenlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzNjE5NTgsImV4cCI6MjA1NDkzNzk1OH0.aiyhONXgFbeLftlg0aZEMNHvsDW-ZLwYoIvhxpRkP85a'
);
