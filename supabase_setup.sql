-- 1. Bật extension pgvector để hỗ trợ vector search
create extension if not exists vector;

-- Xóa các bảng cũ nếu đã tồn tại để tránh lỗi "relation already exists"
drop table if exists semantic_memory cascade;
drop table if exists episodic_memory cascade;
drop table if exists procedural_memory cascade;

-- ==========================================
-- 2. KÝ ỨC NGỮ NGHĨA (Semantic Memory)
-- ==========================================
-- Dùng để tìm kiếm K-nearest neighbor bằng pgvector
create table semantic_memory (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  -- Dùng gemini-embedding-2 (3072 chiều)
  embedding vector(3072), 
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bỏ qua tạo index HNSW do pgvector giới hạn index tối đa 2000 chiều. 
-- Vector 3072 chiều vẫn tìm kiếm bình thường (Sequential Scan - Rất nhanh với tập dữ liệu nhỏ).

-- ==========================================
-- 3. KÝ ỨC SỰ KIỆN (Episodic Memory)
-- ==========================================
-- Lưu vết thời gian thực (Trace) của Event Loop
create table episodic_memory (
  id uuid primary key default gen_random_uuid(),
  event_description text not null,
  emotional_weight float, -- E(c) lấy từ Amygdala
  associative_strength float, -- A(c)
  recency float, -- R(c)
  drift float, -- D(c)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index chuyên biệt cho time-series thay thế cho hypertables
create index episodic_memory_created_at_idx on episodic_memory (created_at desc);

-- ==========================================
-- 4. KÝ ỨC THỦ TỤC (Procedural Memory)
-- ==========================================
-- ACID Database cho các rules và sở thích cứng
create table procedural_memory (
  id uuid primary key default gen_random_uuid(),
  rule_name varchar(255) not null unique,
  condition_logic jsonb not null,
  action_result text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
