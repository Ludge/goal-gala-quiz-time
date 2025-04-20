-- Function to calculate leaderboard for a given room
create or replace function public.get_leaderboard(p_room_id uuid)
returns table (
  player_id uuid,
  player_name text,
  correct_answers bigint,
  total_time_ms bigint
)
language sql
stable
as $$
  select
    p.id as player_id,
    p.name as player_name,
    count(a.id) filter (where a.is_correct = true) as correct_answers,
    coalesce(sum(a.time_taken_ms) filter (where a.is_correct = true), 0) as total_time_ms
  from
    public.players p
  left join
    public.answers a on p.id = a.player_id
  where
    p.room_id = p_room_id
  group by
    p.id, p.name
  order by
    correct_answers desc,
    total_time_ms asc;
$$;

-- Grant execute permission to the function
grant execute on function public.get_leaderboard(uuid) to authenticated;
grant execute on function public.get_leaderboard(uuid) to service_role;
-- Allow anon users if needed, depending on your RLS setup for calling functions
-- grant execute on function public.get_leaderboard(uuid) to anon;

comment on function public.get_leaderboard(uuid) is 'Calculates the leaderboard for a room, ranking players by correct answers (desc) and total time (asc).'; 