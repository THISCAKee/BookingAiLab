import { describe, expect, it, vi } from "vitest";
import {
  loginTimelockUser,
  logoutTimelockUser,
  type SheetDeviceContext,
} from "@/lib/timelock/sheet-gateway";
import { TIMELOCK_EVENT_HEADERS, TIMELOCK_USER_HEADERS } from "@/lib/timelock/sheet-records";
import { createPasswordVerifier } from "@/lib/timelock/passwords";

const device: SheetDeviceContext = { id: "m-1", machineCode: "PC-001" };

describe("TimeLock Sheet gateway sessions", () => {
  it("appends a session_started event after verifying login", async () => {
    const verifier = await createPasswordVerifier("secret-password");
    const sheets = {
      readSheet: vi.fn().mockResolvedValue([
        TIMELOCK_USER_HEADERS,
        [
          "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
          verifier.algorithm, String(verifier.iterations), verifier.salt, verifier.hash,
          "180", "TRUE", "b-1", "2026-08-24T00:00:00.000Z",
        ],
      ]),
      appendSheetRow: vi.fn().mockResolvedValue(undefined),
    };
    const ids = ["s-1", "e-1"];

    await expect(loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, {
      sheets,
      now: () => new Date("2026-08-24T01:30:00.000Z"),
      randomId: () => ids.shift() ?? "unexpected",
    })).resolves.toEqual({
      sessionId: "s-1",
      username: "student",
      machineCode: "PC-001",
      startedAt: "2026-08-24T01:30:00.000Z",
      status: "active",
    });

    expect(sheets.appendSheetRow).toHaveBeenCalledWith("Events", [
      "e-1", "session_started", "s-1", "b-1", "PC-001", "student", "active", "{}",
      "2026-08-24T01:30:00.000Z", "2026-08-24T01:30:00.000Z",
    ]);
  });

  it("appends session_ended for a session started on the same machine", async () => {
    const sheets = {
      readSheet: vi.fn().mockResolvedValue([
        TIMELOCK_EVENT_HEADERS,
        [
          "e-1", "session_started", "s-1", "b-1", "PC-001", "student", "active", "{}",
          "2026-08-24T01:30:00.000Z", "2026-08-24T01:30:00.000Z",
        ],
      ]),
      appendSheetRow: vi.fn().mockResolvedValue(undefined),
    };

    await expect(logoutTimelockUser(device, {
      sessionId: "s-1",
      usedSeconds: 10_800,
      status: "completed",
    }, {
      sheets,
      now: () => new Date("2026-08-24T04:30:00.000Z"),
      randomId: () => "e-2",
    })).resolves.toEqual({
      sessionId: "s-1",
      machineCode: "PC-001",
      usedSeconds: 10_800,
      status: "completed",
      endedAt: "2026-08-24T04:30:00.000Z",
    });

    expect(sheets.appendSheetRow).toHaveBeenCalledWith("Events", [
      "e-2", "session_ended", "s-1", "b-1", "PC-001", "student", "completed",
      JSON.stringify({ usedSeconds: 10_800 }),
      "2026-08-24T04:30:00.000Z", "2026-08-24T04:30:00.000Z",
    ]);
  });
});
