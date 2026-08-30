import {
  listMyNotifications,
  markNotificationReadForm,
  markAllNotificationsReadForm,
} from "@/server/actions/notifications";
import ActionForm from "@/components/forms/ActionForm";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const notifications = await listMyNotifications(page);
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        {hasUnread && (
          <ActionForm
            action={markAllNotificationsReadForm}
            submitLabel="Mark all read"
            onSuccessMessage="Marked as read."
            className="inline"
          >
            <span className="hidden" aria-hidden="true" />
          </ActionForm>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`border rounded-lg p-3 text-sm flex flex-col gap-2 ${n.readAt ? "border-slate-200" : "border-accent bg-primary-light"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-navy flex items-center gap-1.5">
                  {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" aria-hidden="true" />}
                  {n.title}
                </p>
                <p className="text-neutral-500 mt-0.5">{n.body}</p>
                <p className="text-xs text-neutral-500 mt-1">{formatDateTime(n.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {n.linkPath && (
                <Link href={n.linkPath} className="text-accent hover:underline text-xs">
                  View
                </Link>
              )}
              {!n.readAt && (
                <ActionForm
                  action={markNotificationReadForm}
                  submitLabel="Mark read"
                  onSuccessMessage="Marked as read."
                  className="inline"
                >
                  <input type="hidden" name="notificationId" value={n.id} />
                </ActionForm>
              )}
            </div>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-sm text-neutral-500">No notifications yet.</p>}
      </div>
    </div>
  );
}
