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
  const duplicate = rows.find(row => String(row[index.idempotencyKey] || '') === String(body.idempotencyKey));
  if (duplicate) return { ok: true, data: rowObject_(headers, duplicate) };
  // The Next.js policy is re-run by the production script using the same Settings/Machines rows.
  // This lock keeps the read/check/append sequence atomic across concurrent requests.
  const now = new Date().toISOString();
  const bookingId = Utilities.getUuid();
  const bookingNumber = 'BK-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const row = headers.map(header => ({
    bookingId: bookingId,
    bookingNumber: bookingNumber,
    email: body.payload.email,
    name: body.payload.name,
    hd: body.payload.hd,
    emailPrefix: body.payload.emailPrefix,
    machineId: body.payload.machineId,
    startAt: body.payload.startAt,
    status: 'confirmed',
    createdAt: now,
    updatedAt: now,
    idempotencyKey: body.idempotencyKey,
  }[header] || ''));
  sheet.appendRow(row);
  return { ok: true, data: rowObject_(headers, row) };
}

function cancelBooking_(body) {
  return { ok: false, code: 'BOOKING_CANCEL_NOT_IMPLEMENTED' };
}

function rowObject_(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}
