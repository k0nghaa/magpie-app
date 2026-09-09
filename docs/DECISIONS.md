# 기술 결정 기록 (DECISIONS)

형식: 날짜 / 결정 / 고려한 대안 / 선택 이유

---

## 2026-08-28 · 크로스플랫폼 프레임워크: Expo (SDK 57) + React Native + TypeScript
- 대안: 순수 React Native(CLI), Flutter, 네이티브(Swift/Kotlin)
- 이유: PRD 6.1 확정 사항. React 경험 이월, iOS/Android 동시 대응, 알림·오디오 요구를 라이브러리로 커버. Expo config plugin으로 네이티브 설정을 관리형으로 유지.

## 2026-08-28 · 오디오 엔진: react-native-audio-api (Software Mansion) 단일 채택
- 대안: react-native-live-audio-stream(캡처), react-native-audio-record, @fugood/react-native-audio-pcm-stream, expo-av/expo-audio
- 이유: 실시간 speech-to-speech에 필요한 (1) 16kHz raw PCM 스트리밍 캡처, (2) 24kHz PCM 무갭 재생(Web Audio 방식 AudioBufferQueueSourceNode), (3) barge-in용 즉시 정지, (4) iOS 무음모드 스피커 재생 + 백그라운드 오디오 세션을 한 패키지가 모두 제공. 경쟁 캡처 라이브러리들은 방치/아카이브 상태. expo-av/expo-audio는 raw PCM 청크 스트리밍 API가 없음.
- 리스크: pre-1.0(v0.13.x). 무갭 스케줄링·barge-in·duplex(playAndRecord) 동작은 실기기 스파이크로 우선 검증.

## 2026-08-28 · react-native-audio-api 버전 안정성 검증 및 정확 버전 pin
- 확인(출처: npm registry): `latest` dist-tag = **0.13.3**(현재 유일한 정식 릴리스). `1.0.0`은 매일 빌드되는 **nightly 프리릴리스** 단계로 안정성 미확보. 경쟁 라이브러리(live-audio-stream, audio-record 등)는 방치/아카이브.
- 결정: 정식 최신 안정 버전 **0.13.3을 정확 버전으로 pin**(package.json/lockfile에서 caret 제거). nightly는 사용하지 않음. pre-1.0 특성상 마이너 드리프트(0.14.x)를 막기 위함.
- 근거: 이 요구사항(raw PCM 스트리밍 캡처+무갭 재생+barge-in+무음모드/백그라운드 세션)을 한 패키지로 충족하는 유지보수 중인 대안이 없음. 잔여 리스크는 실기기 스파이크로 검증하고, 실패 시 백엔드 WebSocket 프록시/대체 오디오 스택으로 폴백.

## 2026-08-28 · Gemini Live 연결: 순수 WebSocket 어댑터 (공식 @google/genai SDK 미사용)
- 대안: @google/genai SDK의 ai.live.connect 사용
- 이유: @google/genai의 Live 클라이언트는 Node 전용 `ws`에 의존해 RN/Hermes에서 깨질 수 있고 공식 RN 지원이 없음. RN 전역 WebSocket으로 BidiGenerateContent 엔드포인트에 직접 연결하는 것이 커뮤니티 정석. PRD 6.2의 어댑터 패턴으로 감싸 엔진 교체 여지 확보.
- 리스크: 일부 RN 환경에서 직접 WebSocket 실패 사례 보고 → 실패 시 얇은 백엔드 WebSocket 프록시로 폴백(추후).

## 2026-08-28 · API 키 관리: M1은 .env 직접 사용 (dev 전용)
- 대안: 지금부터 백엔드 ephemeral token 발급 프록시 구축
- 이유: M1은 실기기 검증이 목표. EXPO_PUBLIC_GEMINI_API_KEY를 .env(gitignore)로 두고 직접 연결하여 백엔드 없이 빠르게 검증. Gemini Live는 ephemeral token을 지원하므로 배포 단계(M1 이후)에서 백엔드 프록시로 교체 예정(PRD 6.3).
- 주의: EXPO_PUBLIC_ 값은 번들에 포함되므로 개인 dev 빌드 전용. 공개 배포 금지.

