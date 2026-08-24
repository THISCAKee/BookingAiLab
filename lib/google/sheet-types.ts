export type MachineStatus = "inactive" | "available" | "maintenance" | "disabled";
export type BookingStatus =
  | "confirmed"
  | "app_pending"
  | "app_received"
  | "active"
  | "completed"
  | "cancelled"
  | "expired";

export type SheetMachine = {
  sourceRow: number;
  machineId: string;
  machineCode: string;
  machineName: string;
  location: string | null;
  status: MachineStatus;
  deviceTokenHash: string;
  lastSeenAt: string | null;
  updatedAt: string;
};

export type SheetBooking = {
  sourceRow: number;
  bookingId: string;
  bookingNumber: string;
  email: string;
  name: string;
  hd: "msu.ac.th";
  emailPrefix: string;
  machineId: string;
  machineCode: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  manageCodeHash: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
  extensionCount: number;
};

export type SheetSettings = {
  serviceWeekdays: number[];
  openingTime: string;
  closingTime: string;
  durationMinutes: number;
  graceMinutes: number;
  timezone: string;
};
