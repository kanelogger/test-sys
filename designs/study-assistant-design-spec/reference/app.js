/* ==========================================================================
   app.js — 设计参考交互层（今日 / 记录 首个闭环 + 随票占位页）
   只调用 window.StudyFixture 的公开 command/query；不直接改写数据。
   反馈矩阵实现见 DESIGN.md §11。
   ========================================================================== */

(function () {
  "use strict";

  const F = window.StudyFixture;
  const view = document.getElementById("view");

  /* ---------- 图标（lucide 内联 SVG，stroke 1.75） ---------- */

  const ICONS = {
    "calendar-check":
      '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    "calendar-days":
      '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
    "pen-line":
      '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
    history:
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    library:
      '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    clock:
      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    alert:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "move-right": '<path d="M18 8 22 12 18 16"/><path d="M2 12h20"/>',
    "skip-forward":
      '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    external:
      '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    refresh:
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  };

  function icon(name) {
    return (
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || "") +
      "</svg>"
    );
  }

  /* ---------- 工具 ---------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  const WEEKDAYS = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
  ];
  function weekday(dateStr) {
    const a = dateStr.split("-");
    return WEEKDAYS[new Date(+a[0], +a[1] - 1, +a[2]).getDay()];
  }

  /* 页面级 UI 状态（重渲染之间保留） */
  let flash = null; // { kind: "success"|"warning"|"error", text: string }
  let justCompletedId = null; // 成功后播放一次性脉冲
  let openFormPlanId = null; // 今日页展开的完成表单
  let openRecordFormId = null; // 记录页展开的补记表单
  let recordDate = F.fixtureToday();
  let backfillOpen = false;

  function setFlash(kind, text) {
    flash = { kind, text };
  }
  function takeFlash() {
    const f = flash;
    flash = null;
    return f;
  }

  function flashHtml() {
    const f = takeFlash();
    if (!f) return "";
    const ic =
      f.kind === "success" ? "check" : f.kind === "warning" ? "alert" : "alert";
    return (
      '<div class="alert alert-' +
      f.kind +
      '" role="status">' +
      icon(ic) +
      "<span>" +
      esc(f.text) +
      "</span></div>"
    );
  }

  function errorKind(err) {
    if (err.code === "DUPLICATE_SUBMISSION") return "warning";
    if (err.code === "STATE_CHANGED" && /重复提交|已被处理/.test(err.reason))
      return "warning";
    return "error";
  }

  /* ---------- 演示场景控制台（fixture 专用，非产品 UI） ---------- */

  const SCENARIOS = [
    ["normal", "正常"],
    ["slow", "慢速提交"],
    ["stale", "模拟他处变更"],
    ["duplicate", "模拟重复提交"],
  ];

  function consoleHtml() {
    const cur = F.getScenario();
    const btns = SCENARIOS.map(function ([key, label]) {
      return (
        '<button type="button" class="fc-btn' +
        (key === cur ? " is-on" : "") +
        '" data-sc="' +
        key +
        '">' +
        label +
        "</button>"
      );
    }).join("");
    return (
      '<div class="fixture-console">' +
      '<span class="fc-label">演示场景 · fixture（下一次提交生效）</span>' +
      btns +
      '<span class="fc-sep"></span>' +
      '<button type="button" class="fc-btn" data-reset>重置 fixture</button>' +
      "</div>"
    );
  }

  function bindConsole(root) {
    root.querySelectorAll("[data-sc]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        F.setScenario(btn.getAttribute("data-sc"));
        root.querySelectorAll("[data-sc]").forEach(function (b) {
          b.classList.toggle("is-on", b === btn);
        });
      });
    });
    const reset = root.querySelector("[data-reset]");
    if (reset)
      reset.addEventListener("click", function () {
        F.reset();
        recordDate = F.fixtureToday();
        openFormPlanId = openRecordFormId = null;
        backfillOpen = false;
        setFlash("success", "fixture 已重置为初始场景。");
        route();
      });
  }

  function resetScenarioAfterCommand() {
    F.setScenario("normal");
    document.querySelectorAll("[data-sc]").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-sc") === "normal");
    });
  }

  /* ---------- 资源入口 ---------- */

  function resourceHtml(resource) {
    if (!resource) return "";
    if (resource.type === "web") {
      return (
        '<a class="link" href="' +
        esc(resource.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        icon("external") +
        esc(resource.title) +
        "</a>"
      );
    }
    return (
      '<span class="file-chip">' +
      icon("file") +
      esc(resource.filename) +
      '<button type="button" class="chip-copy" data-copy="' +
      esc(resource.filename) +
      '">' +
      icon("copy") +
      "复制文件名</button></span>"
    );
  }

  document.addEventListener("click", function (ev) {
    const btn = ev.target.closest("[data-copy]");
    if (!btn) return;
    const text = btn.getAttribute("data-copy");
    const done = function () {
      const original = btn.innerHTML;
      btn.classList.add("is-copied");
      btn.innerHTML = icon("check") + "已复制";
      setTimeout(function () {
        btn.classList.remove("is-copied");
        btn.innerHTML = original;
      }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text, done, btn);
      });
    } else {
      fallbackCopy(text, done, btn);
    }
  });

  function fallbackCopy(text, done, btn) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      btn.innerHTML = "复制失败，请手动选择复制";
    }
    document.body.removeChild(ta);
  }

  /* ---------- 状态徽章 ---------- */

  function statusBadge(row) {
    const p = row.plan;
    if (p.status === "completed") {
      const extra =
        p.source === "backfill"
          ? ' <span class="badge badge-backfill">补建</span>'
          : "";
      return (
        '<span class="badge badge-completed">' +
        icon("check") +
        "已完成</span>" +
        extra
      );
    }
    if (p.status === "moved") {
      return (
        '<span class="badge badge-moved">' +
        icon("move-right") +
        "已移动" +
        (row.movedToDate ? " · 已移至 " + esc(row.movedToDate) : "") +
        "</span>"
      );
    }
    if (p.status === "skipped")
      return (
        '<span class="badge badge-skipped">' +
        icon("skip-forward") +
        "已跳过</span>"
      );
    return (
      '<span class="badge badge-pending">' + icon("clock") + "待处理</span>"
    );
  }

  function subjectBadge(subject) {
    return '<span class="badge badge-subject">' + esc(subject) + "</span>";
  }

  function logLineHtml(row) {
    if (!row.log) return "";
    const score = row.log.scoreText
      ? '<span class="log-score">成绩 ' + esc(row.log.scoreText) + "</span>"
      : "";
    return (
      '<div class="task-log"><span class="log-meta">实际 ' +
      esc(row.log.actualMinutes) +
      " 分钟 · 学习日 " +
      esc(row.log.date) +
      "</span>" +
      esc(row.log.summary) +
      score +
      "</div>"
    );
  }

  /* ---------- 完成 / 补记 行内表单 ---------- */

  function logFormHtml(row, options) {
    const p = row.plan;
    const dateNote =
      options.mode === "backfill-record"
        ? "补记：当天已学、现在登记；学习日保持 " +
          esc(p.date) +
          "，任务数不增加。"
        : "学习日：" + esc(p.date) + "（日志日期 = 该任务的计划日期）";
    return (
      '<div class="inline-form' +
      (options.open ? " is-open" : "") +
      '" data-form="' +
      esc(p.id) +
      '">' +
      '<div class="inline-form-inner">' +
      '<div class="form-grid">' +
      '<div class="field"><label class="field-label" for="f-min-' +
      esc(p.id) +
      '">实际分钟<span class="req">*</span></label>' +
      '<input class="input" id="f-min-' +
      esc(p.id) +
      '" data-field="actualMinutes" type="number" min="1" step="1" placeholder="如 45"></div>' +
      '<div class="field"><label class="field-label" for="f-score-' +
      esc(p.id) +
      '">成绩（可选）</label>' +
      '<input class="input" id="f-score-' +
      esc(p.id) +
      '" data-field="scoreText" type="text" placeholder="如 52/75"></div>' +
      '<div class="field span-2"><label class="field-label" for="f-sum-' +
      esc(p.id) +
      '">学习总结<span class="req">*</span></label>' +
      '<textarea class="textarea" id="f-sum-' +
      esc(p.id) +
      '" data-field="summary" placeholder="做了什么、结论是什么、卡在哪里"></textarea></div>' +
      "</div>" +
      '<div class="field-hint">' +
      dateNote +
      "</div>" +
      '<div class="form-alerts" style="margin-top:8px"></div>' +
      '<div class="form-actions" style="margin-top:10px">' +
      '<button type="button" class="btn btn-primary" data-submit="' +
      esc(p.id) +
      '"><span class="btn-spinner"></span><span class="btn-text">确认完成</span></button>' +
      '<button type="button" class="btn btn-ghost" data-cancel="' +
      esc(p.id) +
      '">取消</button>' +
      "</div></div></div>"
    );
  }

  function setFormBusy(formEl, busy) {
    formEl
      .querySelectorAll("input, textarea, button, select")
      .forEach(function (el) {
        if (busy) {
          el.setAttribute("disabled", "");
        } else {
          el.removeAttribute("disabled");
        }
      });
    const submit = formEl.querySelector("[data-submit]");
    if (submit) {
      submit.classList.toggle("is-loading", busy);
      submit.querySelector(".btn-text").textContent = busy
        ? "提交中…"
        : "确认完成";
    }
  }

  function showFieldError(formEl, field, reason) {
    formEl.querySelectorAll(".is-invalid").forEach(function (el) {
      el.classList.remove("is-invalid");
    });
    formEl.querySelectorAll(".field-error").forEach(function (el) {
      el.remove();
    });
    const input = formEl.querySelector(
      '[data-field="' + field + '"], [data-bfield="' + field + '"]'
    );
    if (input) {
      input.classList.add("is-invalid");
      const msg = document.createElement("div");
      msg.className = "field-error";
      msg.textContent = reason;
      input.closest(".field").appendChild(msg);
      input.focus();
    }
  }

  function showFormAlert(formEl, kind, text, requery) {
    const box = formEl.querySelector(".form-alerts");
    const ic = kind === "success" ? "check" : "alert";
    box.innerHTML =
      '<div class="alert alert-' +
      kind +
      '" role="alert">' +
      icon(ic) +
      "<span>" +
      esc(text) +
      "</span>" +
      (requery
        ? '<span class="alert-actions"><button type="button" class="btn btn-secondary btn-sm" data-requery>' +
          icon("refresh") +
          "重新查询</button></span>"
        : "") +
      "</div>";
    const rq = box.querySelector("[data-requery]");
    if (rq)
      rq.addEventListener("click", function () {
        route();
      });
  }

  /* 完成 / 补记提交（§11 反馈矩阵） */
  async function submitComplete(pendingRef, formEl, refresh) {
    const log = {
      actualMinutes: formEl.querySelector('[data-field="actualMinutes"]').value,
      summary: formEl.querySelector('[data-field="summary"]').value,
      scoreText: formEl.querySelector('[data-field="scoreText"]').value,
    };
    setFormBusy(formEl, true);
    formEl.querySelectorAll(".is-invalid").forEach(function (el) {
      el.classList.remove("is-invalid");
    });
    formEl.querySelectorAll(".field-error").forEach(function (el) {
      el.remove();
    });
    formEl.querySelector(".form-alerts").innerHTML = "";
    let res;
    try {
      res = await F.complete(pendingRef, log);
    } finally {
      resetScenarioAfterCommand();
    }
    if (res.ok) {
      justCompletedId = res.value.plan.id;
      setFlash(
        "success",
        "已记录 · 学习日 " +
          res.value.log.date +
          "。实际 " +
          res.value.log.actualMinutes +
          " 分钟。"
      );
      openFormPlanId = openRecordFormId = null;
      refresh();
      return;
    }
    setFormBusy(formEl, false);
    if (res.error.code === "INVALID_INPUT" && res.error.field) {
      showFieldError(formEl, res.error.field, res.error.reason);
      return;
    }
    /* STATE_CHANGED / DUPLICATE_SUBMISSION / 其他失败：保留输入，展示原因，提供重新查询 */
    showFormAlert(
      formEl,
      errorKind(res.error),
      res.error.reason + "（" + res.error.code + "）已保留你的输入。",
      true
    );
  }

  /* ---------- 今日页 ---------- */

  function todayTaskHtml(row) {
    const p = row.plan;
    const completed = p.status === "completed";
    const cls =
      "task" +
      (completed ? " is-completed" : "") +
      (justCompletedId === p.id ? " just-completed" : "");
    const actions = completed
      ? ""
      : '<span class="task-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-open-form="' +
        esc(p.id) +
        '">完成</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-move-tomorrow="' +
        esc(p.id) +
        '">移到明天</button>' +
        "</span>";
    return (
      '<div class="' +
      cls +
      '" data-task="' +
      esc(p.id) +
      '">' +
      '<div class="task-head"><span class="task-order">' +
      (p.order + 1) +
      ".</span>" +
      subjectBadge(p.subject) +
      '<span class="task-title">' +
      esc(p.title) +
      "</span>" +
      '<span class="task-minutes">预计 ' +
      p.plannedMinutes +
      " 分钟</span></div>" +
      '<div class="task-criteria"><span class="criteria-label">完成标准</span>' +
      esc(p.completionCriteria) +
      "</div>" +
      '<div class="task-meta">' +
      statusBadge(row) +
      resourceHtml(row.resource) +
      actions +
      "</div>" +
      logLineHtml(row) +
      (completed
        ? ""
        : logFormHtml(row, {
            mode: "complete",
            open: openFormPlanId === p.id,
          })) +
      "</div>"
    );
  }

  function overdueRowHtml(row) {
    const p = row.plan;
    return (
      '<div class="task is-overdue" data-task="' +
      esc(p.id) +
      '">' +
      '<div class="task-head"><span class="task-order">' +
      esc(p.date.slice(5).replace("-", "/")) +
      "</span>" +
      subjectBadge(p.subject) +
      '<span class="task-title">' +
      esc(p.title) +
      "</span>" +
      '<span class="task-minutes">预计 ' +
      p.plannedMinutes +
      " 分钟</span></div>" +
      '<div class="task-meta"><span class="badge badge-overdue">' +
      icon("alert") +
      "逾期</span>" +
      '<span class="task-actions">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-move-today="' +
      esc(p.id) +
      '">移到今天</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-move-tomorrow="' +
      esc(p.id) +
      '">移到明天</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-skip="' +
      esc(p.id) +
      '">跳过</button>' +
      "</span></div></div>"
    );
  }

  async function renderToday() {
    const res = await F.today();
    if (!res.ok) {
      view.innerHTML = pageErrorHtml(res.error);
      return;
    }
    const v = res.value;
    const b = v.budget;
    const budgetCls = "budget-line" + (b.exceeded ? " is-exceeded" : "");
    const budgetNote = b.exceeded
      ? "　超出参考线 " +
        (b.plannedMinutes - b.referenceMinutes) +
        " 分钟（仅为参考，不自动调整）"
      : "";

    let html =
      '<div class="page-head">' +
      '<h1 class="page-title">今天 · <span class="meta" style="font-size:20px">' +
      esc(v.date) +
      "</span> " +
      weekday(v.date) +
      "</h1>" +
      '<div class="page-sub"><span class="meta">距考试 ' +
      v.daysUntilExam +
      " 天（" +
      esc(v.examDate) +
      "）</span>" +
      '<span class="' +
      budgetCls +
      '">今日已计划 ' +
      b.plannedMinutes +
      " / " +
      b.referenceMinutes +
      " 分钟" +
      budgetNote +
      "</span></div></div>";

    html += consoleHtml();
    html += flashHtml();

    if (v.overdue.length) {
      html +=
        '<section class="section"><h2 class="section-title is-overdue">逾期待处理<span class="count">' +
        v.overdue.length +
        "</span></h2>" +
        '<p class="section-note">过去日期仍未处理的任务，不会自动改期；请逐项选择移到今天、移到明天或跳过。补记已学过的内容请到「记录」页。</p>' +
        v.overdue.map(overdueRowHtml).join("") +
        "</section>";
    }

    html +=
      '<section class="section"><h2 class="section-title">今日任务<span class="count is-neutral">' +
      v.items.length +
      "</span></h2>";
    html += v.items.length
      ? v.items.map(todayTaskHtml).join("")
      : '<div class="empty-state">今天没有安排任务。</div>';
    html += "</section>";

    view.innerHTML = html;
    v.items.concat(v.overdue).forEach(function (row) {
      if (row.pending) pendingRefs[row.plan.id] = row.pending;
    });
    bindConsole(view);
    bindTodayActions(view);
    justCompletedId = null;
  }

  function bindTodayActions(root) {
    root.querySelectorAll("[data-open-form]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-open-form");
        openFormPlanId = openFormPlanId === id ? null : id;
        const form = root.querySelector('[data-form="' + CSS.escape(id) + '"]');
        if (form) form.classList.toggle("is-open", openFormPlanId === id);
        if (openFormPlanId === id) {
          const input = form.querySelector('[data-field="actualMinutes"]');
          if (input) input.focus();
        }
      });
    });
    root.querySelectorAll("[data-cancel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openFormPlanId = null;
        const form = root.querySelector(
          '[data-form="' + CSS.escape(btn.getAttribute("data-cancel")) + '"]'
        );
        if (form) form.classList.remove("is-open");
      });
    });
    root.querySelectorAll("[data-submit]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-submit");
        const taskEl = root.querySelector(
          '[data-task="' + CSS.escape(id) + '"]'
        );
        const formEl = taskEl.querySelector("[data-form]");
        const row = pendingRefs[id];
        if (!row) return;
        await submitComplete(row, formEl, renderToday);
      });
    });
    root.querySelectorAll("[data-move-today]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        doMoveSkip(btn, "today");
      });
    });
    root.querySelectorAll("[data-move-tomorrow]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        doMoveSkip(btn, "tomorrow");
      });
    });
    root.querySelectorAll("[data-skip]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        doMoveSkip(btn, "skip");
      });
    });
  }

  /* 当前视图中的 PendingRef 映射（opaque，只传回） */
  let pendingRefs = {};

  async function doMoveSkip(btn, mode) {
    const id =
      btn.getAttribute("data-move-today") ||
      btn.getAttribute("data-move-tomorrow") ||
      btn.getAttribute("data-skip");
    const ref = pendingRefs[id];
    if (!ref) return;
    const group = btn.closest(".task-meta");
    group.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("disabled", "");
    });
    let res;
    if (mode === "skip") res = await F.skipPending(ref);
    else res = await F.movePending(ref, mode);
    resetScenarioAfterCommand();
    if (res.ok) {
      if (mode === "skip") setFlash("success", "已跳过。历史中将保留该记录。");
      else
        setFlash(
          "success",
          mode === "today"
            ? "已移到今天，见「今日任务」。"
            : "已移到明天（本地日历次日）。"
        );
    } else {
      setFlash(
        errorKind(res.error),
        res.error.reason + "（" + res.error.code + "）已为你刷新当前视图。"
      );
    }
    renderToday(); /* 成功或 STATE_CHANGED 后主动重查当前视图 */
  }

  /* ---------- 记录页 ---------- */

  function recordRowHtml(row) {
    const p = row.plan;
    const terminal = p.status === "moved" || p.status === "skipped";
    const cls =
      "task" +
      (p.status === "completed" ? " is-completed" : "") +
      (terminal ? " is-terminal" : "") +
      (justCompletedId === p.id ? " just-completed" : "");
    const actions =
      p.status === "pending"
        ? '<span class="task-actions"><button type="button" class="btn btn-primary btn-sm" data-open-record-form="' +
          esc(p.id) +
          '">记录完成</button></span>'
        : "";
    return (
      '<div class="' +
      cls +
      '" data-task="' +
      esc(p.id) +
      '">' +
      '<div class="task-head"><span class="task-order">' +
      (p.order + 1) +
      ".</span>" +
      subjectBadge(p.subject) +
      '<span class="task-title">' +
      esc(p.title) +
      "</span>" +
      '<span class="task-minutes">预计 ' +
      p.plannedMinutes +
      " 分钟</span></div>" +
      '<div class="task-meta">' +
      statusBadge(row) +
      resourceHtml(row.resource) +
      actions +
      "</div>" +
      logLineHtml(row) +
      (p.status === "pending"
        ? logFormHtml(row, {
            mode: "backfill-record",
            open: openRecordFormId === p.id,
          })
        : "") +
      "</div>"
    );
  }

  function backfillPanelHtml(date) {
    const subjects = F.subjects();
    const subjectOptions = subjects
      .map(function (s) {
        return "<option>" + esc(s) + "</option>";
      })
      .join("");
    const body = backfillOpen
      ? '<div class="form-grid" style="margin-top:12px">' +
        '<div class="field"><label class="field-label">科目<span class="req">*</span></label>' +
        '<input class="input" data-bfield="subject" list="subject-list" placeholder="如 综合知识"><datalist id="subject-list">' +
        subjectOptions +
        "</datalist></div>" +
        '<div class="field"><label class="field-label">预计分钟<span class="req">*</span></label>' +
        '<input class="input" data-bfield="plannedMinutes" type="number" min="1" step="1" placeholder="如实填写当时预计"></div>' +
        '<div class="field span-2"><label class="field-label">标题<span class="req">*</span></label>' +
        '<input class="input" data-bfield="title" type="text" placeholder="当时计划学习的内容"></div>' +
        '<div class="field span-2"><label class="field-label">完成标准<span class="req">*</span></label>' +
        '<textarea class="textarea" data-bfield="completionCriteria" placeholder="做到什么程度算完成"></textarea></div>' +
        '<div class="field"><label class="field-label">实际分钟<span class="req">*</span></label>' +
        '<input class="input" data-bfield="actualMinutes" type="number" min="1" step="1" placeholder="如 45"></div>' +
        '<div class="field"><label class="field-label">成绩（可选）</label>' +
        '<input class="input" data-bfield="scoreText" type="text" placeholder="如 52/75"></div>' +
        '<div class="field span-2"><label class="field-label">学习总结<span class="req">*</span></label>' +
        '<textarea class="textarea" data-bfield="summary" placeholder="做了什么、结论是什么、卡在哪里"></textarea></div>' +
        "</div>" +
        '<div class="field-hint">仅补建「当时确有计划且记得预计时长」的学习；预计分钟如实填写，不用实际分钟冒充。学习日：' +
        esc(date) +
        "</div>" +
        '<div class="form-alerts" style="margin-top:8px"></div>' +
        '<div class="form-actions" style="margin-top:10px">' +
        '<button type="button" class="btn btn-primary" data-bsubmit><span class="btn-spinner"></span><span class="btn-text">新建补录并记录</span></button>' +
        "</div>"
      : "";
    return (
      '<div class="divider-label">无对应任务时才新建补录</div>' +
      '<div class="backfill-panel">' +
      '<div class="check-row"><input type="checkbox" id="no-corresponding"' +
      (backfillOpen ? " checked" : "") +
      ">" +
      '<label for="no-corresponding">我核对过：系统中（含其他日期与终态记录）没有与所学内容对应的任务</label></div>' +
      body +
      "</div>" +
      '<div class="info-line">' +
      icon("info") +
      "<span>补记＝当天已学、现在登记（日志留在学习日）；补做＝当天未学、另择日执行——请先在「今日」或「计划」页把任务移到执行日再完成后继，日志记执行日。当日列表为空不等于全系统无对应任务。</span></div>"
    );
  }

  async function renderRecord() {
    const res = await F.recording(recordDate);
    let html =
      '<div class="page-head"><h1 class="page-title">记录</h1></div>' +
      consoleHtml() +
      flashHtml();

    html +=
      '<div class="date-bar"><label class="field-label" for="record-date">学习日</label>' +
      '<input class="input" id="record-date" type="date" min="2026-09-06" max="' +
      esc(F.fixtureToday()) +
      '" value="' +
      esc(recordDate) +
      '">' +
      '<span class="date-bar-hint">可为今天或历史日期登记；日志日期 ＝ 学习日，不取登记日；新建补录仅限历史日期。</span></div>';

    if (!res.ok) {
      html +=
        '<div style="margin-top:12px">' +
        alertHtml("error", res.error.reason) +
        "</div>";
      view.innerHTML = html;
      bindConsole(view);
      bindRecordDate(view);
      return;
    }

    const v = res.value;
    html +=
      '<section class="section" style="margin-top:16px"><h2 class="section-title">' +
      esc(v.date) +
      " " +
      weekday(v.date) +
      '<span class="count is-neutral">' +
      v.items.length +
      "</span></h2>";
    html += v.items.length
      ? v.items.map(recordRowHtml).join("")
      : v.date < F.fixtureToday()
        ? '<div class="empty-state">该日期没有计划任务。当日列表为空不等于全系统无对应任务，请核对后再使用下方补建。</div>'
        : '<div class="empty-state">今天没有计划任务。</div>';
    html += "</section>";

    html +=
      v.date < F.fixtureToday()
        ? backfillPanelHtml(v.date)
        : '<div class="info-line">' +
          icon("info") +
          "<span>新建补录仅限历史日期，且当时确有计划、记得预计时长、系统中无对应任务；临时未计划学习不记录。今天请直接完成今日待处理任务。</span></div>";

    view.innerHTML = html;
    bindConsole(view);
    bindRecordDate(view);
    bindRecordActions(view, v);
    justCompletedId = null;
  }

  function alertHtml(kind, text) {
    return (
      '<div class="alert alert-' +
      kind +
      '" role="alert">' +
      icon("alert") +
      "<span>" +
      esc(text) +
      "</span></div>"
    );
  }

  function bindRecordDate(root) {
    const input = root.querySelector("#record-date");
    if (input)
      input.addEventListener("change", function () {
        recordDate = input.value;
        openRecordFormId = null;
        backfillOpen = false;
        renderRecord();
      });
  }

  function bindRecordActions(root, v) {
    v.items.forEach(function (row) {
      if (row.pending) pendingRefs[row.plan.id] = row.pending;
    });

    root.querySelectorAll("[data-open-record-form]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-open-record-form");
        openRecordFormId = openRecordFormId === id ? null : id;
        const form = root.querySelector('[data-form="' + CSS.escape(id) + '"]');
        if (form) form.classList.toggle("is-open", openRecordFormId === id);
        if (openRecordFormId === id) {
          const input = form.querySelector('[data-field="actualMinutes"]');
          if (input) input.focus();
        }
      });
    });
    root.querySelectorAll("[data-cancel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openRecordFormId = null;
        const form = root.querySelector(
          '[data-form="' + CSS.escape(btn.getAttribute("data-cancel")) + '"]'
        );
        if (form) form.classList.remove("is-open");
      });
    });
    root.querySelectorAll("[data-submit]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-submit");
        const formEl = root.querySelector(
          '[data-form="' + CSS.escape(id) + '"]'
        );
        const ref = pendingRefs[id];
        if (!ref || !formEl) return;
        await submitComplete(ref, formEl, renderRecord);
      });
    });

    const checkbox = root.querySelector("#no-corresponding");
    if (checkbox)
      checkbox.addEventListener("change", function () {
        backfillOpen = checkbox.checked;
        renderRecord();
      });

    const bsubmit = root.querySelector("[data-bsubmit]");
    if (bsubmit)
      bsubmit.addEventListener("click", async function () {
        const panel = root.querySelector(".backfill-panel");
        const val = function (f) {
          const el = panel.querySelector('[data-bfield="' + f + '"]');
          return el ? el.value : "";
        };
        const input = {
          draft: v.draft,
          noCorrespondingTaskConfirmed: true,
          plan: {
            subject: val("subject"),
            title: val("title"),
            completionCriteria: val("completionCriteria"),
            plannedMinutes: val("plannedMinutes"),
          },
          log: {
            actualMinutes: val("actualMinutes"),
            summary: val("summary"),
            scoreText: val("scoreText"),
          },
        };
        setFormBusy(panel, true);
        panel.querySelectorAll(".is-invalid").forEach(function (el) {
          el.classList.remove("is-invalid");
        });
        panel.querySelectorAll(".field-error").forEach(function (el) {
          el.remove();
        });
        panel.querySelector(".form-alerts").innerHTML = "";
        let res;
        try {
          res = await F.createBackfill(input);
        } finally {
          resetScenarioAfterCommand();
        }
        if (res.ok) {
          justCompletedId = res.value.plan.id;
          backfillOpen = false;
          setFlash(
            "success",
            "已补建并记录 · 学习日 " +
              res.value.log.date +
              "。来源标记为 backfill。"
          );
          renderRecord();
          return;
        }
        setFormBusy(panel, false);
        if (res.error.code === "INVALID_INPUT" && res.error.field) {
          showFieldError(panel, res.error.field, res.error.reason);
          return;
        }
        showFormAlert(
          panel,
          errorKind(res.error),
          res.error.reason + "（" + res.error.code + "）已保留你的输入。",
          true
        );
      });
  }

  /* ---------- 随票占位页 ---------- */

  const TICKETS = {
    plan: [
      [
        "T1",
        "计划页：按日期查看 / 添加 / 删除 / 排序",
        "仅未产生记录且未被移动链引用的 pending 可永久删除；终态不可硬删；日内排序。",
      ],
      [
        "T2",
        "移动：移到今天 / 明天 / 指定日期",
        "仅 pending 可移动；三个入口同一规则；目标日期等于原日期零修改；同一 lineage 至多一个 pending；链末端不可硬删。",
      ],
      [
        "T3",
        "跳过 / 删除的过期操作反馈",
        "写事务重读当前状态；旧标签页过期操作放弃并提示，沿用 DESIGN.md §11-5 模式。",
      ],
      [
        "T7",
        "备份：导出一致快照 / 导入校验与原子替换",
        "导出读取覆盖全部表的同一只读事务快照，不由 UI 缓存拼装；导入校验失败零修改并展示原因；确认后原子完整替换（含 AppMeta）；兼容历史 seedVersion。入口位置随票确认。",
      ],
      [
        "T8",
        "初始化页级状态",
        "首开初始化进行态；SEED_UNAVAILABLE / INVALID_SEED 页级错误（反馈样式见 §11-6）。",
      ],
      [
        "T9",
        "设置：考试日期 / 默认每日分钟",
        "仅影响剩余天数与今日 X / Y 显示；不参与任何自动排程。",
      ],
    ],
    history: [
      [
        "T5",
        "历史页：计划 vs 实际",
        "按日期展示计划与完成情况；moved 显示「已移至 YYYY-MM-DD」绝对日期；skipped、backfill 标识可区分。",
      ],
      [
        "T2a",
        "移动链摘要",
        "采用 PROTO-01 结论格式：原计划日 X ｜ 最终：Y 状态 ｜ 改期 N 次 ｜ 本链待处理 Z 项。",
      ],
      [
        "T4",
        "日志编辑",
        "仅 actualMinutes / summary / scoreText 三字段；不改变 completed 终态与日期；不删除完成日志。",
      ],
    ],
    resources: [
      [
        "T6",
        "资源页：网页跳转 / PDF 文件名复制",
        "网页资源外链跳转（target=_blank, rel=noopener）；本地 PDF 仅显示文件名并支持复制；不打开、不上传、不定位文件、不保存本机绝对路径。",
      ],
    ],
  };

  function renderTicketPage(key, title) {
    const items = TICKETS[key] || [];
    let html =
      '<div class="page-head"><h1 class="page-title">' +
      esc(title) +
      "</h1>" +
      '<div class="page-sub"><span class="meta">本页规范与参考实现随对应票补充（DESIGN.md §12）</span></div></div>';
    html +=
      '<div class="empty-state" style="margin-bottom:16px">本页尚未进入本轮设计范围。首个闭环已实现于「今日」「记录」；以下为该页待拆票的状态清单。</div>';
    html +=
      '<ul class="ticket-list">' +
      items
        .map(function (t) {
          return (
            '<li><span class="ticket-no">' +
            esc(t[0]) +
            '</span><span><span class="ticket-title">' +
            esc(t[1]) +
            '</span><div class="ticket-desc">' +
            esc(t[2]) +
            "</div></span></li>"
          );
        })
        .join("") +
      "</ul>";
    view.innerHTML = html;
  }

  function pageErrorHtml(error) {
    return (
      '<div class="page-head"><h1 class="page-title">今日</h1></div>' +
      alertHtml("error", error.reason + "（" + error.code + "）")
    );
  }

  /* ---------- 路由 ---------- */

  const ROUTES = {
    today: { title: "今日", render: renderToday },
    record: { title: "记录", render: renderRecord },
    plan: {
      title: "计划",
      render: function () {
        renderTicketPage("plan", "计划");
      },
    },
    history: {
      title: "历史",
      render: function () {
        renderTicketPage("history", "历史");
      },
    },
    resources: {
      title: "资源",
      render: function () {
        renderTicketPage("resources", "资源");
      },
    },
  };

  function currentRoute() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    return ROUTES[h] ? h : "today";
  }

  async function route() {
    const name = currentRoute();
    document.querySelectorAll(".nav-item").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-route") === name);
    });
    /* 重查时重建 PendingRef 映射（renderToday / renderRecord 内部填充） */
    pendingRefs = {};
    await ROUTES[name].render();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", function () {
    flash = null;
    openFormPlanId = openRecordFormId = null;
    route();
  });

  route();
})();
