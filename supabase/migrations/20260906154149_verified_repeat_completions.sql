-- Credit only playback sessions whose server-verified coverage reaches 90%.
-- listened_seconds is derived from accepted heartbeat ranges, so seeking does
-- not manufacture completion credit. Existing completion rows are preserved.
update public.playback_sessions as playback
set completed_at = coalesce(playback.last_heartbeat_at, playback.created_at, now())
from public.meditations as meditation
where playback.meditation_id = meditation.id
  and playback.completed_at is null
  and meditation.duration > 0
  and playback.listened_seconds >= ceil(meditation.duration * 0.90);

update public.history as history
set completed = true,
    completion_percent = greatest(history.completion_percent, 90)
where not history.completed
  and exists (
    select 1
    from public.playback_sessions as playback
    join public.meditations as meditation on meditation.id = playback.meditation_id
    where playback.telegram_id = history.telegram_id
      and playback.meditation_id = history.meditation_id
      and playback.completed_at is not null
      and meditation.duration > 0
      and playback.listened_seconds >= ceil(meditation.duration * 0.90)
  );
