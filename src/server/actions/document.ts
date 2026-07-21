"use server";

import { prisma } from "@/lib/prisma";
import { requireOwnMemberOrAdmin } from "@/server/permissions";
import { uploadPrivateFile } from "@/lib/storage/blob";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";
import type { DocumentOwner } from "@prisma/client";

export async function uploadDocument(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const file = formData.get("file");
    const memberId = String(formData.get("memberId") ?? "");
    const beneficiaryId = formData.get("beneficiaryId") ? String(formData.get("beneficiaryId")) : null;
    const claimId = formData.get("claimId") ? String(formData.get("claimId")) : null;
    const paymentId = formData.get("paymentId") ? String(formData.get("paymentId")) : null;
    const ownerType = String(formData.get("ownerType") ?? "") as DocumentOwner;

    if (!(file instanceof File)) return { ok: false, error: "No file provided." };
    if (!memberId) return { ok: false, error: "memberId is required." };

    const session = await requireOwnMemberOrAdmin(memberId);

    const uploaded = await uploadPrivateFile(file, `members/${memberId}`);

    const doc = await prisma.document.create({
      data: {
        ownerType,
        memberId,
        beneficiaryId,
        claimId,
        paymentId,
        storageKey: uploaded.storageKey,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        uploadedByUserId: session.user.id,
      },
    });

    await logAudit({
      entityType: "Document",
      entityId: doc.id,
      memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { ownerType, fileName: uploaded.fileName },
    });

    revalidatePath(`/admin/members/${memberId}`);
    if (paymentId) revalidatePath(`/admin/members/${memberId}/payments`);
    revalidatePath("/profile");
    return { ok: true, data: { id: doc.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to upload document.") };
  }
}
