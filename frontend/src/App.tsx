import { Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Upload, FileSearch, LayoutDashboard, Search, GitGraph, Shield, Trash2, ChevronDown } from "lucide-react";
import { UploadPage } from "./pages/UploadPage";
import { ExtractionReviewPage } from "./pages/ExtractionReviewPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EvidenceExplorerPage } from "./pages/EvidenceExplorerPage";
import { ProofGraphPage } from "./pages/ProofGraphPage";
import { StatementProvider, useStatement } from "./lib/StatementContext";

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { statements, currentId, currentStatement, setCurrentId, purgeAll } = useStatement();

  const navItems = [
    { to: "/", label: "Upload & History", icon: Upload, exact: true },
    {
      to: currentId ? `/review/${currentId}` : "/review",
      label: "Extraction Review",
      icon: FileSearch,
      activePath: "/review",
    },
    {
      to: currentId ? `/dashboard/${currentId}` : "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      activePath: "/dashboard",
    },
    {
      to: currentId ? `/evidence/${currentId}` : "/evidence",
      label: "Evidence Explorer",
      icon: Search,
      activePath: "/evidence",
    },
    {
      to: currentId ? `/graph/${currentId}` : "/graph",
      label: "Proof Graph",
      icon: GitGraph,
      activePath: "/graph",
    },
  ];

  const handleSelectStatement = (idStr: string) => {
    const numId = Number(idStr);
    setCurrentId(numId);
    // If user is on a specific view page, redirect to that view for the newly selected statement
    const path = location.pathname;
    if (path.startsWith("/review")) {
      navigate(`/review/${numId}`);
    } else if (path.startsWith("/dashboard")) {
      navigate(`/dashboard/${numId}`);
    } else if (path.startsWith("/evidence")) {
      navigate(`/evidence/${numId}`);
    } else if (path.startsWith("/graph")) {
      navigate(`/graph/${numId}`);
    }
  };

  const handlePurgeAll = async () => {
    if (window.confirm("Are you sure you want to purge all statements and database records?")) {
      await purgeAll();
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg text-gray-900">MuleGuard</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Local v0.1.0 · Offline</p>
        </div>

        {/* Active Statement Selector in Sidebar */}
        <div className="p-3 border-b border-gray-100 bg-gray-50/50">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Active Statement</span>
            {statements.length > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                {statements.length} Total
              </span>
            )}
          </div>

          {statements.length > 0 ? (
            <div className="relative">
              <select
                value={currentId || ""}
                onChange={(e) => handleSelectStatement(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-md py-1.5 pl-2 pr-7 text-gray-700 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer truncate shadow-sm"
              >
                {statements.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id}: {s.original_filename || "Statement"} {s.tier ? `(${s.tier.replace('_', ' ')})` : `(${s.status})`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-2 pointer-events-none" />
            </div>
          ) : (
            <div className="text-xs text-gray-400 py-1">No statements uploaded yet</div>
          )}

          {currentStatement && (
            <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
              <span className="truncate max-w-[130px]" title={currentStatement.original_filename || ""}>
                {currentStatement.original_filename}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  currentStatement.tier === "CONFIRMED_SUSPICIOUS"
                    ? "bg-red-100 text-red-700"
                    : currentStatement.tier === "LIKELY_LEGITIMATE"
                    ? "bg-green-100 text-green-700"
                    : currentStatement.tier === "REVIEW_REQUIRED"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {currentStatement.tier ? currentStatement.tier.replace("_", " ") : currentStatement.status}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon, exact, activePath }) => {
            const isItemActive = exact
              ? location.pathname === "/"
              : activePath
              ? location.pathname.startsWith(activePath)
              : false;

            return (
              <NavLink
                key={label}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isItemActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 space-y-2">
          {statements.length > 0 && (
            <button
              onClick={handlePurgeAll}
              className="w-full text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Purge All Data
            </button>
          )}
          <div className="text-[11px] text-gray-400 text-center">
            Fully offline &mdash; no data leaves this machine
          </div>
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

export function App() {
  return (
    <StatementProvider>
      <AppLayout />
    </StatementProvider>
  );
}

export default App;
