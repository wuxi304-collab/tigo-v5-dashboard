// TIGO V5 — Salesforce Lightning 风格前端 (Phase 3.0)
// 业务流: Account + Evidence + Gate + Hypothesis + Interaction + Sample + NBA + Score
// 数据存 localStorage, 跨页面持久化

(function () {
  'use strict';

  // ============================================
  // Storage
  // ============================================
  const STORAGE_KEY = 'tigo.v2.accounts';

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveAll(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ============================================
  // Domain Rules (与 apps/api 1:1)
  // ============================================
  const SOURCE_TYPE_TO_GATES = {
    TIANYANCHA: ['G1'], OFFICIAL_REGISTRY: ['G1'],
    OFFICIAL_WEBSITE: ['G2'], OFFICIAL_CATALOG: ['G2'], OFFICIAL_ACCOUNT: ['G2'],
    EXHIBITION: ['G3'], ADVERTISEMENT: ['G3'], RECRUITMENT: ['G3'], PATENT: ['G3'],
    EIA: ['G3'], TENDER: ['G3', 'G4'], ASSOCIATION: ['G3'], GOVERNMENT: ['G3'],
    OWNER_VENDOR_LIST: ['G4'], OEM_ANNOUNCEMENT: ['G4'], AWARD: ['G4'],
    PROJECT_RESULT: ['G4'], OFFICIAL_CUSTOMER_CASE: ['G4'],
    CUSTOMER_INQUIRY: ['G5'], CUSTOMER_DRAWING: ['G5'],
    CALL_CONFIRMED: ['G5'], MEETING_CONFIRMED: ['G5'], EMAIL_CONFIRMED: ['G5'],
    SAMPLE_RESULT: ['G6'], TRIAL_ORDER: ['G6'], REPEAT_ORDER: ['G6'],
  };

  const GATE_RULES = {
    G1: { required: ['TIANYANCHA', 'OFFICIAL_REGISTRY'], minReliability: 80, minCount: 1, desc: '企业主体 + 经营状态可接受' },
    G2: { required: ['OFFICIAL_WEBSITE', 'OFFICIAL_CATALOG', 'OFFICIAL_ACCOUNT'], minReliability: 70, minCount: 1, desc: '官网产品 / 工艺 / 设备已确认' },
    G3: { required: ['EXHIBITION', 'ADVERTISEMENT', 'RECRUITMENT', 'PATENT', 'EIA', 'TENDER', 'ASSOCIATION', 'GOVERNMENT'], minReliability: 60, minCount: 2, minAvg: 60, desc: '≥ 2 类制造 / 市场活动' },
    G4: { required: ['OWNER_VENDOR_LIST', 'OEM_ANNOUNCEMENT', 'PROJECT_RESULT', 'AWARD', 'OFFICIAL_CUSTOMER_CASE'], minReliability: 85, minCount: 1, desc: '业主 / OEM 供应商地位' },
    G5: { required: ['CUSTOMER_INQUIRY', 'CUSTOMER_DRAWING', 'CALL_CONFIRMED', 'MEETING_CONFIRMED', 'EMAIL_CONFIRMED'], minReliability: 0, minCount: 1, desc: '客户直接确认规格' },
    G6: { required: ['SAMPLE_RESULT', 'TRIAL_ORDER', 'REPEAT_ORDER'], minReliability: 0, minCount: 1, desc: '试样 / 试单 / 复购' },
  };

  const GATE_TO_LEVEL = {
    G1: 'V1_ENTITY_VERIFIED', G2: 'V2_PRODUCT_VERIFIED', G3: 'V3_MARKET_VERIFIED',
    G4: 'V4_SUPPLY_CHAIN_VERIFIED', G5: 'V5_DEMAND_CONFIRMED', G6: 'V6_COMMERCIAL_PROVEN',
  };

  const NBA_BY_LEVEL = {
    V0_UNVERIFIED: { action: 'FIND_BUYING_GROUP', target: 'PROCUREMENT', reason: '未开始验证, 建议先找关键角色' },
    V1_ENTITY_VERIFIED: { action: 'REQUEST_OFFICIAL_SITE', target: 'PROCUREMENT', reason: '主体已验证, 下一步收集官网/产品页' },
    V2_PRODUCT_VERIFIED: { action: 'CONFIRM_MATERIAL_USAGE', target: 'R_AND_D', reason: '官网产品已确认, 下一步验证材料' },
    V3_MARKET_VERIFIED: { action: 'FIND_OWNER_SUPPLIER', target: 'R_AND_D', reason: '市场活动已确认, 找业主/OEM 关系' },
    V4_SUPPLY_CHAIN_VERIFIED: { action: 'CONFIRM_DEMAND', target: 'EXECUTIVE', reason: '供应链已确认, 直接询问需求' },
    V5_DEMAND_CONFIRMED: { action: 'DESIGN_SAMPLE', target: 'MATERIAL_ENGINEER', reason: '需求已确认, 共创试样方案' },
    V6_COMMERCIAL_PROVEN: { action: 'EXPAND_RELATIONSHIP', target: 'EXECUTIVE', reason: '商业已证明, 拓展规格/工厂/集团' },
  };

  // ============================================
  // API (本地, 模拟后端)
  // ============================================
  const api = {
    listAccounts() {
      const all = loadAll();
      return { success: true, data: { accounts: all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), total: all.length } };
    },
    getAccount(id) {
      const acc = loadAll().find(a => a.account_id === id);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS', message: '账户不存在' }] };
      return { success: true, data: acc };
    },
    createAccount(input) {
      if (!input.legal_name || !input.legal_name.trim()) {
        return { success: false, errors: [{ code: 'VALIDATION', field: 'legal_name', message: '企业全称必填' }] };
      }
      const all = loadAll();
      if (all.some(a => a.legal_name === input.legal_name.trim())) {
        return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS', field: 'legal_name', message: `已存在同名企业: ${input.legal_name}` }] };
      }
      const acc = {
        account_id: uuid(),
        legal_name: input.legal_name.trim(),
        unified_credit_code: input.unified_credit_code || null,
        region: input.region || null,
        notes: input.notes || null,
        verification_level: 'V0_UNVERIFIED',
        action_tier: 'WATCH',
        created_at: new Date().toISOString(),
        evidences: [], gate_evaluations: [],
        hypotheses: [], interactions: [],
        sample_experiments: [], next_best_actions: [],
        scores: null,
      };
      all.push(acc);
      saveAll(all);
      return { success: true, data: acc };
    },
    addEvidence(accountId, input) {
      const all = loadAll();
      const acc = all.find(a => a.account_id === accountId);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS' }] };
      if (!SOURCE_TYPE_TO_GATES[input.source_type]) {
        return { success: false, errors: [{ code: 'EVIDENCE_INSUFFICIENT', field: 'source_type', message: `未知 source_type: ${input.source_type}` }] };
      }
      acc.evidences.push({
        evidence_id: uuid(), source_type: input.source_type, source_url: input.source_url,
        reliability: input.reliability, excerpt: input.excerpt || null,
        captured_at: new Date().toISOString(),
      });
      saveAll(all);
      return { success: true, data: acc.evidences[acc.evidences.length - 1] };
    },
    evaluateGate(accountId, gate) {
      const all = loadAll();
      const acc = all.find(a => a.account_id === accountId);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS' }] };
      const rule = GATE_RULES[gate];
      if (!rule) return { success: false, errors: [{ code: 'GATE_PREREQUISITE_MISSING' }] };
      const matched = acc.evidences.filter(e => rule.required.includes(e.source_type) && e.reliability >= rule.minReliability);
      const blockers = [];
      if (matched.length < rule.minCount) {
        blockers.push(`需要 ${rule.minCount} 条 source_type ∈ {${rule.required.join(', ')}} 且 reliability ≥ ${rule.minReliability}, 当前 ${matched.length} 条`);
      }
      if (rule.minAvg && matched.length) {
        const avg = matched.reduce((s, e) => s + e.reliability, 0) / matched.length;
        if (avg < rule.minAvg) blockers.push(`平均 reliability ${avg.toFixed(1)} < 要求 ${rule.minAvg}`);
      }
      const status = blockers.length === 0 ? 'PASSED' : 'BLOCKED';
      const newLevel = status === 'PASSED' ? GATE_TO_LEVEL[gate] : acc.verification_level;
      const ev = { gate, status, evidence_ids: matched.map(e => e.evidence_id), blockers, evaluated_at: new Date().toISOString(), description: rule.desc, new_verification_level: newLevel };
      acc.gate_evaluations.push(ev);
      if (status === 'PASSED') acc.verification_level = newLevel;
      saveAll(all);
      return { success: true, data: ev };
    },
    addHypothesis(accountId, input) {
      const all = loadAll();
      const acc = all.find(a => a.account_id === accountId);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS' }] };
      const h = { id: uuid(), statement: input.statement, category: input.category, assertion_state: input.assertion_state || 'POSSIBLE', confidence: input.confidence || 50, validation_question: input.validation_question || null, created_at: new Date().toISOString() };
      acc.hypotheses.unshift(h);
      saveAll(all);
      return { success: true, data: h };
    },
    addInteraction(accountId, input) {
      const all = loadAll();
      const acc = all.find(a => a.account_id === accountId);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS' }] };
      const i = { id: uuid(), channel: input.channel, occurred_at: input.occurred_at || new Date().toISOString(), summary: input.summary, customer_quote: input.customer_quote || null, next_steps: input.next_steps || null, created_at: new Date().toISOString() };
      acc.interactions.unshift(i);
      saveAll(all);
      return { success: true, data: i };
    },
    addSampleExperiment(accountId, input) {
      const all = loadAll();
      const acc = all.find(a => a.account_id === accountId);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS' }] };
      const e = { id: uuid(), problem: input.problem, hypothesis: input.hypothesis, variables: input.variables || [], test_conditions: input.test_conditions || null, success_criteria: input.success_criteria, status: 'PLANNED', created_at: new Date().toISOString() };
      acc.sample_experiments.unshift(e);
      saveAll(all);
      return { success: true, data: e };
    },
    computeNextBestAction(accountId) {
      const all = loadAll();
      const acc = all.find(a => a.account_id === accountId);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS' }] };
      acc.next_best_actions.forEach(n => {
        if (n.is_primary && ['PROPOSED', 'APPROVED', 'IN_PROGRESS'].includes(n.status)) {
          n.status = 'SUPERSEDED'; n.is_primary = false;
        }
      });
      const rec = NBA_BY_LEVEL[acc.verification_level] || { action: 'PAUSE', target: 'EXECUTIVE', reason: '无明确推荐' };
      const due = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const nba = { id: uuid(), action_type: rec.action, reason: `${rec.reason} (基于 ${acc.verification_level})`, target_role: rec.target, is_primary: true, status: 'PROPOSED', due_at: due, created_at: new Date().toISOString() };
      acc.next_best_actions.unshift(nba);
      saveAll(all);
      return { success: true, data: nba };
    },
    recomputeScores(accountId) {
      const all = loadAll();
      const acc = all.find(a => a.account_id === accountId);
      if (!acc) return { success: false, errors: [{ code: 'ENTITY_AMBIGUOUS' }] };
      const V_BASE = { V0_UNVERIFIED: 5, V1_ENTITY_VERIFIED: 15, V2_PRODUCT_VERIFIED: 30, V3_MARKET_VERIFIED: 50, V4_SUPPLY_CHAIN_VERIFIED: 70, V5_DEMAND_CONFIRMED: 85, V6_COMMERCIAL_PROVEN: 95 };
      let sf = V_BASE[acc.verification_level] || 5;
      sf += Math.min(acc.evidences.length * 4, 20);
      const avgRel = acc.evidences.length ? acc.evidences.reduce((s, e) => s + e.reliability, 0) / acc.evidences.length : 0;
      if (avgRel >= 80) sf += 5; else if (avgRel >= 60) sf += 3;
      sf = Math.min(sf, 100);
      let timing = 30 + Math.min(acc.interactions.length * 8, 40);
      const days = (Date.now() - new Date(acc.created_at).getTime()) / (24 * 3600 * 1000);
      if (days < 30) timing += 20; else if (days < 90) timing += 10;
      const hasActive = acc.next_best_actions.some(n => n.is_primary && ['PROPOSED','APPROVED','IN_PROGRESS'].includes(n.status));
      if (hasActive) timing += 10;
      timing = Math.min(timing, 100);
      const ic = acc.interactions.length;
      const relationship = ic >= 5 ? 90 : ic >= 3 ? 60 : ic >= 1 ? 30 : 0;
      let df = avgRel >= 90 ? 90 : avgRel >= 80 ? 75 : avgRel >= 70 ? 60 : avgRel >= 60 ? 45 : 25;
      if (acc.evidences.length >= 5) df = Math.min(df + 10, 100);
      let risk = 50;
      if (['V4_SUPPLY_CHAIN_VERIFIED','V5_DEMAND_CONFIRMED','V6_COMMERCIAL_PROVEN'].includes(acc.verification_level)) risk -= 15;
      if (acc.verification_level === 'V0_UNVERIFIED') risk += 10;
      if (acc.interactions.length === 0 && acc.evidences.length > 0) risk += 5;
      if (days > 180) risk += 10;
      risk = Math.max(10, Math.min(risk, 90));
      acc.scores = { strategic_fit: sf, timing, relationship, delivery_fit: df, risk, rule_version: '5.0', created_at: new Date().toISOString(), explanation: { strategic_fit: `V=${acc.verification_level} (${V_BASE[acc.verification_level]||0}) + ${Math.min(acc.evidences.length*4,20)} (证据)`, timing: `${ic} 次互动 + ${days.toFixed(0)} 天`, relationship: `${ic} 次互动`, delivery_fit: `avg_reliability=${avgRel.toFixed(1)}`, risk: `V=${acc.verification_level}, interaction=${ic}` } };
      if (acc.verification_level === 'V0_UNVERIFIED' || acc.verification_level === 'V1_ENTITY_VERIFIED') acc.action_tier = 'WATCH';
      else if (sf >= 80 && timing >= 60 && risk < 60 && acc.verification_level === 'V4_SUPPLY_CHAIN_VERIFIED') acc.action_tier = 'STRATEGIC';
      else if (sf >= 75 && acc.verification_level === 'V3_MARKET_VERIFIED') acc.action_tier = 'A_PRIORITY';
      else if (acc.verification_level === 'V2_PRODUCT_VERIFIED') acc.action_tier = 'B_DEVELOP';
      else acc.action_tier = 'C_NURTURE';
      saveAll(all);
      return { success: true, data: acc.scores };
    },
    resetAll() { localStorage.removeItem(STORAGE_KEY); },
  };

  // ============================================
  // SVG Illustrations (Salesforce 风格抽象插图)
  // ============================================
  function illustWelcome() {
    return `<svg viewBox="0 0 80 80" width="80" height="80">
      <circle cx="40" cy="40" r="36" fill="#9050E0" opacity="0.15"/>
      <circle cx="32" cy="32" r="12" fill="white" stroke="#9050E0" stroke-width="2"/>
      <circle cx="30" cy="30" r="1.5" fill="#16325C"/>
      <circle cx="34" cy="30" r="1.5" fill="#16325C"/>
      <path d="M28 34 Q 32 36, 36 34" stroke="#16325C" stroke-width="1.5" fill="none"/>
      <rect x="22" y="48" width="20" height="16" rx="3" fill="#9050E0"/>
      <rect x="26" y="52" width="12" height="2" fill="white"/>
      <rect x="26" y="56" width="8" height="2" fill="white"/>
      <circle cx="58" cy="58" r="6" fill="#FE9331" opacity="0.6"/>
      <circle cx="62" cy="22" r="3" fill="#2E844A" opacity="0.6"/>
    </svg>`;
  }
  function illustEmptyAccounts() {
    return `<svg viewBox="0 0 120 80" width="120" height="80">
      <circle cx="60" cy="40" r="32" fill="#9050E0" opacity="0.15"/>
      <circle cx="50" cy="34" r="6" fill="white" stroke="#9050E0" stroke-width="1.5"/>
      <path d="M40 50 Q 40 44, 50 44 Q 60 44, 60 50" fill="#9050E0" opacity="0.6"/>
      <circle cx="70" cy="30" r="4" fill="white" stroke="#9050E0" stroke-width="1.5"/>
      <path d="M64 44 Q 64 38, 70 38 Q 76 38, 76 44" fill="#9050E0" opacity="0.4"/>
    </svg>`;
  }
  function illustEmptyHypotheses() {
    return `<svg viewBox="0 0 120 80" width="120" height="80">
      <circle cx="60" cy="40" r="32" fill="#0070D2" opacity="0.15"/>
      <circle cx="60" cy="40" r="16" fill="white" stroke="#0070D2" stroke-width="2"/>
      <path d="M60 32 L 60 40 L 66 44" stroke="#0070D2" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="56" cy="22" r="2" fill="#0070D2"/>
      <circle cx="64" cy="58" r="2" fill="#0070D2"/>
    </svg>`;
  }
  function illustEmptyInteractions() {
    return `<svg viewBox="0 0 120 80" width="120" height="80">
      <circle cx="60" cy="40" r="32" fill="#2E844A" opacity="0.15"/>
      <path d="M30 30 L 30 50 L 40 50 L 50 60 L 50 20 L 40 30 Z" fill="white" stroke="#2E844A" stroke-width="2"/>
      <circle cx="72" cy="36" r="6" fill="white" stroke="#2E844A" stroke-width="1.5"/>
      <path d="M68 38 Q 68 32, 72 32 Q 76 32, 76 38" fill="#2E844A" opacity="0.5"/>
    </svg>`;
  }
  function illustEmptySamples() {
    return `<svg viewBox="0 0 120 80" width="120" height="80">
      <circle cx="60" cy="40" r="32" fill="#FE9331" opacity="0.15"/>
      <path d="M48 28 L 72 28 L 78 34 L 78 56 L 42 56 L 42 34 Z" fill="white" stroke="#FE9331" stroke-width="2"/>
      <path d="M48 28 L 48 34 L 42 34" stroke="#FE9331" stroke-width="2" fill="none"/>
      <path d="M48 40 L 72 40 M 48 46 L 72 46 M 48 52 L 60 52" stroke="#FE9331" stroke-width="1.5"/>
    </svg>`;
  }

  // ============================================
  // Router
  // ============================================
  function route() {
    const hash = window.location.hash || '#/';
    const path = hash.replace('#', '') || '/';
    if (path === '/' || path === '') return renderHome();
    if (path === '/accounts') return renderAccountsList();
    if (path === '/accounts/new') return renderAccountNew();
    if (path.startsWith('/accounts/')) {
      const id = path.split('/')[2];
      if (id) return renderAccountDetail(id);
    }
    if (path === '/verticals') return renderVerticals();
    if (path === '/signals') return renderSignals();
    if (path === '/samples') return renderSamples();
    if (path === '/phase-status') return renderPhaseStatus();
    if (path === '/docs') return renderDocs();
    return renderNotFound();
  }
  function highlightNav() {
    const hash = window.location.hash || '#/';
    const path = hash.replace('#', '') || '/';
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.route === path);
    });
  }

  // ============================================
  // Pages
  // ============================================
  function renderHome() {
    const all = loadAll();
    const stats = {
      accounts: all.length,
      hypotheses: all.reduce((s, a) => s + (a.hypotheses || []).length, 0),
      interactions: all.reduce((s, a) => s + (a.interactions || []).length, 0),
      samples: all.reduce((s, a) => s + (a.sample_experiments || []).length, 0),
      evidence: all.reduce((s, a) => s + (a.evidences || []).length, 0),
    };
    const topAccounts = all.slice(0, 5);
    const topRows = topAccounts.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: var(--sf-text-muted); padding: 32px;">${illustEmptyAccounts()}<br><strong>暂无账户</strong><br><a href="#/accounts/new">+ 新建第一个账户</a></td></tr>` :
      topAccounts.map(a => {
        const n = (a.next_best_actions || []).find(x => x.is_primary && ['PROPOSED','APPROVED','IN_PROGRESS'].includes(x.status));
        return `<tr>
          <td><a href="#/accounts/${a.account_id}"><strong>${escapeHtml(a.legal_name)}</strong></a></td>
          <td>${escapeHtml(a.region || '—')}</td>
          <td><span class="chip ${a.verification_level}">${a.verification_level.replace('V', 'V').replace('V0', 'V0').replace('V1', 'V1').replace('V2', 'V2').replace('V3', 'V3').replace('V4', 'V4').replace('V5', 'V5').replace('V6', 'V6')}</span></td>
          <td><span class="chip tier-${a.action_tier}">${a.action_tier}</span></td>
          <td>${a.evidences.length}</td>
          <td class="small">${n ? n.action_type : '—'}</td>
        </tr>`;
      }).join('');

    document.getElementById('app').innerHTML = `
      <div class="welcome-banner">
        <div>
          <h1>Welcome, 演示账户</h1>
          <p class="sub">从今天起，把 0.20mm 及以下不锈钢精密带客户开发的每一步都变成可验证的事实。</p>
        </div>
        <div class="welcome-illust">${illustWelcome()}</div>
      </div>

      <div class="dashboard-grid-3">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-blue);">A</span>
              最近账户
            </h2>
            <div class="card-actions">
              <a class="card-link" href="#/accounts">View All →</a>
              <a class="btn btn-sm btn-primary" href="#/accounts/new">+ New</a>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <table>
              <thead><tr><th>Name</th><th>Region</th><th>V-Level</th><th>Tier</th><th>Evid.</th><th>NBA</th></tr></thead>
              <tbody>${topRows}</tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-purple);">5</span>
              5 大战略方向
            </h2>
          </div>
          <div class="card-body">
            <div class="vertical-grid" style="padding: 0;">
              <div class="vertical-cell">
                <h4>V01 手机电子</h4>
                <div class="geog">深圳/东莞</div>
                <div class="stat">${stats.evidence}</div>
                <div class="stat-label">证据数</div>
              </div>
              <div class="vertical-cell">
                <h4>V02 电池壳套</h4>
                <div class="geog">吉利/宁德/特斯拉</div>
                <div class="stat">${stats.samples}</div>
                <div class="stat-label">试样</div>
              </div>
              <div class="vertical-cell">
                <h4>V03 USB</h4>
                <div class="geog">东莞</div>
                <div class="stat">${stats.interactions}</div>
                <div class="stat-label">互动</div>
              </div>
              <div class="vertical-cell">
                <h4>V04 医疗 316</h4>
                <div class="geog">温州/张浦来源</div>
                <div class="stat">${stats.hypotheses}</div>
                <div class="stat-label">假设</div>
              </div>
              <div class="vertical-cell">
                <h4>V05 日韩贸易</h4>
                <div class="geog">JP/KR</div>
                <div class="stat">${stats.accounts}</div>
                <div class="stat-label">账户</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-success);">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <rect x="2" y="9" width="3" height="5" fill="currentColor"/>
                  <rect x="6.5" y="5" width="3" height="9" fill="currentColor"/>
                  <rect x="11" y="2" width="3" height="12" fill="currentColor"/>
                </svg>
              </span>
              KPI 仪表盘
            </h2>
          </div>
          <div class="kpi-grid">
            <div class="kpi"><div class="kpi-label">账户</div><div class="kpi-value">${stats.accounts}</div><div class="kpi-trend">企业主体</div></div>
            <div class="kpi"><div class="kpi-label">证据</div><div class="kpi-value">${stats.evidence}</div><div class="kpi-trend">多源验证</div></div>
            <div class="kpi"><div class="kpi-label">假设</div><div class="kpi-value">${stats.hypotheses}</div><div class="kpi-trend">待验证</div></div>
            <div class="kpi"><div class="kpi-label">互动</div><div class="kpi-value">${stats.interactions}</div><div class="kpi-trend">销售记录</div></div>
            <div class="kpi"><div class="kpi-label">试样</div><div class="kpi-value">${stats.samples}</div><div class="kpi-trend">实验管理</div></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-warning);">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M2 8 L 6 8 L 5 2 L 11 2 L 9 8 L 14 8 L 7 14 L 8 8 Z" fill="currentColor"/>
                </svg>
              </span>
              主要下一动作
            </h2>
            <a class="card-link" href="#/phase-status">查看全部</a>
          </div>
          <div class="card-body">
            <p class="small" style="color: var(--sf-text-soft); margin: 0;">点击账户详情 → 计算 NBA → 系统按 V 等级自动推荐主要下一动作（AGENTS §6.7 唯一性硬约束）</p>
            <div class="row" style="margin-top: 12px;">
              <a href="#/accounts" class="btn btn-primary">前往账户列表 →</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAccountsList() {
    const { accounts, total } = api.listAccounts().data;
    const tableRows = accounts.length === 0 ?
      `<tr><td colspan="7" style="text-align: center; padding: 48px;">${illustEmptyAccounts()}<br><br><strong>暂无账户</strong><br><br><a class="btn btn-primary" href="#/accounts/new">+ 新建第一个账户</a></td></tr>` :
      accounts.map(a => {
        const n = (a.next_best_actions || []).find(x => x.is_primary && ['PROPOSED','APPROVED','IN_PROGRESS'].includes(x.status));
        return `<tr>
          <td><a href="#/accounts/${a.account_id}"><strong>${escapeHtml(a.legal_name)}</strong></a><br><span class="small">${escapeHtml(a.unified_credit_code || '无统一社会信用代码')}</span></td>
          <td>${escapeHtml(a.region || '—')}</td>
          <td><span class="chip ${a.verification_level}">${a.verification_level}</span></td>
          <td><span class="chip tier-${a.action_tier}">${a.action_tier}</span></td>
          <td>${a.evidences.length}</td>
          <td>${n ? `<span class="small">${n.action_type}</span>` : '<span class="small" style="color: var(--sf-text-muted);">— 未计算</span>'}</td>
          <td>${new Date(a.created_at).toLocaleDateString('zh-CN')}</td>
        </tr>`;
      }).join('');

    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 账户</p>
          <h1 class="page-title">账户</h1>
        </div>
        <div class="page-actions">
          <a class="btn btn-sm" href="#/phase-status">阶段进度</a>
          <a class="btn btn-primary" href="#/accounts/new">+ New</a>
        </div>
      </div>

      <div class="card">
        <div class="list-toolbar">
          <div class="list-count">${total} items • 按创建时间倒序</div>
          <div class="list-actions">
            <div class="list-search"><input type="text" placeholder="搜索此列表..." id="list-search"></div>
            <button class="icon-btn" title="设置">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-label="设置">
                <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 1.5 L 8 3.5 M 8 12.5 L 8 14.5 M 1.5 8 L 3.5 8 M 12.5 8 L 14.5 8 M 3.4 3.4 L 4.8 4.8 M 11.2 11.2 L 12.6 12.6 M 3.4 12.6 L 4.8 11.2 M 11.2 4.8 L 12.6 3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="icon-btn" title="刷新" id="refresh-list">↻</button>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead><tr><th><input type="checkbox"></th><th>Name ↑</th><th>Region</th><th>V-Level</th><th>Tier</th><th>Evid.</th><th>NBA</th><th>Created</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('refresh-list')?.addEventListener('click', renderAccountsList);
  }

  function renderAccountNew() {
    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 账户 / 新建</p>
          <h1 class="page-title">新建账户</h1>
        </div>
        <div class="page-actions">
          <a class="btn" href="#/accounts">取消</a>
          <button class="btn btn-primary" id="submit-new">保存</button>
        </div>
      </div>

      <div id="form-msg"></div>

      <div class="form-card">
        <h2 class="card-title" style="margin-bottom: 16px;">基本信息</h2>
        <div class="form-group">
          <label>企业全称 *</label>
          <input id="legal_name" required placeholder="如: 乐清市精工弹片有限公司">
        </div>
        <div class="form-group">
          <label>统一社会信用代码</label>
          <input id="unified_credit_code" placeholder="91 + 17 位 (V1 阶段必填)">
        </div>
        <div class="form-group">
          <label>主要经营地区</label>
          <input id="region" value="温州">
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea id="notes" rows="3" placeholder="来源 / 联系人 / 备注"></textarea>
        </div>
      </div>
    `;
    document.getElementById('submit-new').addEventListener('click', () => {
      const result = api.createAccount({
        legal_name: document.getElementById('legal_name').value,
        unified_credit_code: document.getElementById('unified_credit_code').value || null,
        region: document.getElementById('region').value || null,
        notes: document.getElementById('notes').value || null,
      });
      if (!result.success) {
        const err = result.errors[0];
        document.getElementById('form-msg').innerHTML = `<div class="error-box">${err.code}: ${err.message}</div>`;
        return;
      }
      window.location.hash = `#/accounts/${result.data.account_id}`;
    });
  }

  function renderAccountDetail(id) {
    const result = api.getAccount(id);
    if (!result.success) {
      document.getElementById('app').innerHTML = `<div class="empty-state">${illustEmptyAccounts()}<h2>账户未找到</h2><p>${result.errors[0].message}</p><a class="btn" href="#/accounts">← 返回列表</a></div>`;
      return;
    }
    const a = result.data;
    const evals = a.gate_evaluations || [];
    const evidences = a.evidences || [];
    const hypotheses = a.hypotheses || [];
    const interactions = a.interactions || [];
    const samples = a.sample_experiments || [];
    const activeNba = (a.next_best_actions || []).find(n => n.is_primary && ['PROPOSED','APPROVED','IN_PROGRESS'].includes(n.status));
    const scores = a.scores;

    // Tabs
    const tab = (window.location.hash.split('?tab=')[1]) || 'overview';

    let mainContent = '';

    if (tab === 'overview' || !tab) {
      // NBA banner
      const nbaBlock = activeNba ? `
        <div class="nba-banner">
          <div class="nba-banner-head">
            <h3 class="nba-banner-action">${activeNba.action_type}</h3>
            <span class="chip gate-PASSED">${activeNba.status}</span>
          </div>
          <p class="nba-banner-reason">${escapeHtml(activeNba.reason)}</p>
          <p class="nba-banner-meta">目标角色 <strong>${activeNba.target_role}</strong> · 截止 ${new Date(activeNba.due_at).toLocaleDateString('zh-CN')}</p>
        </div>` : `
        <div class="nba-banner" style="background: var(--sf-bg-light); border-color: var(--sf-border); border-left-color: var(--sf-border);">
          <p class="small" style="color: var(--sf-text-soft); margin: 0 0 8px 0;">尚未计算主要下一动作。点击下方按钮按当前 V 等级自动推荐 (AGENTS §6.7 唯一性硬约束)。</p>
          <button class="btn btn-primary" id="compute-nba-inline">计算 NBA</button>
        </div>`;

      // Score grid
      const scoreBlock = scores ? `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-blue);">5</span>
              5 维评分
            </h2>
            <div class="card-actions">
              <span class="small" style="color: var(--sf-text-soft);">v${scores.rule_version}</span>
              <button class="btn btn-sm" data-action="recompute-scores">重算</button>
            </div>
          </div>
          <div class="score-grid">
            ${scoreScoreCell('战略匹配', scores.strategic_fit, false)}
            ${scoreScoreCell('时机', scores.timing, false)}
            ${scoreScoreCell('关系覆盖', scores.relationship, false)}
            ${scoreScoreCell('交付匹配', scores.delivery_fit, false)}
            ${scoreScoreCell('风险', scores.risk, true)}
          </div>
          <details style="padding: 0 16px 16px; font-size: 12px;">
            <summary style="cursor: pointer; color: var(--sf-blue);">查看各维度解释</summary>
            <pre style="background: var(--sf-bg); padding: 12px; font-size: 11px; color: var(--sf-text); margin-top: 8px; overflow-x: auto; border-radius: 4px;">${escapeHtml(JSON.stringify(scores.explanation, null, 2))}</pre>
          </details>
        </div>` : `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-blue);">5</span>
              5 维评分
            </h2>
          </div>
          <div class="card-body" style="text-align: center; padding: 32px;">
            <p style="color: var(--sf-text-soft); margin: 0 0 16px 0;">尚未计算。基于当前 V 等级 + 证据数 + 互动数 + 账户年龄 推导。</p>
            <button class="btn btn-primary" data-action="recompute-scores">计算 5 维评分</button>
          </div>
        </div>`;

      // Gate grid
      const gateBlock = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-purple);">G</span>
              G1–G6 闸门
            </h2>
            <span class="small" style="color: var(--sf-text-soft);">每条证据必须 source_type + reliability 满足闸门规则; BLOCKED 不推进 V 等级</span>
          </div>
          <div class="gate-grid">
            ${['G1','G2','G3','G4','G5','G6'].map(g => {
              const ev = evals.find(e => e.gate === g);
              const status = ev ? ev.status : 'PENDING';
              return `<div class="gate-card">
                <div class="gate-card-head">
                  <h4 class="gate-card-title">${g} ${gateLabel(g)}</h4>
                  <span class="chip gate-${status}">${status}</span>
                </div>
                <p class="gate-card-desc">${GATE_RULES[g].desc}</p>
                ${ev && ev.blockers.length ? `<ul class="gate-card-blockers">${ev.blockers.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
                <button class="btn btn-sm btn-block" data-evaluate="${g}">评估 ${g}</button>
              </div>`;
            }).join('')}
          </div>
        </div>`;

      // Evidence list (with inline add form)
      const sourceTypeOptions = Object.keys(SOURCE_TYPE_TO_GATES).map(s => `<option value="${s}">${s}</option>`).join('');
      const evidenceBlock = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-title-icon" style="background: var(--sf-success);">E</span>
              证据 · ${evidences.length} 条
            </h2>
            <button class="btn btn-sm btn-primary" data-toggle="add-evidence">+ 添加</button>
          </div>
          <div id="add-evidence-form" style="display: none; padding: 16px; background: var(--sf-bg); border-bottom: 1px solid var(--sf-border);">
            <div class="col-2">
              <div class="form-group">
                <label>Source Type</label>
                <select id="ev-source-type">${sourceTypeOptions}</select>
              </div>
              <div class="form-group">
                <label>Reliability (0-100)</label>
                <input type="number" id="ev-reliability" min="0" max="100" value="80">
              </div>
            </div>
            <div class="form-group">
              <label>Source URL *</label>
              <input type="url" id="ev-source-url" placeholder="https://..." required>
            </div>
            <div class="form-actions" style="margin-top: 8px;">
              <button class="btn btn-primary" data-action="submit-evidence">保存证据</button>
              <button class="btn" data-action="cancel-evidence">取消</button>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            ${evidences.length === 0 ?
              `<div style="text-align: center; padding: 32px; color: var(--sf-text-muted);">${illustEmptyAccounts()}<br><br>暂无证据</div>` :
              `<table><thead><tr><th>Source Type</th><th>URL</th><th>Reliability</th><th>Captured</th></tr></thead><tbody>
                ${evidences.map(e => `<tr>
                  <td><code>${e.source_type}</code></td>
                  <td><a href="${escapeAttr(e.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(e.source_url.length>50?e.source_url.slice(0,50)+'…':e.source_url)}</a></td>
                  <td><strong>${e.reliability}</strong></td>
                  <td>${new Date(e.captured_at).toLocaleString('zh-CN')}</td>
                </tr>`).join('')}
              </tbody></table>`}
          </div>
        </div>`;

      mainContent = nbaBlock + scoreBlock + gateBlock + evidenceBlock;
    } else if (tab === 'hypotheses') {
      const sourceTypeOptions2 = ['MATERIAL_USAGE','SPEC','PAIN_POINT','SUPPLIER','PURCHASE_PATTERN'].map(c => `<option value="${c}">${c}</option>`).join('');
      mainContent = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">假设 (Hypothesis) · ${hypotheses.length} 条</h2>
            <button class="btn btn-sm btn-primary" data-toggle="add-hypothesis">+ 添加</button>
          </div>
          <div id="add-hypothesis-form" style="display: none; padding: 16px; background: var(--sf-bg); border-bottom: 1px solid var(--sf-border);">
            <div class="form-group">
              <label>假设陈述 *</label>
              <input id="hy-statement" placeholder="如: 该企业电池盖板使用 0.10mm SUS304 H 状态">
            </div>
            <div class="col-2">
              <div class="form-group">
                <label>类别</label>
                <select id="hy-category">${sourceTypeOptions2}</select>
              </div>
              <div class="form-group">
                <label>置信度 (0-100)</label>
                <input type="number" id="hy-confidence" min="0" max="100" value="60">
              </div>
            </div>
            <div class="form-group">
              <label>验证问题</label>
              <input id="hy-question" placeholder="需要客户回答什么来验证?">
            </div>
            <div class="form-actions" style="margin-top: 8px;">
              <button class="btn btn-primary" data-action="submit-hypothesis">保存假设</button>
              <button class="btn" data-action="cancel-hypothesis">取消</button>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            ${hypotheses.length === 0 ?
              `<div style="text-align: center; padding: 32px; color: var(--sf-text-muted);">${illustEmptyHypotheses()}<br><br>暂无假设</div>` :
              `<table><thead><tr><th>类别</th><th>陈述</th><th>状态 (置信)</th><th>创建</th></tr></thead><tbody>
                ${hypotheses.map(h => `<tr>
                  <td><span class="vertical-chip"><span class="dot"></span>${h.category}</span></td>
                  <td>${escapeHtml(h.statement)}</td>
                  <td>${h.assertion_state} <strong>${h.confidence}</strong></td>
                  <td>${new Date(h.created_at).toLocaleString('zh-CN')}</td>
                </tr>`).join('')}
              </tbody></table>`}
          </div>
        </div>`;
    } else if (tab === 'interactions') {
      mainContent = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">销售互动 (Interaction) · ${interactions.length} 条</h2>
            <button class="btn btn-sm btn-primary" data-toggle="add-interaction">+ 添加</button>
          </div>
          <div id="add-interaction-form" style="display: none; padding: 16px; background: var(--sf-bg); border-bottom: 1px solid var(--sf-border);">
            <div class="form-group">
              <label>渠道</label>
              <select id="in-channel">
                <option value="CALL">CALL 电话</option>
                <option value="EMAIL">EMAIL 邮件</option>
                <option value="WECHAT">WECHAT 微信</option>
                <option value="MEETING">MEETING 会议</option>
                <option value="VISIT">VISIT 拜访</option>
              </select>
            </div>
            <div class="form-group">
              <label>摘要 *</label>
              <textarea id="in-summary" rows="2" required></textarea>
            </div>
            <div class="form-group">
              <label>客户原话 (原文, AI 不覆盖)</label>
              <textarea id="in-quote" rows="2" placeholder="如: 我们在用 0.10mm 的 304, 厚度公差 0.005"></textarea>
            </div>
            <div class="form-actions" style="margin-top: 8px;">
              <button class="btn btn-primary" data-action="submit-interaction">保存互动</button>
              <button class="btn" data-action="cancel-interaction">取消</button>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            ${interactions.length === 0 ?
              `<div style="text-align: center; padding: 32px; color: var(--sf-text-muted);">${illustEmptyInteractions()}<br><br>暂无互动</div>` :
              `<table><thead><tr><th>渠道</th><th>摘要</th><th>客户原话</th><th>时间</th></tr></thead><tbody>
                ${interactions.map(i => `<tr>
                  <td><strong>${i.channel}</strong></td>
                  <td>${escapeHtml(i.summary)}</td>
                  <td><em>"${escapeHtml((i.customer_quote||'').length>40?(i.customer_quote||'').slice(0,40)+'…':(i.customer_quote||'—'))}"</em></td>
                  <td>${new Date(i.occurred_at).toLocaleString('zh-CN')}</td>
                </tr>`).join('')}
              </tbody></table>`}
          </div>
        </div>`;
    } else if (tab === 'samples') {
      mainContent = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">试样实验 (Sample) · ${samples.length} 个</h2>
            <button class="btn btn-sm btn-primary" data-toggle="add-sample">+ 添加</button>
          </div>
          <div id="add-sample-form" style="display: none; padding: 16px; background: var(--sf-bg); border-bottom: 1px solid var(--sf-border);">
            <div class="form-group">
              <label>问题 (problem) *</label>
              <input id="sa-problem" placeholder="如: 客户反馈厚度公差超标">
            </div>
            <div class="form-group">
              <label>假设 (hypothesis) *</label>
              <textarea id="sa-hypothesis" rows="2" required placeholder="如: 改用 0.10mm SUS304 H 状态 + 精磨可改善"></textarea>
            </div>
            <div class="form-group">
              <label>变量 (variables, 逗号分隔)</label>
              <input id="sa-variables" placeholder="如: 厚度, 状态, 表面">
            </div>
            <div class="form-group">
              <label>测试条件</label>
              <input id="sa-conditions" placeholder="如: 室温 23°C, 冲压速度 60spm">
            </div>
            <div class="form-group">
              <label>成功标准 *</label>
              <input id="sa-criteria" required placeholder="如: 厚度公差 ≤ 0.003mm, 硬度 HV 380-420">
            </div>
            <div class="form-actions" style="margin-top: 8px;">
              <button class="btn btn-primary" data-action="submit-sample">保存试样</button>
              <button class="btn" data-action="cancel-sample">取消</button>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            ${samples.length === 0 ?
              `<div style="text-align: center; padding: 32px; color: var(--sf-text-muted);">${illustEmptySamples()}<br><br>暂无试样</div>` :
              `<table><thead><tr><th>问题</th><th>成功标准</th><th>状态</th><th>创建</th></tr></thead><tbody>
                ${samples.map(s => `<tr>
                  <td>${escapeHtml(s.problem.length>30?s.problem.slice(0,30)+'…':s.problem)}</td>
                  <td class="small">${escapeHtml(s.success_criteria)}</td>
                  <td><span class="chip">${s.status}</span></td>
                  <td>${new Date(s.created_at).toLocaleString('zh-CN')}</td>
                </tr>`).join('')}
              </tbody></table>`}
          </div>
        </div>`;
    }

    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 账户 / ${escapeHtml(a.legal_name)}</p>
          <h1 class="page-title">${escapeHtml(a.legal_name)}</h1>
        </div>
        <div class="page-actions">
          <a class="btn" href="#/accounts">← 返回</a>
          <button class="btn btn-primary">编辑</button>
        </div>
      </div>

      <div class="detail-header">
        <div class="row" style="gap: 16px; align-items: center;">
          <span class="chip ${a.verification_level}">${a.verification_level}</span>
          <span class="chip tier-${a.action_tier}">${a.action_tier}</span>
          <span class="detail-meta">${escapeHtml(a.region || '—')} · ${escapeHtml(a.unified_credit_code || '未填统一社会信用代码')}</span>
        </div>
        <p class="detail-meta" style="margin-top: 4px;">
          创建于 ${new Date(a.created_at).toLocaleString('zh-CN')} · ID <span class="mono">${a.account_id}</span>
        </p>
      </div>

      <div class="tab-bar">
        <a class="tab ${!tab || tab==='overview' ? 'active' : ''}" href="#/accounts/${id}?tab=overview">概览</a>
        <a class="tab ${tab==='hypotheses' ? 'active' : ''}" href="#/accounts/${id}?tab=hypotheses">假设 · ${hypotheses.length}</a>
        <a class="tab ${tab==='interactions' ? 'active' : ''}" href="#/accounts/${id}?tab=interactions">互动 · ${interactions.length}</a>
        <a class="tab ${tab==='samples' ? 'active' : ''}" href="#/accounts/${id}?tab=samples">试样 · ${samples.length}</a>
      </div>

      ${mainContent}
    `;

    // Bind events
    document.querySelectorAll('[data-evaluate]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gate = btn.dataset.evaluate;
        const r = api.evaluateGate(a.account_id, gate);
        if (r.success) {
          const ev = r.data;
          if (ev.status === 'PASSED') alert(`[OK] ${gate} 已通过. V=${ev.new_verification_level}`);
          else alert(`[BLOCKED] ${gate} 失败:\n${ev.blockers.join('\n')}`);
          renderAccountDetail(id);
        }
      });
    });
    bindInlineToggle('add-evidence-form', 'add-evidence', 'cancel-evidence');
    bindInlineToggle('add-hypothesis-form', 'add-hypothesis', 'cancel-hypothesis');
    bindInlineToggle('add-interaction-form', 'add-interaction', 'cancel-interaction');
    bindInlineToggle('add-sample-form', 'add-sample', 'cancel-sample');
    document.querySelector('[data-action="submit-evidence"]')?.addEventListener('click', () => {
      const r = api.addEvidence(a.account_id, {
        source_type: document.getElementById('ev-source-type').value,
        source_url: document.getElementById('ev-source-url').value,
        reliability: parseInt(document.getElementById('ev-reliability').value, 10),
      });
      if (!r.success) { alert(r.errors[0].message); return; }
      renderAccountDetail(id);
    });
    document.querySelector('[data-action="submit-hypothesis"]')?.addEventListener('click', () => {
      const r = api.addHypothesis(a.account_id, {
        statement: document.getElementById('hy-statement').value,
        category: document.getElementById('hy-category').value,
        confidence: parseInt(document.getElementById('hy-confidence').value, 10),
        validation_question: document.getElementById('hy-question').value || null,
      });
      if (!r.success) { alert(r.errors[0].message); return; }
      renderAccountDetail(id);
    });
    document.querySelector('[data-action="submit-interaction"]')?.addEventListener('click', () => {
      const r = api.addInteraction(a.account_id, {
        channel: document.getElementById('in-channel').value,
        summary: document.getElementById('in-summary').value,
        customer_quote: document.getElementById('in-quote').value || null,
      });
      if (!r.success) { alert(r.errors[0].message); return; }
      renderAccountDetail(id);
    });
    document.querySelector('[data-action="submit-sample"]')?.addEventListener('click', () => {
      const vars = document.getElementById('sa-variables').value.split(',').map(s => s.trim()).filter(Boolean);
      const r = api.addSampleExperiment(a.account_id, {
        problem: document.getElementById('sa-problem').value,
        hypothesis: document.getElementById('sa-hypothesis').value,
        variables: vars,
        test_conditions: document.getElementById('sa-conditions').value || null,
        success_criteria: document.getElementById('sa-criteria').value,
      });
      if (!r.success) { alert(r.errors[0].message); return; }
      renderAccountDetail(id);
    });
    document.querySelectorAll('[data-action="recompute-scores"]').forEach(btn => {
      btn.addEventListener('click', () => { api.recomputeScores(a.account_id); renderAccountDetail(id); });
    });
    document.getElementById('compute-nba-inline')?.addEventListener('click', () => { api.computeNextBestAction(a.account_id); renderAccountDetail(id); });
  }

  function bindInlineToggle(formId, openAttr, closeAttr) {
    document.querySelector(`[data-toggle="${openAttr}"]`)?.addEventListener('click', (e) => {
      const f = document.getElementById(formId);
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
    });
    document.querySelector(`[data-action="${closeAttr}"]`)?.addEventListener('click', () => {
      document.getElementById(formId).style.display = 'none';
    });
  }

  function scoreScoreCell(label, value, isRisk) {
    const color = isRisk
      ? (value >= 75 ? 'var(--sf-error)' : value >= 40 ? 'var(--sf-warning)' : 'var(--sf-success)')
      : (value >= 70 ? 'var(--sf-success)' : value >= 40 ? 'var(--sf-warning)' : 'var(--sf-error)');
    const fillPct = isRisk ? value : value;
    const fillColor = color;
    return `<div class="score-cell">
      <div class="score-value" style="color: ${color};">${value}</div>
      <div class="score-label">${label}</div>
      <div class="score-bar"><div class="score-bar-fill" style="width: ${fillPct}%; background: ${fillColor};"></div></div>
    </div>`;
  }

  function gateLabel(g) {
    return { G1: '主体', G2: '官网', G3: '市场', G4: '供应', G5: '需求', G6: '成交' }[g] || g;
  }

  function renderVerticals() {
    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 战略组合</p>
          <h1 class="page-title">5 大战略方向</h1>
        </div>
      </div>
      <div class="dashboard-grid-3">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-blue);">V01</span>手机电子元件</h2>
            <span class="chip">PRIMARY_VERTICAL</span>
          </div>
          <div class="card-body">
            <p class="small"><strong>区域：</strong>深圳 / 东莞</p>
            <p class="small"><strong>场景：</strong>屏蔽罩 / 支撑片 / 补强片 / 弹片 / 卡扣 / 微孔</p>
            <p class="small"><strong>工艺：</strong>连续冲压 / 蚀刻 / 微孔 / 精密分条</p>
            <p class="small" style="color: var(--sf-warning); margin-top: 8px;"><strong>硬约束：</strong>不得把铜/镍/铝元件归为不锈钢机会</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-purple);">V02</span>电池壳套</h2>
            <span class="chip">PRIMARY_VERTICAL</span>
          </div>
          <div class="card-body">
            <p class="small"><strong>产业链：</strong>吉利 / 宁德时代 / 特斯拉</p>
            <p class="small"><strong>场景：</strong>电芯壳体 / 盖板 / 防爆片 / 精密垫片 / 模组与电池包薄壁件</p>
            <p class="small"><strong>三层：</strong>Cell / Module / Pack</p>
            <p class="small" style="color: var(--sf-warning); margin-top: 8px;"><strong>硬约束：</strong>必须区分钢/镀镍钢/不锈钢/铝/铜</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-success);">V03</span>USB 接口</h2>
            <span class="chip">PRIMARY_VERTICAL</span>
          </div>
          <div class="card-body">
            <p class="small"><strong>区域：</strong>东莞</p>
            <p class="small"><strong>场景：</strong>Type-C / USB-A 金属壳 / 屏蔽 / 固定 / 拉深 / 焊接</p>
            <p class="small"><strong>组件：</strong>SHELL / SHIELD / TERMINAL / PLASTIC_CORE</p>
            <p class="small" style="color: var(--sf-warning); margin-top: 8px;"><strong>硬约束：</strong>端子默认非不锈钢目标</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-warning);">V04</span>医疗 316 / 张浦</h2>
            <span class="chip">REQUIRES_SAMPLE_CONFIRMATION</span>
          </div>
          <div class="card-body">
            <p class="small"><strong>区域：</strong>温州</p>
            <p class="small"><strong>场景：</strong>316/316L 医疗针管 / 毛细管 / 微孔 / 医疗弹簧 / 卡扣</p>
            <p class="small"><strong>字段：</strong>mill_source / MTC / heat_number / batch_traceability</p>
            <p class="small" style="color: var(--sf-warning); margin-top: 8px;"><strong>硬约束：</strong>张浦来源只能由客户指定/MTC确认</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-text);">V05</span>日韩贸易</h2>
            <span class="chip">PRIMARY_AND_HORIZONTAL</span>
          </div>
          <div class="card-body">
            <p class="small"><strong>方向：</strong>中国→日韩 / 日韩→中国 / 日韩企业</p>
            <p class="small"><strong>能力：</strong>多语言询价 / 标准映射 / 关税 / 物流 / 单证</p>
            <p class="small"><strong>字段：</strong>原文 / 译文 / HS 编码 / 汇率</p>
            <p class="small" style="color: var(--sf-warning); margin-top: 8px;"><strong>硬约束：</strong>任何动态贸易数据不得硬编码</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderSignals() {
    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 信号中心</p>
          <h1 class="page-title">信号中心 (Phase 4 接入)</h1>
        </div>
        <div class="page-actions">
          <span class="chip">PENDING</span>
        </div>
      </div>
      <div class="empty-state">
        ${illustEmptyHypotheses()}
        <h2>信号中心待 Phase 4 接入</h2>
        <p>天眼查 + 官网 + 展会 + 广告 + 招聘 + 专利 + 环评 + 招投标 7 大类源，<br>按 seed/signal_taxonomy.json 标准化并差分。Phase 4 Connector 上线后启用。</p>
        <a class="btn btn-primary" href="#/phase-status">查看 Phase 计划</a>
      </div>
    `;
  }

  function renderSamples() {
    const all = loadAll();
    const samples = all.flatMap(a => (a.sample_experiments || []).map(s => ({ ...s, account: a })));
    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 试样实验</p>
          <h1 class="page-title">试样实验</h1>
        </div>
        <div class="page-actions">
          <span class="chip">${samples.length} 个</span>
        </div>
      </div>
      ${samples.length === 0 ? `
        <div class="empty-state">
          ${illustEmptySamples()}
          <h2>暂无试样</h2>
          <p>所有账户的试样实验将汇总在此。<br>按 AGENTS §6.8 完整记录 problem / hypothesis / variables / test_conditions / success_criteria。</p>
        </div>
      ` : `
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <table>
              <thead><tr><th>账户</th><th>问题</th><th>成功标准</th><th>状态</th><th>创建</th></tr></thead>
              <tbody>${samples.map(s => `<tr>
                <td><a href="#/accounts/${s.account.account_id}">${escapeHtml(s.account.legal_name)}</a></td>
                <td>${escapeHtml(s.problem.length>30?s.problem.slice(0,30)+'…':s.problem)}</td>
                <td class="small">${escapeHtml(s.success_criteria)}</td>
                <td><span class="chip">${s.status}</span></td>
                <td>${new Date(s.created_at).toLocaleString('zh-CN')}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      `}
    `;
  }

  function renderPhaseStatus() {
    const all = loadAll();
    const stats = {
      accounts: all.length,
      evidence: all.reduce((s, a) => s + a.evidences.length, 0),
      hypotheses: all.reduce((s, a) => s + a.hypotheses.length, 0),
      interactions: all.reduce((s, a) => s + a.interactions.length, 0),
      samples: all.reduce((s, a) => s + a.sample_experiments.length, 0),
    };
    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 阶段进度</p>
          <h1 class="page-title">Phase 进度</h1>
        </div>
        <div class="page-actions">
          <button class="btn btn-danger btn-sm" id="reset-all">清空所有数据</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-blue);">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="2" y="9" width="3" height="5" fill="currentColor"/>
              <rect x="6.5" y="5" width="3" height="9" fill="currentColor"/>
              <rect x="11" y="2" width="3" height="12" fill="currentColor"/>
            </svg>
          </span>当前演示数据</h2>
        </div>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">账户</div><div class="kpi-value">${stats.accounts}</div></div>
          <div class="kpi"><div class="kpi-label">证据</div><div class="kpi-value">${stats.evidence}</div></div>
          <div class="kpi"><div class="kpi-label">假设</div><div class="kpi-value">${stats.hypotheses}</div></div>
          <div class="kpi"><div class="kpi-label">互动</div><div class="kpi-value">${stats.interactions}</div></div>
          <div class="kpi"><div class="kpi-label">试样</div><div class="kpi-value">${stats.samples}</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-success);">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 8 L 7 12 L 13 4" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>已完成</h2>
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead><tr><th>Phase</th><th>描述</th><th>Commit</th></tr></thead>
            <tbody>
              <tr><td><span class="chip v3">Phase 0</span></td><td>仓库审计 (docs/43 + docs/44)</td><td><code>cecabca</code></td></tr>
              <tr><td><span class="chip v3">Phase 1.0</span></td><td>修 6 CRITICAL + 11 HIGH 冲突</td><td><code>dc2ad5b</code></td></tr>
              <tr><td><span class="chip v3">Phase 1.0</span></td><td>34 新表 + RLS + audit_logs + alembic</td><td><code>21ca7ae</code></td></tr>
              <tr><td><span class="chip v3">Phase 1.1</span></td><td>monorepo + 5 packages + FastAPI + Next.js</td><td><code>1a72b6b</code></td></tr>
              <tr><td><span class="chip v3">Phase 1.3</span></td><td>manifest 脚本 + CI 7 jobs + CODEOWNERS</td><td><code>ee42535</code></td></tr>
              <tr><td><span class="chip v3">Phase 2.0</span></td><td>Domain Commands + 5 API + 3 业务页面</td><td><code>c9e01c3</code></td></tr>
              <tr><td><span class="chip v3">Phase 2.2</span></td><td>SQLite + 5 维评分 + 4 业务流 backend</td><td><code>d46318f</code></td></tr>
              <tr><td><span class="chip v3">Phase 3.0</span></td><td>Salesforce Lightning 风格 UI + 业务闭环</td><td><code>current</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="card-title-icon" style="background: var(--sf-text-muted);">→</span>下一步 (Phase 3.1+)</h2>
        </div>
        <div class="card-body" style="padding: 0;">
          <table>
            <thead><tr><th>Phase</th><th>范围</th><th>依赖</th></tr></thead>
            <tbody>
              <tr><td><span class="chip">3.1</span></td><td>DB 切 PG (alembic 0001 已就位)</td><td>用户本地 Docker</td></tr>
              <tr><td><span class="chip">4</span></td><td>天眼查 + 官网 Connector</td><td>真授权</td></tr>
              <tr><td><span class="chip">5</span></td><td>Headless + Trust Gateway + Agent Registry</td><td>Phase 4</td></tr>
              <tr><td><span class="chip">6</span></td><td>Outcome Ledger + Observability</td><td>Phase 5</td></tr>
              <tr><td><span class="chip">7</span></td><td>Data Fabric</td><td>Phase 6</td></tr>
              <tr><td><span class="chip">8</span></td><td>5 大方向行业模块 (V01-V05)</td><td>Phase 7</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('reset-all')?.addEventListener('click', () => {
      if (confirm('清空所有数据? 此操作不可恢复。')) { api.resetAll(); renderPhaseStatus(); }
    });
  }

  function renderDocs() {
    document.getElementById('app').innerHTML = `
      <div class="page-header">
        <div>
          <p class="breadcrumb">TIGO / 文档</p>
          <h1 class="page-title">项目文档</h1>
        </div>
      </div>
      <div class="card">
        <div class="card-body" style="padding: 0;">
          <table>
            <thead><tr><th>文档</th><th>说明</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td><a href="https://github.com" target="_blank">AGENTS.md</a></td><td>业务硬约束 (宪法层)</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/01_PRD.md</td><td>产品需求</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/03_MULTI_STAGE_VERIFICATION_SYSTEM.md</td><td>G1-G6 验证闸门</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/09_TECH_ARCHITECTURE.md</td><td>技术栈</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/13_IMPLEMENTATION_ROADMAP.md</td><td>实施路线 Phase 0-8</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/41_MINIMAX_M3_FINAL_BUILD_PROTOCOL.md</td><td>M3 最终构建协议</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/42_FINAL_ACCEPTANCE_CHECKLIST.md</td><td>最终验收清单</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/43_REPOSITORY_AUDIT.md</td><td>Phase 0 仓库审计 (28 冲突)</td><td><span class="chip v6">FINAL</span></td></tr>
              <tr><td>docs/44_ARCHITECTURE_DECISION_RECORDS.md</td><td>ADR 骨架 (6 候选)</td><td><span class="chip v6">FINAL</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderNotFound() {
    document.getElementById('app').innerHTML = `
      <div class="empty-state">
        <h2>404</h2>
        <p>路径未找到</p>
        <a class="btn btn-primary" href="#/">← 返回首页</a>
      </div>
    `;
  }

  // ============================================
  // Utils
  // ============================================
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ============================================
  // Bootstrap
  // ============================================
  window.addEventListener('hashchange', () => { route(); highlightNav(); });
  document.getElementById('close-rightpanel')?.addEventListener('click', () => {
    document.getElementById('rightpanel').classList.add('collapsed');
  });
  route();
  highlightNav();
})();
