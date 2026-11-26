(function () {
  var cfg = window.VETTED_CONFIG || {};
  var endpoint = (cfg.formEndpoint || "").trim();

  var form = document.getElementById("app");
  var formView = document.getElementById("formView");
  var doneView = document.getElementById("doneView");
  var btn = document.getElementById("submitBtn");
  var sendErr = document.getElementById("sendErr");
  if (!endpoint) document.getElementById("notConnected").hidden = false;

  // The quick "when" choices expand into the same day + time blocks clients pick, so the two can be matched.
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  var WHEN = {
    early: WEEKDAYS.map(function (d) { return d + " Early"; }),
    mid: WEEKDAYS.map(function (d) { return d + " Midday"; }),
    eve: WEEKDAYS.map(function (d) { return d + " Evening"; }),
    wknd: ["Sat Early", "Sat Midday", "Sat Evening", "Sun Early", "Sun Midday", "Sun Evening"]
  };
  var WHEN_LABEL = { early: "Weekday mornings", mid: "Weekday middays", eve: "Weekday evenings", wknd: "Weekends" };

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

  function clearIfValid(e) {
    var f = e.target.closest("[data-req]");
    if (f && f.classList.contains("invalid") && valid(f)) f.classList.remove("invalid");
  }
  form.addEventListener("input", clearIfValid);
  form.addEventListener("change", clearIfValid);

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
    var one = function (k) { return (fd.get(k) || "").toString().trim(); };
    var when = fd.getAll("when");
    var avail = [];
    when.forEach(function (w) { avail = avail.concat(WHEN[w] || []); });
    var data = {
      type: "coach_application",
      website: one("website"), // honeypot: real people leave this empty
      name: one("name"), phone: one("phone"), email: one("email"), instagram: one("instagram"),
      disciplines: fd.getAll("disciplines").join(", "),
      locations: fd.getAll("locations").join(", "),
      areas: one("zip"), radius: "Up to 10 miles",
      availability: avail.join(", "),
      certs: one("certs"), gender: one("gender")
    };

    if (!endpoint) { showError("This form isn't connected yet, so your application wasn't sent."); return; }

    btn.disabled = true; btn.textContent = "Sending…";
    // text/plain keeps this a "simple" request, which Google Apps Script accepts from any site.
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error("rejected");
        renderDone(data, when.map(function (w) { return WHEN_LABEL[w]; }).join(", "));
      })
      .catch(function () { showError("Your application didn't send. Check your connection and try again."); })
      .finally(function () { btn.disabled = false; btn.textContent = "Apply"; });
  });

  function renderDone(d, whenText) {
    var rows = [
      ["Name", d.name], ["Phone", d.phone], ["Coaches", d.disciplines],
      ["Trains at", d.locations], ["Zip code", d.areas], ["Available", whenText]
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
