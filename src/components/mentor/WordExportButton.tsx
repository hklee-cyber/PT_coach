"use client";

import { useState } from "react";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  HeadingLevel,
  VerticalAlign,
} from "docx";
import type { CoachingContent, SubjectContent, InquirySubjectContent } from "@/types/database";

interface Props {
  record: { date: string; content: CoachingContent };
  studentName: string;
  mentorName: string;
}

// ── 데이터 정의 ──────────────────────────────────────────────
const FIELD_ROWS: { field: keyof SubjectContent; label: string; group: string }[] = [
  { field: "grade_goal",     label: "등급목표",          group: "학습 전략" },
  { field: "materials",      label: "교재/인강/현강",     group: "학습 전략" },
  { field: "study_strategy", label: "과목별 공부전략",    group: "학습 전략" },
  { field: "planner_check",  label: "플래너 체크(순공시간)", group: "학습 전략" },
  { field: "last_progress",  label: "지난주 학습진도",    group: "Review & Feedback" },
  { field: "review_habits",  label: "복습&습관",          group: "Review & Feedback" },
  { field: "self_check",     label: "자기점검(Test)",     group: "Review & Feedback" },
  { field: "next_plan",      label: "다음 주 계획",       group: "Action Plan" },
  { field: "focus_training", label: "집중훈련",           group: "Action Plan" },
];

const SUBJECTS = [
  { key: "korean",   label: "국어" },
  { key: "math",     label: "수학" },
  { key: "english",  label: "영어" },
  { key: "inquiry1", label: "탐구1" },
  { key: "inquiry2", label: "탐구2" },
] as const;

// ── 셀 헬퍼 ─────────────────────────────────────────────────
function headerCell(text: string, bgColor = "D0E4FF"): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 18, font: "맑은 고딕" })],
      alignment: AlignmentType.CENTER,
    })],
    shading: { type: ShadingType.CLEAR, fill: bgColor },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 10, type: WidthType.PERCENTAGE },
  });
}

function dataCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: text || "", size: 16, font: "맑은 고딕" })],
    })],
    verticalAlign: VerticalAlign.TOP,
    width: { size: 16, type: WidthType.PERCENTAGE },
  });
}

function labelCell(text: string, bgColor: string): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 16, font: "맑은 고딕" })],
      alignment: AlignmentType.CENTER,
    })],
    shading: { type: ShadingType.CLEAR, fill: bgColor },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 11, type: WidthType.PERCENTAGE },
  });
}

function groupCell(text: string, rowSpan: number, bgColor: string): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 17, font: "맑은 고딕" })],
      alignment: AlignmentType.CENTER,
    })],
    shading: { type: ShadingType.CLEAR, fill: bgColor },
    verticalAlign: VerticalAlign.CENTER,
    rowSpan,
    width: { size: 9, type: WidthType.PERCENTAGE },
  });
}

// ── 문서 생성 ─────────────────────────────────────────────────
async function buildDocx(
  record: { date: string; content: CoachingContent },
  studentName: string,
  mentorName: string
): Promise<Blob> {
  const { content, date } = record;

  // 탐구 과목명 반영
  const subjects = SUBJECTS.map((s) => {
    if (s.key === "inquiry1") {
      const name = (content.inquiry1 as InquirySubjectContent).subject_name;
      return { ...s, label: name ? `탐구1(${name})` : "탐구1" };
    }
    if (s.key === "inquiry2") {
      const name = (content.inquiry2 as InquirySubjectContent).subject_name;
      return { ...s, label: name ? `탐구2(${name})` : "탐구2" };
    }
    return s;
  });

  // ── 그룹별 색상 ─────────────────────────────────────────
  const GROUP_COLORS: Record<string, { group: string; row: string }> = {
    "학습 전략":          { group: "BDD7EE", row: "EBF3FB" },
    "Review & Feedback": { group: "C6EFCE", row: "EBF8EE" },
    "Action Plan":       { group: "FCE4D6", row: "FEF5F0" },
  };

  // ── 헤더 행 ─────────────────────────────────────────────
  const headerRow = new TableRow({
    children: [
      headerCell("구분"),
      headerCell("항목"),
      ...subjects.map((s) => headerCell(s.label)),
    ],
    tableHeader: true,
  });

  // ── 데이터 행 ─────────────────────────────────────────────
  const groups = [
    { name: "학습 전략", rows: FIELD_ROWS.filter((r) => r.group === "학습 전략") },
    { name: "Review & Feedback", rows: FIELD_ROWS.filter((r) => r.group === "Review & Feedback") },
    { name: "Action Plan", rows: FIELD_ROWS.filter((r) => r.group === "Action Plan") },
  ];

  const dataRows: TableRow[] = [];
  for (const group of groups) {
    const colors = GROUP_COLORS[group.name];
    group.rows.forEach((row, idx) => {
      const cells: TableCell[] = [];

      // 그룹 셀 (첫 행만)
      if (idx === 0) {
        cells.push(groupCell(group.name, group.rows.length, colors.group));
      }

      // 항목 셀
      cells.push(labelCell(row.label, colors.row));

      // 각 과목 데이터 셀
      for (const s of subjects) {
        const subj = content[s.key] as SubjectContent;
        const val = (subj[row.field] as string) ?? "";
        cells.push(dataCell(val));
      }

      dataRows.push(new TableRow({ children: cells }));
    });
  }

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:           { style: BorderStyle.SINGLE, size: 4 },
      bottom:        { style: BorderStyle.SINGLE, size: 4 },
      left:          { style: BorderStyle.SINGLE, size: 4 },
      right:         { style: BorderStyle.SINGLE, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2 },
      insideVertical:   { style: BorderStyle.SINGLE, size: 2 },
    },
  });

  const infoItems: string[] = [
    `학생: ${studentName}`,
    `담당 멘토: ${mentorName}`,
    `코칭 일시: ${date}`,
  ];
  if (content.admission_type) infoItems.push(`입시유형: ${content.admission_type}`);
  if (content.grade) infoItems.push(`성적: ${content.grade}`);

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 16838, height: 11906 }, // A4 landscape (EMU ×1 = 1/914400 inch; docx uses twentieths of a point × 20)
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: "NEW PERCENT SPARTA 코칭 리포트", bold: true, size: 32, font: "맑은 고딕" })],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
        }),
        new Paragraph({
          children: [new TextRun({ text: infoItems.join("   |   "), size: 20, font: "맑은 고딕" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6 } },
        }),
        table,
      ],
    }],
  });

  return Packer.toBlob(doc);
}

// ── 컴포넌트 ─────────────────────────────────────────────────
export default function WordExportButton({ record, studentName, mentorName }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const blob = await buildDocx(record, studentName, mentorName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `코칭리포트_${studentName}_${record.date}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition active:scale-95"
      title="Word 파일로 내보내기"
    >
      {loading ? (
        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      )}
      Word
    </button>
  );
}
