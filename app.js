(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LS = window.localStorage;
  var PROFILE_KEY = "psc_profile";
  var DAY_PREFIX = "psc_day_";     // psc_day_<week>_<day>   → daily record
  var BLOCK_PREFIX = "psc_block_"; // psc_block_<blockNo>    → 2-week block record
  var QUEUE_KEY = "psc_queue";
  var LOG_KEY = "psc_log";

  var profile = load(PROFILE_KEY) || null;
  var state = { week: 1, day: "週二" };

  /* ---------- storage ---------- */
  function load(k) { try { return JSON.parse(LS.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { LS.setItem(k, JSON.stringify(v)); }

  function dayKey(w, d) { return DAY_PREFIX + w + "_" + d; }
  function blockKey(b) { return BLOCK_PREFIX + b; }

  function getDay(w, d) {
    return load(dayKey(w, d)) || { 朗讀完成: false, 難點字詞卡: false, 備註: "", submittedAt: null };
  }
  function setDay(w, d, r) { save(dayKey(w, d), r); }

  function getBlock(b) {
    var r = load(blockKey(b)) || { 自學完成: false, 弱項完成: false, 選做: [], updatedAt: null };
    // 向下兼容舊版本地資料
    if (r.專項練習完成 !== undefined) {
      if (r.自學完成 === undefined) r.自學完成 = !!r.專項練習完成;
      if (r.弱項完成 === undefined) r.弱項完成 = false;
      delete r.專項練習完成;
    }
    if (r.自學完成 === undefined) r.自學完成 = false;
    if (r.弱項完成 === undefined) r.弱項完成 = false;
    if (!Array.isArray(r.選做)) r.選做 = [];
    return r;
  }
  function setBlock(b, r) { r.updatedAt = new Date().toLocaleString("zh-HK"); save(blockKey(b), r); }

  /* ---------- date / week ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() {
    var t = new Date();
    return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
  }
  function suggestWeek() {
    var start = (profile && profile.start) || window.CONFIG.COURSE_START;
    var s = new Date(start + "T00:00:00");
    var diff = Math.floor((new Date() - s) / (1000 * 60 * 60 * 24 * 7)) + 1;
    if (diff < 1) diff = 1; if (diff > 13) diff = 13;
    return diff;
  }
  function suggestDay() {
    var map = { 0: "週日", 1: "週一", 2: "週二", 3: "週三", 4: "週四", 5: "週五", 6: "週六" };
    var d = map[new Date().getDay()];
    if (window.DAYS && window.DAYS.indexOf(d) === -1) return window.DAYS[0];
    return d;
  }

  /* ---------- render ---------- */
  function renderHeader() {
    $("whoName").textContent = profile ? profile.name : "—";
    var sel = $("weekSelect");
    if (!sel.options.length) {
      for (var w = 1; w <= 13; w++) {
        var o = document.createElement("option");
        o.value = w; o.textContent = "第 " + w + " 週（" + window.BLOCKS[window.WEEKS[w].block].title + "）";
        sel.appendChild(o);
      }
    }
    sel.value = state.week;
    $("modePill").textContent = window.WEEKS[state.week].mode;
  }

  function renderDayTabs() {
    var box = $("dayTabs"); box.innerHTML = "";
    window.DAYS.forEach(function (d) {
      var b = document.createElement("button");
      b.textContent = d;
      if (d === state.day) b.className = "active";
      if (getDay(state.week, d).submittedAt) {
        var dot = document.createElement("span"); dot.className = "dot"; b.appendChild(dot);
      }
      b.onclick = function () { state.day = d; renderAll(); };
      box.appendChild(b);
    });
  }

  function simpleTask(opts) {
    var row = document.createElement("div"); row.className = "task";
    var cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "cb"; cb.checked = !!opts.checked;
    cb.onchange = function () { opts.onCheck(cb.checked); };
    row.appendChild(cb);
    var body = document.createElement("div"); body.className = "body";
    var t = document.createElement("div"); t.className = "title"; t.textContent = opts.title;
    body.appendChild(t);
    if (opts.meta) { var m = document.createElement("div"); m.className = "meta"; m.textContent = opts.meta; body.appendChild(m); }
    if (opts.link) {
      var a = document.createElement("a"); a.className = "lnk"; a.href = opts.link.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "▶ " + opts.link.label; body.appendChild(a);
    }
    row.appendChild(body);
    return row;
  }

  function sectionTitle(text, hint) {
    var wrap = document.createElement("div"); wrap.style.margin = "6px 4px 4px";
    var h = document.createElement("div");
    h.style.fontSize = "13px"; h.style.fontWeight = "700"; h.style.color = "var(--sec)"; h.style.letterSpacing = ".05em";
    h.textContent = text; wrap.appendChild(h);
    if (hint) {
      var p = document.createElement("div"); p.style.fontSize = "12px"; p.style.color = "var(--sec)"; p.style.marginTop = "2px";
      p.textContent = hint; wrap.appendChild(p);
    }
    return wrap;
  }

  function renderTasks() {
    var area = $("taskArea"); area.innerHTML = "";
    var w = state.week, d = state.day;
    var week = window.WEEKS[w], block = window.BLOCKS[week.block];
    var dayRec = getDay(w, d);
    var blockRec = getBlock(week.block);
    function persistDay() { setDay(w, d, dayRec); renderDayTabs(); }
    function persistBlock() { setBlock(week.block, blockRec); }

    /* 課堂資訊 */
    var info = card("本週課堂內容", "第 " + w + " 週（" + week.mode + "） · " + block.title);
    info.appendChild(kv("發音基礎", block.fj));
    info.appendChild(kv("測試專項", block.cs));
    area.appendChild(info);

    /* ============ 每日打卡 ============ */
    area.appendChild(sectionTitle("每日打卡", "每天完成後打勾"));

    var c1 = card("今日朗讀 " + tagHtml("每日至少一篇", "blue"), null);
    c1.appendChild(simpleTask({
      checked: dayRec.朗讀完成, title: week.reading[d], meta: d + " · 請利用 PTTC 學習工具逐句跟讀",
      onCheck: function (v) { dayRec.朗讀完成 = v; persistDay(); }
    }));
    var exWrap = document.createElement("div"); exWrap.className = "extra-read";
    var exLab = document.createElement("div"); exLab.className = "extra-label";
    exLab.textContent = "今天讀了多於一篇？請填寫額外的篇目（可留空）";
    var exIn = document.createElement("input"); exIn.type = "text";
    exIn.placeholder = "例：第 41 篇、第 42 篇";
    exIn.value = dayRec.額外朗讀 || "";
    exIn.oninput = function () { dayRec.額外朗讀 = exIn.value; persistDay(); };
    exWrap.appendChild(exLab); exWrap.appendChild(exIn);
    c1.appendChild(exWrap);
    area.appendChild(c1);

    var c2 = card("難點字詞記憶詞卡 " + tagHtml("每天 10 分鐘", "green"), null);
    c2.appendChild(simpleTask({
      checked: dayRec.難點字詞卡, title: "完成今天的詞卡練習（10 分鐘）",
      meta: "⚠️ 如已安裝為手機主畫面程式，勿開啟此鏈接",
      link: { url: window.CONFIG.FLASHCARD_URL, label: "開啟練習頁面" },
      onCheck: function (v) { dayRec.難點字詞卡 = v; persistDay(); }
    }));
    area.appendChild(c2);

    var c3 = card("備註", "想跟老師說的話（可留空）");
    var ta = document.createElement("textarea");
    ta.placeholder = "例：翹舌音仍不穩定，想請老師示範";
    ta.value = dayRec.備註;
    ta.oninput = function () { dayRec.備註 = ta.value; persistDay(); };
    c3.appendChild(ta);
    area.appendChild(c3);

    /* ============ 本兩週任務 ============ */
    area.appendChild(sectionTitle("本兩週任務（第 " + block.title + "）", "同一區塊 8 天內完成一次即可，狀態互通"));

    // 專項練習：拆成「自學專項」與「弱項練習（老師派發）」各自打卡
    if (block.zx) {
      var c4 = card("專項練習 " + tagHtml("兩週一次", "orange"), "分兩項打卡，狀態貫穿整個兩週");

      // ① 自學專項
      var row1 = document.createElement("div"); row1.className = "task"; row1.style.marginTop = "8px";
      var cb1 = document.createElement("input"); cb1.type = "checkbox"; cb1.className = "cb"; cb1.checked = !!blockRec.自學完成;
      cb1.onchange = function () { blockRec.自學完成 = cb1.checked; persistBlock(); };
      var body1 = document.createElement("div"); body1.className = "body";
      var t1 = document.createElement("div"); t1.className = "title"; t1.textContent = "① 自學專項";
      var m1 = document.createElement("div"); m1.className = "meta"; m1.textContent = block.zx;
      body1.appendChild(t1); body1.appendChild(m1);
      row1.appendChild(cb1); row1.appendChild(body1);
      c4.appendChild(row1);

      // ② 弱項練習（老師派發）
      var row2 = document.createElement("div"); row2.className = "task"; row2.style.marginTop = "8px";
      var cb2 = document.createElement("input"); cb2.type = "checkbox"; cb2.className = "cb"; cb2.checked = !!blockRec.弱項完成;
      cb2.onchange = function () { blockRec.弱項完成 = cb2.checked; persistBlock(); };
      var body2 = document.createElement("div"); body2.className = "body";
      var t2 = document.createElement("div"); t2.className = "title"; t2.textContent = "② 弱項練習（老師派發）";
      var m2 = document.createElement("div"); m2.className = "meta"; m2.textContent = "由老師透過 WhatsApp / Email 個別指派；若本區塊無派發可略過";
      body2.appendChild(t2); body2.appendChild(m2);
      row2.appendChild(cb2); row2.appendChild(body2);
      c4.appendChild(row2);

      if (blockRec.updatedAt) {
        var upd = document.createElement("p"); upd.className = "sub"; upd.style.marginTop = "6px"; upd.textContent = "上次更新：" + blockRec.updatedAt;
        c4.appendChild(upd);
      }

      area.appendChild(c4);
    } else {
      // 第 13 週沒有專項
      var cNone = card("專項練習", "本區塊（第 13 週）不設專項練習");
      area.appendChild(cNone);
    }

    // 選做練習
    var c5 = card("選做練習 " + tagHtml("兩週一次 · 自選加強", "orange"), "有時間可多做，狀態貫穿整個兩週");
    window.optionalItems(week.block).forEach(function (item) {
      var opt = document.createElement("label"); opt.className = "opt";
      var cb = document.createElement("input"); cb.type = "checkbox";
      cb.checked = blockRec.選做.indexOf(item) > -1;
      cb.onchange = function () {
        var i = blockRec.選做.indexOf(item);
        if (cb.checked && i < 0) blockRec.選做.push(item);
        if (!cb.checked && i > -1) blockRec.選做.splice(i, 1);
        persistBlock();
      };
      var sp = document.createElement("span"); sp.textContent = item;
      opt.appendChild(cb); opt.appendChild(sp); c5.appendChild(opt);
    });
    area.appendChild(c5);

    $("savedNote").textContent = dayRec.submittedAt
      ? ("今天已於 " + dayRec.submittedAt + " 提交，可再次提交更新")
      : "填寫後按提交，記錄會自動送到老師 Notion";
  }

  function card(titleHtml, sub) {
    var c = document.createElement("div"); c.className = "card";
    var h = document.createElement("h2"); h.innerHTML = titleHtml; c.appendChild(h);
    if (sub) { var s = document.createElement("p"); s.className = "sub"; s.textContent = sub; c.appendChild(s); }
    return c;
  }
  function kv(k, v) {
    var d = document.createElement("div"); d.className = "meta"; d.style.marginTop = "4px";
    d.innerHTML = "<b>" + k + "：</b>" + v; return d;
  }
  function tagHtml(txt, cls) { return '<span class="tag ' + cls + '">' + txt + "</span>"; }

  /* ---------- submit ---------- */
  function buildPayload(w, d) {
    var week = window.WEEKS[w];
    var dayRec = getDay(w, d);
    var blockRec = getBlock(week.block);
    return {
      學生姓名: profile.name,
      日期: (function(){ var el = $("checkinDate"); return (el && el.value) || todayISO(); })(),
      週次: "第" + w + "週",
      星期: d,
      朗讀篇目: week.reading[d],
      朗讀完成: !!dayRec.朗讀完成,
      額外朗讀篇目: dayRec.額外朗讀 || "",
      難點字詞卡: !!dayRec.難點字詞卡,
      備註: (function(){
        var ex = (dayRec.額外朗讀 || "").trim();
        var bz = (dayRec.備註 || "").trim();
        if (!ex) return bz;
        return "【額外朗讀】" + ex + (bz ? "\n" + bz : "");
      })(),
      // 以下欄位屬「本兩週任務」，每天送出時附上當下狀態（同一 block 內每天相同）
      自學專項完成: !!blockRec.自學完成,
      弱項練習完成: !!blockRec.弱項完成,
      選做練習: (function(){ var a = blockRec.選做 || []; return a.length ? "• " + a.join("\n• ") : ""; })()
    };
  }

  function submit() {
    if (!profile) { openOnboard(); return; }
    if (!profile.name || !String(profile.name).trim()) {
      toast("請先到「設定」填寫你的姓名"); showPage("settings"); return;
    }
    var w = state.week, d = state.day;
    var payload = buildPayload(w, d);
    var hook = profile.hook || window.CONFIG.WEBHOOK_URL;
    $("submitBtn").disabled = true;
    sendPayload(payload, hook).then(function () {
      var rec = getDay(w, d);
      rec.submittedAt = new Date().toLocaleString("zh-HK"); setDay(w, d, rec);
      logSubmit(w, d);
      toast("很好，已提交今天的學習記錄！"); renderAll();
    }).catch(function () {
      queuePush(payload);
      var rec = getDay(w, d);
      rec.submittedAt = new Date().toLocaleString("zh-HK") + "（待傳送）"; setDay(w, d, rec);
      logSubmit(w, d);
      toast("已離線儲存，恢復網絡後會自動傳送"); renderAll();
    }).then(function () { $("submitBtn").disabled = false; });
  }

  function sendPayload(payload, hook) {
    if (!hook) return Promise.reject("no hook");
    return fetch(hook, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    }).then(function (res) { if (!res.ok) throw new Error("bad status"); return true; });
  }

  function queuePush(p) { var q = load(QUEUE_KEY) || []; q.push(p); save(QUEUE_KEY, q); }
  function flushQueue() {
    var q = load(QUEUE_KEY) || []; if (!q.length) return Promise.resolve(0);
    var hook = profile && (profile.hook || window.CONFIG.WEBHOOK_URL);
    if (!hook) return Promise.resolve(0);
    var remaining = []; var sent = 0;
    return q.reduce(function (chain, item) {
      return chain.then(function () {
        return sendPayload(item, hook).then(function () { sent++; })
          .catch(function () { remaining.push(item); });
      });
    }, Promise.resolve()).then(function () {
      save(QUEUE_KEY, remaining);
      if (sent) toast("已補傳 " + sent + " 筆打卡 ✓");
      return sent;
    });
  }

  /* ---------- log + history ---------- */
  function logSubmit(w, d) {
    var log = load(LOG_KEY) || [];
    var key = w + "_" + d;
    if (log.map(function (x) { return x.k; }).indexOf(key) < 0) log.push({ k: key, date: todayISO() });
    save(LOG_KEY, log);
  }
  function renderHistory() {
    var log = load(LOG_KEY) || [];
    $("totalSub").textContent = log.length;
    $("streakNum").textContent = calcStreak(log);
    var list = $("histList"); list.innerHTML = "";
    for (var w = 1; w <= 13; w++) {
      var doneDays = 0, flash = 0;
      window.DAYS.forEach(function (d) {
        var r = getDay(w, d);
        if (r.朗讀完成) doneDays++;
        if (r.難點字詞卡) flash++;
      });
      var blockRec = getBlock(window.WEEKS[w].block);
      var zx = !!blockRec.自學完成;
      var rj = !!blockRec.弱項完成;
      if (doneDays === 0 && flash === 0 && !zx && !rj) continue;
      var el = document.createElement("div"); el.className = "hist-week";
      var h = document.createElement("h3"); h.textContent = "第 " + w + " 週 · " + window.BLOCKS[window.WEEKS[w].block].title;
      el.appendChild(h);
      el.appendChild(barEl(doneDays, 4, "朗讀"));
      el.appendChild(barEl(flash, 4, "詞卡"));
      var extra = document.createElement("div"); extra.className = "stat"; extra.style.marginTop = "6px";
      extra.innerHTML = "<span>自學：" + (zx ? "<b style=\"color:var(--green)\">已完成</b>" : "未完成") + " · 弱項：" + (rj ? "<b style=\"color:var(--green)\">已完成</b>" : "未完成") + "</span>";
      el.appendChild(extra);
      list.appendChild(el);
    }
    if (!list.children.length) { list.innerHTML = '<p class="muted" style="text-align:center">尚未有打卡記錄。</p>'; }
  }
  function barEl(done, total, label) {
    var wrap = document.createElement("div");
    var s = document.createElement("div"); s.className = "stat";
    s.innerHTML = "<span>" + label + " <b>" + done + "/" + total + "</b></span>";
    var bar = document.createElement("div"); bar.className = "bar";
    var i = document.createElement("i"); i.style.width = (done / total * 100) + "%"; bar.appendChild(i);
    wrap.appendChild(s); wrap.appendChild(bar); return wrap;
  }
  function calcStreak(log) {
    var dates = {}; log.forEach(function (x) { dates[x.date] = true; });
    var streak = 0; var day = new Date();
    for (var i = 0; i < 400; i++) {
      var iso = day.getFullYear() + "-" + pad(day.getMonth() + 1) + "-" + pad(day.getDate());
      if (dates[iso]) { streak++; day.setDate(day.getDate() - 1); }
      else if (i === 0) { day.setDate(day.getDate() - 1); }
      else break;
    }
    return streak;
  }

  /* ---------- nav / pages ---------- */
  function showPage(name) {
    ["checkin", "history", "resources", "settings"].forEach(function (p) {
      $("page" + cap(p)).classList.toggle("hide", p !== name);
    });
    document.querySelectorAll(".nav button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-page") === name);
    });
    if (name === "history") renderHistory();
    if (name === "settings") fillSettings();
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function fillSettings() {
    $("setName").value = profile ? profile.name : "";
    $("setStart").value = (profile && profile.start) || window.CONFIG.COURSE_START;
    $("setHook").value = (profile && profile.hook) || window.CONFIG.WEBHOOK_URL || "";
  }

  /* ---------- onboarding ---------- */
  function openOnboard() { $("onboard").classList.remove("hide"); }
  function closeOnboard() { $("onboard").classList.add("hide"); }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function renderAll() { renderHeader(); renderDayTabs(); renderTasks(); }

  /* ---------- init ---------- */
  function init() {
    document.querySelectorAll(".nav button").forEach(function (b) {
      b.onclick = function () { showPage(b.getAttribute("data-page")); };
    });
    $("weekSelect").onchange = function () { state.week = Number(this.value); renderAll(); };
    $("submitBtn").onclick = submit;
    $("saveSettings").onclick = function () {
      var name = $("setName").value.trim(); if (!name) { toast("請輸入姓名"); return; }
      profile = { name: name, start: $("setStart").value.trim() || window.CONFIG.COURSE_START, hook: $("setHook").value.trim() };
      save(PROFILE_KEY, profile); toast("已儲存"); renderAll(); flushQueue();
    };
    $("resyncBtn").onclick = function () { flushQueue().then(function (n) { if (!n) toast("沒有待傳送的打卡"); }); };
    var _clr = $("clearDataBtn");
    if (_clr) _clr.onclick = function () {
      if (!confirm("確定清除此裝置上的所有打卡資料與設定嗎？\n此操作無法復原。")) return;
      if (!confirm("再次確認：姓名、所有週次的打卡紀錄及設定將被完全刪除。")) return;
      try {
        var ks = [];
        for (var i = 0; i < LS.length; i++) {
          var k = LS.key(i);
          if (k && k.indexOf("psc_") === 0) ks.push(k);
        }
        for (var j = 0; j < ks.length; j++) LS.removeItem(ks[j]);
      } catch (e) {}
      location.reload();
    };
    $("obStart").onclick = function () {
      var name = $("obName").value.trim(); if (!name) { toast("請輸入姓名"); return; }
      profile = { name: name, start: window.CONFIG.COURSE_START, hook: "" };
      save(PROFILE_KEY, profile); closeOnboard();
      state.week = suggestWeek(); state.day = suggestDay(); renderAll();
    };

    state.week = suggestWeek(); state.day = suggestDay();
    var _cd = $("checkinDate"); if (_cd && !_cd.value) _cd.value = todayISO();
    if (!profile) openOnboard();
    renderAll();
    flushQueue();
    window.addEventListener("online", flushQueue);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
