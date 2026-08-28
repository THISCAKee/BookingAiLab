import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireGoogleIdentity: vi.fn(),
  createSheetBooking: vi.fn(),
  createGoogleSheetsClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/identity", () => ({ requireGoogleIdentity: mocks.requireGoogleIdentity }));
vi.mock("@/lib/booking/sheet-repository", () => ({ createSheetBooking: mocks.createSheetBooking }));
vi.mock("@/lib/google/sheets-client", () => ({ createGoogleSheetsClient: mocks.createGoogleSheetsClient }));
vi.mock("@/lib/google/config", () => ({
  getGoogleRuntimeConfig: vi.fn(() => ({ spreadsheetId: "sheet-id" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/booking/schedule", () => ({
  getSelectableBookingDates: vi.fn(() => [{ value: "2026-08-26" }]),
}));

const { createImmediateBooking } = await import("@/lib/booking/actions");

describe("booking flow performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireGoogleIdentity.mockResolvedValue({
      email: "student@msu.ac.th",
      name: "Student",
      hd: "msu.ac.th",
      emailPrefix: "student",
    });
    mocks.createSheetBooking.mockResolvedValue({
      bookingId: "b-1",
      bookingNumber: "BK-1",
      manageCode: "MANAGE-1",
      timelockUsername: "student",
      timelockPassword: "password-1",
      machineCode: "PC-001",
      startAt: "2026-08-26T06:00:00.000Z",
      endAt: "2026-08-26T09:00:00.000Z",
      status: "confirmed",
    });
  });

  it("sends the booking directly to the atomic validator without a duplicate sheet read", async () => {
    const result = await createImmediateBooking({ machineId: "m-1" });

    expect(result.ok).toBe(true);
    expect(mocks.createGoogleSheetsClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    const request = mocks.createSheetBooking.mock.calls[0][0];
    expect(request).toEqual({ machineId: "m-1", idempotencyKey: expect.any(String) });
    expect(request).not.toHaveProperty("startAt");
    expect(request).not.toHaveProperty("endAt");
    expect(result.ok && result.data).toMatchObject({
      startAt: "2026-08-26T06:00:00.000Z",
      endAt: "2026-08-26T09:00:00.000Z",
    });
  });
});
