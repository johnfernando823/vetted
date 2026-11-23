(function () {
  var cfg = window.VETTED_CONFIG || {};
  var endpoint = (cfg.formEndpoint || "").trim();

  // Availability grid
  var days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var blocks = [["early", "Early", "5–8a"], ["mid", "Midday", "8a–4p"], ["eve", "Evening", "4–9p"]];
  var head = document.querySelector(".avail thead tr");
  var tbody = document.querySelector(".avail tbody");
  days.forEach(function (d) { var th = document.createElement("th"); th.textContent = d; head.appendChild(th); });
  blocks.forEach(function (b) {
    var tr = document.createElement("tr");
    var th = document.createElement("th"); th.className = "rowh"; th.scope = "row";
    th.textContent = b[1] + " " + b[2]; tr.appendChild(th);
    days.forEach(function (d) {
      var td = document.createElement("td");
      var lab = document.createElement("label"); lab.className = "slot";
      var inp = document.createElement("input"); inp.type = "checkbox"; inp.name = "avail"; inp.value = d + " " + b[1];
      inp.id = "av-" + d + "-" + b[0]; inp.setAttribute("aria-label", d + " " + b[1].toLowerCase());
      lab.appendChild(inp); lab.appendChild(document.createElement("span"));
      td.appendChild(lab); tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  var form = document.getElementById("app");
  var formView = document.getElementById("formView");
  var doneView = document.getElementById("doneView");
  var btn = document.getElementById("submitBtn");
  var sendErr = document.getElementById("sendErr");
  if (!endpoint) document.getElementById("notConnected").hidden = false;

  function valid(field) {
    if (field.dataset.group) return field.querySelectorAll("input:checked").length > 0;
    var el = field.querySelector("input, select, textarea");
    var v = el.value.trim();
    if (!v) return false;
    if (el.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return true;
  }

  form.addEventListener("input", function (e) {
    var f = e.target.closest("[data-req]");
    if (f && f.classList.contains("invalid") && valid(f)) f.classList.remove("invalid");
  });

  function showError(msg) {
    var c = cfg.contactEmail ? " If it keeps happening, email " + cfg.contactEmail + "." : "";
    sendErr.textContent = msg + c;
    sendErr.hidden = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    sendErr.hidden = true;
    var first = null;
    form.querySelectorAll("[data-req]").forEach(function (f) {
      var ok = valid(f);
      f.classList.toggle("invalid", !ok);
      if (!ok && !first) first = f;
    });
    if (first) {
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      first.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      var el = first.querySelector("input, select, textarea"); if (el) el.focus({ preventScroll: true });
      return;
    }

    var fd = new FormData(form);
    var all = function (k) { return fd.getAll(k).join(", "); };
    var one = function (k) { return (fd.get(k) || "").toString().trim(); };
    var data = {
      type: "coach_application",
      website: one("website"), // honeypot: real people leave this empty
      name: one("name"), email: one("email"), phone: one("phone"), instagram: one("instagram"), gender: one("gender"),
      disciplines: all("disciplines"), levels: all("levels"), years: one("years"), cpr: one("cpr"),
      certs: one("certs"), background: one("background"),
      locations: all("locations"), areas: one("areas"), radius: one("radius"), formats: all("formats"),
      availability: all("avail"), rate: one("rate"), insurance: one("insurance"), gear: one("gear"),
      heard: one("heard"), consent: fd.get("consent") ? "Yes" : "No"
    };

    if (!endpoint) { showError("This form isn't connected yet, so your application wasn't sent."); return; }

    btn.disabled = true; btn.textContent = "Sending…";
    // text/plain keeps this a "simple" request, which Google Apps Script accepts from any site.
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "rejected");
        renderDone(data);
      })
      .catch(function () {
        showError("Your application didn't send. Check your connection and try again.");
      })
      .finally(function () { btn.disabled = false; btn.textContent = "Submit application"; });
  });

  function renderDone(d) {
    var rows = [
      ["Name", d.name], ["Contact", d.email + " · " + d.phone],
      ["Disciplines", d.disciplines], ["Client levels", d.levels || "—"],
      ["Experience", d.years + " years · CPR " + d.cpr], ["Certifications", d.certs],
      ["Locations", d.locations], ["Areas", d.areas + " (" + d.radius + ")"],
      ["Formats", d.formats || "—"], ["Availability", d.availability.split(", ").length + " time blocks a week"],
      ["Rate", d.rate ? "$" + d.rate + " / hour" : "—"], ["Insurance", d.insurance]
    ];
    var dl = document.getElementById("summary"); dl.textContent = "";
    rows.forEach(function (r) {
      var dt = document.createElement("dt"); dt.textContent = r[0];
      var dd = document.createElement("dd"); dd.textContent = r[1];
      dl.append(dt, dd);
    });
    formView.hidden = true; doneView.hidden = false;
    doneView.scrollIntoView({ block: "start" });
  }
})();
