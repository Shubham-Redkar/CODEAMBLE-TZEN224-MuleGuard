import { Routes, Route, NavLink } from "react-router-dom";
import { Upload, FileSearch, LayoutDashboard, Search, GitGraph, Shield } from "lucide-react";
import { UploadPage } from "./pages/UploadPage";
import { ExtractionReviewPage } from "./pages/ExtractionReviewPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EvidenceExplorerPage } from "./pages/EvidenceExplorerPage";
import { ProofGraphPage } from "./pages/ProofGraphPage";

const navItems = [
  { to: "/", label: "Upload", icon: Upload, end: true },
  { to: "/review", label: "Extraction Review", icon: FileSearch },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/evidence", label: "Evidence Explorer", icon: Search },
  { to: "/graph", label: "Proof Graph", icon: GitGraph },
];

function App() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg">MuleGuard</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Local v0.1.0</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
          Fully offline &mdash; no data leaves this machine
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/review" element={<ExtractionReviewPage />} />
          <Route path="/review/:id" element={<ExtractionReviewPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/:id" element={<DashboardPage />} />
          <Route path="/evidence" element={<EvidenceExplorerPage />} />
          <Route path="/evidence/:id" element={<EvidenceExplorerPage />} />
          <Route path="/graph" element={<ProofGraphPage />} />
          <Route path="/graph/:id" element={<ProofGraphPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
