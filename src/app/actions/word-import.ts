"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { EMPTY_CONTENT, type CoachingContent } from "@/types/database";

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────
type SubjectKey = "korean" | "math" | "english" | "inquiry1" | "inquiry2";
type FieldKey =
  | "grade_goal"    | "materials"     | "study_strategy" | "planner_check"
  | "last_progress" | "review_habits" | "self_check"      | "next_plan"
  | "focus_training";

// ─────────────────────────────────────────────────────────────────────────────
// 키워드 패턴
// ─────────────────────────────────────────────────────────────────────────────
const FIXED_SUBJECTS: Array<{ re: RegExp; key: SubjectKey }> = [
  { re: /국어/, key: "korean"  },
  { re: /수학/, key: "math"    },
  { re: /영어/, key: "english" },
];

const FIELD_PATTERNS: Array<{ re: RegExp; key: FieldKey }> = [
  { re: /등급.{0,4}목표|목표.{0,4}등급/,        key: "grade_goal"      },
  { re: /교재|인강|현강/,                        key: "materials"       },
  { re: /공부.{0,4}전략|학습.{0,4}전략|과목별/,  key: "study_strategy"  },
  { re: /플래너|순공/,                           key: "planner_check"   },
  { re: /지난.{0,6}진도/,                        key: "last_progress"   },
  { re: /복습.{0,4}습관/,                        key: "review_habits"   },
  { re: /자기.{0,4}점검|[Tt]est|테스트/,         key: "self_check"      },
  { re: /다음.{0,6}계획/,                        key: "next_plan"       },
  { re: /집중.{0,4}훈련/,                        key: "focus_training"  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 항목명 Allowlist (25자 이하 + 목록 일치 → 제거, 나머지는 절대 삭제 안 함)
// ─────────────────────────────────────────────────────────────────────────────
const LABEL_ALLOWLIST = new Set([
  "등급목표","등급 목표","목표등급","목표 등급",
  "교재","교재/인강","교재/인강/현강","교재·인강·현강","교재 / 인강 / 현강",
  "공부전략","학습전략","과목별공부전략","과목별 공부전략","과목별학습전략","과목별 학습전략",
  "플래너","플래너체크","플래너 체크","순공","순공시간",
  "지난진도","지난주진도","지난주 진도","지난주학습진도","지난주 학습진도",
  "복습","복습습관","복습&습관","복습 & 습관",
  "자기점검","자기 점검","test","테스트",
  "다음주계획","다음주 계획","다음 주 계획","다음주플랜",
  "집중훈련","집중 훈련",
]);

/** 셀 텍스트 정제 — 첫 줄이 단독 항목명이면 제거, 나머지 전량 보존 */
function cleanCell(raw: string): string {
  if (!raw.trim()) return "";
  const lines = raw.split("\n");
  if (lines.length > 1) {
    const first = lines[0].trim();
    if (
      first.length <= 25 &&
      (LABEL_ALLOWLIST.has(first) || LABEL_ALLOWLIST.has(first.toLowerCase()))
    ) {
      const rest = lines.slice(1).join("\n").trim();
      return rest || raw.trim(); // 정제 후 비면 원본 fallback
    }
  }
  return raw.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML → 2D 그리드 (colspan 보정 포함)
// ─────────────────────────────────────────────────────────────────────────────
function cellHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseTableToGrid(tableHtml: string): string[][] {
  // grid[rowIdx][colIdx] = text (undefined = not yet filled)
  const cells: (string | undefined)[][] = [];
  // rowspan carryover: colIndex → { text, remaining rows }
  const rowspanPending = new Map<number, { text: string; remaining: number }>();

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM;
  let rowIdx = 0;

  while ((rowM = rowRe.exec(tableHtml)) !== null) {
    if (!cells[rowIdx]) cells[rowIdx] = [];

    // Pre-fill columns carried over from rowspan in previous rows
    for (const [ci, p] of Array.from(rowspanPending.entries())) {
      cells[rowIdx][ci] = p.text;
      p.remaining--;
      if (p.remaining <= 0) rowspanPending.delete(ci);
    }

    // Find next unfilled column position (skipping rowspan-filled slots)
    const nextFreeCol = (startFrom: number): number => {
      let c = startFrom;
      while (cells[rowIdx][c] !== undefined) c++;
      return c;
    };

    const cellRe = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi;
    let cellM;
    let curCol = 0;

    while ((cellM = cellRe.exec(rowM[1])) !== null) {
      const text    = cellHtmlToText(cellM[2]);
      const csMatch = cellM[1].match(/colspan\s*=\s*["']?(\d+)["']?/i);
      const rsMatch = cellM[1].match(/rowspan\s*=\s*["']?(\d+)["']?/i);
      const cs = csMatch ? parseInt(csMatch[1]) : 1;
      const rs = rsMatch ? parseInt(rsMatch[1]) : 1;

      curCol = nextFreeCol(curCol);
      for (let i = 0; i < cs; i++) {
        cells[rowIdx][curCol + i] = text;
        if (rs > 1) rowspanPending.set(curCol + i, { text, remaining: rs - 1 });
      }
      curCol += cs;
    }

    rowIdx++;
  }

  // Normalize to string[][] and drop fully empty rows
  return cells
    .filter(row => row && row.some(c => c?.trim()))
    .map(row => {
      const len = row.length;
      const out: string[] = [];
      for (let i = 0; i < len; i++) out.push(row[i] ?? "");
      return out;
    });
}

function extractTablesWithContext(html: string): Array<{ grid: string[][]; ctx: string }> {
  const out: Array<{ grid: string[][]; ctx: string }> = [];
  const segs = html.split(/(<table[\s\S]*?<\/table>)/gi);
  let prevText = "";
  for (const seg of segs) {
    if (/^<table/i.test(seg)) {
      out.push({
        grid: parseTableToGrid(seg),
        ctx: prevText.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
                     .replace(/[ \t]+/g, " ").trim(),
      });
      prevText = "";
    } else {
      prevText += " " + seg;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 날짜 파싱 (코드 전용)
// ─────────────────────────────────────────────────────────────────────────────
function parseDate(text: string, todayYear: number): string {
  // YY/MM/DD  예) 26/04/09 → 2026-04-09
  const yy = text.match(/(?<!\d)(\d{2})\/(\d{2})\/(\d{2})(?!\d)/);
  if (yy) return `${2000 + parseInt(yy[1])}-${yy[2]}-${yy[3]}`;
  const ymd = text.match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const ko = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (ko) return `${todayYear}-${ko[1].padStart(2,"0")}-${ko[2].padStart(2,"0")}`;
  const md = text.match(/(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (md) {
    const m = parseInt(md[1]), d = parseInt(md[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31)
      return `${todayYear}-${md[1].padStart(2,"0")}-${md[2].padStart(2,"0")}`;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ 핵심: 2단계 좌표 분석
//   1단계: 헤더 행에서 국어/수학/영어 열 인덱스를 직접 탐지
//   2단계: 탐지된 과목 열의 앞쪽 = 라벨 열, 뒤쪽 = 탐구 열
// ─────────────────────────────────────────────────────────────────────────────
interface ColAnalysis {
  labelCols : number[];                                          // 항목명 열 인덱스들
  subjectMap: Map<number, { key: SubjectKey; name: string }>;   // 과목 열 인덱스 → 과목
}

function analyzeHeaderRow(headerRow: string[]): ColAnalysis {
  // 1단계: 고정 과목(국어/수학/영어) 열 인덱스 전체 탐지
  const fixedMap = new Map<number, { key: SubjectKey; name: string }>();
  for (let ci = 0; ci < headerRow.length; ci++) {
    const cell = headerRow[ci].trim();
    const fixed = FIXED_SUBJECTS.find(({ re }) => re.test(cell));
    if (fixed) fixedMap.set(ci, { key: fixed.key, name: cell });
  }

  if (fixedMap.size === 0) return { labelCols: [], subjectMap: new Map() };

  const allSubjectCols = Array.from(fixedMap.keys());
  const firstSubjectCol = Math.min(...allSubjectCols);
  const lastSubjectCol  = Math.max(...allSubjectCols);

  // 2단계: 과목 열 앞 = 라벨 열
  const labelCols: number[] = [];
  for (let ci = 0; ci < firstSubjectCol; ci++) labelCols.push(ci);

  // 3단계: 과목별 첫 번째 열만 등록 (colspan 중복 열 제거)
  const subjectMap = new Map<number, { key: SubjectKey; name: string }>();
  const seenKeys = new Set<SubjectKey>();
  for (let ci = firstSubjectCol; ci <= lastSubjectCol; ci++) {
    const entry = fixedMap.get(ci);
    if (entry && !seenKeys.has(entry.key)) {
      seenKeys.add(entry.key);
      subjectMap.set(ci, entry);
    }
  }

  // 4단계: 탐구 열 (과목 열 뒤, 이름 중복 제거로 첫 출현만)
  let inquiryCount = 0;
  const seenInquiryNames = new Set<string>();
  for (let ci = lastSubjectCol + 1; ci < headerRow.length; ci++) {
    const cell = headerRow[ci].trim();
    if (cell && inquiryCount < 2 && !seenInquiryNames.has(cell)) {
      seenInquiryNames.add(cell);
      inquiryCount++;
      subjectMap.set(ci, { key: `inquiry${inquiryCount}` as SubjectKey, name: cell });
    }
  }

  return { labelCols, subjectMap };
}

// ─────────────────────────────────────────────────────────────────────────────
// 헤더 행 탐색 (과목 2개 이상 포함된 행)
// ─────────────────────────────────────────────────────────────────────────────
function findHeaderIdx(grid: string[][]): number {
  for (let ri = 0; ri < Math.min(grid.length, 6); ri++) {
    const cnt = grid[ri].filter(c => FIXED_SUBJECTS.some(({ re }) => re.test(c))).length;
    if (cnt >= 2) return ri;
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// 유효 테이블 판별
// ─────────────────────────────────────────────────────────────────────────────
function isValidTable(grid: string[][]): boolean {
  if (grid.flat().join("").replace(/\s/g, "").length < 30) return false;
  const hIdx = findHeaderIdx(grid);
  if (hIdx === -1) return false;
  return (grid.length - hIdx - 1) >= 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// 행에서 FieldKey 탐지
//
//   핵심 원칙: 가장 안쪽(데이터에 가까운) 라벨 열을 먼저 탐색한다.
//   col0 = 섹션 헤더(학습전략, Review&Feedback…) rowspan 유지값이고
//   col1 = 실제 행 라벨(등급목표, 교재/인강/현강…)이므로
//   [0,1] 순서 대신 [1,0] 역순으로 탐색해야 오탐을 막을 수 있음.
//
//   Pass 1: 라벨 열 역순 — 줄 단위
//   Pass 2: 라벨 열 역순 — 줄바꿈→공백 합산 (예: "지난주\n학습진도" 처리)
//   Pass 3: 데이터(과목) 열 + 이미 탐색한 라벨 열 제외, 나머지 전체
//   ※ 데이터 셀은 절대 검색 안 함 (내용에 '인강' 등 키워드로 오탐 방지)
// ─────────────────────────────────────────────────────────────────────────────
function detectField(
  row: string[],
  labelCols: number[],
  subjectColSet: Set<number>
): FieldKey | null {
  // 안쪽 라벨 열(행 특정 라벨)을 섹션 헤더보다 우선하기 위해 역순으로
  const reversed = [...labelCols].reverse();
  const labelColSet = new Set(labelCols);

  // Pass 1: 라벨 열 역순 — 줄 단위
  for (const ci of reversed) {
    if (ci >= row.length) continue;
    for (const line of row[ci].split("\n")) {
      for (const { re, key } of FIELD_PATTERNS)
        if (re.test(line.trim())) return key;
    }
  }

  // Pass 2: 라벨 열 역순 — 줄바꿈→공백 합산 (다줄 라벨 처리)
  for (const ci of reversed) {
    if (ci >= row.length) continue;
    const merged = row[ci].replace(/\n/g, " ").trim();
    for (const { re, key } of FIELD_PATTERNS)
      if (re.test(merged)) return key;
  }

  // Pass 3: 데이터 열·라벨 열 제외한 나머지 열만 (줄 단위 + 합산)
  for (let ci = 0; ci < row.length; ci++) {
    if (subjectColSet.has(ci)) continue;  // 데이터 열 건너뜀
    if (labelColSet.has(ci)) continue;    // 이미 검색한 라벨 열 건너뜀
    const cell = row[ci];
    for (const line of cell.split("\n")) {
      for (const { re, key } of FIELD_PATTERNS)
        if (re.test(line.trim())) return key;
    }
    const merged = cell.replace(/\n/g, " ").trim();
    for (const { re, key } of FIELD_PATTERNS)
      if (re.test(merged)) return key;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 표 1개 → 좌표 기반 추출 + 상세 로그
// ─────────────────────────────────────────────────────────────────────────────
function extractFromGrid(
  grid: string[][],
  ctx: string,
  today: string,
  todayYear: number,
  tableNo: number
): {
  date: string;
  admission_type: "" | "정시" | "수시";
  subjectData: Map<SubjectKey, Map<FieldKey, string>>;
  subjectNames: Partial<Record<SubjectKey, string>>;
} | null {
  const headerIdx = findHeaderIdx(grid);
  if (headerIdx === -1) {
    console.log(`[표${tableNo}] 헤더 행 없음 → 스킵`);
    return null;
  }

  const headerRow = grid[headerIdx];
  const { labelCols, subjectMap } = analyzeHeaderRow(headerRow);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[표${tableNo}] 헤더(row${headerIdx}): ${JSON.stringify(headerRow)}`);
  console.log(`[표${tableNo}] 라벨 열: [${labelCols.join(",")}]`);
  subjectMap.forEach(({ key, name }, ci) =>
    console.log(`[표${tableNo}] col${ci} "${name}" → ${key}`)
  );

  if (subjectMap.size === 0) {
    console.log(`[표${tableNo}] 과목 매핑 없음 → 스킵`);
    return null;
  }

  // 날짜 — 헤더 행 위 rows(메타 정보)에서 먼저 탐색, 없으면 ctx, 없으면 전체
  const metaText = grid.slice(0, headerIdx).flat().join(" ");
  const allText  = ctx + " " + grid.flat().join(" ");
  const date = parseDate(ctx, todayYear)
            || parseDate(metaText, todayYear)
            || parseDate(allText, todayYear)
            || today;
  const admission_type: "" | "정시" | "수시" =
    /정시/.test(allText) ? "정시" : /수시/.test(allText) ? "수시" : "";
  console.log(`[표${tableNo}] 날짜=${date}  입시=${admission_type || "없음"}`);

  // 탐구 과목명
  const subjectNames: Partial<Record<SubjectKey, string>> = {};
  subjectMap.forEach(({ key, name }) => {
    if (key === "inquiry1" || key === "inquiry2") subjectNames[key] = name;
  });

  // 데이터 초기화
  const subjectData = new Map<SubjectKey, Map<FieldKey, string>>();
  subjectMap.forEach(({ key }) => subjectData.set(key, new Map()));

  // 과목 열 인덱스 Set (detectField에서 데이터 셀 오탐 방지용)
  const subjectColSet = new Set<number>(subjectMap.keys());

  // 과목별 열 범위 계산 (startCol → endCol inclusive)
  // 예: 탐구2 col10, 헤더에서 col10·col11 모두 "탐구2" → spanEnd=11
  const subjectColsSorted = Array.from(subjectMap.keys()).sort((a, b) => a - b);
  const subjectSpanEnd = new Map<number, number>();
  for (let i = 0; i < subjectColsSorted.length; i++) {
    const startCol  = subjectColsSorted[i];
    const nextStart = subjectColsSorted[i + 1] ?? headerRow.length;
    // 헤더에서 같은 텍스트가 이어지는 마지막 열까지 span으로 인정
    let end = startCol;
    for (let c = startCol + 1; c < nextStart; c++) {
      if (headerRow[c]?.trim() === headerRow[startCol]?.trim()) end = c;
      else break;
    }
    subjectSpanEnd.set(startCol, end);
  }

  // 데이터 행 순회
  for (let ri = headerIdx + 1; ri < grid.length; ri++) {
    const row = grid[ri];
    if (!row?.length) continue;

    const fieldKey = detectField(row, labelCols, subjectColSet);
    if (!fieldKey) {
      console.log(`[표${tableNo}] row${ri} fieldKey 없음 → 스킵 ("${row[0]?.substring(0,20)}")`);
      continue;
    }

    subjectMap.forEach(({ key: subjKey }, ci) => {
      const spanEnd = subjectSpanEnd.get(ci) ?? ci;

      // 과목 열 범위 내 모든 셀을 수집 — colspan 확장으로 중복된 값은 제거
      const parts: string[] = [];
      for (let c = ci; c <= spanEnd && c < row.length; c++) {
        const v = cleanCell(row[c]) || row[c].trim();
        if (v && (parts.length === 0 || v !== parts[parts.length - 1])) {
          parts.push(v);
        }
      }
      const val = parts.join(" ");   // 분리된 셀 내용을 공백으로 이어붙임

      if (val) subjectData.get(subjKey)!.set(fieldKey, val);

      console.log(
        `[표${tableNo}] 좌표 [row${ri}, col${ci}~${spanEnd}] → ${subjKey}/${fieldKey}\n` +
        `          raw  : "${row.slice(ci, spanEnd + 1).join("|").substring(0,80).replace(/\n/g,"↵")}"\n` +
        `          value: "${val.substring(0,80).replace(/\n/g,"↵")}"`
      );
    });
  }

  return { date, admission_type, subjectData, subjectNames };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export async function parseWordContent(
  html: string,
  _studentId: string
): Promise<Array<{ content: CoachingContent; date: string }>> {
  if (!html.trim()) throw new Error("내용을 입력해주세요.");

  const todayDate = new Date();
  const today     = todayDate.toISOString().split("T")[0];
  const todayYear = todayDate.getFullYear();

  const all    = extractTablesWithContext(html);
  const valid  = all.filter(({ grid }) => isValidTable(grid));

  console.log(`\n[word-import] 전체 표=${all.length}  유효 표=${valid.length}`);
  if (valid.length === 0) throw new Error("파싱할 수 있는 표를 찾지 못했습니다.");

  const results: Array<{ content: CoachingContent; date: string }> = [];

  for (let i = 0; i < valid.length; i++) {
    const { grid, ctx } = valid[i];
    const extracted = extractFromGrid(grid, ctx, today, todayYear, i + 1);
    if (!extracted) continue;

    const { date, admission_type, subjectData, subjectNames } = extracted;

    const content: CoachingContent = JSON.parse(JSON.stringify(EMPTY_CONTENT));
    content.admission_type = admission_type;

    const FIELDS: FieldKey[] = [
      "grade_goal","materials","study_strategy","planner_check",
      "last_progress","review_habits","self_check","next_plan","focus_training",
    ];

    (["korean","math","english","inquiry1","inquiry2"] as SubjectKey[]).forEach(subj => {
      const src = subjectData.get(subj);
      FIELDS.forEach(f => {
        (content[subj] as unknown as Record<string, string>)[f] = src?.get(f) ?? "";
      });
      if (subj === "inquiry1" || subj === "inquiry2") {
        (content[subj] as unknown as Record<string, string>).subject_name = subjectNames[subj] ?? "";
      }
    });

    console.log(`\n[표${i+1}] 저장 → date=${date}`);
    results.push({ content, date });
  }

  if (results.length === 0) throw new Error("유효한 코칭 기록을 추출하지 못했습니다.");
  console.log(`\n[word-import] 최종 레코드=${results.length}개`);
  return results;
}

export async function saveImportedRecord(
  studentId: string,
  mentorId: string,
  date: string,
  content: CoachingContent
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("coaching_records").upsert(
    { student_id: studentId, mentor_id: mentorId, date, content },
    { onConflict: "student_id,date" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/mentor/students/${studentId}`);
  revalidatePath(`/admin/students/${studentId}`);
}

/** 파일만 파싱 (저장 없음) — 멘토 미리보기용 */
export async function parseWordFile(
  formData: FormData
): Promise<Array<{ content: CoachingContent; date: string }>> {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("파일이 없습니다.");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as {
    convertToHtml: (opt: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const { value: html } = await mammoth.convertToHtml({ buffer });
  if (!html.trim()) throw new Error("파일에서 내용을 추출할 수 없습니다.");

  return parseWordContent(html, "");
}

export async function importWordFile(
  formData: FormData,
  studentId: string,
  mentorId: string
): Promise<{ dates: string[] }> {
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("파일이 없습니다.");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as {
    convertToHtml: (opt: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const { value: html } = await mammoth.convertToHtml({ buffer });
  if (!html.trim()) throw new Error("파일에서 내용을 추출할 수 없습니다.");

  const records = await parseWordContent(html, studentId);
  const dates: string[] = [];
  for (const { content, date } of records) {
    await saveImportedRecord(studentId, mentorId, date, content);
    dates.push(date);
  }
  return { dates };
}

export async function getCoachingRecordsForExport(
  studentId: string
): Promise<{ id: string; date: string; content: CoachingContent }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaching_records")
    .select("id, date, content")
    .eq("student_id", studentId)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; date: string; content: CoachingContent }[];
}
