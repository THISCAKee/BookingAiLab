const TABS = {
  settings: 'Settings',
  machines: 'Machines',
  bookings: 'Bookings',
  users: 'Users',
  identities: 'Identities',
  events: 'Events',
  audit: 'AuditLog',
  loginLocks: 'LoginLocks',
};

const SHEET_HEADERS = {
  Settings: ['Key', 'Value', 'UpdatedAt'],
  Machines: ['machineId', 'machineCode', 'machineName', 'location', 'status', 'deviceTokenHash', 'lastSeenAt', 'updatedAt'],
  Bookings: ['bookingId', 'bookingNumber', 'email', 'name', 'hd', 'emailPrefix', 'machineId', 'machineCode', 'startAt', 'endAt', 'status', 'manageCodeHash', 'createdAt', 'updatedAt', 'idempotencyKey', 'extensionCount'],
  Users: ['userId', 'email', 'name', 'emailPrefix', 'username', 'role', 'machineCode', 'passwordAlgorithm', 'passwordIterations', 'passwordSalt', 'passwordHash', 'allowedMinutes', 'isActive', 'sourceBookingId', 'updatedAt'],
  Identities: ['identityId', 'email', 'name', 'hd', 'emailPrefix', 'lastLoginAt', 'updatedAt'],
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
    ['serviceWeekdays', '1,2,3,4,5,6,7', now],
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
    if (body.operation === 'extend_booking') return json_(extendBooking_(body));
    return json_({ ok: false, code: 'BOOKING_OPERATION_INVALID' });
  } catch (error) {
    return json_({ ok: false, code: error.message || 'BOOKING_ATOMIC_FAILED' });
  } finally {
    lock.releaseLock();
  }
}

function createBooking_(body, currentTime) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TABS.bookings);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(String);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const manageCode = String(body.payload.manageCode || '').toUpperCase();
  if (!/^[A-Z0-9_-]{12}$/.test(manageCode)) throw new Error('BOOKING_INPUT_INVALID');
  const duplicate = rows.find(row => String(row[index.idempotencyKey] || '') === String(body.idempotencyKey));
  if (duplicate) {
    if (String(duplicate[index.manageCodeHash]) !== hash_(manageCode)) throw new Error('BOOKING_IDEMPOTENCY_CONFLICT');
    return { ok: true, data: Object.assign(rowObject_(headers, duplicate), { manageCode: manageCode }) };
  }
  const machine = machine_(body.payload.machineId);
  if (!machine || machine.status !== 'available') throw new Error('BOOKING_MACHINE_UNAVAILABLE');
  const current = currentTime || new Date();
  const effective = rows.filter(row => effectiveBooking_(row, index, current));
  const activeForCustomer = effective.some(row => String(row[index.email]).toLowerCase() === String(body.payload.email).toLowerCase());
  if (activeForCustomer) throw new Error('BOOKING_ALREADY_ACTIVE');
  const machineQueue = effective.filter(row => String(row[index.machineId]) === String(body.payload.machineId));
  const latestEnd = machineQueue.reduce((latest, row) => Math.max(latest, new Date(row[index.endAt]).getTime()), -Infinity);
  const start = machineQueue.length === 0 ? new Date(current.getTime()) : new Date(latestEnd + 15 * 60 * 1000);
  const end = new Date(start.getTime() + 180 * 60 * 1000);
  if (bangkokDate_(start) !== bangkokDate_(current)) throw new Error('BOOKING_DATE_NOT_ALLOWED');
  if (end.getTime() > nextBangkokMidnight_(start).getTime()) throw new Error('BOOKING_CROSSES_MIDNIGHT');
  const now = current.toISOString();
  const bookingId = Utilities.getUuid();
  const bookingNumber = 'BK-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + bookingId.slice(0, 6).toUpperCase();
  const bookingValues = {
    bookingId: bookingId,
    bookingNumber: bookingNumber,
    email: body.payload.email,
    name: body.payload.name,
    hd: body.payload.hd,
    emailPrefix: body.payload.emailPrefix,
    machineId: body.payload.machineId,
    machineCode: machine.machineCode,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    status: 'confirmed',
    manageCodeHash: hash_(manageCode),
    createdAt: now,
    updatedAt: now,
    idempotencyKey: body.idempotencyKey,
    extensionCount: 0,
  };
  const row = headers.map(header => bookingValues[header] === undefined ? '' : bookingValues[header]);
  sheet.appendRow(row);
  body.payload.account.allowedMinutes = 180;
  upsertUser_(body.payload, bookingId, machine.machineCode, now);
  const eventSheet = SpreadsheetApp.getActive().getSheetByName(TABS.events);
  const eventHeaders = eventSheet.getDataRange().getValues().shift().map(String);
  appendMappedRow_(eventSheet, eventHeaders, {
    eventId: Utilities.getUuid(),
    eventType: 'booking_confirmed',
    sessionId: 'booking:' + bookingId,
    bookingId: bookingId,
    machineCode: machine.machineCode,
    username: body.payload.account.username,
    status: 'confirmed',
    payload: JSON.stringify({
      bookingNumber: bookingNumber,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allowedMinutes: 180,
    }),
    createdAt: now,
    updatedAt: now,
  });
  appendAudit_({
    actorEmail: body.payload.email,
    action: 'booking_confirmed',
    entityType: 'booking',
    entityId: bookingId,
    metadata: JSON.stringify({
      bookingNumber: bookingNumber,
      machineCode: machine.machineCode,
      username: body.payload.account.username,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allowedMinutes: 180,
    }),
    createdAt: now,
  });
  return { ok: true, data: Object.assign(rowObject_(headers, row), { manageCode: manageCode }) };
}

