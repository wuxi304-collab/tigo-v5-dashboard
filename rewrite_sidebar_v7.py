"""
TIGO V5 Dashboard Sidebar v7 - 真正重设计
- 深蓝渐变 + 顶 accent + 右侧 box-shadow
- 你在这 (you are here) 顶部 context 指示器 + 脉冲绿点
- 18px solid icon (1.6px stroke), inactive 灰白, hover 薄荷绿, active 放大 + 薄荷绿
- Active state: 渐变蓝背景 + 蓝色 3px 左侧 accent (突出) + 薄荷绿右侧 dot + 内阴影
- Hover: 200ms cubic-bezier 平滑过渡 (background + icon color + icon scale)
- Section title: 小字 + 引导线 (Industrial design)
- 底部拍板倒计时卡: 多色渐变 + 装饰性光晕 + 3 个 stat block + 分隔线
"""
import re
from pathlib import Path

DEPLOY_DIR = Path(r"C:\Users\wuxi3\Desktop\同钧工业增长操作系统_TIGO_Agentic最终开发版_v5\tigo-dashboard-deploy")

# 7 dashboard files with their active state and context
DASHBOARDS = [
    # (rel_path_from_deploy_dir, active_key, context_label)
    ("index.html", "newbie", "首页"),
    ("board-ppt-1page/index.html", "board", "8/15 拍板日"),
    ("demo-day-1hour/index.html", "demo", "8/15 拍板日"),
    ("daily-12d/index.html", "daily", "日常查看"),
    ("g2-3000/index.html", "g2", "日常查看"),
    ("kpi-dashboard-v3/index.html", "kpi", "日常查看"),
    ("roi-dashboard-v2/index.html", "roi", "日常查看"),
]

# Better icons - 18x18, 1.6 stroke, line-cap round, distinctive
ICONS = {
    "newbie": '''<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8 L 9 3 L 15 8 V 14.5 a 0.5 0.5 0 0 1 -0.5 0.5 H 3.5 a 0.5 0.5 0 0 1 -0.5 -0.5 Z"/><path d="M7.5 15 V 10.5 a 1.5 1.5 0 0 1 3 0 V 15"/></svg>''',
    "board": '''<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2 H 11 L 14 5 V 15.5 a 0.5 0.5 0 0 1 -0.5 0.5 H 4 a 1 1 0 0 1 -1 -1 V 3 a 1 1 0 0 1 1 -1 Z"/><path d="M11 2 V 5 H 14"/><path d="M6.2 10 L 7.7 11.5 L 11 8.2" stroke-width="1.9"/></svg>''',
    "demo": '''<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="13" height="11" rx="1.5"/><path d="M2.5 7.5 H 15.5"/><path d="M6 3 V 5.5"/><path d="M12 3 V 5.5"/><path d="M9 10.2 L 9.85 11.85 L 11.6 12.1 L 10.3 13.35 L 10.65 15.1 L 9 14.25 L 7.35 15.1 L 7.7 13.35 L 6.4 12.1 L 8.15 11.85 Z" fill="currentColor" stroke="none"/></svg>''',
    "daily": '''<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="6" height="6" rx="1"/><rect x="9.5" y="2.5" width="6" height="6" rx="1"/><rect x="2.5" y="9.5" width="6" height="6" rx="1"/><path d="M10 12.5 L 11.8 14.2 L 15 11" stroke-width="1.9"/></svg>''',
    "g2": '''<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="13" cy="7" r="2"/><path d="M1.5 14.5 a 4 4 0 0 1 7.5 -1.8"/><path d="M10.5 14 a 3.5 3.5 0 0 1 6.5 -0.5"/></svg>''',
    "kpi": '''<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14.8 L 3.8 9.6 a 2.8 2.8 0 0 1 4 -4 L 9 7 L 10.2 5.6 a 2.8 2.8 0 0 1 4 4 Z"/><path d="M5 9.6 H 7 L 8 8 L 9 12 L 10 9.6 H 13" stroke-width="1.4"/></svg>''',
    "roi": '''<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13 L 6.5 8.5 L 9.5 11 L 15 5"/><path d="M11 5 H 15 V 9" stroke-width="1.9"/><path d="M2 16 H 16"/></svg>''',
}

