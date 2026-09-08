/* ==========================================================================
   fixture.js — 设计参考用内存 fixture
   内容来源：public/data/study-plan.seed.json（seedVersion sysanalyst-2026-09-06.v1）
   摘取 2026-09-08 至 2026-09-12 的 PlanItem 与全部 15 个 Resource，逐字段未改写。
   StudyLog 为演示数据（真实种子不含任何日志），逐条标注 FIXTURE-LOG。
   边界：本文件模拟 FLOW-01 的公开 command/query 形状与失败码，用于验证界面与反馈；
   不接 IndexedDB，不构成事务、并发、刷新持久性证据。
   逾期项的 移到今天/移到明天/跳过 仅为视觉演示，移动链事务语义随计划票实现。
   ========================================================================== */

(function () {
  "use strict";

  var FIXTURE_TODAY = "2026-09-12"; // fixture 的"本地今日"（星期六）

  /* ---------- 真实种子内容（未改写） ---------- */

  var SEED_RESOURCES = [
    {
      id: "resource-web-public",
      title: "公共课：架构和系分公共课",
      type: "web",
      url: "https://space.bilibili.com/112111328/lists/3187606?type=season",
    },
    {
      id: "resource-web-knowledge",
      title: "专业课：综合知识",
      type: "web",
      url: "https://www.cheko.cc/chapter?courseId=6",
    },
    {
      id: "resource-web-cases",
      title: "专业课：案例分析",
      type: "web",
      url: "https://www.cheko.cc/chapter?courseId=7",
    },
    {
      id: "resource-web-essay",
      title: "专业课：论文",
      type: "web",
      url: "https://www.cheko.cc/chapter?courseId=8",
    },
    {
      id: "resource-web-past-exams",
      title: "系统分析师历年真题",
      type: "web",
      url: "https://www.cheko.cc/past_exam?subject=1",
    },
    {
      id: "resource-web-daily",
      title: "系统分析师每日一练",
      type: "web",
      url: "https://www.cheko.cc/daily_practice?subject=1",
    },
    {
      id: "resource-web-official",
      title: "中国计算机技术职业资格网",
      type: "web",
      url: "https://www.ruankao.org.cn/",
    },
    {
      id: "resource-web-registration",
      title: "全国计算机技术与软件专业技术资格考试报名平台",
      type: "web",
      url: "https://bm.ruankao.org.cn/sign/welcome",
    },
    {
      id: "resource-pdf-handbook",
      title: "红宝书一本全.pdf",
      type: "local-file",
      filename: "红宝书一本全.pdf",
    },
    {
      id: "resource-pdf-questions",
      title: "选择真题分类解析.pdf",
      type: "local-file",
      filename: "选择真题分类解析.pdf",
    },
    {
      id: "resource-pdf-cases",
      title: "案例真题分类解析.pdf",
      type: "local-file",
      filename: "案例真题分类解析.pdf",
    },
    {
      id: "resource-pdf-case-guide",
      title: "案例冲刺宝典.pdf",
      type: "local-file",
      filename: "案例冲刺宝典.pdf",
    },
    {
      id: "resource-pdf-essay-guide",
      title: "论文写作宝典.pdf",
      type: "local-file",
      filename: "论文写作宝典.pdf",
    },
    {
      id: "resource-pdf-essay-topics",
      title: "论文押题.pdf",
      type: "local-file",
      filename: "论文押题.pdf",
    },
    {
      id: "resource-pdf-exam-guide",
      title: "考前指南.pdf",
      type: "local-file",
      filename: "考前指南.pdf",
    },
  ];

  var SEED_SETTINGS = { examDate: "2026-10-24", defaultDailyMinutes: 90 };

  /* 09-08 */
  var P_0908_1 = {
    id: "seed-20260908-01",
    date: "2026-09-08",
    subject: "综合知识",
    title: "需求工程：获取、分析、验证与管理",
    completionCriteria:
      "选看需求工程对应片段，写出获取、分析、定义验证、管理各阶段的输入和产物。",
    plannedMinutes: 30,
    resourceId: "resource-web-public",
    order: 0,
    status: "pending",
    lineageId: "seed-20260908-01",
    source: "seed",
  };
  var P_0908_2 = {
    id: "seed-20260908-02",
    date: "2026-09-08",
    subject: "综合知识",
    title: "结构化与面向对象分析对比",
    completionCriteria:
      "各画一个分析方法的简图，列出数据流图、数据字典、用例及分析类的用途，闭卷复述方法与产物的对应关系。",
    plannedMinutes: 45,
    resourceId: "resource-pdf-handbook",
    order: 1,
    status: "pending",
    lineageId: "seed-20260908-02",
    source: "seed",
  };
  var P_0908_3 = {
    id: "seed-20260908-03",
    date: "2026-09-08",
    subject: "综合知识",
    title: "需求分析分类题验证",
    completionCriteria:
      "独立完成五道需求分析分类题，说明题干中的方法识别信号，并记录仍易混的术语。",
    plannedMinutes: 15,
    resourceId: "resource-pdf-questions",
    order: 2,
    status: "pending",
    lineageId: "seed-20260908-03",
    source: "seed",
  };
  /* 09-09 */
  var P_0909_1 = {
    id: "seed-20260909-01",
    date: "2026-09-09",
    subject: "综合知识",
    title: "系统设计与架构基础输入",
    completionCriteria:
      "学习系统设计导学及结构化、面向对象设计片段，画出从分析模型到设计产物的关系图。",
    plannedMinutes: 45,
    resourceId: "resource-web-public",
    order: 0,
    status: "pending",
    lineageId: "seed-20260909-01",
    source: "seed",
  };
  var P_0909_2 = {
    id: "seed-20260909-02",
    date: "2026-09-09",
    subject: "综合知识",
    title: "设计方法与架构高频点压缩",
    completionCriteria:
      "完成结构化与面向对象设计对比，列出至少三种架构相关质量属性及对应设计关注点。",
    plannedMinutes: 25,
    resourceId: "resource-pdf-handbook",
    order: 1,
    status: "pending",
    lineageId: "seed-20260909-02",
    source: "seed",
  };
  var P_0909_3 = {
    id: "seed-20260909-03",
    date: "2026-09-09",
    subject: "论文",
    title: "选定可真实说明的论文项目",
    completionCriteria:
      "阅读项目选材要求，选定一个本人确有经历的项目，写出背景、本人角色和可说明的事实；不虚构规模或成绩。",
    plannedMinutes: 20,
    resourceId: "resource-pdf-essay-guide",
    order: 2,
    status: "pending",
    lineageId: "seed-20260909-03",
    source: "seed",
  };
  /* 09-10 */
  var P_0910_1 = {
    id: "seed-20260910-01",
    date: "2026-09-10",
    subject: "综合知识",
    title: "数据库：事务、并发控制与分布式",
    completionCriteria:
      "选看控制功能、分布式数据库和 NoSQL 片段，写出事务特性、并发异常及关系型与 NoSQL 的适用边界。",
    plannedMinutes: 30,
    resourceId: "resource-web-public",
    order: 0,
    status: "pending",
    lineageId: "seed-20260910-01",
    source: "seed",
  };
  var P_0910_2 = {
    id: "seed-20260910-02",
    date: "2026-09-10",
    subject: "综合知识",
    title: "整理数据库高频易混点",
    completionCriteria:
      "完成范式、事务隔离、并发控制和分布式数据库易混表，闭卷解释至少五个高频概念并标 A/B/C。",
    plannedMinutes: 40,
    resourceId: "resource-pdf-handbook",
    order: 1,
    status: "pending",
    lineageId: "seed-20260910-02",
    source: "seed",
  };
  var P_0910_3 = {
    id: "seed-20260910-03",
    date: "2026-09-10",
    subject: "综合知识",
    title: "数据库分类题验证",
    completionCriteria:
      "独立完成八道覆盖规范化与事务的分类题，写出错题识别信号，并重算一个原本做错的例子。",
    plannedMinutes: 20,
    resourceId: "resource-pdf-questions",
    order: 2,
    status: "pending",
    lineageId: "seed-20260910-03",
    source: "seed",
  };
  /* 09-11 */
  var P_0911_1 = {
    id: "seed-20260911-01",
    date: "2026-09-11",
    subject: "综合知识",
    title: "诊断前修复三个优先漏洞",
    completionCriteria:
      "从本周 A/B/C 标记中只选三个优先漏洞，逐个查证并闭卷复述；记下周末诊断需要特别关注的题型。",
    plannedMinutes: 40,
    resourceId: "resource-pdf-handbook",
    order: 0,
    status: "pending",
    lineageId: "seed-20260911-01",
    source: "seed",
  };
  var P_0911_2 = {
    id: "seed-20260911-02",
    date: "2026-09-11",
    subject: "论文",
    title: "补齐项目背景与本人职责",
    completionCriteria:
      "在已选项目上写清背景、目标、参与范围和本人职责，区分本人完成与团队完成的工作。",
    plannedMinutes: 20,
    resourceId: "resource-pdf-essay-guide",
    order: 1,
    status: "pending",
    lineageId: "seed-20260911-02",
    source: "seed",
  };
  /* 09-12（fixture 今日） */
  var P_0912_1 = {
    id: "seed-20260912-01",
    date: "2026-09-12",
    subject: "综合知识",
    title: "选择首份完整未做诊断卷",
    completionCriteria:
      "确认科目为系统分析师，登记所选年份、有效题数及满分、是否见过答案；优先选择完整未做卷，保留最新完整卷供模拟。",
    plannedMinutes: 15,
    resourceId: "resource-web-past-exams",
    order: 0,
    status: "pending",
    lineageId: "seed-20260912-01",
    source: "seed",
  };
  var P_0912_2 = {
    id: "seed-20260912-02",
    date: "2026-09-12",
    subject: "综合知识",
    title: "年度题组训练 1：限时诊断",
    completionCriteria:
      "独立完成已选题组并记录实际用时、题数和正确数；标记错、猜、不确定；缺题或分段必须注明，不冒充完整限时卷。",
    plannedMinutes: 150,
    resourceId: "resource-web-past-exams",
    order: 1,
    status: "pending",
    lineageId: "seed-20260912-02",
    source: "seed",
  };
  var P_0912_3 = {
    id: "seed-20260912-03",
    date: "2026-09-12",
    subject: "综合知识",
    title: "诊断卷初步复盘与错误分类",
    completionCriteria:
      "按考点检索诊断中的错、猜、不确定项，分别记录错误原因、正确规则和同类题识别信号。",
    plannedMinutes: 60,
    resourceId: "resource-pdf-questions",
    order: 2,
    status: "pending",
    lineageId: "seed-20260912-03",
    source: "seed",
  };
  var P_0912_4 = {
    id: "seed-20260912-04",
    date: "2026-09-12",
    subject: "复盘",
    title: "记录诊断基线与次日入口",
    completionCriteria:
      "记录按有效题数计算的基线正确率、卷面完整性和三个优先漏洞；明确次日先复盘的题号与教材主题。",
    plannedMinutes: 15,
    resourceId: "resource-pdf-handbook",
    order: 3,
    status: "pending",
    lineageId: "seed-20260912-04",
    source: "seed",
  };

  /* ---------- fixture 初始状态 ---------- */

  function initialState() {
    var items = [
      P_0908_1,
      P_0908_2,
      P_0908_3,
      P_0909_1,
      P_0909_2,
      P_0909_3,
      P_0910_1,
      P_0910_2,
      P_0910_3,
      P_0911_1,
      P_0911_2,
      P_0912_1,
      P_0912_2,
      P_0912_3,
      P_0912_4,
    ].map(function (p) {
      return Object.assign({}, p);
    });

    var byId = {};
    items.forEach(function (p) {
      byId[p.id] = p;
    });

    /* 终态与移动事实（fixture 场景设定） */
    byId["seed-20260908-01"].status = "completed";
    byId["seed-20260908-02"].status = "skipped";
    byId["seed-20260908-03"].status = "skipped";
    byId["seed-20260909-03"].status = "completed";
    byId["seed-20260910-03"].status = "completed";
    byId["seed-20260911-02"].status = "completed";
    byId["seed-20260912-01"].status = "completed";

    /* 09-09-02 已移动 → 后继在 09-10（演示 moved 事实与 lineage 沿用） */
    byId["seed-20260909-02"].status = "moved";
    byId["seed-20260909-02"].movedToPlanItemId = "fixture-20260909-02-m1";
    var m1 = {
      id: "fixture-20260909-02-m1",
      date: "2026-09-10",
      subject: "综合知识",
      title: "设计方法与架构高频点压缩",
      completionCriteria:
        "完成结构化与面向对象设计对比，列出至少三种架构相关质量属性及对应设计关注点。",
      plannedMinutes: 25,
      resourceId: "resource-pdf-handbook",
      order: 3,
      status: "pending",
      lineageId: "seed-20260909-02",
      source: "seed",
    };
    items.push(m1);
    byId[m1.id] = m1;

    /* FIXTURE-LOG：演示数据，真实种子不含 StudyLog；均满足 date === PlanItem.date */
    var logs = [
      {
        id: "fixture-log-0908-01",
        planItemId: "seed-20260908-01",
        date: "2026-09-08",
        actualMinutes: 35,
        summary: "写出获取、分析、定义验证、管理各阶段的输入和产物清单。",
      },
      {
        id: "fixture-log-0909-03",
        planItemId: "seed-20260909-03",
        date: "2026-09-09",
        actualMinutes: 25,
        summary:
          "选定本人参与过的仓储系统改造项目，写出背景、本人角色与可说明事实。",
      },
      {
        id: "fixture-log-0910-03",
        planItemId: "seed-20260910-03",
        date: "2026-09-10",
        actualMinutes: 25,
        summary: "完成八道规范化与事务分类题，整理错题识别信号。",
        scoreText: "6/8",
      },
      {
        id: "fixture-log-0911-02",
        planItemId: "seed-20260911-02",
        date: "2026-09-11",
        actualMinutes: 20,
        summary: "补齐项目背景与本人职责，区分本人完成与团队完成的工作。",
      },
      {
        id: "fixture-log-0912-01",
        planItemId: "seed-20260912-01",
        date: "2026-09-12",
        actualMinutes: 15,
        summary:
          "选定 2023 年上半年完整未做卷，登记有效题数与满分，最新完整卷保留作模拟。",
      },
    ];

    return {
      initializedSeedVersion: "sysanalyst-2026-09-06.v1",
      settings: Object.assign({}, SEED_SETTINGS),
      resources: SEED_RESOURCES.map(function (r) {
        return Object.assign({}, r);
      }),
      planItems: items,
      studyLogs: logs,
      drafts: {}, // date → { id, date, reservedPlanId, reservedLogId, snapshot }
      seq: 0,
    };
  }

  var state = initialState();
  var scenario = "normal"; // normal | slow | stale | duplicate

  /* ---------- 工具 ---------- */

  function delay(ms) {
    return new Promise(function (res) {
      setTimeout(res, ms);
    });
  }
  function latency() {
    return scenario === "slow" ? 1800 : 260;
  }

  function ok(value) {
    return { ok: true, value: value };
  }
  function err(code, reason, field) {
    var e = { code: code, reason: reason };
    if (field) e.field = field;
    return { ok: false, error: e };
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function byId(id) {
    for (var i = 0; i < state.planItems.length; i++) {
      if (state.planItems[i].id === id) return state.planItems[i];
    }
    return null;
  }
  function logFor(planItemId) {
    for (var i = 0; i < state.studyLogs.length; i++) {
      if (state.studyLogs[i].planItemId === planItemId)
        return state.studyLogs[i];
    }
    return null;
  }
  function resourceFor(id) {
    if (!id) return null;
    for (var i = 0; i < state.resources.length; i++) {
      if (state.resources[i].id === id) return state.resources[i];
    }
    return null;
  }

  function localDaysBetween(fromDate, toDate) {
    function p(s) {
      var a = s.split("-");
      return new Date(+a[0], +a[1] - 1, +a[2]);
    }
    return Math.round((p(toDate) - p(fromDate)) / 86400000);
  }

  function cmpByDayOrder(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.order - b.order;
  }

  /* PendingRef / BackfillDraft：opaque 引用，绑定 query 时观察到的事实，调用者只传回 */
  function makePendingRef(plan) {
    return (
      "pref:" +
      btoa(
        unescape(
          encodeURIComponent(
            JSON.stringify({
              id: plan.id,
              status: plan.status,
              lineageId: plan.lineageId,
              date: plan.date,
            })
          )
        )
      )
    );
  }
  function parsePendingRef(ref) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(ref.slice(5)))));
    } catch (e) {
      return null;
    }
  }

  function makeRow(plan) {
    var row = { plan: clone(plan) };
    var res = resourceFor(plan.resourceId);
    if (res) row.resource = clone(res);
    var log = logFor(plan.id);
    if (log) row.log = clone(log);
    if (plan.status === "pending") row.pending = makePendingRef(plan);
    if (plan.status === "moved" && plan.movedToPlanItemId) {
      var succ = byId(plan.movedToPlanItemId);
      if (succ) row.movedToDate = succ.date;
    }
    return row;
  }

  /* 日志字段校验（FLOW-01：实际分钟正整数，总结 trim 后非空，成绩可选） */
  function validateLog(log) {
    var minutes = Number(log.actualMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      return err("INVALID_INPUT", "实际分钟必须是正整数。", "actualMinutes");
    }
    if (!log.summary || !String(log.summary).trim()) {
      return err("INVALID_INPUT", "学习总结不能为空。", "summary");
    }
    return null;
  }

  /* ---------- 公开 query / command（形状对齐 FLOW-01-I） ---------- */

  var api = {};

  api.fixtureToday = function () {
    return FIXTURE_TODAY;
  };

  api.today = function () {
    return delay(latency() / 4).then(function () {
      var items = state.planItems
        .filter(function (p) {
          return p.date === FIXTURE_TODAY;
        })
        .sort(cmpByDayOrder)
        .map(makeRow);
      var overdue = state.planItems
        .filter(function (p) {
          return p.date < FIXTURE_TODAY && p.status === "pending";
        })
        .sort(cmpByDayOrder)
        .map(makeRow);
      var planned = state.planItems
        .filter(function (p) {
          return (
            p.date === FIXTURE_TODAY &&
            (p.status === "pending" || p.status === "completed")
          );
        })
        .reduce(function (s, p) {
          return s + p.plannedMinutes;
        }, 0);
      var y = state.settings.defaultDailyMinutes;
      return ok({
        date: FIXTURE_TODAY,
        items: items,
        overdue: overdue,
        examDate: state.settings.examDate,
        daysUntilExam: localDaysBetween(FIXTURE_TODAY, state.settings.examDate),
        budget: {
          plannedMinutes: planned,
          referenceMinutes: y,
          exceeded: planned > y,
        },
      });
    });
  };

  api.recording = function (date) {
    return delay(latency() / 4).then(function () {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return err(
          "INVALID_INPUT",
          "日期必须是合法的 YYYY-MM-DD 本地日历日。",
          "date"
        );
      }
      if (date > FIXTURE_TODAY) {
        return err("INVALID_INPUT", "只能登记今天或历史日期。", "date");
      }
      /* 同一日期返回同一草稿：重复进入/重试沿用固定预留 ID（防同次提交重复创建） */
      if (!state.drafts[date]) {
        state.seq += 1;
        state.drafts[date] = {
          id: "draft-" + date + "-" + state.seq,
          date: date,
          reservedPlanId: "fixture-backfill-" + date + "-" + state.seq,
          reservedLogId: "fixture-backfill-log-" + date + "-" + state.seq,
        };
      }
      var items = state.planItems
        .filter(function (p) {
          return p.date === date;
        })
        .sort(cmpByDayOrder)
        .map(makeRow);
      return ok({ date: date, items: items, draft: state.drafts[date].id });
    });
  };

  api.complete = function (pendingRef, log) {
    return delay(latency()).then(function () {
      var facts = parsePendingRef(pendingRef);
      if (!facts)
        return err("INVALID_INPUT", "完成引用无效，请重新查询后操作。");
      var target = byId(facts.id);

      /* 场景：模拟他处（旧标签页/另一连接）已抢先完成同一目标 */
      if (scenario === "stale" && target && target.status === "pending") {
        target.status = "completed";
        state.studyLogs.push({
          id: "fixture-log-elsewhere-" + target.id,
          planItemId: target.id,
          date: target.date,
          actualMinutes: target.plannedMinutes,
          summary: "（他处提交的记录：模拟另一标签页已抢先完成）",
        });
        return err(
          "STATE_CHANGED",
          "任务状态已在别处变更（可能来自另一个标签页）。该任务已被完成为他处记录。"
        );
      }
      /* 场景：模拟同次提交已被处理（重复提交） */
      if (scenario === "duplicate") {
        return err(
          "STATE_CHANGED",
          "同一次提交已被处理（重复提交），未重复写入。"
        );
      }

      var bad = validateLog(log);
      if (bad) return bad;

      if (!target)
        return err("STATE_CHANGED", "目标任务已不存在，请重新查询。");
      if (target.status !== "pending" || logFor(target.id)) {
        return err(
          "STATE_CHANGED",
          "目标任务已不再是待处理状态，请核对最新状态。"
        );
      }

      target.status = "completed";
      var newLog = {
        id: "fixture-log-" + target.id,
        planItemId: target.id,
        date: target.date /* 日志日期 = 计划日期（学习日），不取登记日 */,
        actualMinutes: Number(log.actualMinutes),
        summary: String(log.summary).trim(),
      };
      if (log.scoreText && String(log.scoreText).trim())
        newLog.scoreText = String(log.scoreText).trim();
      state.studyLogs.push(newLog);
      return ok({ plan: clone(target), log: clone(newLog) });
    });
  };

  api.createBackfill = function (input) {
    return delay(latency()).then(function () {
      var draft = null;
      Object.keys(state.drafts).forEach(function (k) {
        if (state.drafts[k].id === input.draft) draft = state.drafts[k];
      });
      if (!draft)
        return err(
          "STATE_CHANGED",
          "补录草稿已失效，请重新查询该日期后再提交。"
        );
      if (draft.date >= FIXTURE_TODAY) {
        return err(
          "INVALID_INPUT",
          "新建补录仅限早于今天的历史日期；今天请直接完成今日待处理任务。",
          "date"
        );
      }
      if (input.noCorrespondingTaskConfirmed !== true) {
        return err("INVALID_INPUT", "请先核对并确认当日没有对应任务。");
      }

      /* 场景：模拟他处在草稿签发后补录了同日内容 → 草稿所依据事实已变 */
      if (scenario === "stale") {
        state.planItems.push({
          id: draft.reservedPlanId + "-elsewhere",
          date: draft.date,
          subject: "综合知识",
          title: "（他处新增的历史补录：模拟草稿过期）",
          completionCriteria: "模拟另一标签页在草稿签发后完成补录。",
          plannedMinutes: 30,
          order: 90,
          status: "completed",
          lineageId: draft.reservedPlanId + "-elsewhere",
          source: "backfill",
        });
        state.studyLogs.push({
          id: draft.reservedLogId + "-elsewhere",
          planItemId: draft.reservedPlanId + "-elsewhere",
          date: draft.date,
          actualMinutes: 30,
          summary: "（他处提交的记录：模拟草稿过期）",
        });
        delete state.drafts[draft.date];
        return err(
          "STATE_CHANGED",
          "该日期的记录已在别处变更，补录草稿已过期。请核对最新状态后重试。"
        );
      }
      /* 场景：模拟同次提交已被处理（预留 ID 已存在 → 判重） */
      var already = byId(draft.reservedPlanId);
      if (already || scenario === "duplicate") {
        return err(
          "DUPLICATE_SUBMISSION",
          "同一次提交已创建过对应任务与日志，未重复写入。"
        );
      }

      var plan = input.plan || {};
      if (!plan.subject || !String(plan.subject).trim())
        return err("INVALID_INPUT", "科目不能为空。", "subject");
      if (!plan.title || !String(plan.title).trim())
        return err("INVALID_INPUT", "标题不能为空。", "title");
      if (!plan.completionCriteria || !String(plan.completionCriteria).trim())
        return err("INVALID_INPUT", "完成标准不能为空。", "completionCriteria");
      var planned = Number(plan.plannedMinutes);
      if (!Number.isInteger(planned) || planned <= 0)
        return err("INVALID_INPUT", "预计分钟必须是正整数。", "plannedMinutes");
      if (plan.resourceId && !resourceFor(plan.resourceId))
        return err("INVALID_INPUT", "关联资源不存在。", "resourceId");
      var bad = validateLog(input.log);
      if (bad) return bad;

      var newPlan = {
        id: draft.reservedPlanId,
        date: draft.date,
        subject: String(plan.subject).trim(),
        title: String(plan.title).trim(),
        completionCriteria: String(plan.completionCriteria).trim(),
        plannedMinutes: planned,
        order: 80 + state.seq,
        status: "completed",
        lineageId: draft.reservedPlanId,
        source: "backfill",
      };
      if (plan.resourceId) newPlan.resourceId = plan.resourceId;
      var newLog = {
        id: draft.reservedLogId,
        planItemId: newPlan.id,
        date: draft.date,
        actualMinutes: Number(input.log.actualMinutes),
        summary: String(input.log.summary).trim(),
      };
      if (input.log.scoreText && String(input.log.scoreText).trim())
        newLog.scoreText = String(input.log.scoreText).trim();
      state.planItems.push(newPlan);
      state.studyLogs.push(newLog);
      return ok({ plan: clone(newPlan), log: clone(newLog) });
    });
  };

  /* ---------- 逾期处理（视觉演示：移动/跳过的事务语义随计划票实现） ---------- */

  function nextLocalDate(date) {
    var a = date.split("-");
    var d = new Date(+a[0], +a[1] - 1, +a[2]);
    d.setDate(d.getDate() + 1);
    function pad(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }

  api.movePending = function (pendingRef, mode) {
    return delay(latency() / 2).then(function () {
      var facts = parsePendingRef(pendingRef);
      var target = facts && byId(facts.id);
      if (!target || target.status !== "pending") {
        return err(
          "STATE_CHANGED",
          "目标任务已不再是待处理状态，请核对最新状态。"
        );
      }
      var toDate =
        mode === "today" ? FIXTURE_TODAY : nextLocalDate(FIXTURE_TODAY);
      state.seq += 1;
      var succ = {
        id: "fixture-moved-" + target.id + "-" + state.seq,
        date: toDate,
        subject: target.subject,
        title: target.title,
        completionCriteria: target.completionCriteria,
        plannedMinutes: target.plannedMinutes,
        order: 50 + state.seq,
        status: "pending",
        lineageId: target.lineageId,
        source: target.source,
      };
      if (target.resourceId) succ.resourceId = target.resourceId;
      target.status = "moved";
      target.movedToPlanItemId = succ.id;
      state.planItems.push(succ);
      return ok({ from: clone(target), to: clone(succ) });
    });
  };

  api.skipPending = function (pendingRef) {
    return delay(latency() / 2).then(function () {
      var facts = parsePendingRef(pendingRef);
      var target = facts && byId(facts.id);
      if (!target || target.status !== "pending") {
        return err(
          "STATE_CHANGED",
          "目标任务已不再是待处理状态，请核对最新状态。"
        );
      }
      target.status = "skipped";
      return ok({ plan: clone(target) });
    });
  };

  /* ---------- 演示场景控制 ---------- */

  api.setScenario = function (s) {
    scenario = s;
  };
  api.getScenario = function () {
    return scenario;
  };
  api.reset = function () {
    state = initialState();
    scenario = "normal";
  };
  api.subjects = function () {
    var seen = [];
    state.planItems.forEach(function (p) {
      if (seen.indexOf(p.subject) < 0) seen.push(p.subject);
    });
    return seen;
  };

  window.StudyFixture = api;
})();
