"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/server/permissions";
import { uploadPrivateFile } from "@/lib/storage/blob";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import { z } from "zod";
import { MeetingType } from "@prisma/client";
import type { ActionResult } from "./member";

const meetingCreateSchema = z.object({
  type: z.nativeEnum(MeetingType),
  date: z.coerce.date(),
  venue: z.string().trim().min(1, "Venue is required."),
  hostMemberId: z.string().min(1, "Select who is hosting the meeting."),
});

export async function createMeeting(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = meetingCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const meeting = await prisma.meeting.create({
      data: {
        type: data.type,
        date: data.date,
        venue: data.venue,
        hostMemberId: data.hostMemberId,
        createdByUserId: session.user.id,
      },
    });

    await logAudit({
      entityType: "Meeting",
      entityId: meeting.id,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { type: data.type, date: data.date.toISOString(), venue: data.venue },
    });

    revalidatePath("/admin/meetings");
    revalidatePath("/meetings");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: meeting.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to schedule meeting.") };
  }
}

/**
 * Meeting notes are uploaded as a follow-up step once the meeting has
 * happened (a scheduled meeting can't have minutes yet), unlike e.g.
 * Expense's compulsory-at-creation receipt.
 */
export async function uploadMeetingNotes(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();

    const file = formData.get("file");
    const meetingId = String(formData.get("meetingId") ?? "");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file provided." };
    if (!meetingId) return { ok: false, error: "meetingId is required." };

    await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

    const uploaded = await uploadPrivateFile(file, `meetings/${meetingId}`);

    const doc = await prisma.document.create({
      data: {
        ownerType: "MEETING_NOTES",
        meetingId,
        storageKey: uploaded.storageKey,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        uploadedByUserId: session.user.id,
      },
    });

    await logAudit({
      entityType: "Meeting",
      entityId: meetingId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { documentId: doc.id, fileName: uploaded.fileName },
    });

    revalidatePath("/admin/meetings");
    revalidatePath("/meetings");
    return { ok: true, data: { id: doc.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to upload meeting notes.") };
  }
}

/** Visible to any signed-in user (admin management screen + member-facing meetings page). */
export async function listMeetings() {
  await requireAuth();
  return prisma.meeting.findMany({
    include: { hostMember: true, documents: true },
    orderBy: { date: "desc" },
  });
}

/** Next `limit` meetings from today onward — for the member dashboard highlight. */
export async function listUpcomingMeetings(limit = 3) {
  await requireAuth();
  return prisma.meeting.findMany({
    where: { date: { gte: new Date() } },
    include: { hostMember: true },
    orderBy: { date: "asc" },
    take: limit,
  });
}

export async function createMeetingForm(formData: FormData) {
  return createMeeting(formDataToObject(formData));
}
