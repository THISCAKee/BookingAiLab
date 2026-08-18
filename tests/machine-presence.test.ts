import { describe, expect, it } from "vitest";
import {
  deriveMachineConnectionStatus,
  normalizeHeartbeatInput,
  type MachineHeartbeatInput,
} from "@/lib/machines/presence";
import { parseHeartbeatRequest } from "@/lib/machines/heartbeat";

describe("machine presence", () => {
  it("treats a recent heartbeat as online", () => {
    expect(
      deriveMachineConnectionStatus(
        "2026-08-18T10:00:00.000Z",
        new Date("2026-08-18T10:00:30.000Z"),
      ),
    ).toBe("online");
  });

  it("treats a heartbeat older than 45 seconds as stale", () => {
    expect(
      deriveMachineConnectionStatus(
        "2026-08-18T10:00:00.000Z",
        new Date("2026-08-18T10:00:46.000Z"),
      ),
    ).toBe("stale");
  });

  it("normalizes a valid heartbeat payload", () => {
    const input: MachineHeartbeatInput = {
      machineCode: " pc-001 ",
      username: "student01",
      sessionStatus: "logged_in",
      appVersion: "1.2.0",
      osVersion: "Windows 11",
      reportedAt: "2026-08-18T10:00:00+07:00",
    };

    expect(normalizeHeartbeatInput(input)).toEqual({
      machineCode: "PC-001",
      username: "student01",
      sessionStatus: "logged_in",
      appVersion: "1.2.0",
      osVersion: "Windows 11",
      reportedAt: "2026-08-18T03:00:00.000Z",
    });
  });

  it("rejects a heartbeat with an invalid session status", () => {
    expect(() =>
      normalizeHeartbeatInput({
        machineCode: "PC-001",
        username: "student01",
        sessionStatus: "unknown",
        appVersion: "1.0.0",
        osVersion: "Windows",
        reportedAt: "2026-08-18T03:00:00.000Z",
      }),
    ).toThrow("INVALID_HEARTBEAT");
  });

  it("clears username when the app reports logged out", () => {
    expect(
      normalizeHeartbeatInput({
        machineCode: "PC-001",
        username: " ",
        sessionStatus: "logged_out",
        appVersion: "1.0.0",
        osVersion: "Windows",
        reportedAt: "2026-08-18T03:00:00.000Z",
      }).username,
    ).toBeNull();
  });

  it("requires the device token from the request header", () => {
    expect(() => parseHeartbeatRequest({ machineCode: "PC-001" }, null)).toThrow(
      "MACHINE_TOKEN_INVALID",
    );
  });

  it("parses a heartbeat body and token separately", () => {
    expect(
      parseHeartbeatRequest(
        {
          machineCode: "PC-001",
          username: "student01",
          sessionStatus: "logged_in",
          appVersion: "1.0.0",
          osVersion: "Windows",
          reportedAt: "2026-08-18T03:00:00.000Z",
        },
        "device-secret",
      ),
    ).toEqual({
      deviceToken: "device-secret",
      heartbeat: {
        machineCode: "PC-001",
        username: "student01",
        sessionStatus: "logged_in",
        appVersion: "1.0.0",
        osVersion: "Windows",
        reportedAt: "2026-08-18T03:00:00.000Z",
      },
    });
  });
});