function extendBooking_(body, currentTime) {
  const spreadsheet = SpreadsheetApp.getActive();
  const bookingSheet = spreadsheet.getSheetByName(TABS.bookings);
  const userSheet = spreadsheet.getSheetByName(TABS.users);
  const eventSheet = spreadsheet.getSheetByName(TABS.events);
  const bookingValues = bookingSheet.getDataRange().getValues();
  const userValues = userSheet.getDataRange().getValues();
  const eventValues = eventSheet.getDataRange().getValues();
  const bookingHeaders = bookingValues.shift().map(String);
  const userHeaders = userValues.shift().map(String);
  const eventHeaders = eventValues.shift().map(String);
  const bookingIndex = headerIndex_(bookingHeaders);
  const userIndex = headerIndex_(userHeaders);
  const eventIndex = headerIndex_(eventHeaders);
  const idempotencyKey = String(body.idempotencyKey || '');
  if (!idempotencyKey) throw new Error('EXTENSION_CONFIRM_INVALID');

  const duplicate = eventValues.find(row => {
    if (String(row[eventIndex.eventType]) !== 'booking_extended') return false;
    try { return JSON.parse(String(row[eventIndex.payload] || '{}')).idempotencyKey === idempotencyKey; }
    catch (_) { return false; }
  });
  if (duplicate) {
    const stored = JSON.parse(String(duplicate[eventIndex.payload]));
    return { ok: true, data: stored.result };
  }

  const payload = body.payload || {};
  const sessionId = String(payload.sessionId || '');
  const bookingId = String(payload.bookingId || '');
  const machineCode = String(payload.machineCode || '').toUpperCase();
  const username = String(payload.username || '').toLowerCase();
  if (!sessionId || !bookingId || !machineCode || !username) throw new Error('EXTENSION_CONFIRM_INVALID');

  const startedPosition = findLastIndex_(eventValues, row => String(row[eventIndex.sessionId]) === sessionId && String(row[eventIndex.eventType]) === 'session_started');
  if (startedPosition < 0) throw new Error('SESSION_NOT_FOUND');
  const started = eventValues[startedPosition];
  const ended = eventValues.some((row, position) => position > startedPosition && String(row[eventIndex.sessionId]) === sessionId && String(row[eventIndex.eventType]) === 'session_ended');
  if (ended) throw new Error('SESSION_NOT_FOUND');
  if (String(started[eventIndex.bookingId]) !== bookingId || String(started[eventIndex.machineCode]).toUpperCase() !== machineCode || String(started[eventIndex.username]).toLowerCase() !== username) {
    throw new Error('EXTENSION_ACCOUNT_MISMATCH');
  }

  const bookingPosition = bookingValues.findIndex(row => String(row[bookingIndex.bookingId]) === bookingId);
  if (bookingPosition < 0) throw new Error('EXTENSION_BOOKING_INACTIVE');
  const booking = bookingValues[bookingPosition];
  if (!active_(String(booking[bookingIndex.status])) || String(booking[bookingIndex.machineCode]).toUpperCase() !== machineCode || String(booking[bookingIndex.emailPrefix]).toLowerCase() !== username) {
    throw new Error('EXTENSION_BOOKING_INACTIVE');
  }

  const nowDate = currentTime || new Date();
  const currentEnd = new Date(booking[bookingIndex.endAt]);
  if (isNaN(currentEnd.getTime()) || bangkokDate_(currentEnd) !== bangkokDate_(nowDate)) throw new Error('EXTENSION_BOOKING_INACTIVE');
  const extensionCount = Number(booking[bookingIndex.extensionCount]);
  if (!Number.isInteger(extensionCount) || extensionCount < 0 || extensionCount >= 2) throw new Error('EXTENSION_LIMIT_REACHED');
  const proposedEnd = new Date(currentEnd.getTime() + 180 * 60 * 1000);
  if (proposedEnd.getTime() > nextBangkokMidnight_(currentEnd).getTime()) throw new Error('EXTENSION_CROSSES_MIDNIGHT');

  const conflict = bookingValues.some(row => {
    if (String(row[bookingIndex.bookingId]) === bookingId || !active_(String(row[bookingIndex.status]))) return false;
    if (String(row[bookingIndex.machineCode]).toUpperCase() !== machineCode) return false;
    return new Date(row[bookingIndex.startAt]).getTime() < proposedEnd.getTime() && currentEnd.getTime() < new Date(row[bookingIndex.endAt]).getTime();
  });
  if (conflict) throw new Error('EXTENSION_NEXT_BOOKING_CONFLICT');

  const userPosition = userValues.findIndex(row => String(row[userIndex.sourceBookingId]) === bookingId && String(row[userIndex.machineCode]).toUpperCase() === machineCode && String(row[userIndex.username]).toLowerCase() === username && String(row[userIndex.isActive]).toLowerCase() === 'true');
  if (userPosition < 0) throw new Error('EXTENSION_ACCOUNT_MISMATCH');
  const nextExtensionCount = extensionCount + 1;
  const allowedMinutes = 180;
  const updatedAt = nowDate.toISOString();
  booking[bookingIndex.endAt] = proposedEnd.toISOString();
  booking[bookingIndex.extensionCount] = nextExtensionCount;
  booking[bookingIndex.updatedAt] = updatedAt;
  const user = userValues[userPosition];
  user[userIndex.allowedMinutes] = allowedMinutes;
  user[userIndex.updatedAt] = updatedAt;
  bookingSheet.getRange(bookingPosition + 2, 1, 1, bookingHeaders.length).setValues([booking]);
  userSheet.getRange(userPosition + 2, 1, 1, userHeaders.length).setValues([user]);

  const result = { bookingId: bookingId, endAt: proposedEnd.toISOString(), extensionCount: nextExtensionCount, allowedMinutes: allowedMinutes };
  appendMappedRow_(eventSheet, eventHeaders, {
    eventId: Utilities.getUuid(), eventType: 'booking_extended', sessionId: sessionId,
    bookingId: bookingId, machineCode: machineCode, username: username, status: 'confirmed',
    payload: JSON.stringify({ idempotencyKey: idempotencyKey, result: result }), createdAt: updatedAt, updatedAt: updatedAt,
  });
  appendAudit_({ actorEmail: username + '@msu.ac.th', action: 'booking_extended', entityType: 'booking', entityId: bookingId, metadata: JSON.stringify(result), createdAt: updatedAt });
  return { ok: true, data: result };
}

