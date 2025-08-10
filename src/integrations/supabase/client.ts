import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fmqmgzmvtutsblbevcap.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcW1nem12dHV0c2JsYmV2Y2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NzE0OTcsImV4cCI6MjA2NzE0NzQ5N30.G4Gw64qkyGr9zfV6XmNqSrk96QNI2nkuOJYOArp55_Q'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)