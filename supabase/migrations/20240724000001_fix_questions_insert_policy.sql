-- Drop the existing restrictive policy if it exists
DROP POLICY IF EXISTS "Allow host to insert questions" ON public.questions;

-- Create a new policy that allows all authenticated and anonymous users to insert questions
CREATE POLICY "Allow insert for game setup" 
  ON public.questions 
  FOR INSERT 
  TO public 
  WITH CHECK (true);

-- Add a comment explaining the policy
COMMENT ON POLICY "Allow insert for game setup" ON public.questions IS 
  'Allows any user (including anonymous) to insert questions when setting up a game'; 