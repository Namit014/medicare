"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pill, Activity, ShieldAlert, Clock, Smartphone } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [slots, setSlots] = useState([{ 
    id: Date.now().toString(), 
    name: "Dose 1", 
    time: "08:00",
    medicines: [{ id: Date.now().toString() + "-m", name: "" }]
  }]);
  const [deviceIdInput, setDeviceIdInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if they already have a routine
  useEffect(() => {
    async function checkRoutine() {
      try {
        const res = await fetch("/api/routine");
        const data = await res.json();
        if (data.routine) {
          // If they already have a routine, they shouldn't be here
          router.push("/");
        }
      } catch (err) {
        console.error("Failed to check routine", err);
      }
    }
    checkRoutine();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          slots: slots,
          deviceId: deviceIdInput,
          active: true
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save routine");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden">
      
      {/* Left Column - Onboarding Form */}
      <div className="relative w-full lg:w-[480px] xl:w-[550px] shrink-0 min-h-screen flex flex-col z-20 bg-white shadow-[20px_0_40px_-20px_rgba(0,0,0,0.05)] pt-12 px-8 lg:px-[80px] xl:px-[109px]">
        
        {/* Logo */}
        <div className="flex items-center gap-[12px] mb-12">
          <div className="w-[32px] h-[36px] flex items-center justify-center relative">
             <Pill className="h-8 w-8 text-black" />
          </div>
          <span className="text-[20px] tracking-[-1px] text-black font-medium">MediCare</span>
        </div>

        {/* Header */}
        <div className="mb-2">
          <h1 className="text-4xl lg:text-4xl xl:text-[44px] text-black tracking-tight lg:tracking-[-2px] leading-tight">
            Set your routine
          </h1>
        </div>

        {/* Subtitle */}
        <div className="mb-10">
          <p className="text-sm lg:text-[13px] text-[#595959] tracking-normal lg:tracking-[-0.65px]">
            Let's get you set up. When do you take your medication?
          </p>
        </div>

        {/* Form */}
        <div className="w-full max-w-[340px]">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col relative w-full">
            <div className="space-y-[20px] w-full">
              
              {slots.map((slot, index) => (
                <div key={slot.id} className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#595959]">
                      Dose {index + 1}
                    </label>
                    {slots.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => setSlots(slots.filter(s => s.id !== slot.id))}
                        className="text-[10px] text-red-500 font-medium hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center mb-4">
                    <Clock className="absolute left-4 h-4 w-4 text-[#595959]" />
                    <input
                      type="time"
                      required
                      value={slot.time}
                      onChange={(e) => {
                        const newSlots = [...slots];
                        newSlots[index].time = e.target.value;
                        setSlots(newSlots);
                      }}
                      className="w-full h-14 rounded-xl bg-[#d9d9d9] pl-[40px] pr-[16px] text-sm text-black placeholder:text-[#595959] placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] transition-all"
                    />
                  </div>

                  <div className="bg-[#f2f2f2] rounded-xl p-3 mb-6 space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#595959]">Medicines</label>
                    {slot.medicines.map((med, medIndex) => (
                      <div key={med.id} className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Pill className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#595959]" />
                          <input
                            type="text"
                            required
                            placeholder="e.g. Aspirin 500mg"
                            value={med.name}
                            onChange={(e) => {
                              const newSlots = [...slots];
                              newSlots[index].medicines[medIndex].name = e.target.value;
                              setSlots(newSlots);
                            }}
                            className="w-full h-10 rounded-lg bg-white border border-[#d9d9d9] pl-[34px] pr-[12px] text-xs text-black placeholder:text-[#595959] focus:outline-none focus:border-[#a3a3a3] transition-all"
                          />
                        </div>
                        {slot.medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newSlots = [...slots];
                              newSlots[index].medicines = newSlots[index].medicines.filter(m => m.id !== med.id);
                              setSlots(newSlots);
                            }}
                            className="h-10 px-3 bg-red-100 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
                          >
                            X
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newSlots = [...slots];
                        newSlots[index].medicines.push({ id: Date.now().toString() + "-m", name: "" });
                        setSlots(newSlots);
                      }}
                      className="w-full py-2 text-xs font-semibold text-[#595959] border border-dashed border-[#d9d9d9] rounded-lg hover:bg-white transition-colors"
                    >
                      + Add Medicine
                    </button>
                  </div>
                </div>
              ))}

              <button 
                type="button"
                onClick={() => setSlots([...slots, { 
                  id: Date.now().toString(), 
                  name: `Dose ${slots.length + 1}`, 
                  time: "12:00",
                  medicines: [{ id: Date.now().toString() + "-m", name: "" }]
                }])}
                className="w-full h-12 rounded-xl border border-dashed border-[#a3a3a3] text-sm text-[#595959] font-medium flex items-center justify-center hover:bg-[#f5f5f5] transition-all"
              >
                + Add another pill time
              </button>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#595959] mb-1.5 block">Smart Box Device ID</label>
                <div className="relative flex items-center">
                  <Smartphone className="absolute left-4 h-4 w-4 text-[#595959]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. MED-1A2B3C"
                    value={deviceIdInput}
                    onChange={(e) => setDeviceIdInput(e.target.value)}
                    className="w-full h-14 rounded-xl bg-[#d9d9d9] pl-[40px] pr-[16px] text-sm text-black placeholder:text-[#595959] placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] transition-all uppercase"
                  />
                </div>
              </div>

            </div>

            {/* Submit Button */}
            <div className="pt-[40px] pb-[40px] w-full">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-xl bg-[#f2f2f2] px-[16px] text-sm text-[#595959] opacity-90 tracking-normal flex items-center justify-center hover:bg-[#e6e6e6] transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] font-semibold"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                ) : (
                  "Complete Setup"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column Grid (Matches Signup page grid layout) */}
      <div className="hidden lg:block flex-1 relative bg-[#EBEBEB] overflow-hidden h-screen pointer-events-none z-10">
        <div className="absolute left-[-4%] top-[-8%] w-[110%] h-[120%] min-w-[900px]">
          <div className="grid grid-cols-4 gap-[2%] w-full h-full">
            {Array.from({ length: 16 }).map((_, i) => (
              <div 
                key={i} 
                className="w-full aspect-square bg-[#d9d9d9] rounded-[24px] lg:rounded-[38px] xl:rounded-[48px] bg-cover bg-center bg-fixed"
                style={{ backgroundImage: "url('/bg.png')" }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
