-- Smart Budget Trip Planner - Full Schema

-- Ensure UUID helpers are available for gen_random_uuid().
create extension if not exists pgcrypto;

-- ============================================================
-- PROFILES TABLE
-- ============================================================
create table if not exists public.profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	email text not null,
	full_name text not null default '',
	role text not null default 'user' check (role in ('user', 'admin')),
	status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
	phone text default '',
	created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
	on public.profiles for select
	to authenticated
	using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
	on public.profiles for select
	to authenticated
	using (
		exists (
			select 1 from public.profiles p
			where p.id = auth.uid() and p.role = 'admin'
		)
	);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
	on public.profiles for insert
	to authenticated
	with check (auth.uid() = id);

drop policy if exists "Users can update own non-sensitive fields" on public.profiles;
create policy "Users can update own non-sensitive fields"
	on public.profiles for update
	to authenticated
	using (auth.uid() = id)
	with check (auth.uid() = id);

-- ============================================================
-- TRIPS TABLE
-- ============================================================
create table if not exists public.trips (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.profiles(id) on delete cascade,
	start_location text not null,
	destination text not null,
	budget numeric not null,
	days integer not null,
	travel_type text not null check (travel_type in ('solo', 'female_solo', 'group', 'family', 'children', 'temple')),
	num_people integer not null default 1,
	distance_km numeric,
	duration_hours numeric,
	start_lat numeric,
	start_lng numeric,
	dest_lat numeric,
	dest_lng numeric,
	budget_breakdown jsonb,
	itinerary jsonb,
	nearby_places jsonb,
	safety_score integer,
	route_polyline jsonb,
	created_at timestamptz default now()
);

alter table public.trips enable row level security;

drop policy if exists "Users can view own trips" on public.trips;
create policy "Users can view own trips"
	on public.trips for select
	to authenticated
	using (auth.uid() = user_id);

drop policy if exists "Users can insert own trips" on public.trips;
create policy "Users can insert own trips"
	on public.trips for insert
	to authenticated
	with check (auth.uid() = user_id);

drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips"
	on public.trips for update
	to authenticated
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trips" on public.trips;
create policy "Users can delete own trips"
	on public.trips for delete
	to authenticated
	using (auth.uid() = user_id);

-- ============================================================
-- PLACE REVIEWS TABLE
-- ============================================================
create table if not exists public.place_reviews (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.profiles(id) on delete cascade,
	trip_id uuid references public.trips(id) on delete set null,
	place_name text not null,
	place_type text not null check (place_type in ('restaurant', 'hotel', 'attraction', 'other')),
	rating integer not null check (rating between 1 and 5),
	review_text text default '',
	cuisine_type text default '',
	price_range text default '',
	location_lat numeric,
	location_lng numeric,
	location_city text default '',
	helpful_count integer default 0,
	created_at timestamptz default now()
);

alter table public.place_reviews enable row level security;

drop policy if exists "Authenticated users can view all reviews" on public.place_reviews;
create policy "Authenticated users can view all reviews"
	on public.place_reviews for select
	to authenticated
	using (true);

drop policy if exists "Users can insert own reviews" on public.place_reviews;
create policy "Users can insert own reviews"
	on public.place_reviews for insert
	to authenticated
	with check (auth.uid() = user_id);

drop policy if exists "Users can update own reviews" on public.place_reviews;
create policy "Users can update own reviews"
	on public.place_reviews for update
	to authenticated
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reviews" on public.place_reviews;
create policy "Users can delete own reviews"
	on public.place_reviews for delete
	to authenticated
	using (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_trips_created_at on public.trips(created_at desc);
create index if not exists idx_place_reviews_place_name on public.place_reviews(place_name);
create index if not exists idx_place_reviews_location_city on public.place_reviews(location_city);
create index if not exists idx_place_reviews_rating on public.place_reviews(rating desc);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_role on public.profiles(role);
