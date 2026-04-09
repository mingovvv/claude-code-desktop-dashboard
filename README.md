# Claude Code Desktop Dashboard

Claude Code 사용 로그를 로컬에서 수집해서 데스크톱 앱 형태로 보여주는 Electron 기반 대시보드입니다.  
사용자의 `~/.claude/projects` 데이터를 읽어서 비용, 세션, 프로젝트별 사용량, 실시간 활동 현황을 한 화면에서 확인할 수 있습니다.

## 개요

- Electron + React + Vite 기반 데스크톱 앱
- Claude Code 로컬 사용 데이터를 자동 집계
- 월 비용, 총 비용, 세션 수, 활성 세션 상태 확인
- 프로젝트별 / 세션별 / 날짜별 사용량 분석
- 트레이 상주 및 자동 갱신 지원
- Windows/macOS 릴리즈 자동 배포 지원

## 주요 화면

- `개요`
  전체 비용, 세션 수, 최근 추이 등 핵심 지표 요약
- `라이브`
  현재 활성 세션과 idle 상태 확인
- `세션`
  세션 단위 사용 내역 탐색
- `프로젝트`
  프로젝트별 누적 사용량 확인
- `리포트`
  날짜 기반 집계/시각화
- `설정`
  세션 종료 타임아웃, 월 예산, 알림 기준 설정

## 데이터 소스

이 앱은 기본적으로 아래 경로의 Claude Code 데이터를 읽습니다.

- Windows: `C:\Users\<사용자명>\.claude\projects`
- macOS/Linux: `~/.claude/projects`

즉, 앱을 실행하는 PC에 Claude Code 사용 데이터가 있어야 실제 통계가 표시됩니다.

## 기술 스택

- Electron Forge
- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Recharts
- chokidar

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 실행

```bash
npm start
```

또는 Windows에서는:

```bat
start.bat
```

## 빌드

### 패키지 빌드

```bash
npm run package
```

### 배포용 설치 파일 생성

```bash
npm run make
```

생성 결과물은 보통 `out/` 아래에 만들어집니다.

- Windows 설치 파일: `out/make/squirrel.windows/x64/*Setup.exe`
- macOS 압축본: `out/make/zip/darwin/*/*.zip`

## 배포 방식

### 설치형 배포

Windows 사용자는 `Setup.exe`만 전달받아 설치하면 됩니다.

예:

- `claude-dashboard-1.3.1 Setup.exe`

### 포터블 배포

설치 없이 실행하려면 `out/claude-dashboard-win32-x64` 폴더 전체를 압축해서 전달해야 합니다.  
`exe` 파일 하나만 따로 전달하면 실행되지 않습니다.

## 자동 릴리즈

이 프로젝트는 GitHub Actions를 이용해 릴리즈를 자동 생성합니다.

흐름:

1. 로컬에서 버전 증가 + 커밋 + `main` 푸시
2. GitHub Actions가 `package.json` 버전을 읽음
3. `v{version}` 태그가 없으면 자동 생성
4. GitHub Release 생성
5. Windows/macOS 빌드 수행
6. 릴리즈 자산 업로드

워크플로우 파일:

- `.github/workflows/release.yml`

## 릴리즈 명령

프로젝트 루트의 `.release-token` 파일에 GitHub PAT를 저장해두면, 아래 명령으로 릴리즈할 수 있습니다.

`.release-token` 예시:

```text
ghp_xxx...
```

이 파일은 `.gitignore`에 포함되어 저장소에는 올라가지 않습니다.

### 패치 릴리즈

```bash
npm run release
```

또는

```bash
npm run release:patch
```

### 마이너 릴리즈

```bash
npm run release:minor
```

### 메이저 릴리즈

```bash
npm run release:major
```

각 명령은 다음을 자동 수행합니다.

- 버전 증가
- 로컬 git 사용자 정보 설정
- 전체 변경 커밋
- `main` 브랜치 푸시

그 이후 실제 태그 생성과 설치 파일 업로드는 GitHub Actions가 처리합니다.

## 일반 문서 수정 시

README 같은 문서만 수정할 때는 릴리즈 명령을 쓸 필요가 없습니다.

그냥 일반 git 흐름으로 올리면 됩니다.

```bash
git add .
git commit -m "docs: update README"
git push origin main
```

이미 해당 버전 태그가 있으면 릴리즈는 자동으로 스킵됩니다.

## 프로젝트 구조

```text
src/
  App.tsx
  main.ts
  preload.ts
  tabs/
  lib/
.github/workflows/
scripts/
```

- `src/main.ts`
  Electron 메인 프로세스
- `src/preload.ts`
  renderer와 main 간 bridge
- `src/App.tsx`
  메인 UI 엔트리
- `src/tabs/*`
  탭 화면 구성
- `src/lib/*`
  집계, 세션 계산, IPC 처리
- `scripts/release-local.mjs`
  로컬 릴리즈 진입 스크립트

## 참고

- 빌드 산출물(`out/`, `dist/`, `.vite/`)은 git에 포함하지 않습니다.
- 비밀값은 `.release-token` 같은 로컬 파일로만 관리합니다.
- Windows에서 SmartScreen 경고가 뜰 수 있습니다. 코드 서명 전에는 일반적인 동작입니다.
