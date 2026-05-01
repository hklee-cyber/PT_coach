-- students 테이블에 좌석 번호 컬럼 추가
alter table public.students
  add column if not exists seat text null;

comment on column public.students.seat is '학원 좌석 번호 (엑셀 연동)';
