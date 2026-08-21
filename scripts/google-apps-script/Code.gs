const TABS = {
  bookings: 'Bookings',
  audit: 'AuditLog',
};

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
  return { ok: true };
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
