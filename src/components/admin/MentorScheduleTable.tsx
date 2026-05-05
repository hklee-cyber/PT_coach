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

/** 학생 이름 pill badge */
function StudentBadge({ name }: { name: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium leading-tight whitespace-nowrap">
      {name}
    </span>
  );
}

/** 교시 셀 내용 */
function PeriodCell({ students }: { students: string[] }) {
  if (students.length === 0) {
    return <span className="text-gray-300 text-sm select-none">—</span>;
  }
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {students.map((name, i) => (
        <StudentBadge key={i} name={name} />
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
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 w-[120px] border-r border-gray-200">
                요일
              </th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 w-[90px] border-r border-gray-200">
                멘토
              </th>
              {SLOTS.map((s) => (
                <th
                  key={s.slot}
                  className="text-center px-3 py-3.5 border-r border-gray-200 last:border-r-0"
                >
                  <div className="text-xs font-bold text-gray-600">{s.slot}교시</div>
                  <div className="text-[11px] font-normal text-gray-400 mt-0.5">{s.startTime}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── 바디 ──────────────────────────────────────────────── */}
          <tbody>
            {scheduleByDay.map(({ day, mentors, totalMentors, totalStudents }, dayIdx) => {
              const isLastDay = dayIdx === scheduleByDay.length - 1;

              if (mentors.length === 0) {
                return (
                  <tr
                    key={day}
                    className={`${!isLastDay ? "border-b-2 border-gray-200" : ""}`}
                  >
                    <td className="px-5 py-4 bg-gray-50/80 align-middle border-r border-gray-200 whitespace-nowrap">
                      <div className="font-bold text-gray-700 text-sm">{day}요일</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">배정 없음</div>
                    </td>
                    <td
                      colSpan={7}
                      className="px-5 py-4 text-gray-400 text-xs text-center"
                    >
                      해당 요일에 배정 없음
                    </td>
                  </tr>
                );
              }

              return mentors.map((mentor, idx) => {
                const isLastRowOfDay = idx === mentors.length - 1;
                const rowBorder = isLastRowOfDay && !isLastDay
                  ? "border-b-2 border-gray-200"
                  : !isLastRowOfDay
                  ? "border-b border-gray-100"
                  : "";

                return (
                  <tr
                    key={`${day}-${mentor.mentorId}`}
                    className={`${rowBorder} hover:bg-blue-50/30 transition-colors`}
                  >
                    {/* 요일 셀: 같은 요일끼리 rowspan */}
                    {idx === 0 && (
                      <td
                        rowSpan={mentors.length}
                        className="px-5 py-4 bg-gray-50/80 align-middle border-r border-gray-200 whitespace-nowrap"
                      >
                        <div className="font-bold text-gray-800 text-sm">{day}요일</div>
                        <div className="text-[11px] text-gray-400 font-normal mt-1 whitespace-nowrap">
                          멘토 {totalMentors}명 · 학생 {totalStudents}명
                        </div>
                      </td>
                    )}

                    {/* 멘토 이름 */}
                    <td className="px-4 py-4 align-middle border-r border-gray-200 whitespace-nowrap">
                      <Link
                        href={`/admin/mentors/${mentor.mentorId}`}
                        className="font-bold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {mentor.mentorName}
                      </Link>
                    </td>

                    {/* 1~6교시 셀 */}
                    {([1, 2, 3, 4, 5, 6] as const).map((slot) => (
                      <td
                        key={slot}
                        className="px-3 py-4 text-center align-middle border-r border-gray-100 last:border-r-0"
                      >
                        <PeriodCell students={mentor.periods[slot] ?? []} />
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
