import { deviceTimeZone } from '@/lib/day-window';
import { supabase } from '@/lib/supabase';

export async function syncProfileTimezone(userId: string): Promise<void> {
  const timezone = deviceTimeZone();

  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle<{ timezone: string | null }>();

  if (error) {
    console.error('[Profile] timezone read failed:', error);
    return;
  }

  if (data?.timezone === timezone) {
    return;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', userId);

  if (updateError) {
    console.error('[Profile] timezone update failed:', updateError);
  }
}
