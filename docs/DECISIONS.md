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
