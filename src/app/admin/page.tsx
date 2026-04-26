import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShieldCheck, Users2, GraduationCap, FileText } from "lucide-react";
import DashboardSchedule, { type ScheduleItem } from "@/components/admin/DashboardSchedule";
import type { DayOfWeek } from "@/lib/schedule";

export default async function AdminHomePage() {
  const supabase = await createClient();

  // ── 카드 뱃지 데이터 ───────────────────────────────────────

  const { count: pendingCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .is("role", null);

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { count: activeStudentCount } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { count: reportDoneCount } = await supabase
    .from("monthly_reports")
    .select("id", { count: "exact", head: true })
    .eq("year_month", yearMonth);

  const missingReportCount = Math.max(0, (activeStudentCount ?? 0) - (reportDoneCount ?? 0));

  // ── 주간 스케줄 데이터 ─────────────────────────────────────

  // 1) 전체 배정 관계
  const { data: relations } = await supabase
    .from("student_mentor_relations")
    .select("student_id, mentor_id, day_of_week, slot");

  const rawRelations = relations ?? [];

  // 2) 활성 학생 정보
  const studentIds = rawRelations.map((r) => r.student_id);
  const { data: studentRows } = studentIds.length > 0
    ? await supabase.from("students").select("id, name, status").in("id", studentIds).eq("status", "active")
    : { data: [] };

  // 3) 멘토 프로필
  const mentorIds = rawRelations.map((r) => r.mentor_id);
  const { data: mentorRows } = mentorIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", mentorIds)
    : { data: [] };

  // 4) 조합
  const activeIds  = new Set((studentRows ?? []).map((s) => s.id));
  const sNameMap   = Object.fromEntries((studentRows ?? []).map((s) => [s.id, s.name]));
  const mNameMap   = Object.fromEntries((mentorRows  ?? []).map((m) => [m.id, m.full_name ?? ""]));

  const schedules: ScheduleItem[] = rawRelations
    .filter((r) => activeIds.has(r.student_id))
    .map((r) => ({
      student_id:   r.student_id,
      student_name: sNameMap[r.student_id] ?? "",
      mentor_id:    r.mentor_id,
      mentor_name:  mNameMap[r.mentor_id]  ?? "",
      day_of_week:  r.day_of_week as DayOfWeek,
      slot:         r.slot as number,
    }));

  // ── 상단 카드 정의 ─────────────────────────────────────────

  const cards = [
    {
      href: "/admin/managers",
      icon: ShieldCheck,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      title: "관리자 관리",
      desc: "관리자 계정을 추가하고 삭제합니다.",
      badge: null,
    },
    {
      href: "/admin/mentors",
      icon: Users2,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      title: "멘토 관리",
      desc: "멘토 계정 관리 및 가입 신청을 승인합니다.",
      badge: (pendingCount ?? 0) > 0 ? pendingCount : null,
    },
    {
      href: "/admin/students",
      icon: GraduationCap,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      title: "학생 관리",
      desc: "전체 학생 목록을 조회하고 관리합니다.",
      badge: null,
    },
    {
      href: "/admin/reports",
      icon: FileText,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      title: "보고서 관리 센터",
      desc: "이번 달 월간 AI 보고서를 일괄 생성·관리합니다.",
      badge: missingReportCount > 0 ? missingReportCount : null,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">관리자 대시보드</h2>
        <p className="text-sm text-gray-500 mt-1">NIMS 뉴퍼센트 학원 관리 시스템</p>
      </div>

      {/* 상단 4개 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map(({ href, icon: Icon, iconBg, iconColor, title, desc, badge }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-4 p-6 bg-white border border-gray-200 rounded-2xl hover:border-gray-400 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              {badge !== null && (
                <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-yellow-400 text-white text-[11px] font-bold">
                  {badge}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-base">{title}</h3>
              <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <span className="text-xs text-blue-600 font-semibold group-hover:underline underline-offset-2">
              바로가기 →
            </span>
          </Link>
        ))}
      </div>

      {/* 하단: 실시간 일정 섹션 */}
      <DashboardSchedule schedules={schedules} />
    </div>
  );
}
