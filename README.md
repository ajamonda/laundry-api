# laundry-api

세탁 서비스 백엔드 (NestJS 모듈러 모놀리스).

이 문서는 **처음 보는 사람도 설치부터 서버 구동, 테스트 실행까지 따라 할 수 있도록** 정리되어 있습니다. 막히는 부분이 있으면 [문제 해결](#문제-해결) 섹션을 먼저 확인하세요.

## 1. 사전 준비

다음 세 가지가 로컬에 설치되어 있어야 합니다.

| 도구 | 권장 버전 | 확인 명령 |
|---|---|---|
| **Node.js** | 20 이상 | `node -v` |
| **npm** | Node.js와 함께 설치됨 | `npm -v` |
| **PostgreSQL** | 14 이상 | `psql --version` |

### Node.js 설치
- Windows에서 `nvm4w` 사용 시: `C:\nvm4w\nodejs` 가 PATH에 있어야 합니다.
- macOS / Linux: [nvm](https://github.com/nvm-sh/nvm) 권장.

### PostgreSQL 설치 & 기동
- Windows: [공식 인스톨러](https://www.postgresql.org/download/windows/) 또는 Docker.
- 기본 포트 `5432`로 띄웁니다.
- 슈퍼유저(`postgres`) 비밀번호를 기억해두세요 — 아래 `DATABASE_URL`에 필요합니다.

설치 후 PostgreSQL 서비스가 실행 중인지 확인:
```bash
psql -U postgres -c "SELECT 1;"
```
`1`이 출력되면 정상.

## 2. 프로젝트 받기 & 의존성 설치

```bash
# 저장소 클론 후
cd laundry-api

# Node 패키지 설치
npm install
```

> Windows PowerShell에서 `nvm4w` 경로 추가가 필요한 경우:
> ```powershell
> $env:PATH='C:\nvm4w\nodejs;' + $env:PATH
> ```

## 3. 환경 변수 설정

루트의 [.env.example](.env.example)을 참고하여 `.env` 파일을 만듭니다. 이미 `.env`가 있다면 값만 본인 환경에 맞게 수정.

```env
DATABASE_URL="postgresql://<USER>:<PASSWORD>@localhost:5432/laundry_service?schema=public"
PORT=3000
JWT_SECRET="자유롭게 입력"
KAKAO_API_KEY="..."
```

**중요**
- 비밀번호에 `#`, `@` 같은 특수문자가 들어가면 URL 인코딩 필요. 예: `#` → `%23`
- `JWT_SECRET`은 로컬용이면 아무 문자열이나 OK. 프로덕션 절대 그대로 쓰지 말 것
- 테스트 전용 DB는 [.env.test](.env.test)에서 `laundry_test` 데이터베이스를 가리킵니다 — 별도 설정 불필요 (DB만 만들면 됨)

## 4. 데이터베이스 준비

### 4-1. 빈 데이터베이스 생성

운영 DB와 테스트 DB **두 개** 생성:

```bash
psql -U postgres -c "CREATE DATABASE laundry_service;"
psql -U postgres -c "CREATE DATABASE laundry_test;"
```

### 4-2. 스키마 마이그레이션 적용

```bash
npm run prisma:migrate
```

처음 실행 시 Prisma가 마이그레이션 이름을 묻습니다 → Enter로 넘어가도 됩니다. 끝나면 `laundry_service`에 모든 테이블이 만들어집니다.

### 4-3. 시드 데이터 주입

카탈로그, 라우팅 규칙, 차량 등 마스터 데이터가 들어갑니다.

```bash
npm run prisma:seed
```

마지막 줄에 `Seeded 22 route resolution rules` 비슷한 메시지가 보이면 성공.

### 4-4. (선택) Prisma Studio로 DB 확인

브라우저 GUI로 DB 내용을 보려면:

```bash
npm run prisma:studio
```

[http://localhost:5555](http://localhost:5555) 에서 테이블 내용을 확인할 수 있습니다.

## 5. 개발 서버 구동

```bash
npm run start:dev
```

다음 메시지가 보이면 정상 기동:

```
[Nest] ... Nest application successfully started
```

- 서버 주소: [http://localhost:3000](http://localhost:3000)
- API 문서 (Swagger UI): [http://localhost:3000/docs](http://localhost:3000/docs)
- 코드 수정 시 자동 재시작 (watch 모드)

### 운영 빌드 / 실행 (선택)

```bash
npm run build      # dist/ 생성
npm start          # node dist/main.js
```

## 6. 빠른 동작 확인 (health check)

서버가 떴는지 간단히 확인:

```bash
# Swagger UI 접속
# 브라우저로 http://localhost:3000/docs

# 카탈로그 조회 (인증 불필요)
curl http://localhost:3000/catalog/items
```

응답으로 셔츠/바지/코트 등 시드된 아이템 목록이 JSON으로 돌아오면 백엔드가 잘 살아있는 것.

### 첫 주문까지 흐름 따라가보기

Swagger UI에서 다음 순서로 호출하면 손쉽게 전체 도메인을 경험할 수 있습니다:

1. `POST /auth/customer/dev-login` — body: `{ "customerId": "customer-1" }` → 응답의 `accessToken`을 복사
2. 우측 상단 **Authorize** 버튼 → `Bearer <accessToken>` 입력
3. `PATCH /auth/customer/me/profile` — 전화번호 + 주소 입력
4. `POST /orders` — 셔츠 1벌 주문
5. 다른 staff 계정으로 dev-login: `/auth/staff/{pickup,wash,delivery}/dev-login`

전체 happy path는 [test/e2e/golden-path.e2e-spec.ts](test/e2e/golden-path.e2e-spec.ts)에 정리되어 있습니다.

## 7. 테스트 실행

이 프로젝트는 **단위 테스트**와 **e2e 테스트** 두 가지를 둡니다.

### 단위 테스트 (빠름, DB 불필요)
```bash
npm run test:unit
```
약 1초. 순수 로직(가격 계산, 라우팅 규칙, 에러 분류 등)만 검증.

### E2E 테스트 (실제 DB 사용)

**처음 한 번**: 테스트 DB 마이그레이션 + 시드를 자동 실행:
```bash
npm run test:e2e
```
약 10초. `laundry_test` DB를 자동으로 마이그레이션·시드한 뒤 전체 시나리오를 검증합니다.

> **참고**: e2e는 `laundry_test` DB의 모든 volatile 테이블을 비웠다 채우기를 반복하므로 **운영 DB로 절대 가리키지 마세요**. `.env.test`의 `DATABASE_URL`에 반드시 `_test`가 포함되어야 하고, 그렇지 않으면 [test/load-env.ts](test/load-env.ts)의 안전장치가 실행을 막습니다.

### 타입 검사
```bash
npm run typecheck
```

## 8. 자주 쓰는 명령 요약

```bash
npm run start:dev          # 개발 서버 (watch)
npm run build              # 프로덕션 빌드
npm start                  # 빌드 결과 실행

npm run prisma:migrate     # 마이그레이션 적용
npm run prisma:seed        # 시드 데이터 주입
npm run prisma:studio      # DB GUI
npm run prisma:generate    # Prisma client 재생성 (스키마 변경 시)

npm run typecheck          # 타입만 검사
npm run test:unit          # 단위 테스트
npm run test:e2e           # 통합 테스트
```

## 9. 프로젝트 구조 한눈에

```
laundry-api/
├── src/
│   ├── main.ts                     # 엔트리포인트
│   ├── app.module.ts               # 루트 모듈
│   ├── common/
│   │   ├── auth/                   # 가드, 데코레이터, 토큰 발급
│   │   └── errors/                 # DomainError, 글로벌 필터, idempotency 헬퍼
│   ├── database/                   # PrismaService
│   └── modules/
│       ├── auth/                   # 고객/스태프 인증
│       ├── catalog/                # 카탈로그, 가격, 라우팅
│       ├── pickup/                 # 픽업 운영
│       ├── processing-route/       # 공정 상태 엔진
│       ├── wash/                   # 세탁 공장
│       ├── exception/              # 예외 흐름, 승인, 라우트 변경
│       ├── billing/                # 청구 / 결제
│       └── delivery/               # 배달
├── prisma/
│   ├── schema.prisma               # DB 스키마
│   ├── migrations/                 # 마이그레이션 SQL
│   └── seed.ts                     # 시드 스크립트
├── test/
│   ├── smoke.e2e-spec.ts
│   ├── e2e/                        # E2E 테스트 6종
│   ├── unit/                       # 단위 테스트
│   └── utils/                      # 테스트 공통 헬퍼
└── docs/                           # 도메인별 명세 (개발자/AI용)
```

도메인별 상세 명세는 [docs/](docs/)에서 볼 수 있습니다.

## 문제 해결

### `npm install`에서 멈춤 / 에러
- Node 버전 확인 (`node -v` → 20 이상)
- `node_modules`, `package-lock.json` 삭제 후 재시도

### `prisma:migrate`가 DB에 연결 못 함
- PostgreSQL 서비스가 실행 중인지 확인
- `.env`의 `DATABASE_URL` 사용자 / 비밀번호 / 포트 확인
- 비밀번호에 특수문자가 있으면 URL 인코딩 필요 (`#` → `%23`, `@` → `%40` 등)

### `prisma:seed`에서 외래키 에러
- 마이그레이션이 안 들어간 상태. `npm run prisma:migrate` 먼저 실행

### 서버는 떴는데 Swagger UI가 안 열림
- 다른 프로세스가 3000 포트를 점유 중일 수 있음 — `.env`의 `PORT` 값 변경 또는 점유 프로세스 종료

### E2E 테스트가 빨간색
- `laundry_test` DB 존재 확인 (`psql -U postgres -l | grep laundry_test`)
- `.env.test`의 `DATABASE_URL`이 `_test`로 끝나는지 확인
- 한 번 실행 후 막혔다면 `laundry_test`를 비웠다 다시 실행:
  ```bash
  psql -U postgres -c "DROP DATABASE laundry_test;"
  psql -U postgres -c "CREATE DATABASE laundry_test;"
  npm run test:e2e
  ```

### "JWT secret is required" 같은 인증 에러
- `.env`의 `JWT_SECRET`이 비어있지 않은지 확인. 로컬에선 아무 문자열이나 OK

## 더 알아보기

- 도메인별 명세: [docs/](docs/) (도메인 8개 README + 공통 규칙)
- 아키텍처 / 코딩 규칙: [docs/common/architecture.md](docs/common/architecture.md), [docs/common/coding-style.md](docs/common/coding-style.md)
- 테스트 전략: [docs/common/test.md](docs/common/test.md)
- API 문서: 서버 기동 후 [http://localhost:3000/docs](http://localhost:3000/docs)