## 2026-08-28 · 상태관리 Zustand / 단일 화면 (네비게이션 라이브러리 없음)
- 이유: PRD 6.1대로 Zustand 채택. M1은 화면이 하나(대화 시작/상태/종료)라 react-navigation 등 불필요.

## 2026-08-28 · Expo Go 대신 EAS dev build
- 이유: react-native-audio-api는 네이티브 모듈이라 Expo Go에서 동작 불가. expo-dev-client + EAS development 빌드로 실기기 검증.

## 2026-09-02 · iOS 빌드 환경: Intel 맥 로컬 빌드 포기, 윈도우 + EAS 클라우드 빌드로 확정
- 대안: Intel 맥 로컬 빌드, Expo SDK 다운그레이드(54 등), Apple Silicon 맥 대여, Android 우선 검증
- 이유: `expo-modules-jsi`와 `@expo/expo-modules-macros-plugin`의 `apple/Package.swift`가 `swift-tools-version: 6.2`를 요구함(에러: `package 'apple' is using Swift tools version 6.2.0 but the installed version is 6.0.0`). Swift 6.2는 Xcode 26 = Apple Silicon 전용이고, Intel 맥은 Xcode 16.2(Swift 6.0.3)가 상한이라 **실기기는 물론 시뮬레이터도 빌드 불가**. `swift-tools-version` 하향은 매니페스트가 트레일링 콤마(6.1)·`NonisolatedNonsendingByDefault`/`InferIsolatedConformances`(6.2)·swift-syntax 602를 실제로 사용하므로 불가.
- EAS는 충족: SDK 57 기본 이미지 `macos-tahoe-26.5-xcode-26.6`(Xcode 26.6)이므로 `eas.json`에 `image` 명시 불필요. 빌드가 클라우드 macOS에서 돌아 개발 머신 OS는 무관 → 윈도우에서 `eas build` + `expo start`로 전체 루프 가능, 아이폰은 internal distribution 링크로 무선 설치(케이블·Xcode 불필요).
- 비용: 실기기 설치는 UDID 등록이 필요해 Apple Developer Program($99/년) 필수. 무료 Apple ID는 로컬 Xcode(맥) 경유만 가능하므로 윈도우 경로에는 무료 옵션이 없음. 2026-04-28부터 App Store 업로드도 Xcode 26 + iOS 26 SDK가 강제라 어차피 필요한 비용.
- 참고: `developmentClient: true`라 JS는 로컬 Metro가 번들 → `EXPO_PUBLIC_*` 키는 개발 머신 `.env`에서 인라인됨. `.env`를 EAS에 올릴 필요 없음(gitignore로 업로드에서도 제외됨).
- EAS 시뮬레이터 빌드도 대안이 아님: EAS 러너가 Apple Silicon이라 arm64 슬라이스만 생성되고, Intel 맥 시뮬레이터는 x86_64를 요구함.

