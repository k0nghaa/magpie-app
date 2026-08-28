/**
 * 환경 설정 로더.
 *
 * Expo는 `EXPO_PUBLIC_` 접두사가 붙은 .env 변수를 빌드 시점에 번들로 인라인합니다.
 * (주의: 이 값들은 클라이언트 번들에 포함되므로 개인 dev 빌드 전용입니다. PRD 6.3 참조.)
 */

/** Gemini API 키. 최초 연결 시점에 .env에 채워집니다. */
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

/**
 * 사용할 Gemini Live 모델 ID.
 * preview 접미사(-12-2025 등)는 자주 바뀌므로 .env에서 교체할 수 있게 했습니다.
 * 연결이 실패하면 aistudio의 models.list로 현재 유효한 native-audio 모델 ID를 확인하세요.
 */
export const GEMINI_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_MODEL ??
  'gemini-2.5-flash-native-audio-preview-12-2025';

/** 키가 설정되어 있는지 확인 (UI에서 안내용). */
export const hasApiKey = GEMINI_API_KEY.trim().length > 0;
