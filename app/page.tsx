"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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

function ArrowCircleRight({ className }: { className?: string }) {
  return (
    <div className={className || "relative size-[32px]"}>
      <svg width="32" height="32" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="22" fill="#D9D9D9" />
        <path d="M22 13L31 22M31 22L22 31M31 22L13 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ArrowCircleRightBlue({ className, onClick }: { className?: string, onClick?: () => void }) {
  return (
    <div className={className || "relative size-[36px] cursor-pointer"} onClick={onClick}>
      <svg width="36" height="36" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="22" fill="#B0D5FF" />
        <path d="M22 13L31 22M31 22L22 31M31 22L13 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'settings'>('dashboard');
  const [todayStatus, setTodayStatus] = useState<Record<string, SlotStatus>>({});
  const [stats, setStats] = useState<AdherenceStats>({
    adherenceRate: 100,
    currentStreak: 0,
    totalTaken: 0,
    totalMissed: 0
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [slots, setSlots] = useState<{ id: string, name: string, time: string, medicines: { id: string, name: string }[], date?: string, daysOfWeek?: number[] }[]>([]);
  const [dateSpecificSlots, setDateSpecificSlots] = useState<Record<string, any[]>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tempDateSlots, setTempDateSlots] = useState<{ id: string, name: string, time: string, daysOfWeek?: number[] }[]>([]);

  const [deviceIdInput, setDeviceIdInput] = useState("");
  const [routineActive, setRoutineActive] = useState(true);

  const [useSimulatedTime, setUseSimulatedTime] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState("08:15");
  const [pillsPresent, setPillsPresent] = useState<Record<string, boolean>>({});
  const [virtualMuted, setVirtualMuted] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const localDate = `${year}-${month}-${day}`;

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

        const routineRes = await fetch("/api/routine");
        if (routineRes.ok) {
          const rData = await routineRes.json();
          if (rData.routine) {
            const fetchedSlots = rData.routine.slots || [];
            setSlots(fetchedSlots);
            setDateSpecificSlots(rData.routine.date_specific_slots || {});

            const initialPills = fetchedSlots.reduce((acc: any, s: any) => {
              acc[s.id] = true;
              return acc;
            }, {});
            setPillsPresent(initialPills);
            setRoutineActive(rData.routine.active);
            setLoading(false);
          } else {
            router.push("/onboarding");
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Authentication check failed:", err);
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(() => {
        fetchData(true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) { }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#d9d9d9] text-[#3c3c3c]">
        Loading MediCare...
      </div>
    );
  }

  const isAlarmSounding = Object.values(todayStatus).some(
    (s) => s.status === "due"
  ) && !virtualMuted;

  const simulatePillRemoval = async (slotId: string, isRemoval: boolean) => {
    try {
      const res = await fetch("/api/device/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceIdInput,
          slotId: slotId,
          status: isRemoval ? "taken" : "pending"
        })
      });
      if (res.ok) {
        setPillsPresent(prev => ({ ...prev, [slotId]: !isRemoval }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, active: routineActive, deviceId: deviceIdInput, dateSpecificSlots })
      });
      if (res.ok) {
        alert("Routine saved successfully!");
        fetchData();
      } else {
        alert("Failed to save routine");
      }
    } catch (err) {
      alert("Error saving routine");
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setTempDateSlots(dateSpecificSlots[dateStr] || []);
  };

  const handleSaveDateSlots = async () => {
    if (!selectedDate) return;
    const newDateSpecificSlots = { ...dateSpecificSlots };
    if (tempDateSlots.length === 0) {
      delete newDateSpecificSlots[selectedDate];
    } else {
      newDateSpecificSlots[selectedDate] = tempDateSlots;
    }
    setDateSpecificSlots(newDateSpecificSlots);
    setSelectedDate(null);

    // Automatically save to backend
    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, active: routineActive, deviceId: deviceIdInput, dateSpecificSlots: newDateSpecificSlots })
      });
      if (res.ok) {
        fetchData(); // refresh history to reflect new schedule
      } else {
        alert("Failed to save calendar event");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`blank-${i}`} className="aspect-square bg-transparent"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const customPills = [
        ...(dateSpecificSlots[dateStr] || []),
        ...slots.filter((s: any) => s.date === dateStr)
      ];
      const hasSpecificPills = customPills.length > 0;
      const now = new Date();
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const isToday = todayDateStr === dateStr;

      days.push(
        <div
          key={d}
          onClick={() => handleDateClick(dateStr)}
          className={`min-h-[80px] sm:min-h-[120px] rounded-[16px] sm:rounded-[20px] p-2 sm:p-4 flex flex-col justify-between cursor-pointer transition-all border group
            ${isToday ? 'bg-black text-white shadow-md' : 'bg-white text-black hover:bg-gray-50 border-transparent hover:border-black/10 shadow-sm'}
          `}
        >
          <div className="flex justify-end w-full">
            <span className={`text-[16px] sm:text-[20px] font-semibold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-white/20' : 'group-hover:bg-gray-200'}`}>
              {d}
            </span>
          </div>

          <div className="flex flex-col gap-1 w-full mt-2">
            {hasSpecificPills && (
              <div className="w-full bg-[#B0D5FF] text-[#003b80] text-[10px] sm:text-[12px] font-semibold px-2 py-1 rounded-md truncate text-center">
                {customPills.length} Custom {customPills.length === 1 ? 'Pill' : 'Pills'}
              </div>
            )}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="min-h-screen w-full bg-white font-sans tracking-[-0.06em] relative overflow-x-hidden flex flex-col">

      {/* Floating Top Tab Switcher - centered and floating with uniform radius */}
      <div className="absolute bg-[#d9d9d9] h-[55px] rounded-[30px] left-[50%] -translate-x-[50%] top-[20px] w-[90vw] max-w-[450px] flex items-center justify-around px-2 shadow-sm z-30">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`h-[40px] flex-1 rounded-[22px] flex items-center justify-center text-[14px] sm:text-[15px] tracking-tight font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white text-black shadow-xs' : 'text-black/70 hover:bg-white/40'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`h-[40px] flex-1 rounded-[22px] flex items-center justify-center text-[14px] sm:text-[15px] tracking-tight font-medium transition-all ${activeTab === 'calendar' ? 'bg-white text-black shadow-xs' : 'text-black/70 hover:bg-white/40'}`}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`h-[40px] flex-1 rounded-[22px] flex items-center justify-center text-[14px] sm:text-[15px] tracking-tight font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-black shadow-xs' : 'text-black/70 hover:bg-white/40'}`}
        >
          Edit Routne
        </button>
      </div>

      {/* Header Elements */}
      <div className="w-full px-4 sm:px-8 pt-6 flex items-center justify-between z-20 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="MediCare" width={32} height={32} className="object-contain" />
        </div>

        {/* Header Logout */}
        <div className="flex items-center gap-2 sm:gap-3 relative z-30">
          <p className="text-[#595959] text-[16px] sm:text-[18px] tracking-tight">Logout</p>
          <ArrowCircleRightBlue onClick={handleLogout} />
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="w-full px-4 sm:px-8 pt-6 pb-6 flex-1 flex flex-col">

        {/* ----------------- DASHBOARD VIEW ----------------- */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 flex-1">

            {/* LEFT COLUMN */}
            <div className="flex-[1.5] flex flex-col gap-4 xl:gap-6">
              <div className="mb-[10px] shrink-0">
                <p className="text-[#3c3c3c] text-[36px] sm:text-[48px] leading-[normal] tracking-tight sm:tracking-[-2px] m-0 p-0 font-medium">
                  Hi {user?.name || "Name"},
                </p>
                <p className="text-[#595959] text-[16px] sm:text-[18px] tracking-tight m-0 p-0">
                  Welcome to MediCare
                </p>
              </div>

              {/* Stats Cards Row */}
              <div className="flex flex-col sm:flex-row items-center sm:items-stretch justify-between gap-4 xl:gap-6 w-full">

                {/* Adherence Rate (Pink) */}
                <div
                  className="flex-1 aspect-square sm:aspect-[258/228] min-w-0 w-full overflow-hidden rounded-[24px] xl:rounded-[36px] relative p-5 flex flex-col mx-auto sm:mx-0"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 258 228' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.899e-16 11.4 -12.9 6.9805e-16 129 114)'><stop stop-color='rgba(255,59,129,1)' offset='0'/><stop stop-color='rgba(255,79,140,1)' offset='0.3'/><stop stop-color='rgba(251,111,157,1)' offset='0.45'/><stop stop-color='rgba(247,142,173,1)' offset='0.6'/><stop stop-color='rgba(248,187,206,1)' offset='0.8'/><stop stop-color='rgba(248,232,238,1)' offset='1'/></radialGradient></defs></svg>\")" }}
                >
                  <p className="text-[16px] xl:text-[20px] tracking-tight text-black leading-tight max-w-[145px]">Adherence Rate</p>
                  <div className="flex-1 flex items-center justify-center pt-1 min-w-0">
                    <p className="font-doto text-[50px] lg:text-[70px] xl:text-[80px] text-white tracking-[-2px] xl:tracking-[-4px] leading-none text-center">
                      {stats.adherenceRate.toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>

                {/* Doses Taken (Orange) */}
                <div
                  className="flex-1 aspect-square sm:aspect-[258/228] min-w-0 w-full overflow-hidden rounded-[24px] xl:rounded-[36px] relative p-5 flex flex-col mx-auto sm:mx-0"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 258 228' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.75'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.899e-16 11.4 -12.9 6.9805e-16 129 114)'><stop stop-color='rgba(255,178,28,1)' offset='0'/><stop stop-color='rgba(255,138,43,1)' offset='0.3'/><stop stop-color='rgba(250,131,73,1)' offset='0.45'/><stop stop-color='rgba(244,123,103,1)' offset='0.6'/><stop stop-color='rgba(245,150,131,1)' offset='0.7'/><stop stop-color='rgba(247,178,160,1)' offset='0.8'/><stop stop-color='rgba(249,232,216,1)' offset='1'/></radialGradient></defs></svg>\")" }}
                >
                  <p className="text-[16px] xl:text-[20px] tracking-tight text-black leading-tight max-w-[145px]">Doses Taken</p>
                  <div className="flex-1 flex items-center justify-center pt-1 min-w-0">
                    <p className="font-doto text-[50px] lg:text-[70px] xl:text-[80px] text-white tracking-[-2px] xl:tracking-[-4px] leading-none text-center">
                      {stats.totalTaken.toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>

                {/* Doses Missed (Blue) */}
                <div
                  className="flex-1 aspect-square sm:aspect-[258/228] min-w-0 w-full overflow-hidden rounded-[24px] xl:rounded-[36px] relative p-5 flex flex-col mx-auto sm:mx-0"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 258 228' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.899e-16 11.4 -12.9 6.9805e-16 129 114)'><stop stop-color='rgba(110,140,255,1)' offset='0'/><stop stop-color='rgba(141,165,255,1)' offset='0.3'/><stop stop-color='rgba(184,189,245,0.72157)' offset='0.6'/><stop stop-color='rgba(238,240,255,1)' offset='1'/></radialGradient></defs></svg>\")" }}
                >
                  <p className="text-[16px] xl:text-[20px] tracking-tight text-black leading-tight max-w-[164px]">Doses Missed</p>
                  <div className="flex-1 flex items-center justify-center pt-1 min-w-0">
                    <p className="font-doto text-[50px] lg:text-[70px] xl:text-[80px] text-white tracking-[-2px] xl:tracking-[-4px] leading-none text-center">
                      {stats.totalMissed.toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Today's Medication Schedule Container */}
              <div className="bg-[#e7e7e7] w-full flex-1 overflow-hidden rounded-[24px] xl:rounded-[31px] p-5 xl:p-6 relative mt-[20px] xl:mt-[30px] flex flex-col">
                <p className="text-[24px] sm:text-[32px] tracking-tight text-black leading-tight m-0 p-0 mb-4 xl:mb-6 shrink-0 font-medium">
                  Today's Medication Schedule
                </p>
                <div className="space-y-3 xl:space-y-4 flex-1">
                  {(() => {
                    const now = new Date();
                    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const todaysOneOffs = dateSpecificSlots[todayDateStr] || [];
                    const combinedSlots = [...slots.filter((s: any) => {
                      if (s.date && s.date !== todayDateStr) return false;
                      if (s.date === todayDateStr) return true;
                      if (s.daysOfWeek && s.daysOfWeek.length > 0) return s.daysOfWeek.includes(now.getDay());
                      if (s.date) return false;
                      return true; // daily
                    }), ...todaysOneOffs];

                    if (combinedSlots.length === 0) {
                      return <div className="text-lg text-black/50 p-4">No pill times configured.</div>;
                    }

                    return combinedSlots.map((slot) => {
                      const data = todayStatus[slot.id] || { scheduled: slot.time, status: "pending" };
                      return (
                        <div key={slot.id} className="bg-[#bdbaba] bg-opacity-60 h-[56px] xl:h-[60px] rounded-[16px] xl:rounded-[20px] w-full flex items-center justify-between px-4 relative">
                          <div className="flex items-center gap-[16px]">
                            <ArrowCircleRight />
                            <div className="flex items-center gap-[20px]">
                              <p className="text-[20px] sm:text-[24px] tracking-tight text-[#605757] m-0 leading-none font-medium">{slot.name}</p>
                              <p className="text-[14px] sm:text-[16px] tracking-tight text-black m-0 leading-none opacity-80 pt-1">At {data.scheduled}</p>
                            </div>
                          </div>
                          <div className="text-[18px] sm:text-[20px] tracking-tight text-black font-semibold pr-2 sm:pr-4">
                            {data.status.toUpperCase()}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Medication History Logs */}
            <div className="flex-[1] w-full max-w-none xl:max-w-[500px] bg-[#d2d2d2] rounded-[24px] xl:rounded-[31px] relative p-6 overflow-hidden flex flex-col">
              <p className="text-[24px] sm:text-[28px] tracking-tight text-black opacity-80 leading-none text-center mb-6 shrink-0 font-medium">
                Medication History Logs
              </p>

              <div className="flex justify-between w-[90%] mx-auto text-[14px] sm:text-[16px] tracking-tight text-black opacity-60 px-4 mb-3 shrink-0 font-medium">
                <div className="flex-1">Date</div>
                <div className="flex-[0.5] text-center">Slot</div>
                <div className="flex-1 text-center">Scheduled</div>
                <div className="flex-1 text-right">Status</div>
              </div>

              <div className="w-[90%] mx-auto mb-4 border-b border-dashed border-black/20 shrink-0"></div>

              <div className="w-[90%] mx-auto space-y-5 flex-1 pb-6 overflow-y-auto pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-base text-black/50 text-center pt-10">No history logs yet.</div>
                ) : history.map((item) => {
                  const allKnownSlots = [...slots, ...Object.values(dateSpecificSlots).flat()];
                  const slotObj = allKnownSlots.find(s => s.id === item.slot);
                  const slotName = slotObj ? slotObj.name : `Slot ${item.slot}`;
                  return (
                    <div key={item.id} className="flex justify-between w-full text-[14px] sm:text-[16px] tracking-tight text-black font-medium">
                      <div className="flex-1 opacity-70">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}</div>
                      <div className="flex-[0.5] text-center opacity-70 whitespace-nowrap overflow-hidden text-ellipsis">{slotName}</div>
                      <div className="flex-1 text-center opacity-70">{item.dueAt}</div>
                      <div className="flex-1 text-right opacity-70">
                        {item.status === 'taken' ? 'Taken' : item.status === 'missed' ? 'Not taken' : 'Pending'}
                      </div>
                    </div>
                  )
                })}
              </div>


            </div>
          </div>
        )}

        {/* ----------------- CALENDAR VIEW ----------------- */}
        {activeTab === 'calendar' && (
          <div className="w-full max-w-[1200px] mx-auto pt-[70px] px-4 pb-12 flex-1 flex flex-col h-full">
            <div className="bg-[#f4f4f4] p-6 sm:p-10 rounded-[31px] shadow-sm flex-1 flex flex-col border border-black/5 overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 shrink-0">
                <h2 className="text-[32px] sm:text-[43px] tracking-tight text-black m-0 leading-none">
                  Calendar
                </h2>
                <div className="flex items-center gap-2 sm:gap-4 bg-white p-2 rounded-2xl shadow-sm border border-black/5">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() - 7))} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#f4f4f4] text-black rounded-xl hover:bg-[#e0e0e0] transition-colors text-[14px] sm:text-[15px] shadow-sm">Prev Week</button>
                  <span className="text-[15px] sm:text-[18px] min-w-[140px] text-center text-[#3c3c3c]">
                    {(() => {
                        const start = new Date(currentMonth);
                        start.setDate(start.getDate() - start.getDay());
                        const end = new Date(start);
                        end.setDate(start.getDate() + 6);
                        return `${start.toLocaleDateString('default', {month:'short', day:'numeric'})} - ${end.toLocaleDateString('default', {month:'short', day:'numeric'})}`;
                    })()}
                  </span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 7))} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#f4f4f4] text-black rounded-xl hover:bg-[#e0e0e0] transition-colors text-[14px] sm:text-[15px] shadow-sm">Next Week</button>
                </div>
              </div>

              {/* Grid Header (Days) */}
              <div className="flex border-b border-black/10 pb-4 shrink-0">
                 <div className="w-[50px] sm:w-[80px] shrink-0"></div> {/* Empty corner */}
                 <div className="flex-1 grid grid-cols-7 gap-2">
                   {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => {
                      const dayDate = new Date(currentMonth);
                      dayDate.setDate(dayDate.getDate() - dayDate.getDay() + i);
                      const isToday = new Date().toDateString() === dayDate.toDateString();
                      return (
                        <div key={d} className="flex flex-col items-center">
                          <span className="text-[#595959] text-[11px] sm:text-[13px] font-bold tracking-wider">{d}</span>
                          <span className={`text-[16px] sm:text-[20px] font-bold mt-1 w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-black text-white' : 'text-black'}`}>
                            {dayDate.getDate()}
                          </span>
                        </div>
                      );
                   })}
                 </div>
              </div>

              {/* Scrollable Time Grid */}
              <div className="flex-1 overflow-y-auto relative mt-4 custom-scrollbar pr-2 min-h-[400px]">
                 <div className="flex relative h-[1440px]">
                   {/* Hours Sidebar */}
                   <div className="w-[50px] sm:w-[80px] shrink-0 flex flex-col relative h-full">
                     {Array.from({length: 24}).map((_, i) => (
                       <div key={i} className="absolute w-full text-right pr-2 sm:pr-4 text-[#595959] text-[11px] sm:text-[12px] font-semibold" style={{ top: `${i * 60 - 8}px` }}>
                         {String(i).padStart(2, '0')}:00
                       </div>
                     ))}
                   </div>
                   
                   {/* Main Grid Lines */}
                   <div className="flex-1 relative h-full">
                     {Array.from({length: 24}).map((_, i) => (
                        <div key={i} className="absolute w-full border-t border-dashed border-black/10" style={{ top: `${i * 60}px` }}></div>
                     ))}
                     
                     {/* Column dividers */}
                     <div className="absolute inset-0 grid grid-cols-7 h-full">
                       {Array.from({length: 7}).map((_, i) => {
                           const dayDate = new Date(currentMonth);
                           dayDate.setDate(dayDate.getDate() - dayDate.getDay() + i);
                           const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                           return (
                             <div key={i} className="border-l border-dashed border-black/5 h-full relative cursor-pointer hover:bg-black/5 transition-colors" 
                                  onClick={(e) => {
                                     const rect = e.currentTarget.getBoundingClientRect();
                                     const y = e.clientY - rect.top;
                                     const hours = Math.floor(y / 60);
                                     const timeStr = `${String(hours).padStart(2, '0')}:00`;
                                     setSelectedDate(dateStr);
                                     setTempDateSlots([{ id: Date.now().toString(), name: `One-off Pill`, time: timeStr }]);
                                  }}
                             >
                                {/* Render pills for this day */}
                                {(() => {
                                   const daySlots = slots.filter((s: any) => {
                                      if (s.date && s.date !== dateStr) return false;
                                      if (s.date === dateStr) return true;
                                      if (s.daysOfWeek && s.daysOfWeek.length > 0) return s.daysOfWeek.includes(i);
                                      if (s.date) return false; // has date but didn't match
                                      return true; // daily
                                   });
                                   
                                   const customPills = [...(dateSpecificSlots[dateStr] || []), ...daySlots];
                                   
                                   return customPills.map((slot: any, idx) => {
                                      const [hours, minutes] = slot.time.split(':').map(Number);
                                      const topPx = (hours + minutes / 60) * 60;
                                      const colors = ['bg-[#B0D5FF] text-[#003b80]', 'bg-[#ffb21c] text-white', 'bg-[#ff3b81] text-white'];
                                      const colorClass = colors[idx % colors.length];
                                      return (
                                        <div key={slot.id || idx} 
                                          className={`absolute left-1 right-1 rounded-xl p-1.5 sm:p-2 shadow-sm ${colorClass} cursor-pointer hover:opacity-90 transform hover:scale-[1.02] transition-all z-10 overflow-hidden flex flex-col`}
                                          style={{ top: `${topPx}px`, minHeight: '44px' }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDate(dateStr);
                                            setTempDateSlots(dateSpecificSlots[dateStr] || []);
                                          }}
                                        >
                                          <p className="text-[10px] sm:text-[13px] font-bold leading-tight truncate">{slot.name}</p>
                                          <p className="text-[9px] sm:text-[10px] font-medium opacity-90 mt-0.5">{slot.time}</p>
                                        </div>
                                      );
                                   });
                                })()}
                             </div>
                           );
                       })}
                     </div>
                   </div>
                 </div>
              </div>
            </div>

            {/* Calendar Popup Modal */}
            {selectedDate && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedDate(null)}>
                <div className="bg-white rounded-[24px] p-6 sm:p-8 w-full max-w-sm shadow-xl border border-white" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[22px] font-bold text-black">
                      {new Date(selectedDate).toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </h3>
                    <button onClick={() => setSelectedDate(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-black transition-colors">✕</button>
                  </div>
                  
                  <div className="space-y-4 mb-8">
                    {tempDateSlots.length === 0 ? (
                      <div className="bg-[#f4f4f4] rounded-[16px] p-6 text-center border border-black/5">
                        <p className="text-[#595959] text-sm">No custom pills scheduled for this day.</p>
                      </div>
                    ) : (
                      tempDateSlots.map((slot, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-[#f2f2f2] rounded-[16px] gap-3 shadow-sm hover:border-black/10 transition-colors border border-transparent">
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                             <div className="w-3 h-3 bg-[#B0D5FF] rounded-full shrink-0 shadow-sm"></div>
                             <input 
                               type="text" 
                               value={slot.name}
                               onChange={(e) => {
                                 const newSlots = [...tempDateSlots];
                                 newSlots[idx].name = e.target.value;
                                 setTempDateSlots(newSlots);
                               }}
                               className="bg-transparent border-none focus:outline-none text-[16px] w-full text-[#3c3c3c]"
                             />
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            <input 
                              type="time"
                              value={slot.time}
                              onChange={(e) => {
                                 const newSlots = [...tempDateSlots];
                                 newSlots[idx].time = e.target.value;
                                 setTempDateSlots(newSlots);
                              }}
                              className="bg-white px-2 py-1.5 rounded-lg border-none focus:outline-none text-[#595959] text-sm"
                            />
                            <button onClick={() => setTempDateSlots(tempDateSlots.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors">✕</button>
                          </div>
                        </div>
                      ))
                    )}
                    
                    <button 
                      onClick={() => setTempDateSlots([...tempDateSlots, { id: Date.now().toString(), name: `One-off Pill`, time: "12:00" }])}
                      className="w-full py-3.5 border border-dashed border-[#bdbaba] rounded-[16px] text-[#595959] hover:bg-[#f4f4f4] transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <span>+</span> Add Custom Pill
                    </button>
                  </div>
                  
                  <button 
                    onClick={handleSaveDateSlots}
                    className="w-full bg-black text-white py-4 rounded-[16px] hover:shadow-lg hover:bg-gray-800 transition-all shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------- SETTINGS VIEW ----------------- */}
        {activeTab === 'settings' && (
          <div className="w-full max-w-2xl mx-auto pt-6 pb-12 flex-1">
            <div className="bg-[#f4f4f4] p-6 sm:p-10 rounded-[31px] shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[32px] sm:text-[40px] tracking-tight text-black m-0 leading-none font-semibold">
                  Reminders
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-[#595959]">{routineActive ? "Active" : "Paused"}</span>
                  <button
                    type="button"
                    onClick={() => setRoutineActive(!routineActive)}
                    className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${routineActive ? 'bg-green-500' : 'bg-gray-400'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform shadow-sm ${routineActive ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveRoutine} className="space-y-6">
                {/* Reminders List */}
                <div className="space-y-4">
                  {slots.map((slot, index) => (
                    <div key={slot.id} className="bg-white p-4 rounded-[20px] shadow-sm flex flex-col gap-4 border border-black/5 hover:border-black/10 transition-colors">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={slot.name}
                            onChange={(e) => {
                              const newSlots = [...slots];
                              newSlots[index].name = e.target.value;
                              setSlots(newSlots);
                            }}
                            className="text-[18px] font-semibold text-black bg-transparent border-none focus:outline-none w-full"
                            placeholder="e.g. Morning Pill"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f9f9f9] p-3 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-10">Date</span>
                          <input
                            type="date"
                            value={slot.date || ""}
                            onChange={(e) => {
                              const newSlots = [...slots];
                              newSlots[index].date = e.target.value;
                              setSlots(newSlots);
                            }}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[15px] font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/5 cursor-pointer"
                          />
                          {slot.date && (
                            <button type="button" onClick={() => { const ns = [...slots]; delete ns[index].date; setSlots(ns); }} className="text-xs text-red-400 hover:text-red-600">Clear Date</button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Time</span>
                          <input
                            type="time"
                            value={slot.time}
                            onChange={(e) => {
                              const newSlots = [...slots];
                              newSlots[index].time = e.target.value;
                              setSlots(newSlots);
                            }}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[15px] font-medium text-black focus:outline-none focus:ring-2 focus:ring-black/5 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setSlots(slots.filter(s => s.id !== slot.id))}
                            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors ml-2"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Repeat On</p>
                          <div className="flex gap-2">
                             {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, dayIdx) => {
                                const isSelected = slot.daysOfWeek ? slot.daysOfWeek.includes(dayIdx) : true; // Default to all if missing
                                return (
                                  <button 
                                    key={dayIdx} 
                                    type="button"
                                    onClick={() => {
                                       const newSlots = [...slots];
                                       let days = newSlots[index].daysOfWeek || [0,1,2,3,4,5,6];
                                       if (days.includes(dayIdx)) {
                                          days = days.filter(d => d !== dayIdx);
                                       } else {
                                          days = [...days, dayIdx].sort();
                                       }
                                       newSlots[index].daysOfWeek = days;
                                       setSlots(newSlots);
                                    }}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${isSelected ? 'bg-black text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                  >
                                    {dayChar}
                                  </button>
                                );
                             })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setSlots([...slots, { id: Date.now().toString(), name: `Dose ${slots.length + 1}`, time: "12:00", medicines: [] }])}
                    className="w-full h-[60px] rounded-[20px] border-2 border-dashed border-gray-300 text-gray-500 font-semibold flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 hover:text-gray-700 transition-all"
                  >
                    + Add New Reminder
                  </button>
                </div>

                {/* Advanced / Hardware Settings */}
                <div className="pt-6 border-t border-gray-200 mt-8">
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-800 list-none flex items-center gap-2 select-none">
                      <span className="transition group-open:rotate-90">▶</span> Advanced Device Settings
                    </summary>
                    <div className="pt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Hardware Link ID</label>
                        <input
                          type="text"
                          value={deviceIdInput}
                          onChange={(e) => setDeviceIdInput(e.target.value)}
                          placeholder="Enter ESP32 device serial number..."
                          className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-black"
                        />
                      </div>

                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-orange-800 mb-2">Hardware Simulation Tools</h4>
                        <p className="text-xs text-orange-600 mb-3">Manually trigger device sensors for testing adherence logs without physical hardware.</p>
                        <div className="flex flex-wrap gap-2">
                          {slots.map(slot => {
                            const isPillIn = pillsPresent[slot.id];
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => simulatePillRemoval(slot.id, isPillIn)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${isPillIn ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                              >
                                {slot.name}: {isPillIn ? 'Take Pill' : 'Refill'}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>

                {/* Submit */}
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-black text-white py-4 rounded-[20px] text-[18px] font-semibold hover:bg-gray-800 transition shadow-md hover:shadow-lg transform active:scale-[0.99]"
                  >
                    Save Reminders
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
