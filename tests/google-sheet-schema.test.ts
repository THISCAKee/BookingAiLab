import { describe, expect, it } from "vitest";
import {
  BOOKING_HEADERS,
  MACHINE_HEADERS,
  parseBookings,
  parseMachines,
} from "@/lib/google/sheet-schema";

describe("Google Sheet schema", () => {
  it("parses machine rows and preserves source row numbers", () => {
    const rows = [
      MACHINE_HEADERS,
      ["m-1", "PC-001", "Lab 1", "A", "available", "hash", "", "2026-08-21T00:00:00.000Z"],
    ];

    expect(parseMachines(rows)).toEqual([
      {
        sourceRow: 2,
        machineId: "m-1",
        machineCode: "PC-001",
        machineName: "Lab 1",
        location: "A",
        status: "available",
        deviceTokenHash: "hash",
        lastSeenAt: null,
        updatedAt: "2026-08-21T00:00:00.000Z",
      },
    ]);
  });

  it("rejects missing headers and invalid booking rows", () => {
    expect(() => parseMachines([["bad"]])).toThrow("SHEET_HEADER_INVALID:Machines");
    expect(() =>
      parseBookings([
        BOOKING_HEADERS,
        ["b-1", "BK-1", "student@msu.ac.th", "Student", "msu.ac.th", "student", "m-1", "PC-001", "bad", "", "confirmed", "hash", "", "", "request-1"],
      ]),
    ).toThrow("SHEET_BOOKING_INVALID:2");
  });
});
