/**
 * Vetted — runs inside the "Vetted Sign-ups" Google Sheet.
 *   - Saves coach applications and client requests from the website, each to its own tab:
 *     "Applications" and "Client Requests".
 *   - Emails you when a new one arrives.
 *   - Adds a "Vetted" menu: set up the sheet, and suggest coaches for a client.
 *
 * Setup (one time):
 *   1. Open the "Vetted Sign-ups" Google Sheet.
 *   2. Extensions → Apps Script. Delete what's there and paste this whole file. Click Save.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as: Me
 *        Who has access: Anyone
 *      Click Deploy, approve the permissions, and copy the Web app URL.
 *   4. Paste that URL into assets/config.js as formEndpoint.
 *
 * Updating this code later: paste the new version, Save, then
 *   Deploy → Manage deployments → pencil (Edit) → Version: New version → Deploy.
 * The web app URL stays the same.
 */

// Who gets an email for each new sign-up. Leave empty to email the Google account that owns this sheet.
// To add more people, separate addresses with commas.
var ALERT_EMAILS = '';

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
    lock.releaseLock();
    sendAlert(data);
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

/* ───────────────────────── Alerts ───────────────────────── */

function sendAlert(d) {
  try {
    var to = ALERT_EMAILS || Session.getEffectiveUser().getEmail();
    if (!to) return;
    var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    var subject, lines;
    if (d.type === 'client_request') {
      subject = 'New client request: ' + d.name + (d.zip ? ' (' + d.zip + ')' : '');
      lines = [
        'Name: ' + d.name,
        'Phone: ' + d.phone + (d.textOk === 'Yes' ? '  (OK to text)' : '  (no texts)'),
        'Email: ' + d.email,
        '',
        'Goal: ' + d.goal,
        'Wants to train: ' + d.train + ' · ' + d.level,
        'Where: ' + d.where + ' · zip ' + d.zip,
        'Format: ' + d.format,
        'When: ' + d.availability + ' · ' + d.often,
        'Coach preference: ' + d.coachPref,
        d.injuries ? 'Injuries / notes: ' + d.injuries : '',
        '',
        'Open the sheet, click their row on the Client Requests tab, then Vetted → Suggest coaches.'
      ];
    } else {
      subject = 'New coach application: ' + d.name;
      var opt = function (label, v) { return v ? label + ': ' + v : null; };
      lines = [
        'Name: ' + d.name,
        'Phone: ' + d.phone,
        'Email: ' + d.email,
        opt('Instagram', d.instagram),
        '',
        opt('Coaches', d.disciplines),
        opt('Trains at', d.locations),
        opt('Area', d.areas),
        opt('Certified', d.certs),
        opt('Gender', d.gender),
        '',
        'Text them to set up the intro call. When they pass screening, set their Status to Approved on the Applications tab.'
      ];
    }
    lines.push('', url);
    MailApp.sendEmail(to, subject, lines.filter(function (l) { return l !== null; }).join('\n'));
  } catch (err) {
    console.error('Alert email failed: ' + err);
  }
}

/* ───────────────────────── Menu & setup ───────────────────────── */

var COACH_STATUSES = ['New', 'Intro call', 'Screening', 'Approved', 'Not a fit'];
var CLIENT_STATUSES = ['New', 'Contacted', 'Matched', 'Active', 'Paused', 'Closed'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Vetted')
    .addItem('Suggest coaches for selected client', 'suggestCoaches')
    .addSeparator()
    .addItem('Set up sheet (tabs, dropdowns, roster)', 'setupSheet')
    .addItem('Send a test alert email', 'testAlert')
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var apps = getSheet(FORMS.coach_application);
  var clients = getSheet(FORMS.client_request);

  statusDropdown(apps, COACH_STATUSES);
  statusDropdown(clients, CLIENT_STATUSES);

  // Roster: every coach whose status is Approved, kept up to date by a formula.
  var roster = ss.getSheetByName('Coach Roster') || ss.insertSheet('Coach Roster');
  roster.clear();
  var cols = ['Name', 'Phone', 'Email', 'Gender', 'Disciplines', 'Client levels', 'Locations', 'Areas covered', 'Max travel', 'Formats', 'Availability', 'Rate (1-on-1 hour)'];
  roster.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  roster.setFrozenRows(1);
  var parts = cols.map(function (c) { return 'Applications!' + colLetter(apps, c) + '2:' + colLetter(apps, c); });
  roster.getRange('A2').setFormula(
    '=IFERROR(FILTER({' + parts.join(',') + '}, Applications!' + colLetter(apps, 'Status') + '2:' + colLetter(apps, 'Status') + '="Approved"), "No approved coaches yet. Set a coach\'s Status to Approved on the Applications tab.")'
  );

  // "Matched coach" on client requests: pick from approved coaches.
  var mc = headerIndex(clients)['Matched coach'];
  if (mc) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(roster.getRange('A2:A'), true).setAllowInvalid(true).build();
    clients.getRange(2, mc, clients.getMaxRows() - 1, 1).setDataValidation(rule);
  }

  // Remove the empty starter tab if it's still there.
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);

  SpreadsheetApp.getUi().alert('Vetted is set up.\n\nApprove a coach by setting their Status to "Approved" on the Applications tab. They then appear on the Coach Roster tab and in coach suggestions.');
}

