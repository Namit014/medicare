"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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
    <div className="bg-white h-screen w-full flex flex-col lg:flex-row overflow-hidden">
      
      {/* Left Column */}
      <div className="relative w-full lg:w-[550px] xl:w-[650px] shrink-0 h-full flex flex-col z-20 bg-white shadow-[20px_0_40px_-20px_rgba(0,0,0,0.05)] justify-center pl-[10%] lg:pl-[80px] xl:pl-[120px] pr-6 lg:pr-8 py-8 xl:py-12">
        
        {/* Logo */}
        <div className="absolute left-[8%] lg:left-[40px] xl:left-[60px] top-[24px] lg:top-[40px] flex items-center gap-[12px]">
          <Image 
             src="/logo.png" 
             alt="MediCare Logo" 
             width={48} 
             height={48} 
             className="w-[36px] h-[36px] xl:w-[48px] xl:h-[48px] object-contain"
          />
          <span className="text-[22px] xl:text-[26px] tracking-tight text-black font-medium">MediCare</span>
        </div>

        {/* Header */}
        <div className="mt-16 lg:mt-20 xl:mt-24 mb-4 xl:mb-6">
          <h1 className="text-5xl lg:text-5xl xl:text-[64px] text-black tracking-tight leading-[1.1]">
            Log In
          </h1>
        </div>

        {/* Subtitle / Signup Link */}
        <div className="mb-10 xl:mb-12">
          <p className="text-base xl:text-[16px] text-[#595959] tracking-normal">
            New to MediCare?{" "}
            <Link href="/signup" className="font-medium text-black hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        {/* Form */}
        <div className="w-full max-w-[380px] xl:max-w-[440px]">
          {error && (
            <div className="p-4 mb-6 text-sm text-red-500 bg-red-50 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col relative w-full">
            <div className="space-y-4 xl:space-y-5 w-full">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full h-12 lg:h-[56px] xl:h-[60px] rounded-xl lg:rounded-[12px] bg-[#d9d9d9] px-[20px] text-base xl:text-[15px] text-black placeholder:text-[#595959] placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] transition-all"
              />

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full h-12 lg:h-[56px] xl:h-[60px] rounded-xl lg:rounded-[12px] bg-[#d9d9d9] px-[20px] text-base xl:text-[15px] text-black placeholder:text-[#595959] placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] transition-all"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-8 xl:pt-10 w-full">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 lg:h-[56px] xl:h-[60px] rounded-xl lg:rounded-[12px] bg-[#f2f2f2] px-[20px] text-base xl:text-[15px] text-[#595959] opacity-80 tracking-normal flex items-center justify-start hover:bg-[#e6e6e6] transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#c2c2c2] font-medium"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent mx-auto"></div>
                ) : (
                  "Log In"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column Grid Image */}
      <div className="hidden lg:flex flex-1 relative bg-[#f2f2f2] h-full items-center justify-center overflow-hidden">
        <div className="grid grid-cols-4 grid-rows-4 gap-4 lg:gap-6 xl:gap-8 w-[140%] xl:w-[130%] aspect-square flex-shrink-0 absolute">
          {Array.from({ length: 16 }).map((_, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            return (
              <div 
                key={i} 
                className="w-full h-full rounded-[24px] lg:rounded-[32px] xl:rounded-[40px] bg-white shadow-sm"
                style={{
                  backgroundImage: 'url(/singupimage.png)',
                  backgroundSize: 'calc(400% + 16px) calc(400% + 16px)',
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
