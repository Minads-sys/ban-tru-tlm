import prisma from "@/lib/db";
import { NextRequest } from "next/server";

export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  IMPORT: "IMPORT",
  EXPORT: "EXPORT",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  VOID: "VOID",
  RESET: "RESET",
} as const;

export const AUDIT_MODULES = {
  AUTH: "AUTH",
  STUDENTS: "STUDENTS",
  CLASSES: "CLASSES",
  SCHEDULE: "SCHEDULE",
  MEALS: "MEALS",
  BILLING: "BILLING",
  SETTINGS: "SETTINGS",
  SYSTEM: "SYSTEM",
} as const;

export interface LogAuditParams {
  req?: Request | NextRequest;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: keyof typeof AUDIT_ACTIONS | string;
  module: keyof typeof AUDIT_MODULES | string;
  description: string;
  targetId?: string | null;
  metadata?: any;
}

/**
 * Trích xuất địa chỉ IP từ request
 */
export function getClientIp(req?: Request | NextRequest): string | null {
  if (!req) return null;
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    if (cfConnectingIp) {
      return cfConnectingIp.trim();
    }
  } catch {
    // Ignore error
  }
  return null;
}

/**
 * Ghi nhật ký thao tác (Audit Log) một cách an toàn và không gây chậm request
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const ipAddress = getClientIp(params.req);
    const metadataStr = params.metadata
      ? typeof params.metadata === "string"
        ? params.metadata
        : JSON.stringify(params.metadata)
      : null;

    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        userName: params.userName || null,
        userRole: params.userRole || null,
        action: params.action,
        module: params.module,
        description: params.description,
        targetId: params.targetId || null,
        metadata: metadataStr,
        ipAddress: ipAddress,
      },
    });
  } catch (error) {
    // Không bao giờ để lỗi ghi log làm gián đoạn request của người dùng
    console.error("[AuditLog Error]", error);
  }
}
