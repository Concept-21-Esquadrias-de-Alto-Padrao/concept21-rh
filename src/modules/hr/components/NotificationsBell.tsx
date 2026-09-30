"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  listUnreadPlatformNotifications,
  markPlatformNotificationRead,
} from "@/modules/hr/services/notifications.service";
import type { PlatformNotification } from "@/modules/hr/types";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const data = await listUnreadPlatformNotifications(6);

        if (active) {
          setNotifications(data);
        }
      } catch {
        if (active) {
          setNotifications([]);
        }
      }
    }

    void loadNotifications();

    const interval = window.setInterval(loadNotifications, 60000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function markRead(notification: PlatformNotification) {
    setNotifications((current) => current.filter((item) => item.id !== notification.id));

    try {
      await markPlatformNotificationRead(notification.id);
    } catch {
      setNotifications((current) => [notification, ...current]);
    }
  }

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-9 w-9 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-orange-200 hover:text-[#f97316]"
        title="Notificacoes"
      >
        <Bell className="h-4 w-4" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#f97316] px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-2rem))] rounded-md border border-zinc-200 bg-white p-2 shadow-xl">
          <div className="border-b border-zinc-100 px-3 py-2">
            <p className="text-sm font-semibold text-zinc-950">Notificacoes</p>
          </div>
          {notifications.length ? (
            <div className="max-h-80 overflow-y-auto py-1">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.action_url ?? "/rh"}
                  onClick={() => {
                    setOpen(false);
                    void markRead(notification);
                  }}
                  className="block rounded-md px-3 py-2 text-sm transition hover:bg-orange-50"
                >
                  <p className="font-semibold text-zinc-950">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{notification.body}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-3 py-4 text-sm text-zinc-500">Nada pendente.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
