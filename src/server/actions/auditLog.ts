"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/permissions";
import { DEFAULT_PAGE_SIZE, paginationSkip } from "@/lib/pagination";

const AUDIT_LOG_PAGE_SIZE = DEFAULT_PAGE_SIZE;

function auditLogWhere(query?: { search?: string }) {
  return query?.search
    ? {
        OR: [
          { entityType: { contains: query.search, mode: "insensitive" as const } },
          { entityId: { contains: query.search, mode: "insensitive" as const } },
          { performedByUserId: { contains: query.search, mode: "insensitive" as const } },
        ],
      }
    : {};
}

export async function listAuditLogs(query?: { search?: string; page?: number }) {
  await requireAdmin();
  const page = Math.max(1, query?.page ?? 1);
  return prisma.auditLog.findMany({
    where: auditLogWhere(query),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: paginationSkip(page, AUDIT_LOG_PAGE_SIZE),
    take: AUDIT_LOG_PAGE_SIZE,
  });
}

export async function countAuditLogs(query?: { search?: string }) {
  await requireAdmin();
  return prisma.auditLog.count({ where: auditLogWhere(query) });
}
