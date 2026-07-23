"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/permissions";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";
import type { Member } from "@prisma/client";

const ACTIVATION_TOKEN_TTL_DAYS = 7;

/**
 * Seeds a new User's login identifier from its Member record so the account
 * is never left with neither an email nor a phone — a member who leaves both
 * fields blank on the activation form would otherwise end up permanently
 * unable to log in. Member.phone is required, so it's the reliable fallback;
 * either field is skipped if another User already owns that exact value
 * (rare, but seen in practice with pre-existing/orphaned accounts) rather
 * than letting a unique-constraint error fail the whole invite.
 */
async function createUserSeededFromMember(member: Member) {
  const [emailTaken, phoneTaken] = await Promise.all([
    member.email ? prisma.user.findUnique({ where: { email: member.email } }) : null,
    member.phone ? prisma.user.findUnique({ where: { phone: member.phone } }) : null,
  ]);

  return prisma.user.create({
    data: {
      memberId: member.id,
      phone: phoneTaken ? undefined : member.phone,
      email: emailTaken || !member.email ? undefined : member.email,
      // Unusable placeholder — replaced when the member activates their account.
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
      mustChangePassword: true,
    },
  });
}

/**
 * Admin-issued invite: creates (or reuses) a User for a member and a
 * one-time activation token. The resulting link is handed to the member
 * offline (WhatsApp/SMS/in person) — there is no public self-signup, matching
 * the constitution's committee-oversight model for new/existing members.
 */
export async function inviteMember(memberId: string): Promise<ActionResult<{ token: string }>> {
  try {
    const session = await requireAdmin();
    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, include: { user: true } });

    const user = member.user ?? (await createUserSeededFromMember(member));

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.activationToken.create({ data: { token, userId: user.id, expiresAt } });

    await logAudit({
      entityType: "User",
      entityId: user.id,
      memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { type: "activation_invite" },
    });

    return { ok: true, data: { token } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to create invite.") };
  }
}

const activateSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1).optional().or(z.literal("")),
});

export async function activateAccount(input: unknown): Promise<ActionResult<{ userId: string }>> {
  try {
    const parsed = activateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const activation = await prisma.activationToken.findUnique({ where: { token: data.token } });
    if (!activation || activation.usedAt || activation.expiresAt < new Date()) {
      return { ok: false, error: "This activation link is invalid or has expired. Ask an admin for a new one." };
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: activation.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          ...(data.email ? { email: data.email } : {}),
          ...(data.phone ? { phone: data.phone } : {}),
        },
      }),
      prisma.activationToken.update({ where: { id: activation.id }, data: { usedAt: new Date() } }),
    ]);

    return { ok: true, data: { userId: activation.userId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to activate account.") };
  }
}
