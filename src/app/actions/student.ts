"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Student, StudentStatus } from "@/types/database";

// ──────────────────────────────────────────────────────────────
// 설계 원칙 (데이터 보존 정책)
//
// [멘토] 담당 해제 (unassignStudent)
//   → student_mentor_relations 행만 삭제
//   → students / coaching_records 는 절대 삭제하지 않음
//   → "배정 관계를 끊는 것"이지 "학생 데이터를 지우는 것"이 아님
//
// [어드민] 퇴원 처리 (deactivateStudent)
//   → students.status = 'inactive' 로 변경
//   → coaching_records 는 그대로 보존됨
//   → 재등록 시 reactivateStudent 로 status = 'active' 복원 가능
// ──────────────────────────────────────────────────────────────

/** 신규 학생 생성 + 현재 멘토에게 배정 */
export async function createAndAssignStudent(
  mentorId: string,
  name: string,
  targetUniversity: string | null
): Promise<Student> {
  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({ name, target_university: targetUniversity })
    .select()
    .single();

  if (studentError || !student) {
    throw new Error(studentError?.message ?? "학생 생성에 실패했습니다.");
  }

  const { error: relError } = await supabase
    .from("student_mentor_relations")
    .insert({ student_id: student.id, mentor_id: mentorId });

  if (relError) {
    // 관계 저장 실패 시 학생 롤백
    await supabase.from("students").delete().eq("id", student.id);
    throw new Error(relError.message);
  }

  revalidatePath("/mentor");
  return student;
}

/** 기존 학생을 현재 멘토에게 배정 */
export async function assignExistingStudent(
  studentId: string,
  mentorId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("student_mentor_relations")
    .insert({ student_id: studentId, mentor_id: mentorId });

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 담당 학생으로 등록되어 있습니다.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/mentor");
}

/**
 * [멘토 전용] 담당 해제
 *
 * ⚠️ 이것은 "담당 관계 해제"이지 "데이터 삭제"가 아닙니다.
 *    - student_mentor_relations 테이블에서 해당 (student_id, mentor_id) 행만 제거
 *    - students 테이블의 학생 데이터는 그대로 유지
 *    - coaching_records(코칭 기록)는 삭제되지 않고 DB에 보존됨
 */
export async function unassignStudent(
  studentId: string,
  mentorId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("student_mentor_relations")
    .delete()
    .eq("student_id", studentId)
    .eq("mentor_id", mentorId);

  if (error) throw new Error(error.message);
  revalidatePath("/mentor");
}

/**
 * [어드민 전용] 퇴원 처리
 *
 * students.status = 'inactive' 로 변경.
 * coaching_records 및 student_mentor_relations 는 삭제되지 않음.
 * 재등록 시 reactivateStudent 로 복원 가능.
 */
export async function deactivateStudent(studentId: string): Promise<void> {
  const supabase = await createClient();

  // 호출자가 admin 인지 검증
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("관리자만 퇴원 처리를 할 수 있습니다.");

  const { error } = await supabase
    .from("students")
    .update({ status: "inactive" })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/students/${studentId}`);
}

/**
 * [어드민 전용] 퇴원 취소 (재등록)
 *
 * students.status = 'active' 로 복원.
 */
export async function reactivateStudent(studentId: string): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("관리자만 재등록 처리를 할 수 있습니다.");

  const { error } = await supabase
    .from("students")
    .update({ status: "active" })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/students/${studentId}`);
}

/** [어드민 전용] 학생 직접 생성 (멘토 미배정) */
export async function createStudentAdmin(
  name: string,
  targetUniversity: string | null
): Promise<Student> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자만 학생을 직접 추가할 수 있습니다.");

  const { data, error } = await supabase
    .from("students")
    .insert({ name: name.trim(), target_university: targetUniversity || null, status: "active" })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "학생 생성 실패");
  revalidatePath("/admin/students");
  return data;
}

/**
 * [어드민 전용] 학생 완전 삭제
 *
 * ⚠️ 멘토에게 배정된 상태라면 삭제를 차단합니다.
 *    삭제 시 coaching_records도 CASCADE로 함께 삭제됩니다.
 */
export async function deleteStudentAdmin(studentId: string): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Unauthorized");

  const { count } = await supabase
    .from("student_mentor_relations")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if ((count ?? 0) > 0) {
    throw new Error("멘토 화면에서 먼저 담당 해제를 진행해야 삭제할 수 있습니다.");
  }

  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/students");
}

/**
 * [어드민 전용] 엑셀 데이터 일괄 upsert
 *
 * - 이름이 기존 학생과 일치하는 경우: seat만 업데이트
 * - 이름이 없는 경우: 신규 학생 생성 (name, seat)
 * - 결과로 변경된 전체 학생 목록을 반환
 */
export async function upsertStudentsFromExcel(
  rows: { name: string; seat: string | null }[]
): Promise<Student[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자만 엑셀 데이터를 업로드할 수 있습니다.");

  // 현재 전체 학생 이름 목록 조회
  const { data: existing } = await supabase
    .from("students")
    .select("id, name");

  const existingMap = new Map<string, string>(
    (existing ?? []).map((s) => [s.name.trim(), s.id])
  );

  const toUpdate: { id: string; seat: string | null }[] = [];
  const toInsert: { name: string; seat: string | null; target_university: null; status: StudentStatus }[] = [];

  for (const row of rows) {
    const trimmedName = row.name.trim();
    if (!trimmedName) continue;

    if (existingMap.has(trimmedName)) {
      toUpdate.push({ id: existingMap.get(trimmedName)!, seat: row.seat });
    } else {
      toInsert.push({ name: trimmedName, seat: row.seat, target_university: null, status: "active" });
    }
  }

  // 기존 학생 seat 업데이트 (병렬)
  await Promise.all(
    toUpdate.map(({ id, seat }) =>
      supabase.from("students").update({ seat }).eq("id", id)
    )
  );

  // 신규 학생 일괄 삽입
  if (toInsert.length > 0) {
    const { error } = await supabase.from("students").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/students");

  // 업데이트 후 전체 학생 목록 반환
  const { data: updated, error: fetchError } = await supabase
    .from("students")
    .select("id, name, target_university, status, seat, created_at")
    .order("name");

  if (fetchError) throw new Error(fetchError.message);
  return (updated ?? []) as Student[];
}

/**
 * [어드민 전용] 학생 좌석 번호 업데이트
 */
export async function updateStudentSeat(
  studentId: string,
  seat: string | null
): Promise<Student> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자만 좌석을 수정할 수 있습니다.");

  const { data, error } = await supabase
    .from("students")
    .update({ seat: seat || null })
    .eq("id", studentId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "좌석 업데이트 실패");

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin");
  revalidatePath("/mentor");

  return data as Student;
}

/**
 * 학생 이름 검색 (기존 학생 불러오기용)
 * - 재원 중(active) 학생만 반환 (퇴원 학생은 검색 결과에 포함하지 않음)
 */
export async function searchStudents(
  query: string,
  excludeIds: string[]
): Promise<Pick<Student, "id" | "name" | "target_university">[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();

  let q = supabase
    .from("students")
    .select("id, name, target_university")
    .eq("status", "active")          // 재원 중인 학생만
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(10);

  if (excludeIds.length > 0) {
    q = q.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data } = await q;
  return data ?? [];
}
