-- Fix Row Level Security (RLS) policies for the users table
-- Run this in your Supabase SQL Editor: https://esqqdcjldpvtkndmcymc.supabase.co/project/_/sql

-- First, check if RLS is enabled (it probably is)
-- If you want to disable RLS entirely (NOT RECOMMENDED for production):
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- RECOMMENDED: Keep RLS enabled but add proper policies

-- Drop existing policies if any (in case of conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON users;

-- Create new policies
-- Allow authenticated users to read their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- IMPORTANT: Also add policies to allow reading other users' data for matchmaking
-- (You need to see opponent names, ELO, etc.)
CREATE POLICY "Users can view all profiles"
ON users FOR SELECT
TO authenticated
USING (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';
