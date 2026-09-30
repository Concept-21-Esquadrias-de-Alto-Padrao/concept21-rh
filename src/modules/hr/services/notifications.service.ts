import { getHrSupabaseClient } from "@/modules/hr/services/service-utils";
import type { ID, PlatformNotification } from "@/modules/hr/types";

export async function listUnreadPlatformNotifications(limit = 5) {
  const supabase = getHrSupabaseClient();
  const { data, error } = await supabase
    .from("platform_notifications")
    .select("*")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PlatformNotification[];
}

export async function markPlatformNotificationRead(notificationId: ID) {
  const supabase = getHrSupabaseClient();
  const { error } = await supabase
    .from("platform_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    throw new Error(error.message);
  }
}
