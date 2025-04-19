-- First, drop any existing policies (if they exist)
DROP POLICY IF EXISTS "Allow host to insert questions" ON public.questions;
DROP POLICY IF EXISTS "Allow insert for game setup" ON public.questions;

-- Ensure RLS is enabled on the questions table
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Create a more permissive insert policy for public (including anonymous) access
CREATE POLICY "Allow anyone to insert questions" 
  ON public.questions 
  FOR INSERT 
  TO public 
  WITH CHECK (true);

-- Add a comment explaining the policy
COMMENT ON POLICY "Allow anyone to insert questions" ON public.questions IS 
  'Allows any user (including anonymous) to insert questions during game setup';

-- Also check if the policy for viewing questions is appropriate
DROP POLICY IF EXISTS "Allow players in the room to view questions" ON public.questions;

-- Create a more permissive SELECT policy to ensure questions can be read
CREATE POLICY "Allow anyone to view questions" 
  ON public.questions 
  FOR SELECT 
  TO public 
  USING (true); 