function statusDropdown(sheet, values) {
  var col = headerIndex(sheet)['Status'];
  if (!col) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(true).build();
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}

function testAlert() {
  sendAlert({ type: 'client_request', name: 'Test alert', phone: '(000) 000-0000', textOk: 'Yes', email: 'test@example.com',
    goal: 'This is a test', train: 'Boxing', level: 'Brand new', where: 'Park or beach', zip: '00000',
    format: 'Just me (1-on-1)', availability: 'Sat Midday', often: 'Once a week', coachPref: 'No preference' });
  SpreadsheetApp.getUi().alert('Test alert sent to ' + (ALERT_EMAILS || Session.getEffectiveUser().getEmail()) + '. Check your inbox (and spam folder).');
}

/* ───────────────────────── Coach suggestions ───────────────────────── */

var RADIUS_MILES = { 'Up to 5 miles': 5, 'Up to 10 miles': 10, 'Up to 20 miles': 20, 'Anywhere in the county': 60 };
var PLACE_MAP = { 'My home': "Client's home", "My building's gym": 'Building gym', 'Park or beach': 'Park or beach' };
var LEVEL_MAP = { 'Brand new': 'Beginner', 'Some experience': 'Some experience', 'Experienced': 'Experienced' };

function suggestCoaches() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  if (sheet.getName() !== FORMS.client_request.sheet) {
    ui.alert('Go to the Client Requests tab, click any cell in the client\'s row, then try again.');
    return;
  }
  var rowNum = sheet.getActiveRange().getRow();
  if (rowNum < 2) { ui.alert('Click a cell in a client\'s row (not the header), then try again.'); return; }

  var client = rowObject(sheet, rowNum);
  var apps = ss.getSheetByName(FORMS.coach_application.sheet);
  var coaches = apps ? allRows(apps).filter(function (c) { return String(c['Status']).trim() === 'Approved'; }) : [];

  var results = coaches.map(function (coach) {
    return matchCoach(client, coach, distanceToCoach(client['Zip code'], coach['Areas covered']));
  });
  results.sort(function (a, b) { return (b.ok - a.ok) || (b.score - a.score); });

  var html = HtmlService.createHtmlOutput(renderSuggestions(client, rowNum, results, coaches.length))
    .setWidth(560).setHeight(620);
  ui.showModalDialog(html, 'Coaches for ' + (client['Name'] || 'this client'));
}

function assignCoach(rowNum, coachName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FORMS.client_request.sheet);
  var h = headerIndex(sheet);
  sheet.getRange(rowNum, h['Matched coach']).setValue(coachName);
  sheet.getRange(rowNum, h['Status']).setValue('Matched');
  return true;
}

/**
 * Scores one approved coach for one client. Pure function (no Google services) so it can be tested.
 * client / coach: objects keyed by sheet header. miles: distance in miles, or null if unknown.
 * Returns { name, ok, score, good: [...], warn: [...], blockers: [...] }.
 */
