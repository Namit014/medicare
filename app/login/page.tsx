"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pill } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) router.push("/");
      } catch (err) {
        console.error(err);
      }
    }
    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
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
      
      {/* Left Column (Matching Signup Layout) */}
      <div className="relative w-full lg:w-[480px] xl:w-[500px] shrink-0 min-h-screen flex flex-col z-20 bg-white shadow-[20px_0_40px_-20px_rgba(0,0,0,0.05)]">
        
        {/* Logo */}
        <div className="lg:absolute lg:left-[40px] lg:top-[30px] flex items-center gap-[12px] p-6 lg:p-0">
          <div className="w-[32px] h-[36px] flex items-center justify-center relative">
             <Pill className="h-8 w-8 text-black" />
          </div>
          <span className="text-[20px] tracking-[-1px] text-black">MediCare</span>
        </div>

        {/* Header */}
        <div className="lg:absolute lg:left-[80px] xl:left-[109px] lg:top-[223px] px-6 lg:px-0 mt-8 lg:mt-0">
          <h1 className="text-4xl lg:text-4xl xl:text-[44px] text-black tracking-tight lg:tracking-[-2px] leading-tight">
            Log In account
          </h1>
        </div>

        {/* Subtitle */}
        <div className="lg:absolute lg:left-[80px] xl:left-[109px] lg:top-[280px] xl:top-[293px] px-6 lg:px-0 mt-2 lg:mt-0 flex gap-1">
          <p className="text-sm lg:text-[13px] text-[#595959] tracking-normal lg:tracking-[-0.65px]">
            New to MediCare?
          </p>
          <Link href="/signup" className="text-sm lg:text-[13px] text-black font-medium tracking-normal lg:tracking-[-0.65px] hover:underline">
            Create an account
          </Link>
        </div>

        {/* Form */}
        <div className="lg:absolute lg:left-[80px] xl:left-[104px] lg:top-[380px] xl:top-[397px] w-full max-w-[340px] px-6 lg:px-0 mt-12 lg:mt-0">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col relative w-full">
            <div className="space-y-[20px] w-full">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full h-14 lg:h-[60px] rounded-xl lg:rounded-[12px] bg-[#d9d9d9] px-[16px] text-sm lg:text-[13px] text-black placeholder:text-[#595959] placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] transition-all"
              />

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full h-14 lg:h-[60px] rounded-xl lg:rounded-[12px] bg-[#d9d9d9] px-[16px] text-sm lg:text-[13px] text-black placeholder:text-[#595959] placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] transition-all"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-[50px] w-full">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 lg:h-[60px] rounded-xl lg:rounded-[12px] bg-[#f2f2f2] px-[16px] text-sm lg:text-[13px] text-[#595959] opacity-70 tracking-normal flex items-center justify-start hover:bg-[#e6e6e6] transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2]"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent mx-auto"></div>
                ) : (
                  "Log In"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column Grid Image */}
      <div className="hidden lg:flex flex-1 relative bg-white h-screen sticky top-0 items-center justify-center p-6 xl:p-12 overflow-hidden">
        <div className="grid grid-cols-4 grid-rows-4 gap-[1rem] w-full max-w-[900px] max-h-full aspect-square">
          {Array.from({ length: 16 }).map((_, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            return (
              <div 
                key={i} 
                className="w-full h-full rounded-[24px] xl:rounded-[32px] bg-gray-100"
                style={{
                  backgroundImage: 'url(/singupimage.png)',
                  backgroundSize: 'calc(400% + 3rem) calc(400% + 3rem)',
                  backgroundPosition: `${col * 33.333333}% ${row * 33.333333}%`,
                  backgroundRepeat: 'no-repeat'
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
