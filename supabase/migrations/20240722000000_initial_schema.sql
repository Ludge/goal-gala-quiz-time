-- Create the rooms table
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  game_state text default 'lobby'::text not null, -- e.g., lobby, playing, finished
  question_index integer default 0 not null -- Track current question index
);

-- Enable RLS
alter table public.rooms enable row level security;

-- Create policies for rooms
create policy "Allow anyone to create rooms" on public.rooms for insert with check (true);
create policy "Allow anyone to read rooms" on public.rooms for select using (true);

-- Create the players table
create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) null, -- Allow anonymous players
  name text not null,
  is_host boolean default false not null,
  score integer default 0 not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.players enable row level security;

-- Create policies for players
create policy "Allow players to insert themselves" on public.players for insert with check (true);

-- TODO: [SECURITY] Temporarily relaxed policy for development. Implement proper auth check.
create policy "Allow players to view players in their room (TEMP)" on public.players for select using (true);
-- Original Policy (requires auth or header):
-- create policy "Allow players to view players in their room" on public.players for select using (
--   room_id in (select room_id from public.players where user_id = auth.uid()) -- Check if user is in the room
--   or
--   room_id in (select id from public.rooms where code = current_setting('request.header.x-room-code', true)) -- Allow access via room code header for anon
-- );

create policy "Allow players to update their own score/name" on public.players for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Allow host to update player scores (e.g., reset)" on public.players for update using (
  exists (select 1 from public.players where room_id = public.players.room_id and user_id = auth.uid() and is_host = true)
);

-- Create the questions table
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  question_number integer not null,
  question_text text not null,
  options jsonb not null, -- e.g., ["Option A", "Option B", ...]
  correct_option_index integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_id, question_number) -- Ensure question numbers are unique per room
);

-- Enable RLS
alter table public.questions enable row level security;

-- Create policies for questions
create policy "Allow host to insert questions" on public.questions for insert with check (
  exists (select 1 from public.players where room_id = public.questions.room_id and user_id = auth.uid() and is_host = true)
);
create policy "Allow players in the room to view questions" on public.questions for select using (
  room_id in (select room_id from public.players where user_id = auth.uid()) -- Check if user is in the room
  or
  room_id in (select id from public.rooms where code = current_setting('request.header.x-room-code', true)) -- Allow access via room code header for anon
);

-- Create the answers table
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  selected_option_index integer not null,
  time_taken_ms integer not null, -- Time in milliseconds
  is_correct boolean not null,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(player_id, question_id) -- Ensure one answer per player per question
);

-- Enable RLS
alter table public.answers enable row level security;

-- Create policies for answers
create policy "Allow players to insert their own answers" on public.answers for insert with check (player_id = (select id from public.players where user_id = auth.uid() limit 1));
create policy "Allow players in the room to view answers" on public.answers for select using (
  exists (select 1 from public.players p join public.questions q on p.room_id = q.room_id where p.user_id = auth.uid() and q.id = public.answers.question_id)
  or
  exists (select 1 from public.rooms r join public.questions q on r.id = q.room_id where r.code = current_setting('request.header.x-room-code', true) and q.id = public.answers.question_id) -- Allow access via room code header for anon
);

-- Set up publications for realtime
-- Drop default publication if exists
drop publication if exists supabase_realtime;

-- Create publication for all tables needed for realtime updates
create publication supabase_realtime for table public.rooms, public.players, public.questions, public.answers; 