## 2026-09-02 · eas.json에서 channel 제거 (OTA/EAS Update 미사용)
- 대안: expo-updates 추가 후 channel 유지, 현행 유지(빌드 시 프롬프트 감수)
- 이유: `channel`은 EAS Update(OTA) 대상 태그인데 `expo-updates`가 의존성에 없어 무효 상태였음. M1 dev 빌드는 `developmentClient: true`라 JS를 로컬 Metro가 번들하므로 OTA가 불필요. channel이 설정됐는데 expo-updates가 없으면 `eas build` 시 "expo-updates를 설치·설정할까요?" 대화형 프롬프트가 뜸(근거: eas-cli PR #2016). 셋 다 제거해 빌드를 깔끔하게 유지.
- 재도입 시점: OTA 무선 업데이트가 필요한 M2 이후에 `expo-updates` 설치 + `eas update:configure`와 함께 channel을 다시 붙인다.

## 2026-09-03 · react-native-audio-api의 AudioControls 위젯을 Metro 스텁으로 제거
- 문제: `react-native-audio-api@0.13.3`의 `AudioControls.tsx`가 `react-native-gesture-handler`와 `react-native-reanimated`를 import하는데, 둘 다 peerDependencies에 선언되지 않음. 배럴 export(`index → api → AudioControls`)로 딸려와 Metro 번들링이 `Unable to resolve "react-native-gesture-handler"`로 실패. (tsc는 node_modules를 타입체크에서 건너뛰어 못 잡음)
- 대안: (1) gesture-handler+reanimated 정식 설치 → 둘 다 네이티브 모듈이라 EAS 재빌드 필요 + reanimated babel 플러그인/GestureHandlerRootView 설정 필요. 안 쓰는 위젯을 위한 비용. (2) 라이브러리 버전 변경 → pre-1.0라 리스크.
- 결정: 앱은 AudioControls(재생 UI 위젯)를 사용하지 않으므로(코드 검색 0건), `metro.config.js`의 `resolver.resolveRequest`로 **react-native-audio-api 내부에서 들어오는** 두 import만 빈 스텁(`stubs/empty.js`)으로 치환. 네이티브 모듈을 추가하지 않아 **기존 dev 빌드 바이너리 재사용**(재빌드 불필요). 우리 사용처(raw PCM 스트리밍)와 정확히 일치.
- 범위 한정: `originModulePath`가 `react-native-audio-api`인 경우에만 치환해 다른 코드 영향 없음. 향후 이 두 라이브러리를 실제로 쓰게 되면 정식 설치 + 이 스텁 규칙 제거.

## 2026-09-03 · AudioBufferQueueSourceNode.start를 start(0, 0)으로 명시 호출 (라이브러리 버그 우회)
- 문제: `react-native-audio-api@0.13.3`의 `AudioBufferQueueSourceNode.start(when=0, offset=-1)`는 offset 기본값이 -1인데 곧바로 `offset < 0`을 거부해, 인자 없이 `start()`를 부르면 실기기에서 `RangeError: offset must be a finite non-negative number: -1`로 항상 throw됨(base 클래스 `AudioBufferSourceNode.start`는 offset 기본값이 0으로 정상 → 서브클래스 override의 회귀 버그).
- 결정: `player.ts`에서 `queue.start(0, 0)`으로 offset을 명시적으로 0(=처음부터 재생, base와 동일 의미) 전달해 우회. 순수 JS 수정이라 재빌드 불필요.
- 향후: 라이브러리가 기본값을 0으로 고치면 인자 생략으로 되돌릴 수 있음.

## 2026-09-04 · iOS 오디오 세션 iosMode: voiceChat → default (AI 재생 볼륨 정상화)
- 문제: `iosMode: 'voiceChat'`은 통신(전화)용 모드라 출력 게인이 낮게 캘리브레이션되고 기본 라우팅이 수화부 쪽이라 AI 음성이 작게 들렸음. 원래 voiceChat을 쓴 목적은 AEC였으나, 설치된 `react-native-audio-api@0.13.3`은 VoiceProcessingIO를 연결하지 않아 **voiceChat으로도 실제 AEC가 걸리지 않음**(조사 확인: 라이브러리 소스에 VoiceProcessing 코드 없음, GitHub 이슈 #670에서 메인테이너가 AEC 미지원 인정. `iosVoiceProcessing` 옵션은 미released `main` 브랜치/nightly에만 존재).
- 대안: nightly(1.0)로 올려 `AudioRecorder({ iosVoiceProcessing: true })` 사용 / patch-package로 백포트 / 재생부에 GainNode 부스트
- 결정: `iosMode`를 `'default'`로 변경. 무음 스위치 무시·duplex·이어폰 라우팅은 **`playAndRecord` 카테고리**가 담당하므로 iosMode 변경과 무관하게 유지됨. nightly 채택은 기존 결정(0.13.3 pin, nightly 미사용)과 충돌하므로 배제. 어차피 0.13.3에서 voiceChat은 AEC 이득이 0이라 잃는 것 없음. 에코는 반이중 게이팅으로 별도 처리(아래 결정).
- 검증: 실기기에서 AI 음성 볼륨 증가 확인. 순수 JS 변경이라 재빌드 불필요.

## 2026-09-04 · 에코 대응: 반이중(half-duplex) 마이크 게이팅 (iOS AEC 부재 우회)
- 문제: `react-native-audio-api@0.13.3`은 iOS AEC(음향 에코 제거)를 지원하지 않음(위 결정·이슈 #670 참조). 스피커로 나온 AI 음성이 마이크로 되돌아가 서버에 "사용자 발화"로 전사되고 가짜 barge-in(AI가 자기 말에 자기가 끊김)을 유발. 볼륨 정상화(voiceChat→default) 후 스피커 출력이 커져 증상이 악화됨. 이어폰 사용 시엔 물리적 분리로 증상 없음(실기기 확인).
- 대안: (1) 정식 AEC — `iosVoiceProcessing: true`는 미released nightly(1.0)에만 존재, 기존 nightly 미사용 결정과 충돌. (2) 이어폰 전용 — 아침 스피커 핸즈프리 컨셉(PRD §1) 훼손. (3) 클라 GainNode로 마이크 무음화 — 컨트롤러 레벨 게이팅으로 더 단순히 달성 가능.
- 결정: `conversationController.ts`에 `aiSpeaking` 플래그를 두고, AI 발화 중(`onAudio`~`onTurnComplete`)에는 마이크 청크를 서버로 보내지 않음. 진폭이 아니라 발화 "국면"으로 막아 견고. 트레이드오프: AI 발화 중에는 사용자 barge-in을 서버가 감지 못함. barge-in은 이 시점에 PRD 스코프에서 제거했으며(라이브러리 AEC 부재), 정식 AEC(iosVoiceProcessing) 도입 시 이 게이팅을 제거하고 기능으로 재추가한다.
- 검증: 실기기(스피커)에서 가짜 barge-in 소멸, 꼬리 에코 없음, 정상 턴 교대 확인. 순수 JS 변경이라 재빌드 불필요.

## 2026-09-07 · [M2] 로컬 알림 라이브러리: expo-notifications 채택
- 대안: notifee, @notifee/react-native, 직접 네이티브 모듈
- 이유: Expo 관리형(config plugin)에 통합돼 EAS 빌드와 마찰이 없고, DAILY 반복 트리거·권한·cold start 응답 수신을 한 패키지로 커버. PRD 6.1의 `expo-notifications`(로컬 알림) 명시와 일치.
- 확인(출처: expo/expo 네이티브 소스 대조): `SchedulableTriggerInputTypes.DAILY`는 iOS에서 `UNCalendarNotificationTrigger(repeats:true)` 하드코딩, Android에서 fire마다 다음 날을 재예약(self-rescheduling)해 **매일 반복**된다(`repeats` 필드 불필요, 1회성 아님). 재부팅 후에도 라이브러리 내장 `RECEIVE_BOOT_COMPLETED` 리시버가 복원.

## 2026-09-07 · [M2] 화면 구조: 조건부 렌더링(네비게이션 라이브러리 없음) 유지
- 대안: react-navigation(native-stack) 지금 도입, expo-router
- 이유: M2는 화면이 2개(대화/설정)뿐이라 경량 zustand 스토어(`appRoute`) 기반 조건부 렌더링으로 충분. M1의 "네비게이션 라이브러리 없음" 결정과 연속. native-stack이면 gesture-handler/reanimated는 불필요하나(스텁과 무관), 화면 2개에 네이티브 모듈 2개(screens/safe-area-context)를 추가할 이유가 아직 없음.
- 재도입 시점: M3에서 둥지 화면이 추가돼 화면이 3개+가 되면 `@react-navigation/native-stack` 도입(알림 딥링크 라우팅도 함께 정석화).

## 2026-09-07 · [M2] Android 정확 알람: SCHEDULE_EXACT_ALARM 선언 + 자동 inexact 폴백
- 대안: expo-intent-launcher로 설정화면 유도, exact 미사용(inexact만)
- 이유: 아침 습관 트리거라 정시성이 중요(±1시간이면 루틴 부적합)해 `app.json`에 `SCHEDULE_EXACT_ALARM` 선언. 라이브러리가 `canScheduleExactAlarms()`로 exact→inexact 자동 폴백하므로 권한 미허용(특히 Android 14+ 신규설치 기본 거부)이어도 알림 자체는 온다(크래시/누락 없음). expo-notifications엔 exact-alarm 권한을 앱에서 요청하는 공식 API가 없어 설정화면 유도(비공식 커뮤니티 패턴, 의존성 추가)는 이번 범위에서 제외. 설정 화면에 "정확 알람 꺼짐 시 최대 1시간 지연" 안내만 표시.
- 배포 주의: `SCHEDULE_EXACT_ALARM`은 Google Play 정책상 알람시계/캘린더 부류 앱에만 허용된다. 개인 sideload·EAS dev build에는 무해하나, Play 스토어 배포 시 심사 거부 리스크가 있으므로 배포 단계 전 재검토(대안: `USE_EXACT_ALARM` 부적격 → inexact 전환 또는 정책 소명).

## 2026-09-07 · [M2] 시간 picker: @react-native-community/datetimepicker
- 대안: 순수 JS 스테퍼, 커스텀 휠
- 이유: OS 네이티브 시간 선택 UI로 UX가 익숙하고 유지보수가 안정적. 어차피 expo-notifications로 dev build를 재생성하므로 네이티브 모듈 1개 추가 비용이 합산됨. `expo install`이 SDK 57 호환 9.1.0 선택, config plugin 자동 등록.

## 2026-09-07 · [M2] 알림 시각 저장: 별도 저장소 없이 예약 알림 content.data 사용
- 대안: @react-native-async-storage/async-storage, expo-secure-store
- 이유: 설정 시각을 예약 알림의 `content.data.{hour,minute}`에 실어 두고 `getAllScheduledNotificationsAsync()`로 되읽어 복원. data는 iOS/Android 모두 안정적으로 왕복하므로 별도 KV 네이티브 의존성을 회피(안정성·최소 범위 원칙). 예약 = 곧 저장.

> [M2] dev build 재생성 필요: expo-notifications·@react-native-community/datetimepicker는 네이티브 모듈이며 app.json plugin/권한(POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM)이 변경됐으므로, 실기기 검증 전 EAS development 빌드를 1회 재생성해야 한다(두 모듈 + 권한 변경이 한 번의 재빌드로 반영됨).

## 2026-09-07 · [범위 확정] M2는 일반 푸시 알림으로 종료, "진짜 알람"은 M2.5로 분리
- 배경: 이 서비스의 창업 가설이 "계속되는 푸시 알림 무시 → 습관 실패"(PRD §1)라, 무음 모드를 뚫고 확실히 깨우는 "진짜 알람"이 제품의 핵심 전제로 부상. 하지만 이는 PRD §2 비목표이자 M2(알림 트리거) 범위 밖.
- 결정:
  - **M2**는 현재의 expo-notifications 기반 일반 로컬 푸시 알림(예약·탭→대화 시작)으로 **확정·종료**. iPhone(iOS 26.6.1) 실기기에서 잠금/콜드스타트/백그라운드/무음/이어폰 시나리오 정상 확인.
  - 무음 스위치까지 뚫는 **"진짜 알람"은 별도 마일스톤 M2.5로 분리**하고, **M3(둥지/보상)보다 우선** 착수(못 깨우면 보상 화면 도달 자체가 불가 → 루프 입구가 먼저).
- M2.5 방향(조사 기반, 상세는 [docs/alarm-feasibility.md](./alarm-feasibility.md)):
  - iOS: **AlarmKit(iOS 26+)** — 무음/Focus/DND 관통, 지속 울림, 알람 버튼(App Intent + `openAppWhenRun`)으로 종료 상태에서도 앱 실행→대화 시작. Swift 커스텀 Expo 네이티브 모듈 필요(성숙한 RN 래퍼 없음). **최소 1탭 필요, 0-탭 자동 대화 재생은 여전히 불가**(PRD 기존 비목표와 일치).
  - Android: full-screen intent + exact alarm + foreground service. "알람 앱" 자격 시 권한 자동 승인. `react-native-notify-kit`(Notifee 포크) 후보이나 자체 검증 필요.
  - 착수 방식: **온디바이스 스파이크(iPhone iOS 26.6.1)로 iOS 26 AlarmKit 알람음 안정성부터 검증**(iOS 26.0/26.1 커스텀 사운드 버그 보고 있음) 후 본구현.
- 스킵한 대안:
  - **경량 개선(Time Sensitive interruption level·30초 커스텀 사운드·반복 넛지)**: 전부 Apple 공식 알림 API(꼼수 아님)지만 AlarmKit이 상위호환이라 지금은 불필요. 배포 단계에서 iOS 26 미만 fallback이 필요해지면 그때 이 "깨끗한 알림 경로"로 추가(무음 오디오 루프 같은 편법은 정책 위반·불안정이라 배제).
  - **최소 iOS 26으로 다운로드 제한 vs iOS<26 fallback**: 배포 시점 결정 사항(스파이크를 막지 않음). 개인용 단계 기본값은 "최소 26, fallback 없음"(코드 경로 단일화).

## 2026-09-08 · [M2.5] iOS AlarmKit: 커스텀 Swift Expo 네이티브 모듈 채택(라이브러리 배제)
- 대안: expo-alarm-kit(28★)·react-native-nitro-ios-alarm-kit(13★)·rn-alarm-kit(5★) 등 기존 래퍼 사용
- 이유: 공식 문서 재검증 결과 성숙한 RN/Expo AlarmKit 래퍼가 없음(전부 <30★, config plugin 부재, 하나는 자칭 "not production-ready"). AlarmKit OS 동작이 26.x 포인트 릴리스마다 바뀌어 소규모 포크가 추적을 못 함. `modules/expo-real-alarm`로 자체 Swift 모듈 작성(레퍼런스 두 곳의 실제 컴파일되는 시그니처를 근거로 함: full initializer `AlarmManager.AlarmConfiguration<Meta>(countdownDuration:schedule:attributes:stopIntent:secondaryIntent:sound:)`, `AlarmButton(text:textColor:systemImageName:)`, `try manager.alarms`/`stop(id:)`/`cancel(id:)`).
- 리스크: 신규 API 시그니처 드리프트 → 온디바이스 빌드에서 컴파일 검증 필요(Swift는 EAS Xcode 26.6 클라우드 빌드에서만 컴파일 가능, 로컬/CI tsc로는 못 잡음). 컴파일 리스크가 높은 두 지점(`secondaryButtonBehavior: .custom`, `countdownDuration: nil`)을 코드 주석에 명시.

## 2026-09-08 · [M2.5] 알람음: 시스템 기본음(.default)만 사용, 커스텀 사운드 회피
- 대안: 앱 번들 커스텀 알람음(AlertConfiguration.AlertSound.named(...))
- 이유: iOS 26.0→26.1→2026-02까지 커스텀 사운드 버그가 형태를 바꿔가며 지속 보고(에러음 대체·미반복·30초 제한 등), 26.6.x 해소 확인 사례 없음. 반면 `.default`는 전 버전에서 정상 동작·지속 울림이 확인됨. MVP는 기본음에 의존하고 커스텀 사운드는 실기기 검증 후 옵션 기능으로만.

## 2026-09-08 · [M2.5] 알람 버튼→앱 실행 브릿지: App Group 공유 UserDefaults
- 대안: 딥링크(URL scheme)/NSUserActivity, in-memory static(expo-alarm-kit 방식)
- 이유: AlarmKit 버튼 인텐트(LiveActivityIntent)의 `perform()`이 진입점이며, cold start에서 시스템 알람 프로세스→앱 프로세스로 상태를 확실히 넘기려면 App Group의 공유 UserDefaults가 정석(딥링크는 AlarmKit 공식 흐름 아님). `perform()`이 pending-start(alarm id)를 기록 → 네이티브 `consumePendingStart()`가 읽고 즉시 clear → App.tsx가 실행 시(cold)와 AppState 'active'(warm)에 소비해 `navigate('conversation') + useConversation.getState().start()` 호출. 기존 알림 응답 처리와 동일 패턴, 세션 코드 미수정.
- 주의: `openAppWhenRun`은 정적 프로퍼티라 런타임 토글 불가 → 동작별 인텐트 타입을 분리한다.
- (2026-09-08 실기기 UX 조정) AlarmKit은 `stopButton`이 필수라 정지 컨트롤(밀어서 끄기)을 없앨 수 없음. "밀어서 끄면 알람만 꺼지고 화면이 안 켜진다"는 실사용 피드백에 따라 **정지 컨트롤도 openAppWhenRun=true + pending-start 기록**으로 바꿔, 밀든 버튼을 누르든 모두 앱 실행+대화 시작이 되게 함(스킵 탈출구 제거 = 각성 보장 강화). 스와이프 해제 시 stopIntent 미발화 iOS 26 버그가 보고돼 있어 [대화 시작] 버튼(탭)을 확실한 경로로 함께 유지.

## 2026-09-08 · [M2.5] 권한/엔타이틀먼트: NSAlarmKitUsageDescription + App Group만
- 대안: `com.apple.developer.alarmkit` 엔타이틀먼트 추가, App ID capability 신청
- 이유: 공식 포럼에서 Apple 엔지니어가 `com.apple.developer.alarmkit`는 LLM이 지어낸 **존재하지 않는 키**임을 확인(추가 시 프로비저닝 프로파일 깨짐). AlarmKit은 특별 엔타이틀먼트/포털 신청 불필요 — Info.plist `NSAlarmKitUsageDescription` + 런타임 `requestAuthorization()`만 필요. App Group(`group.com.k0nghaa.magpie`)은 AlarmKit 요구가 아니라 위 브릿지용으로만 추가. app.json의 `ios.infoPlist`/`ios.entitlements`로 주입(EAS가 capability 동기화).
- 주의: `authorizationState`가 허용 후에도 `.notDetermined`로 오보고되는 버그 보고 있음 → 방어적 재확인 로직 유지.

## 2026-09-08 · [M2.5] 미지원 기기 fallback: isRealAlarmAvailable() 런타임 분기
- 대안: 최소 iOS 26으로 App Store 다운로드 제한(코드 경로 단일화)
- 이유: 아무도 서비스에서 잠기지 않도록 iOS<26/Android/Expo Go에서는 `isRealAlarmAvailable()`이 false → 기존 M2 로컬 알림(scheduleDailyReminder) 유지. AlarmKit 코드는 전부 `@available(iOS 26.0,*)` 런타임 게이팅이라 pod 최소 타깃(15.1) 유지, 배포 타깃 상향 불필요. "최소 iOS 26, fallback 없음"은 코드가 아니라 **배포 시점 옵션**으로만 남김(개인용 단계에서 재결정).

## 2026-09-08 · [M2.5] iOS 스파이크 실기기 통과 → 본구현 착수
- 검증(iPhone iOS 26.6.1): 무음 스위치 ON + 잠금 상태에서 알람 발화 확인, 밀어서 끄기·[대화 시작] 버튼 둘 다 앱 실행 + 대화 세션 시작 확인. 스파이크 게이트 통과 → 방향 확정.
- 순서 결정: iOS 본구현 완성·커밋 → Android(방식은 그때 확정). Android 병행은 변경폭이 커 배제.

## 2026-09-08 · [M2.5] iOS 본구현: AlarmKit 매일 반복 예약 + 백엔드 분기 추상화
- 대안: 스파이크의 1회성 예약 유지, Settings에서 expo-notifications를 직접 분기
- 이유: 스파이크의 `scheduleFixed`(1회성)를 `Alarm.Schedule.relative` + 전체 7요일 반복(=매일)으로 승격해 production 예약으로 전환(요일별 on/off는 향후 범위, PRD F4-1). 설정 화면은 새 `src/alarm/alarmScheduler.ts` 추상화만 호출하고, 추상화가 `isRealAlarmAvailable()`로 iOS26+면 AlarmKit(`scheduleDaily`)·그 외면 M2 `scheduleDailyReminder`로 분기. **예약 시 반대편 백엔드를 항상 취소**해 이중 발화를 막는다(cancelReminders ↔ cancelAllAlarms). 예약 시각은 App Group UserDefaults에 저장하고 `getScheduledTime`이 `manager.alarms`와 교차확인해 stale 표시를 방지(M2의 content.data 왕복 패턴과 동일 취지). 권한도 추상화(`ensureAlarmPermission`)가 AlarmKit 권한/알림 권한으로 분기. 세션 코드·알림 스케줄러·네이티브 모듈 경계는 유지하고 조합만.
- 정리: 온디바이스 검증용 스파이크 패널(`AlarmSpikePanel`, `SHOW_ALARM_SPIKE`)과 `scheduleTestAlarm`은 제거(P4). 실제 검증은 Settings 저장 흐름으로 일원화.

## 2026-09-09 · [스코프] 플랫폼 분리 진행: iOS 우선 완주, Android는 실기기 확보 후 일괄
- 배경: Android 실기기 검증 환경이 없어(에뮬 doze로 시간 알람 검증 불가, M2에서 확인) 진짜 알람 FSI를 지금 실증할 수 없음. iOS M2.5는 실기기(26.6.1)에서 핵심 통과.
- 결정: **① M2.5 iOS를 main에 머지** → **② M3(둥지/보상)를 iOS 버전만 먼저 진행** → **③ Android 실기기 확보 시 M2.5(진짜 알람)+M3를 일괄 구현.** Android 진짜 알람 구현 체크리스트는 docs/platform-roadmap.md에 정리.
- 안전장치: Android/iOS<26에서는 이미 M2 일반 로컬 알림으로 런타임 fallback(`alarmScheduler`)하므로, Android도 "일반 알림" 수준으로는 동작함(진짜 알람 FSI만 미구현). 아무도 서비스에서 잠기지 않음.
- iOS 미검증 잔여: 매일 반복(익일 재발화)은 시간상 실사용 중 확인(안 되면 리뷰 권장#1대로 인텐트의 stop 호출 제거). 빌드·무음/잠금 발화·버튼/밀어서끄기→앱 실행은 검증 완료(= Swift 컴파일 노브 3곳도 EAS 빌드 통과).

## 2026-09-08 · [M2.5] Android FSI 방식은 iOS 스파이크 통과 후 결정(보류)
- 대안: 지금 확정
- 이유: 리스크가 iOS AlarmKit에 집중돼 iOS 온디바이스 스파이크를 먼저 게이트로 둠. Android 재검증 결론은 기록: `react-native-notify-kit`(v10.7.0, New Arch 전용, config plugin이 `USE_FULL_SCREEN_INTENT`는 자동 주입 안 함)로 FSI **표시**만 맡기고 신뢰성 핵심(exact alarm·부팅 재예약)은 얇은 자체 Kotlin으로 두는 **하이브리드**가 유력. Play 정책상 `USE_EXACT_ALARM`는 미선언(심사 거부 리스크)하고 기존 `SCHEDULE_EXACT_ALARM` + 런타임 grant + 거부 시 60초 헤즈업 fallback. Android 15는 `BOOT_COMPLETED` 리시버에서 mediaPlayback/microphone FGS 직접 시작 금지(부팅 시 재예약만).
