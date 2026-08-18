import { describe, expect, it } from "vitest";
import { validateMachineStatus } from "@/lib/machines/administration";

describe("machine administration", () => {
  it("accepts only persisted machine status values", () => {
    expect(validateMachineStatus("available")).toBe("available");
    expect(validateMachineStatus("maintenance")).toBe("maintenance");
    expect(validateMachineStatus("disabled")).toBe("disabled");
    expect(validateMachineStatus("deleted")).toBeNull();
  });
});
