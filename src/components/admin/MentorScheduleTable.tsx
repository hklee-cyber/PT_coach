import Link from "next/link";
import { DayOfWeek, SLOTS } from "@/lib/schedule";

export interface MentorDaySchedule {
  mentorId: string;
  mentorName: string;
  /** slot(1~6) → 배정된 학생 이름 목록 */
  periods: Record<number, string[]>;
}

export interface DayScheduleData {
  day: DayOfWeek;
  mentors: MentorDaySchedule[];
  totalMentors: number;
  totalStudents: number;
}

interface Props {
  scheduleByDay: DayScheduleData[];
}

// 요일별 컬러 팔레트
const DAY_COLORS: Record<string, {
  dayBg: string;
  dayText: string;
  daySubText: string;
  dayBorder: string;
  badgeBg: string;
  badgeText: string;
  rowHover: string;
  rowBorderBottom: string;
}> = {
  "월": {
    dayBg:          "bg-blue-50",
    dayText:        "text-blue-800",
    daySubText:     "text-blue-400",
    dayBorder:      "border-blue-200",
    badgeBg:        "bg-blue-100",
    badgeText:      "text-blue-700",
    rowHover:       "hover:bg-blue-50/40",
    rowBorderBottom:"border-blue-100",
  },
  "화": {
    dayBg:          "bg-emerald-50",
    dayText:        "text-emerald-800",
    daySubText:     "text-emerald-400",
    dayBorder:      "border-emerald-200",
    badgeBg:        "bg-emerald-100",
    badgeText:      "text-emerald-700",
    rowHover:       "hover:bg-emerald-50/40",
    rowBorderBottom:"border-emerald-100",
  },
  "수": {
    dayBg:          "bg-amber-50",
    dayText:        "text-amber-800",
    daySubText:     "text-amber-400",
    dayBorder:      "border-amber-200",
    badgeBg:        "bg-amber-100",
    badgeText:      "text-amber-700",
    rowHover:       "hover:bg-amber-50/40",
    rowBorderBottom:"border-amber-100",
  },
  "목": {
    dayBg:          "bg-violet-50",
    dayText:        "text-violet-800",
    daySubText:     "text-violet-400",
    dayBorder:      "border-violet-200",
    badgeBg:        "bg-violet-100",
    badgeText:      "text-violet-700",
    rowHover:       "hover:bg-violet-50/40",
    rowBorderBottom:"border-violet-100",
  },
  "금": {
    dayBg:          "bg-rose-50",
    dayText:        "text-rose-800",
    daySubText:     "text-rose-400",
    dayBorder:      "border-rose-200",
    badgeBg:        "bg-rose-100",
    badgeText:      "text-rose-700",
    rowHover:       "hover:bg-rose-50/40",
    rowBorderBottom:"border-rose-100",
  },
  "토": {
    dayBg:          "bg-cyan-50",
    dayText:        "text-cyan-800",
    daySubText:     "text-cyan-400",
    dayBorder:      "border-cyan-200",
    badgeBg:        "bg-cyan-100",
    badgeText:      "text-cyan-700",
    rowHover:       "hover:bg-cyan-50/40",
    rowBorderBottom:"border-cyan-100",
  },
};

const DEFAULT_COLOR = {
  dayBg:          "bg-gray-50",
  dayText:        "text-gray-700",
  daySubText:     "text-gray-400",
  dayBorder:      "border-gray-200",
  badgeBg:        "bg-gray-100",
  badgeText:      "text-gray-700",
  rowHover:       "hover:bg-gray-50/40",
  rowBorderBottom:"border-gray-100",
};

function getDayKey(day: string) {
  return day.replace("요일", "").trim();
}

