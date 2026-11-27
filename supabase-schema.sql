-- ══════════════════════════════════════════════════════════════
--  가연님 대시보드 — 전용 테이블 (선택 사항)
--  Supabase SQL Editor에 붙여넣고 Run 하세요.
--
--  * 지금 앱은 busan-trip-dashboard와 같은 `trip_dashboards` 테이블의
--    `gayeon-dash-...` 행을 사용합니다. (행이 분리되어 서로 영향 없음)
--  * 이 스크립트는 대시보드만의 테이블을 따로 두고 싶을 때 쓰는 준비본입니다.
--    실행해도 기존 데이터는 전혀 건드리지 않습니다.
--  * 앱 본문은 AES-GCM으로 암호화되어 저장되므로, anon 키로 행을 읽어도
--    동기화 코드를 모르면 내용을 볼 수 없습니다.
-- ══════════════════════════════════════════════════════════════

create table if not exists public.gayeon_dashboard (
  sync_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.gayeon_dashboard to anon, authenticated;

alter table public.gayeon_dashboard enable row level security;

-- 비밀 코드(동기화 코드)로 파생한 행 ID를 아는 기기끼리만 읽고 쓰기
drop policy if exists "gayeon read" on public.gayeon_dashboard;
create policy "gayeon read"
  on public.gayeon_dashboard for select
  using (true);

drop policy if exists "gayeon insert" on public.gayeon_dashboard;
create policy "gayeon insert"
  on public.gayeon_dashboard for insert
  with check (true);

drop policy if exists "gayeon update" on public.gayeon_dashboard;
create policy "gayeon update"
  on public.gayeon_dashboard for update
  using (true);

-- Realtime 자동 동기화
alter publication supabase_realtime add table public.gayeon_dashboard;

-- (정리용) 대시보드 행을 지우고 싶을 때
-- delete from public.trip_dashboards where sync_id like 'gayeon-dash-%';
