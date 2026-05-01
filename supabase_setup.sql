-- 1. Bật extension pgvector để hỗ trợ vector search
create extension if not exists vector;

-- Xóa các bảng cũ nếu đã tồn tại để tránh lỗi "relation already exists"
drop table if exists semantic_memory cascade;
drop table if exists episodic_memory cascade;
drop table if exists procedural_memory cascade;

-- ==========================================
-- 2. KÝ ỨC NGỮ NGHĨA (Semantic Memory)
-- ==========================================
create table semantic_memory (
  id uuid primary key default gen_random_uuid(),
  world_id varchar(255) not null,
  content text not null,
  -- Dùng gemini-embedding-2 (3072 chiều)
  embedding vector(3072), 
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 3. KÝ ỨC SỰ KIỆN (Episodic Memory)
-- ==========================================
-- Lưu đoạn hội thoại và cảm xúc
create table episodic_memory (
  id uuid primary key default gen_random_uuid(),
  world_id varchar(255) not null,
  event_description text not null,
  embedding vector(3072),
  emotional_weight float, -- E(c) lấy từ Amygdala
  associative_strength float, -- A(c)
  recency float, -- R(c)
  drift float, -- D(c)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index chuyên biệt cho time-series
create index episodic_memory_created_at_idx on episodic_memory (created_at desc);

-- ==========================================
-- 4. KÝ ỨC THỦ TỤC (Procedural Memory)
-- ==========================================
-- ACID Database cho các rules và sở thích cứng
create table procedural_memory (
  id uuid primary key default gen_random_uuid(),
  world_id varchar(255) not null,
  rule_name varchar(255) not null,
  condition_logic jsonb not null,
  action_result text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(world_id, rule_name)
);

-- ==========================================
-- 5. CÁC HÀM TÌM KIẾM VECTOR (RPC)
-- ==========================================

-- Hàm tìm kiếm Semantic Memory
create or replace function match_semantic_documents (
  query_embedding vector(3072),
  filter_world_id varchar,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    semantic_memory.id,
    semantic_memory.content,
    semantic_memory.metadata,
    1 - (semantic_memory.embedding <=> query_embedding) as similarity
  from semantic_memory
  where semantic_memory.world_id = filter_world_id
    and 1 - (semantic_memory.embedding <=> query_embedding) > match_threshold
  order by semantic_memory.embedding <=> query_embedding
  limit match_count;
$$;

-- Hàm tìm kiếm Episodic Memory
create or replace function match_episodic_documents (
  query_embedding vector(3072),
  filter_world_id varchar,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  event_description text,
  emotional_weight float,
  similarity float
)
language sql stable
as $$
  select
    episodic_memory.id,
    episodic_memory.event_description,
    episodic_memory.emotional_weight,
    1 - (episodic_memory.embedding <=> query_embedding) as similarity
  from episodic_memory
  where episodic_memory.world_id = filter_world_id
    and 1 - (episodic_memory.embedding <=> query_embedding) > match_threshold
  order by episodic_memory.embedding <=> query_embedding
  limit match_count;
$$;