# Nav items: (key, label, title-tooltip, href-path)
# href-path is relative to current file
NAV_ITEMS = [
    ("newbie", "新人入口", "5 分钟上手", "index.html"),
    ("board", "决策包 1 页", "给老板看的 1 页 PPT", "board-ppt-1page/index.html"),
    ("demo", "8/15 拍板会", "现场流程 · 1 小时跑完", "demo-day-1hour/index.html"),
    ("daily", "我每天看什么", "12 个核心指标", "daily-12d/index.html"),
    ("g2", "我们有多少客户", "3000 个潜在客户 + 5 黄金", "g2-3000/index.html"),
    ("kpi", "客户健康度", "320 个评分", "kpi-dashboard-v3/index.html"),
    ("roi", "投入回报算账", "125x 杠杆真实算账", "roi-dashboard-v2/index.html"),
]

# CSS for v7 sidebar (replaces v2 block in style section)
NEW_SIDEBAR_CSS = """
/* === Sidebar v7: 重设计 (深蓝渐变 + context 指示 + 真正设计感) === */
.sf-sidebar {
  width: 240px;
  background: linear-gradient(180deg, #04245A 0%, #021B3D 100%);
  color: white;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.04), 4px 0 24px rgba(0, 0, 0, 0.10);
  min-height: 100%;
}
.sf-sidebar::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, #0070D2 0%, #9050E0 50%, #AEF1DA 100%);
  opacity: 0.7;
  z-index: 2;
  pointer-events: none;
}

/* 你在这 (You are here) 顶部 context 指示 */
.sf-sidebar-context {
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 6px;
  position: relative;
}
.sf-sidebar-context-pulse {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: #AEF1DA;
  text-transform: uppercase;
  letter-spacing: 1.6px;
  font-weight: 700;
}
.sf-sidebar-context-pulse::before {
  content: "";
  width: 6px; height: 6px;
  background: #AEF1DA;
  border-radius: 50%;
  box-shadow: 0 0 8px #AEF1DA;
  animation: sf-sidebar-pulse 2s ease-in-out infinite;
}
@keyframes sf-sidebar-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.78); }
}
.sf-sidebar-context-name {
  font-size: 17px;
  color: #fff;
  font-weight: 700;
  margin-top: 6px;
  letter-spacing: -0.2px;
}

/* Section */
.sf-sidebar-section {
  padding: 6px 0 2px;
}
.sf-sidebar-section-title {
  padding: 8px 22px 5px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.42);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 7px;
}
.sf-sidebar-section-title::before {
  content: "";
  width: 10px;
  height: 1px;
  background: rgba(255, 255, 255, 0.28);
}

/* Nav item - 基础态 */
.sf-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  margin: 1px 10px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
              color 200ms cubic-bezier(0.4, 0, 0.2, 1),
              border-color 200ms cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  letter-spacing: 0.1px;
}
.sf-nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.98);
  text-decoration: none;
}
.sf-nav-item .sf-nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.55);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 200ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
.sf-nav-item:hover .sf-nav-icon {
  color: #AEF1DA;
  transform: scale(1.08);
}

/* Active state - 真正的视觉冲击 */
.sf-nav-item.active {
  background: linear-gradient(90deg, rgba(0, 112, 210, 0.28) 0%, rgba(0, 112, 210, 0.08) 100%);
  color: #fff;
  font-weight: 600;
  border-color: rgba(0, 112, 210, 0.32);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.sf-nav-item.active::before {
  content: "";
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: #0070D2;
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px rgba(0, 112, 210, 0.6);
}
.sf-nav-item.active .sf-nav-icon {
  color: #AEF1DA;
  transform: scale(1.05);
}
.sf-nav-item.active::after {
  content: "";
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  background: #AEF1DA;
  border-radius: 50%;
  box-shadow: 0 0 6px #AEF1DA;
}

/* Divider */
.sf-sidebar-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 8px 16px;
}

/* 底部拍板倒计时卡 - 多色渐变 + 装饰性光晕 */
.sf-sidebar-deadline {
  margin: auto 12px 14px 12px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(0, 112, 210, 0.22) 0%, rgba(144, 80, 224, 0.12) 100%);
  border: 1px solid rgba(0, 112, 210, 0.35);
  border-radius: 10px;
  position: relative;
  overflow: hidden;
}
.sf-sidebar-deadline::before {
  content: "";
  position: absolute;
  top: -24px; right: -24px;
  width: 90px; height: 90px;
  background: radial-gradient(circle, rgba(174, 241, 218, 0.20) 0%, transparent 70%);
  pointer-events: none;
}
.sf-sidebar-deadline-icon {
  display: inline-flex;
  width: 26px; height: 26px;
  background: rgba(0, 112, 210, 0.32);
  color: #AEF1DA;
  border-radius: 7px;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
  box-shadow: 0 0 12px rgba(0, 112, 210, 0.25);
}
.sf-sidebar-deadline-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 1.3px;
  font-weight: 700;
  position: relative;
  z-index: 1;
}
.sf-sidebar-deadline-date {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.3px;
  position: relative;
  z-index: 1;
}
.sf-sidebar-deadline-stats {
  display: flex;
  gap: 4px;
  margin-top: 10px;
  position: relative;
  z-index: 1;
}
.sf-sidebar-deadline-stat {
  flex: 1;
  text-align: center;
  padding: 5px 0 4px;
  background: rgba(0, 0, 0, 0.18);
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.sf-sidebar-deadline-stat strong {
  display: block;
  color: #AEF1DA;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.sf-sidebar-deadline-stat span {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
  margin-top: 1px;
  letter-spacing: 0.2px;
}
.sf-sidebar-deadline-sub {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  letter-spacing: 0.3px;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 5px;
}
.sf-sidebar-deadline-sub::before {
  content: "";
  width: 4px; height: 4px;
  background: #AEF1DA;
  border-radius: 50%;
  flex-shrink: 0;
}
"""


