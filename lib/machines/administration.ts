export const machineStatuses = ["inactive", "available", "maintenance", "disabled"] as const;
export type MachineStatus = (typeof machineStatuses)[number];

export function validateMachineStatus(value: unknown): MachineStatus | null {
  return typeof value === "string" && machineStatuses.includes(value as MachineStatus)
    ? (value as MachineStatus)
    : null;
}
