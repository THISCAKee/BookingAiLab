const TABS = {
  settings: 'Settings',
  machines: 'Machines',
  bookings: 'Bookings',
  users: 'Users',
  events: 'Events',
  audit: 'AuditLog',
  loginLocks: 'LoginLocks',
};

const SHEET_HEADERS = {
  Settings: ['Key', 'Value', 'UpdatedAt'],
  Machines: ['machineId', 'machineCode', 'machineName', 'location', 'status', 'deviceTokenHash', 'lastSeenAt', 'updatedAt'],
  Bookings: ['bookingId', 'bookingNumber', 'email', 'name', 'hd', 'emailPrefix', 'machineId', 'machineCode', 'startAt', 'endAt', 'status', 'manageCodeHash', 'createdAt', 'updatedAt', 'idempotencyKey'],
  Users: ['userId', 'email', 'name', 'emailPrefix', 'username', 'role', 'machineCode', 'passwordAlgorithm', 'passwordIterations', 'passwordSalt', 'passwordHash', 'allowedMinutes', 'isActive', 'sourceBookingId', 'updatedAt'],
  Events: ['eventId', 'eventType', 'sessionId', 'bookingId', 'machineCode', 'username', 'status', 'payload', 'createdAt', 'updatedAt'],
  AuditLog: ['auditId', 'actorEmail', 'action', 'entityType', 'entityId', 'metadata', 'createdAt'],
  LoginLocks: ['username', 'failedCount', 'lockedUntil', 'lastFailedAt', 'updatedAt'],
};

function initializeSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActive();
  const requiredTabs = Object.keys(SHEET_HEADERS);
  const existing = requiredTabs.map(name => spreadsheet.getSheetByName(name)).filter(Boolean);
  const hasData = existing.some(sheet => {
    const values = sheet.getDataRange().getDisplayValues();
    return values.some(row => row.some(value => String(value).trim() !== ''));
  });
  if (hasData) throw new Error('INITIALIZE_REQUIRES_BLANK_SPREADSHEET');

  spreadsheet.setSpreadsheetTimeZone('Asia/Bangkok');
  requiredTabs.forEach(name => {
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    sheet.clear();
    const headers = SHEET_HEADERS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dbeafe');
    sheet.setFrozenRows(1);
  });

  const now = new Date().toISOString();
  const settings = [
    ['serviceWeekdays', '1,2,3,4,5', now],
    ['openingTime', '08:30', now],
    ['closingTime', '16:30', now],
    ['durationMinutes', '180', now],
    ['graceMinutes', '15', now],
    ['timezone', 'Asia/Bangkok', now],
  ];
  spreadsheet.getSheetByName(TABS.settings).getRange(2, 1, settings.length, settings[0].length).setValues(settings);

  const machines = Array.from({ length: 6 }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');
    return [Utilities.getUuid(), `PC-${number}`, `Workstation ${index + 1}`, 'AI Lab', 'available', '', '', now];
  });
  spreadsheet.getSheetByName(TABS.machines).getRange(2, 1, machines.length, machines[0].length).setValues(machines);
  spreadsheet.getSheets().forEach(sheet => sheet.autoResizeColumns(1, sheet.getLastColumn()));

  return { spreadsheetId: spreadsheet.getId(), spreadsheetUrl: spreadsheet.getUrl(), tabs: requiredTabs };
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  if (body.secret !== PropertiesService.getScriptProperties().getProperty('ATOMIC_MUTATION_SECRET')) {
    return json_({ ok: false, code: 'BOOKING_ATOMIC_UNAUTHORIZED' });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, code: 'BOOKING_ATOMIC_BUSY' });
  try {
    if (body.operation === 'create_booking') return json_(createBooking_(body));
    if (body.operation === 'cancel_booking') return json_(cancelBooking_(body));
    return json_({ ok: false, code: 'BOOKING_OPERATION_INVALID' });
  } catch (error) {
    return json_({ ok: false, code: error.message || 'BOOKING_ATOMIC_FAILED' });
  } finally {
    lock.releaseLock();
  }
}

function createBooking_(body) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TABS.bookings);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(String);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const settings = settings_();
  const machine = machine_(body.payload.machineId);
  if (!machine || machine.status !== 'available') throw new Error('BOOKING_MACHINE_UNAVAILABLE');
  const start = new Date(body.payload.startAt);
  const end = new Date(body.payload.endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) throw new Error('BOOKING_TIME_INVALID');
  if (!inSchedule_(start, end, settings)) throw new Error('BOOKING_OUTSIDE_SCHEDULE');
  const duplicate = rows.find(row => String(row[index.idempotencyKey] || '') === String(body.idempotencyKey));
  if (duplicate) return { ok: true, data: rowObject_(headers, duplicate) };
  for (const row of rows) {
    if (!active_(String(row[index.status] || ''))) continue;
    const rowStart = new Date(row[index.startAt]);
    const rowEnd = new Date(row[index.endAt]);
    if (rowStart < end && start < rowEnd) {
      if (String(row[index.machineId]) === body.payload.machineId) throw new Error('BOOKING_MACHINE_OVERLAP');
      if (String(row[index.email]).toLowerCase() === String(body.payload.email).toLowerCase()) throw new Error('BOOKING_CUSTOMER_OVERLAP');
    }
  }
  const now = new Date().toISOString();
  const bookingId = Utilities.getUuid();
  const bookingNumber = 'BK-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + bookingId.slice(0, 6).toUpperCase();
  const manageCode = randomCode_();
  const row = headers.map(header => ({
    bookingId: bookingId,
    bookingNumber: bookingNumber,
    email: body.payload.email,
    name: body.payload.name,
    hd: body.payload.hd,
    emailPrefix: body.payload.emailPrefix,
    machineId: body.payload.machineId,
    machineCode: machine.machineCode,
    startAt: body.payload.startAt,
    endAt: body.payload.endAt,
    status: 'confirmed',
    manageCodeHash: hash_(manageCode),
    createdAt: now,
    updatedAt: now,
    idempotencyKey: body.idempotencyKey,
  }[header] || ''));
  sheet.appendRow(row);
  upsertUser_(body.payload, bookingId, machine.machineCode, now);
  return { ok: true, data: Object.assign(rowObject_(headers, row), { manageCode: manageCode }) };
}

