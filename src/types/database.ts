// Supabase 스키마 타입 정의
import type { DayOfWeek } from "@/lib/schedule";
export type { DayOfWeek };

export type Role = "admin" | "mentor" | null;
export type AdmissionType = "정시" | "수시" | "";
export type AnalysisType = "monthly" | "cumulative";

// interface 대신 type alias 사용: TypeScript 5.x strict에서 interface는
// Record<string, unknown>을 extend하지 않아 Supabase 타입 유틸리티가 never를 반환함.
export type Profile = {
  id: string;
  role: Role;              // null = 승인 대기, "mentor" | "admin" = 활성
  full_name: string;
  password_plain: string | null;
  created_at: string;
};

export type StudentStatus = "active" | "inactive";

export type Student = {
  id: string;
  name: string;
  target_university: string | null;
  /** "active" = 재원 중 | "inactive" = 퇴원 처리됨 (admin만 변경 가능) */
  status: StudentStatus;
  created_at: string;
  // mentor_id 제거: student_mentor_relations 테이블로 분리됨
};

export type StudentMentorRelation = {
  id: string;
  student_id: string;
  mentor_id: string;
  day_of_week: DayOfWeek | null;
  slot: number | null;
  created_at: string;
};

export type MentorAvailability = {
  id: string;
  mentor_id: string;
  day_of_week: DayOfWeek;
  slot: number;
  created_at: string;
};

export type MonthlyReport = {
  id: string;
  student_id: string;
  year_month: string;
  content: string;
  analysis_type: AnalysisType;
  created_at: string;
};

// ── coaching_records.content jsonb 구조 ───────────────────

// 과목별 세부 입력 항목
export type SubjectContent = {
  // [학습 전략]
  grade_goal: string;      // 등급목표
  materials: string;       // 교재/인강/현강
  study_strategy: string;  // 과목별 공부전략
  planner_check: string;   // 플래너 체크 (순공시간)
  // [Review & Feedback]
  last_progress: string;   // 지난주 학습진도
  review_habits: string;   // 복습&습관
  self_check: string;      // 자기점검 (Test)
  // [Action Plan]
  next_plan: string;       // 다음 주 계획
  focus_training: string;  // 집중훈련
};

// 탐구 과목은 과목명을 직접 입력
export type InquirySubjectContent = SubjectContent & {
  subject_name: string;    // e.g. "생윤", "사문", "지구과학"
};

export type CoachingContent = {
  // 상단 메타 정보
  admission_type: AdmissionType; // 입시 유형
  grade: string;                 // 성적
  // 과목별 데이터
  korean: SubjectContent;
  math: SubjectContent;
  english: SubjectContent;
  inquiry1: InquirySubjectContent;
  inquiry2: InquirySubjectContent;
};

export type CoachingRecord = {
  id: string;
  student_id: string;
  mentor_id: string;
  date: string;
  content: CoachingContent;
  created_at: string;
};

// 빈 과목 데이터 기본값
export const EMPTY_SUBJECT: SubjectContent = {
  grade_goal: "",
  materials: "",
  study_strategy: "",
  planner_check: "",
  last_progress: "",
  review_habits: "",
  self_check: "",
  next_plan: "",
  focus_training: "",
};

export const EMPTY_INQUIRY: InquirySubjectContent = {
  ...EMPTY_SUBJECT,
  subject_name: "",
};

export const EMPTY_CONTENT: CoachingContent = {
  admission_type: "",
  grade: "",
  korean: { ...EMPTY_SUBJECT },
  math: { ...EMPTY_SUBJECT },
  english: { ...EMPTY_SUBJECT },
  inquiry1: { ...EMPTY_INQUIRY },
  inquiry2: { ...EMPTY_INQUIRY },
};

// ── Supabase Database 타입 ────────────────────────────────
// Supabase CLI 생성 형식 준수 (GenericSchema 호환)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: [];
      };
      students: {
        Row: Student;
        Insert: Omit<Student, "id" | "created_at" | "status"> & { status?: StudentStatus };
        Update: Partial<Omit<Student, "id" | "created_at">>;
        Relationships: [];
      };
      student_mentor_relations: {
        Row: StudentMentorRelation;
        Insert: Omit<StudentMentorRelation, "id" | "created_at" | "day_of_week" | "slot"> & { day_of_week?: DayOfWeek | null; slot?: number | null };
        Update: Partial<Omit<StudentMentorRelation, "id" | "created_at">>;
        Relationships: [];
      };
      mentor_availability: {
        Row: MentorAvailability;
        Insert: Omit<MentorAvailability, "id" | "created_at">;
        Update: Partial<Omit<MentorAvailability, "id" | "created_at">>;
        Relationships: [];
      };
      coaching_records: {
        Row: CoachingRecord;
        Insert: Omit<CoachingRecord, "id" | "created_at">;
        Update: Partial<Omit<CoachingRecord, "id" | "created_at">>;
        Relationships: [];
      };
      monthly_reports: {
        Row: MonthlyReport;
        Insert: Omit<MonthlyReport, "id" | "created_at" | "analysis_type"> & { analysis_type?: AnalysisType };
        Update: Partial<Omit<MonthlyReport, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role: "admin" | "mentor";
    };
    CompositeTypes: Record<string, never>;
  };
};
