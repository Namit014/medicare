"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pill, Activity, ShieldAlert, User, Mail, Lock, Sparkles } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState(""); // "Who are you?" input
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check session
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          router.push("/");
        }
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Signup failed");
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
    <div className="min-h-screen w-full bg-black text-zinc-100 font-sans flex flex-col md:flex-row overflow-x-hidden">
      
      {/* LEFT COLUMN: 50% width on desktop, centers the 3x3 Bento Grid */}
      <div className="hidden md:flex md:w-1/2 min-h-screen bg-black items-center justify-center p-8 lg:p-16 border-r border-zinc-950">
        
        {/* 3x3 Bento Grid Container */}
        <div className="w-full max-w-[460px] aspect-square grid grid-cols-3 grid-rows-3 gap-3.5">
          
          {/* Row 1, Col 1: Dark metallic style placeholder */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/30 relative overflow-hidden aspect-square flex items-center justify-center group">
            <div className="absolute inset-0 bg-radial from-emerald-500/5 to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/10 via-black/40 to-black/80"></div>
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Sensors</span>
            </div>
          </div>

          {/* Row 1, Col 2: Dark metallic style placeholder */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/30 relative overflow-hidden aspect-square flex items-center justify-center group">
            <div className="absolute inset-0 bg-radial from-zinc-800/10 to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/5 via-black/40 to-black/80"></div>
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Network</span>
            </div>
          </div>

          {/* Row 1, Col 3: Purple Card with Logo (Matches Reference top-right placement) */}
          <div className="rounded-3xl bg-purple-400 text-zinc-950 flex items-center justify-center aspect-square shadow-lg shadow-purple-500/10 relative overflow-hidden group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="h-12 w-12 rounded-2xl bg-black flex items-center justify-center shadow-md">
              <Pill className="h-7 w-7 text-purple-400 rotate-45" />
            </div>
          </div>

          {/* Row 2, Col 1: Purple Card with Text & Dot Grid Pattern (Matches Reference mid-left placement) */}
          <div className="rounded-3xl bg-purple-400 text-zinc-950 p-5 flex flex-col justify-between aspect-square relative overflow-hidden shadow-lg shadow-purple-500/10">
            {/* Dots background overlay */}
            <div className="absolute top-0 right-0 p-4 opacity-25">
              <div className="grid grid-cols-5 gap-1">
                {[...Array(25)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-purple-950"></div>
                ))}
              </div>
            </div>
            <div className="h-4"></div>
            <div className="space-y-1">
              <h3 className="text-[17px] font-extrabold leading-tight tracking-tight">Total Care.</h3>
              <p className="text-[14px] font-bold leading-tight text-purple-950/75">Total Different.</p>
            </div>
          </div>

          {/* Row 2, Col 2: Yellow Card with + and "Own your health" (Matches Reference center placement) */}
          <div className="rounded-3xl bg-amber-100 text-zinc-950 p-5 flex flex-col justify-between aspect-square shadow-lg shadow-amber-100/5">
            <div className="text-xl font-bold text-amber-700/80">+</div>
            <p className="text-[13px] font-extrabold leading-tight text-zinc-900 tracking-tight">
              Own<br />your health
            </p>
          </div>

          {/* Row 2, Col 3: Dark metallic style placeholder */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/30 relative overflow-hidden aspect-square flex items-center justify-center group">
            <div className="absolute inset-0 bg-radial from-rose-500/5 to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/5 via-black/40 to-black/80"></div>
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Alarms</span>
            </div>
          </div>

          {/* Row 3, Col 1: Yellow Card with + and "Building trust..." (Matches Reference bottom-left placement) */}
          <div className="rounded-3xl bg-amber-100 text-zinc-950 p-5 flex flex-col justify-between aspect-square shadow-lg shadow-amber-100/5">
            <div className="text-xl font-bold text-amber-700/80">+</div>
            <p className="text-[12px] font-extrabold leading-snug text-zinc-900 tracking-tight">
              Building trust in healthcare technology
            </p>
          </div>

          {/* Row 3, Col 2: Dark metallic style placeholder */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/30 relative overflow-hidden aspect-square flex items-center justify-center group">
            <div className="absolute inset-0 bg-radial from-zinc-800/10 to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/5 via-black/40 to-black/80"></div>
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">System</span>
            </div>
          </div>

          {/* Row 3, Col 3: Dark metallic style placeholder */}
          <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/30 relative overflow-hidden aspect-square flex items-center justify-center group">
            <div className="absolute inset-0 bg-radial from-teal-500/5 to-transparent"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/5 via-black/40 to-black/80"></div>
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Postgres</span>
            </div>
          </div>

        </div>

      </div>

      {/* RIGHT COLUMN: 50% width on desktop, centers the Form */}
      <div className="w-full md:w-1/2 min-h-screen bg-black flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-24">
        
        <div className="w-full max-w-sm mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Sign Up
            </h1>
            <p className="mt-2 text-sm text-zinc-400 leading-normal">
              Enter your details to create an account and sync with your smart pill box.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-950/20 p-3.5 text-sm text-red-400">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Name */}
              <div className="relative">
                <label htmlFor="name-input" className="absolute -top-2 left-3 bg-black px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Full Name
                </label>
                <div className="flex items-center">
                  <User className="absolute left-4 h-4 w-4 text-zinc-600" />
                  <input
                    id="name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alice Caroline"
                    className="w-full rounded-xl border border-zinc-800 bg-black py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Who are you? / Role Input Box */}
              <div className="relative">
                <label htmlFor="role-input" className="absolute -top-2 left-3 bg-black px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Who are you? (Role)
                </label>
                <div className="flex items-center">
                  <Activity className="absolute left-4 h-4 w-4 text-zinc-600" />
                  <input
                    id="role-input"
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Patient, Doctor, Caregiver"
                    className="w-full rounded-xl border border-zinc-800 bg-black py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="relative">
                <label htmlFor="email-input" className="absolute -top-2 left-3 bg-black px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Email
                </label>
                <div className="flex items-center">
                  <Mail className="absolute left-4 h-4 w-4 text-zinc-600" />
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alice_login@gmail.com"
                    className="w-full rounded-xl border border-zinc-800 bg-black py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="relative">
                <label htmlFor="password-input" className="absolute -top-2 left-3 bg-black px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Password
                </label>
                <div className="flex items-center">
                  <Lock className="absolute left-4 h-4 w-4 text-zinc-600" />
                  <input
                    id="password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-zinc-800 bg-black py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-900"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-zinc-600 uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-zinc-900"></div>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-3.5">
              <button 
                type="button"
                onClick={() => alert("Google sign-in clicked.")}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-900 bg-zinc-950 text-sm font-semibold hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Google
              </button>
              <button 
                type="button"
                onClick={() => alert("Facebook sign-in clicked.")}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-900 bg-zinc-950 text-sm font-semibold hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Facebook
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-purple-400 hover:text-purple-300 hover:underline">
                Log in
              </Link>
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