function matchCoach(client, coach, miles) {
  var r = { name: String(coach['Name'] || ''), phone: String(coach['Phone'] || ''), rate: String(coach['Rate (1-on-1 hour)'] || ''),
            ok: true, score: 0, good: [], warn: [], blockers: [] };
  var list = function (v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); };

  // Coach preference
  var pref = String(client['Coach preference'] || '');
  var gender = String(coach['Gender'] || '');
  if (pref === 'Female coach' && gender !== 'Woman') r.blockers.push('Client asked for a female coach');
  if (pref === 'Male coach' && gender !== 'Man') r.blockers.push('Client asked for a male coach');
  if (pref && pref !== 'No preference' && r.blockers.length === 0) r.good.push(pref);

  // Where they train
  var wants = list(client['Where']).map(function (w) { return PLACE_MAP[w] || w; });
  var offers = list(coach['Locations']);
  var places = wants.filter(function (w) { return offers.indexOf(w) >= 0; });
  if (wants.length && !places.length) r.blockers.push('Doesn\'t train at ' + list(client['Where']).join(' / ').toLowerCase());
  else if (places.length) r.good.push('Trains at ' + places.join(', ').toLowerCase());

  // Group sessions
  if (/Small group/.test(String(client['Format'] || ''))) {
    var formats = String(coach['Formats'] || '');
    if (!formats) r.warn.push('Ask if they coach small groups');
    else if (!/Small group/.test(formats)) r.blockers.push('Doesn\'t do small groups');
  }

  // Distance
  var radius = RADIUS_MILES[String(coach['Max travel'] || '')] || 10;
  if (miles === null || miles === undefined) {
    r.warn.push('Check the area: coach covers "' + String(coach['Areas covered'] || 'not listed') + '"');
  } else if (miles > radius) {
    r.blockers.push(Math.round(miles) + ' mi away (travels up to ' + radius + ')');
  } else {
    r.good.push(miles < 1 ? 'Covers their zip' : 'About ' + Math.round(miles) + ' mi away');
    r.score += Math.max(0, 20 - 2 * miles);
  }

  // Shared times
  var cTimes = list(client['Availability']);
  var kTimes = list(coach['Availability']);
  var shared = cTimes.filter(function (t) { return kTimes.indexOf(t) >= 0; });
  if (shared.length) { r.good.push(shared.length + ' shared time' + (shared.length > 1 ? 's' : '') + ': ' + shared.slice(0, 4).join(', ') + (shared.length > 4 ? '…' : '')); r.score += 10 * Math.min(shared.length, 6); }
  else if (cTimes.length) { r.warn.push('No shared times'); r.score -= 20; }

  // What they train
  var train = list(client['Wants to train']);
  var teaches = list(coach['Disciplines']);
  var both = train.filter(function (t) { return teaches.indexOf(t) >= 0; });
  if (both.length) { r.good.push('Coaches ' + both.join(', ')); r.score += 15 * both.length; }
  else if (train.indexOf('Not sure yet') >= 0) { r.score += 10; }
  else if (train.length) { r.warn.push('Doesn\'t list ' + train.join(', ')); r.score -= 15; }

  // Experience level
  var lvl = LEVEL_MAP[String(client['Experience'] || '')];
  var levels = list(coach['Client levels']);
  if (lvl && levels.length) {
    if (levels.indexOf(lvl) >= 0) { r.good.push('Takes ' + lvl.toLowerCase() + ' clients'); r.score += 10; }
    else r.warn.push('Doesn\'t usually take ' + lvl.toLowerCase() + ' clients');
  }

  r.ok = r.blockers.length === 0;
  r.score = Math.round(r.score);
  return r;
}

