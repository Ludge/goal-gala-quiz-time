import { supabase } from '../integrations/supabase/client';

// This script adds the 'showing_leaderboard' state to support the game flow
async function applyMigration() {
  try {
    console.log('Applying migration to add showing_leaderboard state...');
    
    // Execute the SQL directly through the client
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        -- Add showing_leaderboard value if it's an enum type
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_state_enum') THEN
                -- Check if 'showing_leaderboard' value exists in the enum
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_enum 
                    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'game_state_enum')
                    AND enumlabel = 'showing_leaderboard'
                ) THEN
                    -- Add the value to the enum
                    ALTER TYPE game_state_enum ADD VALUE 'showing_leaderboard';
                END IF;
            END IF;
        END $$;
      `
    });
    
    if (error) {
      console.error('Migration failed:', error);
    } else {
      console.log('Migration successful!');
    }
  } catch (err) {
    console.error('Unexpected error during migration:', err);
  }
}

// Run the migration
applyMigration(); 