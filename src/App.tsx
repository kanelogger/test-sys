import { NavLink, Route, Routes } from "react-router";
import HistoryPage from "./pages/HistoryPage";
import PlanPage from "./pages/PlanPage";
import RecordPage from "./pages/RecordPage";
import ResourcesPage from "./pages/ResourcesPage";
import TodayPage from "./pages/TodayPage";

const NAV_ITEMS = [
  { to: "/", label: "今日", end: true },
  { to: "/plan", label: "计划", end: false },
  { to: "/record", label: "记录", end: false },
  { to: "/history", label: "历史", end: false },
  { to: "/resources", label: "资源", end: false },
] as const;

export default function App() {
  return (
    <div className="app-shell">
      <aside className="app-nav">
        <h1 className="app-title">系统分析师学习助手</h1>
        <nav>
          <ul className="app-nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive ? "app-nav-link is-active" : "app-nav-link"
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="app-main">
        <Routes>
          <Route index element={<TodayPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="*" element={<TodayPage />} />
        </Routes>
      </main>
    </div>
  );
}
