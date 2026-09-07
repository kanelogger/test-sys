import { NavLink, Route, Routes } from "react-router";
import { Icon, type IconName } from "./ui/Icon";
import HistoryPage from "./pages/HistoryPage";
import PlanPage from "./pages/PlanPage";
import RecordPage from "./pages/RecordPage";
import ResourcesPage from "./pages/ResourcesPage";
import TodayPage from "./pages/TodayPage";

/** §10.1 PC 侧边导航：五项顺序固定，未随票交付页带「随票」徽章 */
const NAV_ITEMS: ReadonlyArray<{
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
  laterTicket: boolean;
}> = [
  {
    to: "/",
    label: "今日",
    icon: "calendar-check",
    end: true,
    laterTicket: false,
  },
  {
    to: "/plan",
    label: "计划",
    icon: "calendar-days",
    end: false,
    laterTicket: true,
  },
  {
    to: "/record",
    label: "记录",
    icon: "pen-line",
    end: false,
    laterTicket: false,
  },
  {
    to: "/history",
    label: "历史",
    icon: "history",
    end: false,
    laterTicket: true,
  },
  {
    to: "/resources",
    label: "资源",
    icon: "library",
    end: false,
    laterTicket: true,
  },
];

export default function App() {
  return (
    <>
      <div className="pc-only-notice" role="note">
        <Icon name="info" />
        本应用仅适配 PC 端，请加宽窗口。
      </div>
      <aside className="sidebar">
        <div className="sidebar-brand">系统分析师学习助手</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-item is-active" : "nav-item"
              }
            >
              <Icon name={item.icon} />
              {item.label}
              {item.laterTicket ? (
                <span className="nav-badge">随票</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">数据仅保存在本机浏览器</div>
      </aside>
      <main className="content">
        <div className="content-inner">
          <Routes>
            <Route index element={<TodayPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/record" element={<RecordPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="*" element={<TodayPage />} />
          </Routes>
        </div>
      </main>
    </>
  );
}
