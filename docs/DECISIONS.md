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
