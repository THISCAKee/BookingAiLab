import { describe, expect, it } from "vitest";
import {
  parseDeviceRequest,
  parseExtensionCheckRequest,
  parseExtensionConfirmRequest,
  parseLoginRequest,
  parseLogoutRequest,
  parseOfflineSessionRequest,
} from "@/lib/timelock/requests";
import { buildOfflineAccount } from "@/lib/timelock/offline-cache";
import { timelockErrorResponse } from "@/lib/timelock/http";

describe("TimeLock API request contracts", () => {
  it("normalizes machine credentials from headers", () => {
    const headers = new Headers({
      "x-machine-code": " pc-001 ",
      "x-device-token": " device-secret ",
    });

    expect(parseDeviceRequest(headers)).toEqual({
      machineCode: "PC-001",
      deviceToken: "device-secret",
    });
  });

  it("rejects missing machine credentials", () => {
    expect(() => parseDeviceRequest(new Headers())).toThrow("MACHINE_TOKEN_INVALID");
  });

  it("normalizes login and logout bodies", () => {
    expect(parseLoginRequest({ username: " Student01 ", password: "secret" })).toEqual({
      username: "student01",
      password: "secret",
    });
    expect(parseLogoutRequest({ sessionId: "session-1", usedSeconds: 42, status: "completed" })).toEqual({
      sessionId: "session-1",
      usedSeconds: 42,
      status: "completed",
    });
  });

  it("rejects malformed offline sessions", () => {
    expect(() =>
      parseOfflineSessionRequest({
        clientSessionId: "client-1",
        username: "student01",
        startedAt: "not-a-date",
        endedAt: "2026-08-19T10:00:00Z",
        usedSeconds: 10,
        status: "logged_out",
      }),
    ).toThrow("OFFLINE_SESSION_INVALID");
  });

  it("normalizes extension check and confirmation bodies", () => {
    expect(parseExtensionCheckRequest({ sessionId: " s-1 " })).toEqual({ sessionId: "s-1" });
    expect(parseExtensionConfirmRequest({
      sessionId: " s-1 ",
      idempotencyKey: " request-1 ",
    })).toEqual({ sessionId: "s-1", idempotencyKey: "request-1" });
  });

  it("rejects an extension confirmation without idempotency", () => {
    expect(() => parseExtensionConfirmRequest({ sessionId: "s-1" }))
      .toThrow("EXTENSION_CONFIRM_INVALID");
  });
});

describe("offline account payload", () => {
  it("contains a verifier and expiry without exposing the Sheet password", () => {
    const result = buildOfflineAccount(
      {
        id: "account-1",
        username: "student01",
        allowedMinutes: 60,
        isActive: true,
        passwordAlgorithm: "pbkdf2-sha256",
        passwordIterations: 600_000,
        passwordSalt: "salt",
        passwordHash: "hash",
      },
      new Date("2026-08-19T10:00:00.000Z"),
    );

    expect(result).toEqual({
      id: "account-1",
      username: "student01",
      allowedMinutes: 60,
      isActive: true,
      verifier: {
        algorithm: "pbkdf2-sha256",
        iterations: 600_000,
        salt: "salt",
        hash: "hash",
      },
      issuedAt: "2026-08-19T10:00:00.000Z",
      expiresAt: "2026-08-20T10:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("Password");
  });
});

describe("TimeLock booking window errors", () => {
  it.each(["BOOKING_NOT_STARTED", "BOOKING_EXPIRED", "BOOKING_PREVIOUS_NOT_STARTED", "BOOKING_CROSSES_MIDNIGHT"])(
    "returns a conflict response for %s without internal details",
    async (code) => {
      const response = timelockErrorResponse(new Error(code), "LOGIN_FAILED");
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ ok: false, code });
    },
  );
});
