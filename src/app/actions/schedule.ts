"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DayOfWeek } from "@/lib/schedule";

// ── 권한 검증 헬퍼 ───────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") throw new Error("관리자만 스케줄을 변경할 수 있습니다.");
  return supabase;
}

// ── 멘토 가용 시간 저장 (기존 전체 교체) ──────────────────────
export async function setMentorAvailability(
  mentorId: string,
  slots: { day_of_week: DayOfWeek; slot: number }[]
): Promise<void> {
  const supabase = await requireAdmin();

  // 기존 가용 시간 전체 삭제 후 재삽입
  const { error: delErr } = await supabase
    .from("mentor_availability")
    .delete()
    .eq("mentor_id", mentorId);
  if (delErr) throw new Error(delErr.message);

  if (slots.length > 0) {
    const { error: insErr } = await supabase
      .from("mentor_availability")
      .insert(slots.map((s) => ({ mentor_id: mentorId, ...s })));
    if (insErr) throw new Error(insErr.message);
  }

  revalidatePath(`/admin/mentors/${mentorId}`);
}

// ── 특정 요일·교시에서 배정 가능한 멘토 조회 ─────────────────
export async function getAvailableMentors(
  dayOfWeek: DayOfWeek,
  slot: number,
  excludeStudentId?: string
): Promise<{ id: string; full_name: string }[]> {
  const supabase = await requireAdmin();

  // 해당 슬롯에 가용 표시된 멘토
  const { data: available } = await supabase
    .from("mentor_availability")
    .select("mentor_id")
    .eq("day_of_week", dayOfWeek)
    .eq("slot", slot);

  const availableIds = (available ?? []).map((a) => a.mentor_id);
  if (availableIds.length === 0) return [];

  // 이미 해당 슬롯에 다른 학생이 배정된 멘토 제외
  const { data: occupied } = await supabase
    .from("student_mentor_relations")
    .select("mentor_id, student_id")
    .eq("day_of_week", dayOfWeek)
    .eq("slot", slot)
    .in("mentor_id", availableIds);

  const occupiedMentorIds = new Set(
    (occupied ?? [])
      .filter((o) => o.student_id !== excludeStudentId)
      .map((o) => o.mentor_id)
  );

  const freeMentorIds = availableIds.filter((id) => !occupiedMentorIds.has(id));
  if (freeMentorIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", freeMentorIds)
    .eq("role", "mentor")
    .order("full_name");

  return (profiles ?? []) as { id: string; full_name: string }[];
}

// ── 학생에게 스케줄 배정 (admin 전용) ────────────────────────
export async function assignStudentSchedule(
  studentId: string,
  mentorId: string,
  dayOfWeek: DayOfWeek,
  slot: number
): Promise<void> {
  const supabase = await requireAdmin();

  // 기존 배정 제거
  const { error: delErr } = await supabase
    .from("student_mentor_relations")
    .delete()
    .eq("student_id", studentId);

  if (delErr) throw new Error(delErr.message);

  // 새 배정 삽입
  const { error } = await supabase
    .from("student_mentor_relations")
    .insert({ student_id: studentId, mentor_id: mentorId, day_of_week: dayOfWeek, slot });

  if (error) throw new Error(error.message);

  revalidateTag("students-list");
  revalidatePath("/admin/students", "layout");
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/admin/mentors/${mentorId}`);
}

// ── 수업 취소 토글 (특정 날짜) ───────────────────────────────
export async function toggleCancelSession(
  studentId: string,
  sessionDate: string,
  slot: number
): Promise<void> {
  const supabase = await requireAdmin();

  const { data: existing } = await supabase
    .from("pt_schedule_overrides")
    .select("id")
    .eq("student_id", studentId)
    .eq("session_date", sessionDate)
    .eq("slot", slot)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("pt_schedule_overrides")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("pt_schedule_overrides")
      .insert({ student_id: studentId, session_date: sessionDate, slot, status: "취소" });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin");
}

// ── 보강 세션 등록 ───────────────────────────────────────────
export async function addMakeupSession(
  studentId: string,
  mentorId: string,
  makeupDate: string,
  slot: number,
  originalDate?: string
): Promise<void> {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("pt_makeups")
    .insert({
      student_id: studentId,
      mentor_id: mentorId,
      makeup_date: makeupDate,
      slot,
      original_date: originalDate ?? null,
      status: "대기",
    });

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

// ── 보강 세션 삭제 ───────────────────────────────────────────
export async function deleteMakeupSession(makeupId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("pt_makeups").delete().eq("id", makeupId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

// ── 보강 세션 수정 ───────────────────────────────────────────
export async function updateMakeupSession(
  makeupId: string,
  data: { makeup_date: string; slot: number; mentor_id: string }
): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("pt_makeups")
    .update({ makeup_date: data.makeup_date, slot: data.slot, mentor_id: data.mentor_id })
    .eq("id", makeupId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

// ── 스케줄 배정 해제 ─────────────────────────────────────────
export async function removeStudentSchedule(studentId: string): Promise<void> {
  const supabase = await requireAdmin();

  // 기존 배정에서 mentor_id 조회 (revalidate용)
  const { data: existing } = await supabase
    .from("student_mentor_relations")
    .select("mentor_id")
    .eq("student_id", studentId)
    .maybeSingle();

  const { error } = await supabase
    .from("student_mentor_relations")
    .delete()
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);

  revalidateTag("students-list");
  revalidatePath("/admin/students", "layout");
  revalidatePath(`/admin/students/${studentId}`);
  if (existing?.mentor_id) revalidatePath(`/admin/mentors/${existing.mentor_id}`);
}
