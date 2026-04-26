# 프로젝트 정의서: NIMS PT 코칭 모듈 (AI-Driven Academy Management System)

## 1. 프로젝트 개요
- **서비스명:** 뉴퍼센트 학원 관리 시스템 (NIMS) - PT 코칭 모듈
- **목적:** 기존 워드(Word) 기반의 주간 PT 코칭 프로세스를 디지털화하고, 축적된 데이터를 기반으로 AI 전략 보고서를 자동 생성함.
- **핵심 가치:** 멘토의 입력 편의성 극대화, 데이터 기반의 정교한 코칭, 학부모 신뢰도 향상.

## 2. 기술 스택 (Technical Stack)
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS, Shadcn UI
- **Database/Auth:** Supabase (PostgreSQL, Auth, Storage)
- **AI Engine:** Gemini-flash-latest
- **PDF Export:** react-pdf 또는 jspdf

## 3. 사용자 권한 및 워크플로우 (RBAC)
### [Role: Admin (관리자)]
1. **로그인:** 시스템 전체 권한 보유.
2. **멘토 관리:** 멘토 선생님 추가 및 삭제 기능.
3. **학생 관리:** 모든 멘토의 학생 리스트 열람 및 관리.
4. **AI 전략 보고서:** 특정 학생 선택 시 누적된 `pt_logs`를 기반으로 AI 리포트 생성, 내용 수정 및 PDF 저장.

### [Role: Mentor (멘토)]
1. **로그인:** 본인 인증 후 입장.
2. **본인 확인:** 멘토 리스트에서 본인 선택 시 담당 학생 리스트 노출.
3. **학생 관리:** 담당 학생 추가 및 삭제 기능.
4. **PT 코칭 입력:** - 주간 학습 전략, 진도, 테스트 결과 입력.
   - **[이전 자료 불러오기]** 버튼을 통해 직전 회차 기록을 현재 폼으로 자동 로드.

## 4. 데이터베이스 스키마 (Database Schema)
### `profiles`
- `id`: uuid (PK, auth.users 연결)
- `role`: text (admin | mentor)
- `full_name`: text

### `students`
- `id`: uuid (PK)
- `name`: text
- `target_university`: text
- `mentor_id`: uuid (FK, profiles.id 연결)

### `pt_logs` (주간 코칭 데이터)
- `id`: uuid (PK)
- `student_id`: uuid (FK)
- `mentor_id`: uuid (FK)
- `date`: date (기본값: 오늘)
- `data`: jsonb (국어, 수학, 영어, 탐구 각 과목별 전략/진도/테스트 점수 포함)
- `created_at`: timestamp

## 5. UI/UX 요구사항
- **계층형 구조:** [로그인] -> [멘토 선택] -> [학생 선택] -> [코칭 입력/보고서 생성]
- **입력 양식:** 기존 워드 표의 레이아웃(국/수/영/탐구 섹션 구분)을 웹 폼으로 재현.
- **보고서 뷰어:** AI가 생성한 텍스트를 관리자가 편집할 수 있는 인터페이스 제공.

## 6. Claude Code 실행 가이드 (Prompting)
1. "이 `claude.md` 파일을 읽고, 먼저 데이터베이스 설계를 위해 Supabase용 SQL Migration 파일을 작성해줘."
2. "Next.js에서 사용자의 Role(Admin/Mentor)에 따라 접근 가능한 페이지를 제어하는 미들웨어를 구현해줘."
3. "학생 상세 페이지에서 '직전 주차 데이터 불러오기' 기능을 구현하고, 입력 폼을 사진(워드 양식)과 유사하게 디자인해줘."
4. "관리자 전용 페이지에서 Gemini API를 사용하여 `pt_logs` 히스토리를 요약하고 전략 보고서 초안을 만드는 서버 액션을 작성해줘."
5. "최종 승인된 보고서를 PDF로 변환하여 다운로드하는 기능을 구현해줘."