function installDailyCleanupTrigger(currentTime) {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyCleanupTick_') ScriptApp.deleteTrigger(trigger);
  });
  const now = currentTime || new Date();
  PropertiesService.getScriptProperties().setProperty('LAST_DAILY_CLEANUP_DATE', bangkokDate_(now));
  ScriptApp.newTrigger('dailyCleanupTick_').timeBased().everyMinutes(1).create();
  return { installed: true, date: bangkokDate_(now) };
}

function dailyCleanupTick_(currentTime) {
  const now = currentTime || new Date();
  const today = bangkokDate_(now);
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('LAST_DAILY_CLEANUP_DATE') === today) return { bookingsDeleted: 0, usersDeleted: 0 };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (properties.getProperty('LAST_DAILY_CLEANUP_DATE') === today) return { bookingsDeleted: 0, usersDeleted: 0 };
    const spreadsheet = SpreadsheetApp.getActive();
    const bookingSheet = spreadsheet.getSheetByName(TABS.bookings);
    const userSheet = spreadsheet.getSheetByName(TABS.users);
    const bookingsDeleted = Math.max(0, bookingSheet.getLastRow() - 1);
    const usersDeleted = Math.max(0, userSheet.getLastRow() - 1);
    if (bookingsDeleted > 0) bookingSheet.deleteRows(2, bookingsDeleted);
    if (usersDeleted > 0) userSheet.deleteRows(2, usersDeleted);
    const completedAt = now.toISOString();
    if (bookingsDeleted > 0 || usersDeleted > 0) {
      appendAudit_({
        actorEmail: 'system', action: 'daily_cleanup', entityType: 'spreadsheet', entityId: today,
        metadata: JSON.stringify({ bookingsDeleted: bookingsDeleted, usersDeleted: usersDeleted }), createdAt: completedAt,
      });
    }
    properties.setProperty('LAST_DAILY_CLEANUP_DATE', today);
    return { bookingsDeleted: bookingsDeleted, usersDeleted: usersDeleted };
  } finally {
    lock.releaseLock();
  }
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
function effectiveBooking_(row, index, now) {
  const end = new Date(row[index.endAt]);
  return active_(String(row[index.status] || '')) && !isNaN(end.getTime()) && end.getTime() > now.getTime();
}
function bangkokDate_(date) { return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function nextBangkokMidnight_(date) { return new Date(new Date(bangkokDate_(date) + 'T00:00:00+07:00').getTime() + 24 * 60 * 60 * 1000); }
function headerIndex_(headers) { return Object.fromEntries(headers.map((header, position) => [header, position])); }
function findLastIndex_(rows, predicate) { for (let index = rows.length - 1; index >= 0; index -= 1) if (predicate(rows[index], index)) return index; return -1; }
function appendMappedRow_(sheet, headers, values) { sheet.appendRow(headers.map(header => values[header] === undefined ? '' : values[header])); }
function appendAudit_(values) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TABS.audit);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(String);
  appendMappedRow_(sheet, headers, Object.assign({ auditId: Utilities.getUuid() }, values));
}
function hash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(function(byte) { return ('0' + (byte & 0xFF).toString(16)).slice(-2); }).join(''); }
function randomCode_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase(); }
function machine_(machineId) {
  const rows = SpreadsheetApp.getActive().getSheetByName('Machines').getDataRange().getValues();
  const headers = rows.shift().map(String);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const row = rows.find(item => String(item[index.machineId]) === String(machineId));
  return row ? { machineCode: String(row[index.machineCode]), status: String(row[index.status]) } : null;
}
function rowObject_(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}
