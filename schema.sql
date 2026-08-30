-- Medicare Database Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com/sql/new

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_id TEXT,
  role TEXT DEFAULT 'Patient'
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Routines table
CREATE TABLE IF NOT EXISTS routines (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  morning TEXT DEFAULT '08:00',
  afternoon TEXT DEFAULT '14:00',
  night TEXT DEFAULT '20:00',
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own routine" ON routines FOR ALL USING (auth.uid() = user_id);

-- 3. Adherence logs table
CREATE TABLE IF NOT EXISTS adherence_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT,
  date TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('morning', 'afternoon', 'night')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'taken', 'missed')),
  due_at TEXT NOT NULL,
  taken_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date, slot)
);

ALTER TABLE adherence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own logs" ON adherence_logs FOR ALL USING (auth.uid() = user_id);

-- 4. Medications table
CREATE TABLE IF NOT EXISTS medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily',
  slot TEXT NOT NULL CHECK (slot IN ('morning', 'afternoon', 'night')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own medications" ON medications FOR ALL USING (auth.uid() = user_id);
