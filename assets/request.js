(function () {
  var cfg = window.VETTED_CONFIG || {};
  var endpoint = (cfg.formEndpoint || "").trim();

  // Availability grid (same blocks coaches pick, so the two can be matched)
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

  var form = document.getElementById("req");
  var steps = Array.prototype.slice.call(form.querySelectorAll("fieldset[data-step]"));
  var total = steps.length;
  var current = 0;
  var nextBtn = document.getElementById("nextBtn");
  var backBtn = document.getElementById("backBtn");
  var sendErr = document.getElementById("sendErr");
  if (!endpoint) document.getElementById("notConnected").hidden = false;

  function show(i) {
    current = i;
    steps.forEach(function (s, j) { s.hidden = j !== i; });
    document.getElementById("stepLabel").textContent = "Step " + (i + 1) + " of " + total;
    document.getElementById("stepName").textContent = steps[i].dataset.name;
    document.getElementById("barFill").style.width = ((i + 1) / total * 100) + "%";
    backBtn.hidden = i === 0;
    nextBtn.textContent = i === total - 1 ? "Find my coach" : "Next";
    sendErr.hidden = true;
  }

  function valid(field) {
    if (field.dataset.group) return field.querySelectorAll("input:checked").length > 0;
    var el = field.querySelector("input, select, textarea");
    var v = el.value.trim();
    if (!v) return false;
    if (field.hasAttribute("data-zip")) return /^\d{5}$/.test(v);
    if (field.hasAttribute("data-phone")) return v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length === 10;
    if (el.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return true;
  }

  function checkStep(i) {
    var first = null;
    steps[i].querySelectorAll("[data-req]").forEach(function (f) {
      var ok = valid(f);
      f.classList.toggle("invalid", !ok);
      if (!ok && !first) first = f;
    });
    if (first) {
      var el = first.querySelector("input, select, textarea");
      if (el) el.focus();
      return false;
    }
    return true;
  }

  form.addEventListener("change", function (e) {
    var f = e.target.closest("[data-req]");
    if (f && f.classList.contains("invalid") && valid(f)) f.classList.remove("invalid");
  });
  form.addEventListener("input", function (e) {
    var f = e.target.closest("[data-req]");
    if (f && f.classList.contains("invalid") && valid(f)) f.classList.remove("invalid");
  });

  backBtn.addEventListener("click", function () { if (current > 0) { show(current - 1); scrollTop(); } });

  function scrollTop() {
    document.getElementById("formView").scrollIntoView({ block: "start" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!checkStep(current)) return;
    if (current < total - 1) { show(current + 1); scrollTop(); return; }
    send();
  });

  function send() {
    sendErr.hidden = true;
    var fd = new FormData(form);
    var all = function (k) { return fd.getAll(k).join(", "); };
    var one = function (k) { return (fd.get(k) || "").toString().trim(); };
    var data = {
      type: "client_request",
      website: one("website"),
      goal: one("goal"), train: all("train"), level: one("level"),
      zip: one("zip"), where: all("where"), format: one("format"),
      availability: all("avail"), often: one("often"),
      coachPref: one("coachPref"), injuries: one("injuries"),
      name: one("name"), phone: one("phone"), email: one("email"),
      textOk: fd.get("textOk") ? "Yes" : "No", heard: one("heard")
    };
    if (!endpoint) { showError("This form isn't connected yet, so your request wasn't sent."); return; }

    nextBtn.disabled = true; nextBtn.textContent = "Sending…";
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error("rejected");
        done(data);
      })
      .catch(function () { showError("Your request didn't send. Check your connection and try again."); })
      .finally(function () { nextBtn.disabled = false; nextBtn.textContent = "Find my coach"; });
  }

  function showError(msg) {
    var c = cfg.contactEmail ? " If it keeps happening, email " + cfg.contactEmail + "." : "";
    sendErr.textContent = msg + c;
    sendErr.hidden = false;
  }

  function done(d) {
    var rows = [
      ["Goal", d.goal], ["Training", d.train], ["Level", d.level],
      ["Where", d.where + " · " + d.zip], ["Format", d.format],
      ["When", d.availability.split(", ").length + " time blocks · " + d.often],
      ["Coach", d.coachPref]
    ];
    var dl = document.getElementById("summary"); dl.textContent = "";
    rows.forEach(function (r) {
      var dt = document.createElement("dt"); dt.textContent = r[0];
      var dd = document.createElement("dd"); dd.textContent = r[1];
      dl.append(dt, dd);
    });
    document.getElementById("formView").hidden = true;
    document.getElementById("doneView").hidden = false;
    document.getElementById("doneView").scrollIntoView({ block: "start" });
  }

  show(0);
})();
