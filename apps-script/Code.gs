/**
 * Vetted — saves coach applications and client requests from the website into this Google Sheet.
 * Each goes to its own tab: "Applications" and "Client Requests".
 *
 * Setup (one time):
 *   1. Open the "Vetted Sign-ups" Google Sheet.
 *   2. Extensions → Apps Script. Delete what's there and paste this whole file. Click Save.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as: Me
 *        Who has access: Anyone
 *      Click Deploy, approve the permissions, and copy the Web app URL.
 *   4. Paste that URL into assets/config.js as formEndpoint.
 */

var COACH_COLUMNS = [
  ['submittedAt', 'Submitted at'],
  ['status', 'Status'],
  ['name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['instagram', 'Instagram'],
  ['gender', 'Gender'],
  ['disciplines', 'Disciplines'],
  ['levels', 'Client levels'],
  ['years', 'Years coaching'],
  ['cpr', 'CPR / First Aid'],
  ['certs', 'Certifications'],
  ['background', 'Background'],
  ['locations', 'Locations'],
  ['areas', 'Areas covered'],
  ['radius', 'Max travel'],
  ['formats', 'Formats'],
  ['availability', 'Availability'],
  ['rate', 'Rate (1-on-1 hour)'],
  ['insurance', 'Insurance'],
  ['gear', 'Equipment'],
  ['heard', 'Heard about us'],
  ['consent', 'Screening consent'],
  // Filled in by you during vetting:
  ['callDone', 'Intro call done'],
  ['bgCheck', 'Background check'],
  ['certsVerified', 'Certs verified'],
  ['insVerified', 'Insurance verified'],
  ['trialDone', 'Trial session'],
  ['notes', 'Notes']
];

var CLIENT_COLUMNS = [
  ['submittedAt', 'Submitted at'],
  ['status', 'Status'],
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['textOk', 'Texting OK'],
  ['goal', 'Main goal'],
  ['train', 'Wants to train'],
  ['level', 'Experience'],
  ['zip', 'Zip code'],
  ['where', 'Where'],
  ['format', 'Format'],
  ['availability', 'Availability'],
  ['often', 'How often'],
  ['coachPref', 'Coach preference'],
  ['injuries', 'Injuries / notes'],
  ['heard', 'Heard about us'],
  // Filled in by you:
  ['matchedCoach', 'Matched coach'],
  ['paid', 'Paid'],
  ['package', 'Package'],
  ['sessionsLeft', 'Sessions left'],
  ['waiver', 'Waiver signed'],
  ['nextSession', 'Next session'],
  ['notes', 'Notes']
];

var FORMS = {
  coach_application: { sheet: 'Applications', columns: COACH_COLUMNS, required: ['name', 'email', 'phone'] },
  client_request: { sheet: 'Client Requests', columns: CLIENT_COLUMNS, required: ['name', 'phone', 'email', 'zip'] }
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var data = JSON.parse(e.postData.contents || '{}');

    // Spam trap: the website has a hidden field real people never fill in.
    if (data.website) return json({ ok: true });
    var form = FORMS[data.type];
    if (!form) return json({ ok: false, error: 'unknown form' });
    for (var i = 0; i < form.required.length; i++) {
      if (!data[form.required[i]]) return json({ ok: false, error: 'missing fields' });
    }

    data.submittedAt = new Date();
    data.status = 'New';

    var sheet = getSheet(form);
    var row = form.columns.map(function (c) {
      var v = data[c[0]];
      if (v === undefined || v === null) return '';
      v = String(v).slice(0, 2000);
      // Stop text that starts with = + - @ being run as a spreadsheet formula.
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    });
    row[0] = data.submittedAt;
    sheet.appendRow(row);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: 'Vetted sign-ups' });
}

function getSheet(form) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(form.sheet) || ss.insertSheet(form.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(form.columns.map(function (c) { return c[1]; }));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, form.columns.length).setFontWeight('bold');
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
