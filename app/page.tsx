"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
    <div className={className || "relative size-[44px]"}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="22" fill="#D9D9D9"/>
        <path d="M22 13L31 22M31 22L22 31M31 22L13 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function ArrowCircleRightBlue({ className, onClick }: { className?: string, onClick?: () => void }) {
  return (
    <div className={className || "relative size-[44px] cursor-pointer"} onClick={onClick}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="22" fill="#B0D5FF"/>
        <path d="M22 13L31 22M31 22L22 31M31 22L13 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

  const [slots, setSlots] = useState<{ id: string, name: string, time: string, medicines: { id: string, name: string }[], date?: string }[]>([]);
  const [dateSpecificSlots, setDateSpecificSlots] = useState<Record<string, any[]>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tempDateSlots, setTempDateSlots] = useState<{ id: string, name: string, time: string }[]>([]);

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
    } catch (err) {}
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
    <div className="min-h-screen w-full bg-white font-sans relative overflow-x-hidden flex flex-col">
      
      {/* Floating Top Tab Switcher - centered and floating with uniform radius */}
      <div className="absolute bg-[#d9d9d9] h-[65px] rounded-[30px] left-[50%] -translate-x-[50%] top-[24px] w-[90vw] max-w-[500px] flex items-center justify-around px-2 shadow-sm z-30">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`h-[45px] flex-1 rounded-[22px] flex items-center justify-center text-[16px] sm:text-[18px] tracking-[-1px] font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white text-black shadow-xs' : 'text-black/70 hover:bg-white/40'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`h-[45px] flex-1 rounded-[22px] flex items-center justify-center text-[16px] sm:text-[18px] tracking-[-1px] font-medium transition-all ${activeTab === 'calendar' ? 'bg-white text-black shadow-xs' : 'text-black/70 hover:bg-white/40'}`}
          >
            Calendar
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`h-[45px] flex-1 rounded-[22px] flex items-center justify-center text-[16px] sm:text-[18px] tracking-[-1px] font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-black shadow-xs' : 'text-black/70 hover:bg-white/40'}`}
          >
            Edit Routne
          </button>
        </div>

        {/* Header Elements */}
        <div className="w-full px-4 sm:px-12 pt-6 flex items-center justify-between z-20 shrink-0">
          {/* Fake Cross/Pill Icon (Figma top left) */}
          <div className="flex items-center gap-2">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>

          {/* Header Logout */}
          <div className="flex items-center gap-2 sm:gap-3 relative z-30">
            <p className="text-[#595959] text-[18px] sm:text-[20px] tracking-[-1px]">Logout</p>
            <ArrowCircleRightBlue onClick={handleLogout} />
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="w-full px-4 sm:px-12 pt-10 pb-8 sm:pb-12 flex-1 flex flex-col">
        
        {/* ----------------- DASHBOARD VIEW ----------------- */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col xl:flex-row gap-8 xl:gap-12 flex-1">
            
            {/* LEFT COLUMN */}
            <div className="flex-[1.5] flex flex-col gap-6">
              <div className="mb-[20px] shrink-0">
                <p className="text-[#3c3c3c] text-[48px] sm:text-[68px] leading-[normal] tracking-[-2.5px] sm:tracking-[-3.4px] m-0 p-0 font-medium">
                  Hi {user?.name || "Name"},
                </p>
                <p className="text-[#595959] text-[18px] sm:text-[20px] tracking-[-0.95px] m-0 p-0">
                  Welcome to MediCare
                </p>
              </div>

              {/* Stats Cards Row */}
              <div className="flex flex-col sm:flex-row items-center sm:items-stretch justify-between gap-4 xl:gap-8 w-full">
                
                {/* Adherence Rate (Pink) */}
                <div 
                  className="flex-1 aspect-square sm:aspect-[258/228] min-w-0 w-full overflow-hidden rounded-[30px] xl:rounded-[45px] relative p-6 flex flex-col mx-auto sm:mx-0"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 258 228' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.899e-16 11.4 -12.9 6.9805e-16 129 114)'><stop stop-color='rgba(255,59,129,1)' offset='0'/><stop stop-color='rgba(255,79,140,1)' offset='0.3'/><stop stop-color='rgba(251,111,157,1)' offset='0.45'/><stop stop-color='rgba(247,142,173,1)' offset='0.6'/><stop stop-color='rgba(248,187,206,1)' offset='0.8'/><stop stop-color='rgba(248,232,238,1)' offset='1'/></radialGradient></defs></svg>\")" }}
                >
                  <p className="text-[20px] xl:text-[26px] tracking-[-1px] xl:tracking-[-1.3px] text-black leading-tight max-w-[145px]">Adherence Rate</p>
                  <div className="flex-1 flex items-center justify-center pt-2 min-w-0">
                    <p className="font-doto text-[70px] lg:text-[90px] xl:text-[100px] text-white tracking-[-3px] xl:tracking-[-5px] leading-none text-center">
                      {stats.adherenceRate.toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>

                {/* Doses Taken (Orange) */}
                <div 
                  className="flex-1 aspect-square sm:aspect-[258/228] min-w-0 w-full overflow-hidden rounded-[30px] xl:rounded-[45px] relative p-6 flex flex-col mx-auto sm:mx-0"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 258 228' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.75'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.899e-16 11.4 -12.9 6.9805e-16 129 114)'><stop stop-color='rgba(255,178,28,1)' offset='0'/><stop stop-color='rgba(255,138,43,1)' offset='0.3'/><stop stop-color='rgba(250,131,73,1)' offset='0.45'/><stop stop-color='rgba(244,123,103,1)' offset='0.6'/><stop stop-color='rgba(245,150,131,1)' offset='0.7'/><stop stop-color='rgba(247,178,160,1)' offset='0.8'/><stop stop-color='rgba(249,232,216,1)' offset='1'/></radialGradient></defs></svg>\")" }}
                >
                  <p className="text-[20px] xl:text-[26px] tracking-[-1px] xl:tracking-[-1.3px] text-black leading-tight max-w-[145px]">Doses Taken</p>
                  <div className="flex-1 flex items-center justify-center pt-2 min-w-0">
                    <p className="font-doto text-[70px] lg:text-[90px] xl:text-[100px] text-white tracking-[-3px] xl:tracking-[-5px] leading-none text-center">
                      {stats.totalTaken.toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>

                {/* Doses Missed (Blue) */}
                <div 
                  className="flex-1 aspect-square sm:aspect-[258/228] min-w-0 w-full overflow-hidden rounded-[30px] xl:rounded-[45px] relative p-6 flex flex-col mx-auto sm:mx-0"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 258 228' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(7.899e-16 11.4 -12.9 6.9805e-16 129 114)'><stop stop-color='rgba(110,140,255,1)' offset='0'/><stop stop-color='rgba(141,165,255,1)' offset='0.3'/><stop stop-color='rgba(184,189,245,0.72157)' offset='0.6'/><stop stop-color='rgba(238,240,255,1)' offset='1'/></radialGradient></defs></svg>\")" }}
                >
                  <p className="text-[20px] xl:text-[26px] tracking-[-1px] xl:tracking-[-1.3px] text-black leading-tight max-w-[164px]">Doses Missed</p>
                  <div className="flex-1 flex items-center justify-center pt-2 min-w-0">
                    <p className="font-doto text-[70px] lg:text-[90px] xl:text-[100px] text-white tracking-[-3px] xl:tracking-[-5px] leading-none text-center">
                      {stats.totalMissed.toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Today's Medication Schedule Container */}
              <div className="bg-[#e7e7e7] w-full flex-1 overflow-hidden rounded-[31px] p-[24px] relative mt-[30px] flex flex-col">
                <p className="text-[43px] tracking-[-2.15px] text-black leading-[33px] m-0 p-0 mb-[30px] pt-2 shrink-0">
                  Today's Medication Schedule
                </p>
                <div className="space-y-4 flex-1">
                  {(() => {
                    const now = new Date();
                    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const todaysOneOffs = dateSpecificSlots[todayDateStr] || [];
                    const dailySlots = slots.filter((s: any) => !s.date);
                    const specificSlotsForToday = slots.filter((s: any) => s.date === todayDateStr);
                    const combinedSlots = [...dailySlots, ...specificSlotsForToday, ...todaysOneOffs];
                    
                    if (combinedSlots.length === 0) {
                      return <div className="text-xl text-black/50 p-4">No pill times configured.</div>;
                    }
                    
                    return combinedSlots.map((slot) => {
                      const data = todayStatus[slot.id] || { scheduled: slot.time, status: "pending" };
                    return (
                      <div key={slot.id} className="bg-[#bdbaba] bg-opacity-60 h-[78px] rounded-[22px] w-full flex items-center justify-between px-[15px] relative">
                         <div className="flex items-center gap-[20px]">
                           <ArrowCircleRight />
                           <div className="flex items-center gap-[30px]">
                             <p className="text-[35px] tracking-[-1.75px] text-[#605757] m-0 leading-none">{slot.name}</p>
                             <p className="text-[23px] tracking-[-1.15px] text-black m-0 leading-none opacity-80 pt-2">At {data.scheduled}</p>
                           </div>
                         </div>
                         <div className="text-[31px] tracking-[-1.55px] text-black pr-[30px]">
                           {data.status.toUpperCase()}
                         </div>
                      </div>
                    )
                  })})()}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Medication History Logs */}
            <div className="flex-[1] w-full max-w-none xl:max-w-[594px] bg-[#d2d2d2] rounded-[31px] relative p-[30px] overflow-hidden flex flex-col">
              <p className="text-[34px] tracking-[-1.7px] text-black opacity-71 leading-none text-center mb-[30px] shrink-0">
                Medication History Logs
              </p>
              
              <div className="flex justify-between w-[80%] mx-auto text-[24px] tracking-[-1.2px] text-black opacity-50 px-[20px] mb-[20px] shrink-0">
                <div className="flex-1">Date</div>
                <div className="flex-[0.5] text-center">Slot</div>
                <div className="flex-1 text-center">Scheduled</div>
                <div className="flex-1 text-right">Status</div>
              </div>
              
              <div className="w-[80%] mx-auto h-[1px] bg-black/10 border-b border-dashed border-black/20 absolute left-[10%] top-[140px]"></div>

              <div className="w-[80%] mx-auto mt-[20px] space-y-[40px] flex-1 pb-10 overflow-y-auto pr-2 custom-scrollbar">
                 {history.length === 0 ? (
                   <div className="text-xl text-black/50 text-center pt-10">No history logs yet.</div>
                 ) : history.map((item) => {
                   const allKnownSlots = [...slots, ...Object.values(dateSpecificSlots).flat()];
                   const slotObj = allKnownSlots.find(s => s.id === item.slot);
                   const slotName = slotObj ? slotObj.name : `Slot ${item.slot}`;
                   return (
                   <div key={item.id} className="flex justify-between w-full text-[24px] tracking-[-1.2px] text-black">
                     <div className="flex-1 opacity-50">{new Date(item.date).toLocaleDateString('en-GB', {day:'2-digit', month:'2-digit', year:'2-digit'}).replace(/\//g, '-')}</div>
                     <div className="flex-[0.5] text-center opacity-50 whitespace-nowrap overflow-hidden text-ellipsis">{slotName}</div>
                     <div className="flex-1 text-center opacity-50">{item.dueAt}</div>
                     <div className="flex-1 text-right opacity-50">
                       {item.status === 'taken' ? 'Taken' : item.status === 'missed' ? 'Not taken' : 'Pending'}
                     </div>
                   </div>
                 )})}
              </div>


            </div>
          </div>
        )}

        {/* ----------------- CALENDAR VIEW ----------------- */}
        {activeTab === 'calendar' && (
          <div className="w-full max-w-[1200px] mx-auto pt-[90px] px-4 pb-12 flex-1 flex flex-col">
            <div className="bg-[#f4f4f4] p-6 sm:p-10 rounded-[31px] shadow-sm flex-1 flex flex-col border border-black/5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-[32px] sm:text-[43px] tracking-[-1.5px] sm:tracking-[-2.15px] text-black m-0 leading-none">
                  Calendar
                </h2>
                <div className="flex items-center gap-2 sm:gap-4 bg-white p-2 rounded-2xl shadow-sm border border-black/5">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#f4f4f4] rounded-xl hover:bg-[#e0e0e0] transition text-[14px] sm:text-[15px] font-medium">Prev</button>
                  <span className="text-[15px] sm:text-[18px] font-semibold min-w-[140px] text-center">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#f4f4f4] rounded-xl hover:bg-[#e0e0e0] transition text-[14px] sm:text-[15px] font-medium">Next</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-4">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                  <div key={d} className="text-center font-medium text-[#595959] text-[12px] sm:text-[14px]">{d}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2 sm:gap-4">
                {renderCalendarDays()}
              </div>
            </div>
            
            {/* Calendar Popup Modal */}
            {selectedDate && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedDate(null)}>
                <div className="bg-white rounded-[24px] p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[20px] font-semibold">
                      {new Date(selectedDate).toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </h3>
                    <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-black">✕</button>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    {tempDateSlots.length === 0 ? (
                      <p className="text-gray-500 text-center py-4 text-sm">No custom pills scheduled for this day.</p>
                    ) : (
                      tempDateSlots.map((slot, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-[#f2f2f2] rounded-[16px] gap-3">
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                             <div className="w-[10px] h-[10px] bg-[#B0D5FF] rounded-full shrink-0"></div>
                             <input 
                               type="text" 
                               value={slot.name}
                               onChange={(e) => {
                                 const newSlots = [...tempDateSlots];
                                 newSlots[idx].name = e.target.value;
                                 setTempDateSlots(newSlots);
                               }}
                               className="bg-transparent border-none focus:outline-none font-medium text-[16px] w-full"
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
                              className="bg-white px-2 py-1 rounded-md border-none focus:outline-none text-[#595959] font-medium"
                            />
                            <button onClick={() => setTempDateSlots(tempDateSlots.filter((_, i) => i !== idx))} className="text-red-500 text-xs font-semibold shrink-0">DEL</button>
                          </div>
                        </div>
                      ))
                    )}
                    
                    <button 
                      onClick={() => setTempDateSlots([...tempDateSlots, { id: Date.now().toString(), name: `One-off Pill`, time: "12:00" }])}
                      className="w-full py-3 border border-dashed border-[#bdbaba] rounded-[16px] text-gray-500 hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      + Add Pill
                    </button>
                  </div>
                  
                  <button 
                    onClick={handleSaveDateSlots}
                    className="w-full bg-black text-white py-3 rounded-[16px] font-semibold hover:bg-gray-800 transition"
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
                                <button type="button" onClick={() => { const ns=[...slots]; delete ns[index].date; setSlots(ns); }} className="text-xs text-red-400 hover:text-red-600">Clear Date</button>
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
