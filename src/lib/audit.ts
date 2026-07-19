import { AuditAction } from "@prisma/client";
import { prisma } from "./prisma";

export async function logAudit(input: {
  entityType: string;
  entityId: string;
  memberId?: string | null;
  action: AuditAction;
  performedByUserId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      memberId: input.memberId ?? null,
      action: input.action,
      performedByUserId: input.performedByUserId,
      // Normalizes Dates to ISO strings and drops undefined values so the
      // payload is always valid JSON for the Json column.
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  });
}