function renderSuggestions(client, rowNum, results, approvedCount) {
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var good = results.filter(function (r) { return r.ok; });
  var other = results.filter(function (r) { return !r.ok; });
  var card = function (r, i) {
    return '<div class="card' + (r.ok ? '' : ' no') + '">' +
      '<div class="top"><div><b>' + esc(r.name) + '</b>' + (r.rate ? ' <span class="m">$' + esc(r.rate) + '/hr</span>' : '') +
      (r.phone ? '<div class="m">' + esc(r.phone) + '</div>' : '') + '</div>' +
      (r.ok ? '<button data-name="' + esc(r.name) + '">' + (i === 0 ? 'Assign (best match)' : 'Assign') + '</button>' : '') + '</div>' +
      '<ul>' + r.good.map(function (g) { return '<li class="g">' + esc(g) + '</li>'; }).join('') +
      r.warn.map(function (g) { return '<li class="w">' + esc(g) + '</li>'; }).join('') +
      r.blockers.map(function (g) { return '<li class="x">' + esc(g) + '</li>'; }).join('') + '</ul></div>';
  };
  var body;
  if (!approvedCount) {
    body = '<p class="empty">No approved coaches yet. On the Applications tab, set a coach\'s Status to <b>Approved</b>, then try again.</p>';
  } else {
    body = (good.length ? good.map(card).join('') : '<p class="empty">None of your ' + approvedCount + ' approved coaches fit every requirement. See why below.</p>') +
      (other.length ? '<h3>Not a fit (' + other.length + ')</h3>' + other.map(card).join('') : '');
  }
  return '<!doctype html><html><head><base target="_top"><style>' +
    'body{font:14px/1.45 Arial,sans-serif;color:#1a2433;margin:0;padding:4px 2px}' +
    '.sum{background:#eef3fb;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px}' +
    '.card{border:1px solid #e0e5ee;border-radius:8px;padding:10px 12px;margin-bottom:10px}.card.no{opacity:.7}' +
    '.top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.m{color:#5a6575;font-size:12.5px}' +
    'button{background:#1f5fbf;color:#fff;border:0;border-radius:6px;padding:7px 12px;font-weight:bold;cursor:pointer;white-space:nowrap}' +
    'button[disabled]{opacity:.6}ul{margin:8px 0 0;padding:0;list-style:none}li{padding-left:18px;position:relative;font-size:13px;margin:2px 0}' +
    'li:before{position:absolute;left:0;font-weight:bold}.g:before{content:"✓";color:#1f7a4a}.w:before{content:"!";color:#9a5b00}.x:before{content:"✕";color:#b42318}' +
    'h3{font-size:13px;color:#5a6575;margin:16px 0 8px}.empty{color:#5a6575}' +
    '</style></head><body>' +
    '<div class="sum"><b>' + esc(client['Name'] || '') + '</b>: ' + esc(client['Wants to train'] || '') + ' · ' + esc(client['Experience'] || '') +
    '<br>' + esc(client['Where'] || '') + ' · ' + esc(client['Zip code'] || '') + ' · ' + esc(client['Coach preference'] || '') +
    '<br>' + esc(client['Availability'] || '') + '</div>' + body +
    '<script>document.querySelectorAll("button[data-name]").forEach(function(b){b.onclick=function(){' +
    'document.querySelectorAll("button").forEach(function(x){x.disabled=true});b.textContent="Assigning…";' +
    'google.script.run.withSuccessHandler(function(){google.script.host.close()}).withFailureHandler(function(e){b.textContent="Failed: "+e.message})' +
    '.assignCoach(' + rowNum + ', b.getAttribute("data-name"));};});</script></body></html>';
}

/* ───────────────────────── Distance ───────────────────────── */

function distanceToCoach(clientZip, coachAreas) {
  var zips = String(coachAreas || '').match(/\b\d{5}\b/g);
  var from = zipLocation(String(clientZip || '').trim());
  if (!zips || !from) return null;
  var best = null;
  zips.forEach(function (z) {
    var to = zipLocation(z);
    if (!to) return;
    var d = milesBetween(from, to);
    if (best === null || d < best) best = d;
  });
  return best;
}

function zipLocation(zip) {
  if (!/^\d{5}$/.test(zip)) return null;
  var cache = CacheService.getScriptCache();
  var hit = cache.get('zip:' + zip);
  if (hit) return hit === 'none' ? null : JSON.parse(hit);
  var loc = null;
  try {
    var res = Maps.newGeocoder().setRegion('us').geocode(zip + ', USA');
    if (res.status === 'OK' && res.results.length) loc = res.results[0].geometry.location;
  } catch (err) { console.error('Geocode failed for ' + zip + ': ' + err); }
  cache.put('zip:' + zip, loc ? JSON.stringify(loc) : 'none', 21600);
  return loc;
}

function milesBetween(a, b) {
  var R = 3958.8, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ───────────────────────── Sheet helpers ───────────────────────── */

function headerIndex(sheet) {
  var map = {};
  if (sheet.getLastColumn() === 0) return map;
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].forEach(function (h, i) { if (h) map[String(h).trim()] = i + 1; });
  return map;
}

function colLetter(sheet, header) {
  var n = headerIndex(sheet)[header], s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function rowObject(sheet, rowNum) {
  var heads = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var vals = sheet.getRange(rowNum, 1, 1, heads.length).getValues()[0];
  var o = {};
  heads.forEach(function (h, i) { o[String(h).trim()] = vals[i]; });
  return o;
}

function allRows(sheet) {
  if (sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var heads = data[0].map(function (h) { return String(h).trim(); });
  return data.slice(1).map(function (row) { var o = {}; heads.forEach(function (h, i) { o[h] = row[i]; }); return o; });
}
