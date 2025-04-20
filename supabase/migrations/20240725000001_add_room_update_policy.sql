-- Add UPDATE policy for the rooms table

-- Policy: Allow the host of a room to update its game_state and question_index
create policy "Allow host to update room state" on public.rooms
  for update using (
    -- Check if the authenticated user is the host of this room
    auth.uid() in (
      select user_id from public.players p
      where p.room_id = public.rooms.id and p.is_host = true
    )
  )
  with check (
    -- Apply the same check for the WITH CHECK clause
    auth.uid() in (
      select user_id from public.players p
      where p.room_id = public.rooms.id and p.is_host = true
    )
  );

comment on policy "Allow host to update room state" on public.rooms is 
  'Allows the player marked as host to update the game_state and question_index of their room.'; 