def build_sidebar(active_key: str, context_label: str, is_root: bool) -> str:
    """Build the new sidebar HTML.

    is_root=True → hrefs use bare names (index.html, board-ppt-1page/index.html)
    is_root=False → hrefs use ../ prefix for sub-page nav links
    """
    prefix = "" if is_root else "../"

    def href_for(target_href: str) -> str:
        return prefix + target_href

    # Section 1: home / newbie (no section title, sits under context)
    newbie_key, newbie_label, newbie_title, newbie_href = NAV_ITEMS[0]
    newbie_class = "sf-nav-item active" if active_key == newbie_key else "sf-nav-item"
    newbie_link = f'<a class="{newbie_class}" href="{href_for(newbie_href)}" title="{newbie_title}"><span class="sf-nav-icon">{ICONS[newbie_key]}</span><span>{newbie_label}</span></a>'

    # Section 2: 8/15 拍板日 (board + demo)
    section2_items = []
    for key, label, title, href in NAV_ITEMS[1:3]:
        cls = "sf-nav-item active" if active_key == key else "sf-nav-item"
        section2_items.append(f'<a class="{cls}" href="{href_for(href)}" title="{title}"><span class="sf-nav-icon">{ICONS[key]}</span><span>{label}</span></a>')
    section2 = (
        '<div class="sf-sidebar-section">'
        '<div class="sf-sidebar-section-title">8/15 拍板日</div>'
        + "".join(section2_items) +
        '</div>'
    )

    # Section 3: 日常查看 (daily + g2 + kpi + roi)
    section3_items = []
    for key, label, title, href in NAV_ITEMS[3:]:
        cls = "sf-nav-item active" if active_key == key else "sf-nav-item"
        section3_items.append(f'<a class="{cls}" href="{href_for(href)}" title="{title}"><span class="sf-nav-icon">{ICONS[key]}</span><span>{label}</span></a>')
    section3 = (
        '<div class="sf-sidebar-section">'
        '<div class="sf-sidebar-section-title">日常查看</div>'
        + "".join(section3_items) +
        '</div>'
    )

    sidebar = (
        '<nav class="sf-sidebar" aria-label="主导航">'
        '<div class="sf-sidebar-context">'
        '<div class="sf-sidebar-context-pulse">你在这</div>'
        f'<div class="sf-sidebar-context-name">{context_label}</div>'
        '</div>'
        + newbie_link
        + section2
        + section3
        + '<div class="sf-sidebar-divider"></div>'
        '<div class="sf-sidebar-deadline">'
        '<div class="sf-sidebar-deadline-icon">'
        '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
        '<circle cx="9" cy="9" r="7"/>'
        '<path d="M9 5 V 9 L 11.5 11"/>'
        '</svg>'
        '</div>'
        '<div class="sf-sidebar-deadline-label">拍板倒计时</div>'
        '<div class="sf-sidebar-deadline-date">2026-08-15 18:00</div>'
        '<div class="sf-sidebar-deadline-stats">'
        '<div class="sf-sidebar-deadline-stat"><strong>5</strong><span>黄金</span></div>'
        '<div class="sf-sidebar-deadline-stat"><strong>30</strong><span>宝武</span></div>'
        '<div class="sf-sidebar-deadline-stat"><strong>12</strong><span>集成商</span></div>'
        '</div>'
        '<div class="sf-sidebar-deadline-sub">8/15 拍板 · 24h 可撤回</div>'
        '</div>'
        '</nav>'
    )
    return sidebar