/** 학생 이름 pill badge */
function StudentBadge({ name, colors }: { name: string; colors: typeof DEFAULT_COLOR }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md ${colors.badgeBg} ${colors.badgeText} text-[11px] font-medium leading-tight whitespace-nowrap`}>
      {name}
    </span>
  );
}

/** 교시 셀 내용 */
function PeriodCell({ students, colors }: { students: string[]; colors: typeof DEFAULT_COLOR }) {
  if (students.length === 0) {
    return <span className="text-gray-300 text-sm select-none">—</span>;
  }
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {students.map((name, i) => (
        <StudentBadge key={i} name={name} colors={colors} />
      ))}
    </div>
  );
}

export default function MentorScheduleTable({ scheduleByDay }: Props) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-gray-700">요일별/교시별 배정 현황</h3>

      {/* 모바일: 가로 스크롤 / PC: 표 형태 */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[780px] w-full text-sm border-collapse">

          {/* ── 헤더 ──────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-gray-200">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 w-[120px] border-r border-gray-200">
                요일
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 w-[90px] border-r border-gray-200">
                멘토
              </th>
              {SLOTS.map((s) => (
                <th
                  key={s.slot}
                  className="text-center px-3 py-2.5 border-r border-gray-200 last:border-r-0"
                >
                  <div className="text-xs font-bold text-slate-600">{s.slot}교시</div>
                  <div className="text-[11px] font-normal text-slate-400 mt-0.5">{s.startTime}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── 바디 ──────────────────────────────────────────────── */}
          <tbody>
            {scheduleByDay.map(({ day, mentors, totalMentors, totalStudents }, dayIdx) => {
              const isLastDay = dayIdx === scheduleByDay.length - 1;
              const dayKey = getDayKey(day);
              const colors = DAY_COLORS[dayKey] ?? DEFAULT_COLOR;

              if (mentors.length === 0) {
                return (
                  <tr
                    key={day}
                    className={`${!isLastDay ? `border-b-2 ${colors.dayBorder}` : ""}`}
                  >
                    <td className={`px-5 py-2.5 ${colors.dayBg} align-middle border-r ${colors.dayBorder} whitespace-nowrap`}>
                      <div className={`font-bold text-sm ${colors.dayText}`}>{day}</div>
                      <div className={`text-[11px] mt-0.5 ${colors.daySubText}`}>배정 없음</div>
                    </td>
                    <td
                      colSpan={7}
                      className="px-5 py-2.5 text-gray-400 text-xs text-center"
                    >
                      해당 요일에 배정 없음
                    </td>
                  </tr>
                );
              }

              return mentors.map((mentor, idx) => {
                const isLastRowOfDay = idx === mentors.length - 1;
                const rowBorder = isLastRowOfDay && !isLastDay
                  ? `border-b-2 ${colors.dayBorder}`
                  : !isLastRowOfDay
                  ? `border-b ${colors.rowBorderBottom}`
                  : "";

                return (
                  <tr
                    key={`${day}-${mentor.mentorId}`}
                    className={`${rowBorder} ${colors.rowHover} transition-colors`}
                  >
                    {/* 요일 셀: 같은 요일끼리 rowspan */}
                    {idx === 0 && (
                      <td
                        rowSpan={mentors.length}
                        className={`px-5 py-2.5 ${colors.dayBg} align-middle border-r ${colors.dayBorder} whitespace-nowrap`}
                      >
                        <div className={`font-bold text-sm ${colors.dayText}`}>{day}</div>
                        <div className={`text-[11px] font-normal mt-1 whitespace-nowrap ${colors.daySubText}`}>
                          멘토 {totalMentors}명 · 학생 {totalStudents}명
                        </div>
                      </td>
                    )}

                    {/* 멘토 이름 */}
                    <td className="px-4 py-2 align-middle border-r border-gray-200 whitespace-nowrap">
                      <Link
                        href={`/admin/mentors/${mentor.mentorId}`}
                        className={`font-bold hover:underline underline-offset-2 transition-colors ${colors.dayText}`}
                      >
                        {mentor.mentorName}
                      </Link>
                    </td>

                    {/* 1~6교시 셀 */}
                    {([1, 2, 3, 4, 5, 6] as const).map((slot) => (
                      <td
                        key={slot}
                        className="px-3 py-2 text-center align-middle border-r border-gray-100 last:border-r-0"
                      >
                        <PeriodCell students={mentor.periods[slot] ?? []} colors={colors} />
                      </td>
                    ))}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
