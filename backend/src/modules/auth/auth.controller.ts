import { FastifyReply, FastifyRequest } from "fastify";

import { JwtAuthPayload, getAuthContext } from "../../middleware/auth";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { toCamelCase } from "../../shared/http/case";
import { ok } from "../../shared/http/reply";
import { validateBody } from "../../shared/validation/validate";
import {
  changePasswordSchema,
  forceUpdatePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchoolSchema,
  resetPasswordSchema,
} from "./auth.schemas";
import {
  AuthResult,
  RequestMeta,
  changePassword,
  forceUpdatePassword,
  getCurrentUser,
  issueRefreshToken,
  login,
  registerSchool,
  requestPasswordReset,
  resetPassword,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./auth.service";

function requestMeta(request: FastifyRequest): RequestMeta {
  return { ipAddress: request.ip, userAgent: request.headers["user-agent"] ?? null };
}

function accessTokenPayload(result: AuthResult): JwtAuthPayload {
  return {
    sub: result.user.id,
    schoolId: result.school.id,
    membershipId: result.membershipId,
    role: result.role,
    ...(result.forcePasswordChange ? { fpc: true } : {}),
  };
}

async function buildSession(reply: FastifyReply, result: AuthResult, refreshToken: string) {
  const token = await reply.jwtSign(accessTokenPayload(result));
  return {
    user: { ...toCamelCase<Record<string, unknown>>(result.user), role: result.role },
    school: toCamelCase(result.school),
    role: result.role,
    mustChangePassword: result.forcePasswordChange,
    token,
    refreshToken,
  };
}

export async function registerSchoolHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = validateBody(request, registerSchoolSchema);
  const result = await registerSchool(input);
  const refreshToken = await issueRefreshToken(result.user.id, result.school.id, result.membershipId, requestMeta(request));

  reply.status(201).send(ok(await buildSession(reply, result, refreshToken)));
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const input = validateBody(request, loginSchema);
  const result = await login(input, requestMeta(request));
  const refreshToken = await issueRefreshToken(result.user.id, result.school.id, result.membershipId, requestMeta(request));

  reply.status(200).send(ok(await buildSession(reply, result, refreshToken)));
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { refreshToken } = validateBody(request, refreshSchema);
  const rotated = await rotateRefreshToken(refreshToken, requestMeta(request));

  reply.status(200).send(ok(await buildSession(reply, rotated.result, rotated.refreshToken)));
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { refreshToken } = validateBody(request, logoutSchema);

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "auth.logout",
    resourceType: "profile",
    resourceId: actor.userId,
    ipAddress: request.ip,
  });

  reply.status(200).send(ok({ loggedOut: true }));
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const result = await getCurrentUser(actor.userId, actor.schoolId, actor.membershipId);

  reply.status(200).send(
    ok({
      user: { ...toCamelCase<Record<string, unknown>>(result.user), role: result.role },
      school: toCamelCase(result.school),
      role: result.role,
      mustChangePassword: result.forcePasswordChange,
    })
  );
}

export async function changePasswordHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { currentPassword, newPassword } = validateBody(request, changePasswordSchema);
  await changePassword(actor.userId, currentPassword, newPassword);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "auth.password_changed",
    resourceType: "profile",
    resourceId: actor.userId,
    ipAddress: request.ip,
  });

  // Every refresh token was revoked, so hand back a fresh session for this device.
  const result = await getCurrentUser(actor.userId, actor.schoolId, actor.membershipId);
  const refreshToken = await issueRefreshToken(actor.userId, actor.schoolId, actor.membershipId, requestMeta(request));
  reply.status(200).send(ok(await buildSession(reply, result, refreshToken)));
}

export async function forceUpdatePasswordHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  const { newPassword } = validateBody(request, forceUpdatePasswordSchema);
  await forceUpdatePassword(actor.userId, newPassword);

  await recordAuditLog({
    schoolId: actor.schoolId,
    userId: actor.userId,
    action: "auth.password_changed",
    resourceType: "profile",
    resourceId: actor.userId,
    payload: { forced: true },
    ipAddress: request.ip,
  });

  const result = await getCurrentUser(actor.userId, actor.schoolId, actor.membershipId);
  const refreshToken = await issueRefreshToken(actor.userId, actor.schoolId, actor.membershipId, requestMeta(request));
  reply.status(200).send(ok(await buildSession(reply, result, refreshToken)));
}

export async function forgotPasswordHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { email } = validateBody(request, forgotPasswordSchema);
  await requestPasswordReset(email);

  reply.status(200).send(ok({ message: "If an account exists for that e-mail, a reset link has been sent." }));
}

export async function resetPasswordHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { token, newPassword } = validateBody(request, resetPasswordSchema);
  await resetPassword(token, newPassword);

  reply.status(200).send(ok({ message: "Password reset. Please sign in with your new password." }));
}

export async function logoutAllHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const actor = getAuthContext(request);
  await revokeAllRefreshTokens(actor.userId);
  reply.status(200).send(ok({ loggedOut: true }));
}