function cancelBooking_(body) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TABS.bookings);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(String);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const rowNumber = rows.findIndex(row => String(row[index.bookingNumber]) === String(body.payload.bookingNumber));
  if (rowNumber < 0) throw new Error('BOOKING_NOT_FOUND');
  const row = rows[rowNumber];
  if (String(row[index.manageCodeHash]) !== hash_(String(body.payload.manageCode))) throw new Error('BOOKING_ACCESS_DENIED');
  if (String(row[index.email]).toLowerCase() !== String(body.payload.email).toLowerCase()) throw new Error('BOOKING_ACCESS_DENIED');
  if (!active_(String(row[index.status] || ''))) throw new Error('BOOKING_CANCELLATION_NOT_ALLOWED');
  row[index.status] = 'cancelled';
  row[index.updatedAt] = new Date().toISOString();
  sheet.getRange(rowNumber + 2, 1, 1, headers.length).setValues([row]);
  deactivateBookingUser_(String(row[index.bookingId]));
  return { ok: true };
}

function upsertUser_(payload, bookingId, machineCode, now) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TABS.users);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(String);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const existingIndex = rows.findIndex(row => String(row[index.emailPrefix] || '').toLowerCase() === String(payload.emailPrefix).toLowerCase());
  const current = existingIndex >= 0 ? rows[existingIndex] : [];
  const values = {
    userId: current[index.userId] || Utilities.getUuid(),
    email: payload.email,
    name: payload.name,
    emailPrefix: payload.emailPrefix,
    username: payload.account.username,
    role: 'user',
    machineCode: machineCode,
    passwordAlgorithm: payload.account.passwordAlgorithm,
    passwordIterations: payload.account.passwordIterations,
    passwordSalt: payload.account.passwordSalt,
    passwordHash: payload.account.passwordHash,
    allowedMinutes: payload.account.allowedMinutes,
    isActive: true,
    sourceBookingId: bookingId,
    updatedAt: now,
  };
  const row = headers.map(header => values[header] === undefined ? '' : values[header]);
  if (existingIndex >= 0) sheet.getRange(existingIndex + 2, 1, 1, headers.length).setValues([row]);
  else sheet.appendRow(row);
}

function deactivateBookingUser_(bookingId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TABS.users);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(String);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const rowIndex = rows.findIndex(row => String(row[index.sourceBookingId]) === bookingId);
  if (rowIndex < 0) return;
  rows[rowIndex][index.isActive] = false;
  rows[rowIndex][index.updatedAt] = new Date().toISOString();
  sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([rows[rowIndex]]);
}

function active_(status) { return ['cancelled', 'expired', 'completed'].indexOf(status) < 0; }
function hash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(function(byte) { return ('0' + (byte & 0xFF).toString(16)).slice(-2); }).join(''); }
function randomCode_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase(); }
function settings_() {
  const rows = SpreadsheetApp.getActive().getSheetByName('Settings').getDataRange().getValues();
  const result = {};
  rows.slice(1).forEach(row => result[String(row[0])] = String(row[1]));
  return { weekdays: result.serviceWeekdays.split(',').map(Number), opening: result.openingTime, closing: result.closingTime, timezone: result.timezone };
}
function machine_(machineId) {
  const rows = SpreadsheetApp.getActive().getSheetByName('Machines').getDataRange().getValues();
  const headers = rows.shift().map(String);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const row = rows.find(item => String(item[index.machineId]) === String(machineId));
  return row ? { machineCode: String(row[index.machineCode]), status: String(row[index.status]) } : null;
}
function inSchedule_(start, end, settings) {
  const localStart = Utilities.formatDate(start, settings.timezone, 'u HH:mm');
  const localEnd = Utilities.formatDate(end, settings.timezone, 'u HH:mm');
  const startParts = localStart.split(' '); const endParts = localEnd.split(' ');
  if (startParts[0] !== endParts[0] || settings.weekdays.indexOf(Number(startParts[0])) < 0) return false;
  return startParts[1] >= settings.opening && endParts[1] <= settings.closing;
}

function rowObject_(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}
