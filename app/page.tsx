"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Pill, Clock, CheckCircle2, AlertTriangle, XCircle, Settings, 
  Flame, Percent, BarChart3, LogOut, Radio, RefreshCw, Volume2, 
  VolumeX, HelpCircle, ShieldAlert
} from "lucide-react";

interface SlotStatus {
  scheduled: string;
  status: "pending" | "due" | "taken" | "missed";
  takenAt: string | null;
}

interface AdherenceStats {
  adherenceRate: number;
  currentStreak: number;
  totalTaken: number;
  totalMissed: number;
}

interface HistoryItem {
  id: string;
  date: string;
  slot: string;
  status: "pending" | "taken" | "missed";
  dueAt: string;
  takenAt: string | null;
}

export default function Dashboard() {
  const router = useRouter();
  
  // App States
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [todayStatus, setTodayStatus] = useState<Record<string, SlotStatus>>({});
  const [stats, setStats] = useState<AdherenceStats>({
    adherenceRate: 100,
    currentStreak: 0,
    totalTaken: 0,
    totalMissed: 0
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Settings Form States
  const [morningTime, setMorningTime] = useState("08:00");
  const [afternoonTime, setAfternoonTime] = useState("14:00");
  const [nightTime, setNightTime] = useState("20:00");
  const [deviceIdInput, setDeviceIdInput] = useState("");
  const [routineActive, setRoutineActive] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");

  // Simulator States
  const [isSimulatorEnabled, setIsSimulatorEnabled] = useState(true);
  const [useSimulatedTime, setUseSimulatedTime] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState("08:15");
  const [pillsPresent, setPillsPresent] = useState({
    morning: true,
    afternoon: true,
    night: true,
  });
  const [virtualMuted, setVirtualMuted] = useState(false);

  // Fetch all adherence data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const now = new Date();
      const localDate = now.toISOString().split("T")[0];
      
      // Determine what time to query with
      let localTime = now.toTimeString().split(" ")[0].substring(0, 5);
      if (useSimulatedTime) {
        localTime = simulatedTime;
      }

      const res = await fetch(`/api/adherence?date=${localDate}&time=${localTime}`);
      if (res.ok) {
        const data = await res.json();
        setTodayStatus(data.todayStatus);
        setStats(data.stats);
        setHistory(data.history);
      }
    } catch (err) {
      console.error("Error loading adherence data:", err);
    } finally {
      if (!isSilent) setRefreshing(false);
    }
  }, [useSimulatedTime, simulatedTime]);

  // Authenticate user session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setDeviceIdInput(data.user.deviceId || "");
        
        // Fetch routine config
        const routineRes = await fetch("/api/routine");
        if (routineRes.ok) {
          const rData = await routineRes.json();
          if (rData.routine) {
            setMorningTime(rData.routine.morning);
            setAfternoonTime(rData.routine.afternoon);
            setNightTime(rData.routine.night);
            setRoutineActive(rData.routine.active);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error("Authentication check failed:", err);
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  // Initial load and short polling for live dashboard updates
  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(() => {
        fetchData(true);
      }, 3000); // Poll database every 3 seconds for physical/virtual updates
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  // Save routine configurations
  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("Saving...");
    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          morning: morningTime,
          afternoon: afternoonTime,
          night: nightTime,
          deviceId: deviceIdInput,
          active: routineActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }
      
      setUser((prev: any) => ({ ...prev, deviceId: deviceIdInput }));
      setSaveStatus("Settings saved successfully!");
      fetchData();
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err: any) {
      setSaveStatus(`Error: ${err.message}`);
      setTimeout(() => setSaveStatus(""), 5000);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Simulate hardware action: Pill removal detection
  const simulatePillRemoval = async (slot: "morning" | "afternoon" | "night", remove: boolean) => {
    if (!user || !user.deviceId) return;
    
    // Update local switch state
    setPillsPresent((prev) => ({ ...prev, [slot]: !remove }));

    try {
      const now = new Date();
      const localDate = now.toISOString().split("T")[0];
      
      const payload = {
        deviceId: user.deviceId,
        slot,
        status: remove ? "taken" : "reset",
        date: localDate,
      };

      const res = await fetch("/api/device/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchData(true);
      }
    } catch (err) {
      console.error("Failed to send simulator status:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-4">
          <Pill className="h-10 w-10 animate-bounce text-emerald-400" />
          <p className="text-sm text-zinc-400 animate-pulse">Loading Medicare Dashboard...</p>
        </div>
      </div>
    );
  }

  // Determine if buzzer is currently sounding based on the todayStatus slots
  const isAlarmSounding = Object.values(todayStatus).some(
    (s) => s.status === "due"
  ) && !virtualMuted;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-12">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 -z-10 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl"></div>
      <div className="absolute top-1/3 left-1/4 -z-10 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl"></div>

      {/* Alarm Banner */}
      {isAlarmSounding && (
        <div className="bg-red-950/60 border-b border-red-500/30 px-4 py-3 text-red-200 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></div>
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
            <span className="text-sm font-semibold tracking-wide">
              PILL BOX WARNING: Alarm Triggered! Active medication compartment needs attention.
            </span>
          </div>
          <button 
            onClick={() => setVirtualMuted(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-900/50 hover:bg-red-900 border border-red-500/20 text-xs font-semibold text-white transition-all"
          >
            <VolumeX className="h-3.5 w-3.5" />
            Mute Alarm
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <Pill className="h-5 w-5 text-black" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Medicare</span>
              <span className="ml-2 text-xs font-semibold text-emerald-400 border border-emerald-500/20 bg-emerald-950/20 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-zinc-300">Welcome, {user.name}</div>
              <div className="text-xs text-zinc-500 font-mono">Device: {user.deviceId || "Not Linked"}</div>
            </div>
            
            <button 
              onClick={() => fetchData()}
              disabled={refreshing}
              className="p-2 rounded-lg border border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3.5 py-2 text-sm text-zinc-400 hover:text-red-400 hover:border-red-900/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Statistics Widgets Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Adherence Rate Card */}
          <div className="border border-zinc-900 bg-zinc-900/10 backdrop-blur p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block mb-1">Adherence Rate</span>
              <span className="text-2xl font-extrabold tracking-tight text-emerald-400 font-mono">{stats.adherenceRate}%</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-950/30 border border-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Percent className="h-5 w-5" />
            </div>
          </div>

          {/* Current Streak Card */}
          <div className="border border-zinc-900 bg-zinc-900/10 backdrop-blur p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block mb-1">Current Streak</span>
              <span className="text-2xl font-extrabold tracking-tight text-amber-500 font-mono">{stats.currentStreak} Days</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-950/30 border border-amber-500/10 flex items-center justify-center text-amber-500">
              <Flame className="h-5 w-5" />
            </div>
          </div>

          {/* Doses Taken Card */}
          <div className="border border-zinc-900 bg-zinc-900/10 backdrop-blur p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block mb-1">Doses Taken</span>
              <span className="text-2xl font-extrabold tracking-tight text-indigo-400 font-mono">{stats.totalTaken}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-950/30 border border-indigo-500/10 flex items-center justify-center text-indigo-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          {/* Doses Missed Card */}
          <div className="border border-zinc-900 bg-zinc-900/10 backdrop-blur p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block mb-1">Doses Missed</span>
              <span className="text-2xl font-extrabold tracking-tight text-rose-500 font-mono">{stats.totalMissed}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-950/30 border border-rose-500/10 flex items-center justify-center text-rose-500">
              <XCircle className="h-5 w-5" />
            </div>
          </div>

        </section>

        {/* Core Layout split: Dashboard on left, Settings/Hardware Simulation on right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Adherence Logs & Today's Schedule (8 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Today's Schedule Card */}
            <div className="border border-zinc-900 bg-zinc-950 p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-emerald-400" />
                Today's Medication Schedule
              </h2>

              <div className="space-y-4">
                {(["morning", "afternoon", "night"] as const).map((slot) => {
                  const data = todayStatus[slot] || { scheduled: "--:--", status: "pending", takenAt: null };
                  
                  // Label formatting
                  const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
                  
                  // Status layout parameters
                  let bgClass = "bg-zinc-900/20 border-zinc-900";
                  let glowClass = "";
                  let textCol = "text-zinc-400";
                  let icon = <Clock className="h-5 w-5 text-zinc-500" />;
                  let statusDesc = "Pending scheduled time";

                  if (data.status === "taken") {
                    bgClass = "bg-emerald-950/10 border-emerald-950/35";
                    textCol = "text-emerald-400";
                    icon = <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
                    statusDesc = `Taken at ${data.takenAt ? new Date(data.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "scheduled time"}`;
                  } else if (data.status === "due") {
                    bgClass = "bg-red-950/20 border-red-500/30 animate-pulse";
                    glowClass = "shadow-[0_0_15px_rgba(239,68,68,0.15)]";
                    textCol = "text-red-400 font-semibold";
                    icon = <AlertTriangle className="h-5 w-5 text-red-500 animate-bounce" />;
                    statusDesc = "🚨 Due: Buzzer active, remove pill from compartment!";
                  } else if (data.status === "missed") {
                    bgClass = "bg-rose-950/10 border-rose-950/35";
                    textCol = "text-rose-500";
                    icon = <XCircle className="h-5 w-5 text-rose-500" />;
                    statusDesc = "Missed: Scheduled window expired";
                  }

                  return (
                    <div 
                      key={slot}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4.5 rounded-xl border ${bgClass} ${glowClass} transition-all`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                          {icon}
                        </div>
                        <div>
                          <div className="text-base font-bold text-zinc-200">{slotLabel} Dose</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3 w-3" /> Scheduled for {data.scheduled}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 sm:mt-0 text-left sm:text-right shrink-0">
                        <span className={`text-sm ${textCol} tracking-wide block`}>
                          {data.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-zinc-500 block mt-0.5">
                          {statusDesc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historical Compliance logs */}
            <div className="border border-zinc-900 bg-zinc-950 p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
                <BarChart3 className="h-5 w-5 text-indigo-400" />
                Medication History Logs
              </h2>

              <div className="overflow-hidden border border-zinc-900 rounded-xl">
                <table className="min-w-full divide-y divide-zinc-900 text-left">
                  <thead className="bg-zinc-900/40 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5">Slot</th>
                      <th className="px-4 py-3.5">Scheduled</th>
                      <th className="px-4 py-3.5">Taken Time</th>
                      <th className="px-4 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 bg-zinc-950 text-sm">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-zinc-500">
                          No logging data recorded yet.
                        </td>
                      </tr>
                    ) : (
                      history.map((log) => (
                        <tr key={log.id} className="hover:bg-zinc-900/10">
                          <td className="px-4 py-3 font-medium text-zinc-300 font-mono">{log.date}</td>
                          <td className="px-4 py-3 text-zinc-400 capitalize">{log.slot}</td>
                          <td className="px-4 py-3 text-zinc-500 font-mono">{log.dueAt}</td>
                          <td className="px-4 py-3 text-zinc-500 font-mono">
                            {log.takenAt ? new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide
                              ${log.status === "taken" ? "bg-emerald-950/30 text-emerald-400 border border-emerald-500/10" : ""}
                              ${log.status === "missed" ? "bg-rose-950/30 text-rose-400 border border-rose-500/10" : ""}
                              ${log.status === "pending" ? "bg-zinc-900 text-zinc-400 border border-zinc-800" : ""}
                            `}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* RIGHT: Hardware Simulation & Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Visual ESP32 Pillbox Hardware Simulator */}
            {isSimulatorEnabled && (
              <div className="border border-indigo-900/40 bg-zinc-950 p-6 rounded-2xl shadow-xl shadow-indigo-950/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2.5">
                  <span className="flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                </div>

                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-1">
                  <Radio className="h-5 w-5 text-indigo-400" />
                  Virtual Pillbox Simulator
                </h2>
                <p className="text-xs text-zinc-500 mb-6">
                  Simulate ESP32 pill removals and triggers in the browser.
                </p>

                {/* Simulated Time Controller */}
                <div className="mb-6 p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Time Simulation
                    </label>
                    <input 
                      type="checkbox" 
                      id="useSimTime"
                      checked={useSimulatedTime}
                      onChange={(e) => {
                        setUseSimulatedTime(e.target.checked);
                        setTimeout(() => fetchData(), 50);
                      }}
                      className="rounded bg-zinc-900 border-zinc-800 text-indigo-500 focus:ring-indigo-500/20"
                    />
                  </div>
                  
                  {useSimulatedTime ? (
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-indigo-400" />
                      <input 
                        type="time" 
                        value={simulatedTime}
                        onChange={(e) => {
                          setSimulatedTime(e.target.value);
                        }}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-2.5 py-1 text-sm font-mono text-center flex-1 focus:outline-none focus:border-indigo-500"
                      />
                      <button 
                        onClick={() => fetchData()}
                        className="px-3 py-1 bg-indigo-900/50 hover:bg-indigo-900 border border-indigo-500/20 text-xs font-semibold rounded-lg transition-all"
                      >
                        Apply
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Currently using your real computer time. Toggle checkbox to override.
                    </p>
                  )}
                </div>

                {/* Compartment Box Layout */}
                <div className="bg-zinc-900/35 border border-zinc-900 rounded-xl p-4.5 space-y-4">
                  <div className="text-xs font-bold text-zinc-400 flex items-center justify-between border-b border-zinc-900 pb-2">
                    <span>COMPARTMENTS (3 slots)</span>
                    <span className="flex items-center gap-1">
                      {isAlarmSounding ? (
                        <>
                          <Volume2 className="h-3.5 w-3.5 text-red-500 animate-bounce" />
                          <span className="text-red-500 animate-pulse uppercase tracking-wider font-extrabold text-[9px]">
                            Buzzer Sounding
                          </span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="text-zinc-500 uppercase tracking-wider font-medium text-[9px]">Buzzer Silent</span>
                        </>
                      )}
                    </span>
                  </div>

                  {(["morning", "afternoon", "night"] as const).map((slot) => {
                    const data = todayStatus[slot] || { status: "pending" };
                    const isPillIn = pillsPresent[slot];

                    // LED Logic
                    let ledClass = "bg-zinc-800 border-zinc-700";
                    let isBlinking = false;
                    
                    if (data.status === "taken") {
                      ledClass = "bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
                    } else if (data.status === "due") {
                      ledClass = "bg-red-500 border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.6)]";
                      isBlinking = true;
                    } else if (data.status === "missed") {
                      ledClass = "bg-rose-900 border-rose-950";
                    }

                    return (
                      <div key={slot} className="border border-zinc-900/80 bg-zinc-950/40 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* LED Indicator */}
                          <div className={`h-3 w-3 rounded-full border ${ledClass} ${isBlinking ? "animate-pulse" : ""}`}></div>
                          <div>
                            <div className="text-sm font-semibold capitalize text-zinc-200">{slot} Slot</div>
                            <div className="text-[10px] text-zinc-500 font-medium">
                              {isPillIn ? "💊 Pill Present" : "📭 Empty"}
                            </div>
                          </div>
                        </div>

                        {/* Simulator Action Buttons */}
                        <div className="flex gap-2">
                          {isPillIn ? (
                            <button
                              onClick={() => simulatePillRemoval(slot, true)}
                              className="px-2.5 py-1.5 bg-emerald-950/20 border border-emerald-500/20 hover:bg-emerald-950/40 text-emerald-400 text-xs font-semibold rounded-lg transition-all"
                            >
                              Remove Pill
                            </button>
                          ) : (
                            <button
                              onClick={() => simulatePillRemoval(slot, false)}
                              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs font-semibold rounded-lg transition-all"
                            >
                              Place Pill
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Routine & Device Configuration */}
            <div className="border border-zinc-900 bg-zinc-950 p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
                <Settings className="h-5 w-5 text-zinc-400" />
                Routine Settings
              </h2>

              <form onSubmit={handleSaveRoutine} className="space-y-4">
                <div>
                  <label htmlFor="morning-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Morning Pill Time
                  </label>
                  <div className="relative">
                    <input
                      id="morning-input"
                      type="time"
                      value={morningTime}
                      onChange={(e) => setMorningTime(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="afternoon-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Afternoon Pill Time
                  </label>
                  <div className="relative">
                    <input
                      id="afternoon-input"
                      type="time"
                      value={afternoonTime}
                      onChange={(e) => setAfternoonTime(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="night-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Night Pill Time
                  </label>
                  <div className="relative">
                    <input
                      id="night-input"
                      type="time"
                      value={nightTime}
                      onChange={(e) => setNightTime(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="deviceId-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Linked ESP32 Device ID
                  </label>
                  <input
                    id="deviceId-input"
                    type="text"
                    required
                    placeholder="e.g. ESP32-MED-001"
                    value={deviceIdInput}
                    onChange={(e) => setDeviceIdInput(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-mono placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Enter the Device ID flashed onto your ESP32 board.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label htmlFor="active-toggle" className="text-sm font-semibold text-zinc-300">
                    System Enabled
                  </label>
                  <input 
                    id="active-toggle"
                    type="checkbox"
                    checked={routineActive}
                    onChange={(e) => setRoutineActive(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-800 text-emerald-500 focus:ring-emerald-500/20 h-5 w-5 cursor-pointer"
                  />
                </div>

                {saveStatus && (
                  <p className={`text-xs text-center font-medium mt-2
                    ${saveStatus.includes("success") ? "text-emerald-400" : ""}
                    ${saveStatus.includes("Error") ? "text-rose-400" : ""}
                    ${saveStatus.includes("Saving") ? "text-zinc-400 animate-pulse" : ""}
                  `}>
                    {saveStatus}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full mt-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 py-3 text-sm font-bold text-zinc-200 transition-all hover:text-white"
                >
                  Save Settings
                </button>
              </form>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