def update_file(rel_path: str, active_key: str, context_label: str, is_root: bool) -> None:
    path = DEPLOY_DIR / rel_path
    content = path.read_text(encoding="utf-8")

    # 1) Replace v2 sidebar CSS block (between the comment and </style>)
    v2_start = content.find("/* Sidebar v2:")
    if v2_start == -1:
        print(f"  WARN: v2 sidebar CSS not found in {rel_path}")
    else:
        style_close = content.find("</style>", v2_start)
        if style_close == -1:
            print(f"  ERROR: </style> not found in {rel_path}")
        else:
            # Build new content: everything before v2 + v7 CSS + everything from </style> onwards
            before = content[:v2_start]
            after = content[style_close:]
            content = before + "\n" + NEW_SIDEBAR_CSS.rstrip() + "\n" + after

    # 2) Replace sidebar HTML
    nav_start = content.find('<nav class="sf-sidebar"')
    if nav_start == -1:
        print(f"  ERROR: sidebar nav not found in {rel_path}")
    else:
        nav_end = content.find("</nav>", nav_start)
        if nav_end == -1:
            print(f"  ERROR: </nav> not found in {rel_path}")
        else:
            nav_end += len("</nav>")
            new_nav = build_sidebar(active_key, context_label, is_root)
            content = content[:nav_start] + new_nav + content[nav_end:]

    path.write_text(content, encoding="utf-8")
    print(f"  OK  → {rel_path}")


def main():
    print("=== TIGO V5 Sidebar v7 重设计 (7 dashboard) ===\n")
    for rel, key, ctx in DASHBOARDS:
        is_root = (rel == "index.html")
        update_file(rel, key, ctx, is_root)
    print("\n完成. 验证: 7 dashboard 顶部 context 名 + active state + 18px icon 全部就位")


if __name__ == "__main__":
    main()
