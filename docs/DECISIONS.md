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
