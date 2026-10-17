import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, BarChart, AlertCircle, ArrowRight, Clock, Cpu, X, Trash2, Power } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { apiUrl } from "../lib/api.js";
// Button component (unchanged)
const Button = ({ children, onClick, className = "", variant = "default", type = "button", disabled = false }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
    ${variant === "default" ? "bg-[#d9ff57] text-[#07110e] hover:bg-[#e7ff91]" :
      variant === "outline" ? "border border-gray-600 text-gray-200 hover:bg-gray-700 hover:text-white" :
      variant === "ghost" ? "text-gray-300 hover:bg-gray-800 hover:text-white" : ""} ${className}`}
  >
    {children}
  </button>
);

// MonitorCard component (updated)
const MonitorCard = ({ monitor, onDelete, onToggle, isActive }) => {
  const handleDeleteClick = () => onDelete(monitor.id);
  const handleToggleClick = () => onToggle(monitor.id);

  // Ensure averageLatencyPerMinute is defined
  const averageLatencyPerMinute = monitor.averageLatencyPerMinute || [];

  const status = monitor.currentStatus === "Good" ? "up" : monitor.currentStatus === "Bad" ? "down" : "unknown";

  // Ensure uptimePercentage is defined
  const uptimePercentage = monitor.uptimePercentage || 0;

  return (
    <div className={`rounded-xl border ${isActive ? "border-gray-700 bg-gray-800/80" : "border-gray-700/50 bg-gray-800/40"} text-white shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-gray-600 relative group`}>
      <div className={!isActive ? "opacity-70" : ""}>
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center">
              <span className="relative flex h-3 w-3 mr-3">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${
                    !isActive ? "bg-gray-500" :
                    status === "up" ? "bg-emerald-500" :
                    status === "down" ? "bg-rose-500" : "bg-amber-400"
                  }`}
                />
                {isActive && status === "down" && (
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      "bg-rose-500"
                    } animate-ping`}
                  />
                )}
              </span>
              <h3 className="text-lg font-bold">{monitor.websiteName}</h3>
            </div>
            <span className={`${
              !isActive ? "bg-gray-500/10 text-gray-400 border-gray-500/20" :
              status === "up" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
              status === "down" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
              "bg-amber-500/10 text-amber-300 border-amber-500/20"
            } text-xs font-medium px-2.5 py-1 rounded-full border`}>
              {!isActive ? "Inactive" :
               status === "up" ? "Operational" :
               status === "down" ? "Down" : "Awaiting data"}
            </span>
          </div>

          <div className="flex justify-between items-center mb-4">
            <button
              onClick={handleDeleteClick}
              aria-label={`Delete ${monitor.websiteName}`}
              className="p-2 bg-gray-700/70 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/20 opacity-100 transition-all shadow-sm z-10"
              title="Delete monitor"
            >
              <Trash2 className="h-5 w-5" />
            </button>

            <button
              onClick={handleToggleClick}
              aria-label={`${isActive ? "Pause" : "Resume"} ${monitor.websiteName}`}
              className={`p-2 rounded-lg transition-all shadow-sm z-10 ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300"
                  : "bg-gray-700/70 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
              }`}
              title={isActive ? "Disable monitor" : "Enable monitor"}
            >
              <Power className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-4 truncate">{monitor.url}</p>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-lg bg-gray-900/80 border border-gray-700">
              <p className="text-xs text-gray-400 mb-1 flex items-center">
                <Clock className="h-3 w-3 mr-1.5" />
                Uptime
              </p>
              <p className="text-xl font-bold">{monitor.totalTicks ? `${uptimePercentage.toFixed(2)}%` : "—"}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-900/80 border border-gray-700">
              <p className="text-xs text-gray-400 mb-1 flex items-center">
                <Cpu className="h-3 w-3 mr-1.5" />
                Response
              </p>
              <div className="flex items-center">
                <p className="text-xl font-bold">{monitor.response == null ? "—" : `${monitor.response} ms`}</p>
              </div>
            </div>
          </div>

          <div className="h-16 mb-3 relative">
            <div className="absolute inset-0 flex items-end gap-0.5">
              {isActive && averageLatencyPerMinute.length > 0 ? averageLatencyPerMinute.slice(-50).map((latencyData) => (
                <div
                  key={latencyData.timestamp}
                  style={{ height: `${latencyData.averageLatency > 0 ? Math.min(latencyData.averageLatency / 10, 100) : 10}%` }}
                  className={`flex-1 ${
                    latencyData.averageLatency === 0
                      ? "bg-gradient-to-t from-rose-500/90 to-rose-400/50"
                      : "bg-gradient-to-t from-emerald-500/90 to-emerald-400/50"
                  } rounded-t-sm`}
                />
              )) : (
                <p className="m-auto text-xs text-gray-500">{isActive ? "Awaiting observations" : "Monitoring paused"}</p>
              )}
            </div>
          </div>
        </div>
        <Link to={`/monitor/${monitor.id}`} className="block bg-gray-900 p-3 border-t border-gray-700 hover:bg-gray-800 transition-colors">
          <span className="text-sm text-gray-300 hover:text-white w-full flex justify-between items-center transition-colors">
            View Details
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
};

// StatCard component (unchanged)
const StatCard = ({ title, value, icon, color }) => (
  <div className={`rounded-xl border p-5 shadow-lg backdrop-blur-sm ${
    color === "green" ? "bg-emerald-500/5 border-emerald-500/20" :
    color === "red" ? "bg-rose-500/5 border-rose-500/20" :
    color === "blue" ? "bg-emerald-500/5 border-emerald-500/20" :
    color === "yellow" ? "bg-amber-500/5 border-amber-500/20" : ""}`}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <div className={`rounded-full p-1.5 ${
        color === "green" ? "bg-emerald-500/20 text-emerald-400" :
        color === "red" ? "bg-rose-500/20 text-rose-400" :
        color === "blue" ? "bg-emerald-500/20 text-emerald-400" :
        color === "yellow" ? "bg-amber-500/20 text-amber-400" : ""
      }`}>
        {icon}
      </div>
    </div>
    <p className="text-3xl font-bold text-white mt-2">{value}</p>
  </div>
);

// AddMonitor component (unchanged)
const AddMonitor = ({ isOpen, onClose, onAdd }) => {
  const {getToken} = useAuth();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(apiUrl('/website'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ websiteName: name, url }),
      });

      if (!response.ok) {
        throw new Error("Failed to add monitor");
      }

      const newMonitor = await response.json();
      onAdd(newMonitor);
      setName("");
      setUrl("");
      onClose();
    } catch (error) {
      setError("Failed to add monitor. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 pointer-events-none"></div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close add monitor"
          className="absolute right-4 top-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors z-20"
        >
          <X className="h-5 w-5" />
        </button>
        <form onSubmit={handleSubmit} className="p-8 relative z-10">
          <h2 className="text-2xl font-semibold mb-1 text-white">Add Monitor</h2>
          <div className="mb-6" />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <div className="space-y-5">
            <div>
              <label htmlFor="monitor-name" className="block text-sm font-medium mb-2 text-gray-300">Name</label>
              <input
                id="monitor-name"
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="My Website"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="monitor-url" className="block text-sm font-medium mb-2 text-gray-300">Website URL</label>
              <input
                id="monitor-url"
                type="url"
                maxLength={2048}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-8">
            <Button
              onClick={onClose}
              variant="ghost"
              className="text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="text-sm bg-[#d9ff57] text-[#07110e] hover:bg-[#e7ff91]"
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create Monitor"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const {getToken} = useAuth();
  const [isAddMonitorOpen, setIsAddMonitorOpen] = useState(false);
  const [monitors, setMonitors] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, monitorId: null, monitorName: "" });

  // Fetch data from the backend
  const fetchDashboardDetails = useCallback(async () => {
    const token = await getToken();
    try {
      const response = await fetch(apiUrl('/dashboard-details'), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard details");
      }

      const data = await response.json();
      setMonitors(data.websites);
      setDashboardError("");
    } catch (error) {
      console.error("Error fetching dashboard details:", error);
      setDashboardError("Could not load monitors. Retrying…");
    }
  }, [getToken]);

  // Poll the backend every 1 minute
  useEffect(() => {
    fetchDashboardDetails(); // Initial fetch
    const interval = setInterval(fetchDashboardDetails, 60000); // Poll every 1 minute
    return () => clearInterval(interval);
  }, [fetchDashboardDetails]);

  // Handle adding a new monitor
  const handleAddMonitor = (newMonitor) => {
    setMonitors((current) => [newMonitor, ...current]);
  };

  // Handle deleting a monitor
  const handleDeleteMonitor = async (monitorId) => {
    const token = await getToken();
    try {
      const response = await fetch(apiUrl(`/website/${monitorId}`), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete monitor");
      }

      setMonitors((current) => current.filter((monitor) => monitor.id !== monitorId));
      setDeleteDialog({ isOpen: false, monitorId: null, monitorName: "" });
    } catch (error) {
      console.error("Error deleting monitor:", error);
      setDashboardError("Could not delete this monitor.");
    }
  };

  // Handle toggling a monitor
  const handleToggleMonitor = async (monitorId) => {
    try {
      const token = await getToken();
      const response = await fetch(apiUrl(`/website-track/${monitorId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization" : `Bearer ${token}`
        },
      });

      if (!response.ok) {
        throw new Error("Failed to toggle monitor");
      }

      setMonitors((current) => current.map((monitor) =>
        monitor.id === monitorId ? { ...monitor, disabled: !monitor.disabled } : monitor
      ));
    } catch (error) {
      console.error("Error toggling monitor:", error);
      setDashboardError("Could not update this monitor.");
    }
  };

  // Filter monitors based on search query
  const filteredMonitors = monitors.filter((monitor) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      monitor.websiteName.toLowerCase().includes(query) ||
      monitor.url.toLowerCase().includes(query)
    );
  });

  // Calculate statistics for the dashboard
  const totalMonitors = monitors.length;
  const enabledCount = monitors.filter((monitor) => !monitor.disabled).length;
  const disabledCount = monitors.filter((monitor) => monitor.disabled).length;

  return (
    <div className="min-h-screen pt-16 pb-12 animate-fade-in bg-[#07110e]">
      {/* Delete confirmation dialog */}
      {deleteDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-2 text-white">Delete Monitor</h2>
              <p className="mb-6 text-gray-300">
                Are you sure you want to delete this monitor? <span className="font-medium text-white">"{deleteDialog.monitorName}"</span> will be permanently removed.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setDeleteDialog({ isOpen: false, monitorId: null, monitorName: "" })}
                  variant="ghost"
                  className="text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteMonitor(deleteDialog.monitorId)}
                  variant="default"
                  className="text-sm bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-md hover:shadow-lg shadow-red-500/20"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="container px-4 py-8 max-w-7xl mx-auto">
        {/* Header with welcome and quick stats */}
        <div className="flex flex-col gap-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-medium tracking-tight text-[#f3f0e8]">Dashboard</h1>
              {dashboardError && <p role="alert" className="mt-3 text-sm text-amber-300">{dashboardError}</p>}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setIsAddMonitorOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                <span>Add Monitor</span>
              </Button>
            </div>
          </div>

          {/* Stats overview with improved grid layout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard
              title="Total Monitors"
              value={totalMonitors.toString()}
              icon={<BarChart className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              title="Enabled"
              value={enabledCount.toString()}
              icon={<Cpu className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              title="Paused"
              value={disabledCount.toString()}
              icon={<AlertCircle className="h-5 w-5" />}
              color="red"
            />
          </div>
        </div>

        {/* Monitor filters and search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">Your Monitors</h2>
          </div>
          <div className="flex w-full md:w-auto gap-3">
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search monitors..."
                className="pl-9 pr-4 py-2.5 w-full md:w-64 rounded-md border border-gray-700 bg-gray-900 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Monitors grid with improved spacing */}
        {filteredMonitors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMonitors.map((monitor) => (
              <MonitorCard
                key={monitor.id} // Add a unique key for each monitor
                monitor={monitor}
                onDelete={(id) => setDeleteDialog({ isOpen: true, monitorId: id, monitorName: monitor.websiteName })}
                onToggle={handleToggleMonitor}
                isActive={!monitor.disabled}
              />
            ))}
          </div>
        )}

        {/* Empty state with improved design - show when no monitors or no search results */}
        {filteredMonitors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 border border-gray-700 rounded-xl bg-gray-800/50 backdrop-blur-sm">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/30">
              {searchQuery ? <Search className="h-10 w-10 text-emerald-400" /> : <BarChart className="h-10 w-10 text-emerald-400" />}
            </div>
            <h3 className="text-2xl font-medium mb-3 text-white">
              {searchQuery ? "No matching monitors found" : "No monitors yet"}
            </h3>
            <p className="text-gray-400 text-center max-w-md mb-8">
              {searchQuery
                ? `No matches for "${searchQuery}".`
                : "Add a website to start tracking uptime."}
            </p>
            <div className="flex gap-4">
              {searchQuery && (
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="outline"
                  className="px-6 py-2.5 text-base"
                >
                  Clear Search
                </Button>
              )}
              <Button
                onClick={() => setIsAddMonitorOpen(true)}
                className="px-6 py-2.5 text-base"
              >
                <Plus className="h-5 w-5 mr-2" />
                {searchQuery ? "Add New Monitor" : "Add Your First Monitor"}
              </Button>
            </div>
          </div>
        )}

        <AddMonitor
          isOpen={isAddMonitorOpen}
          onClose={() => setIsAddMonitorOpen(false)}
          onAdd={handleAddMonitor}
        />
      </div>
    </div>
  );
};

export default Dashboard;
