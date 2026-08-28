/**
 * Gemini Live 와이어 프로토콜 메시지 빌더.
 * liveClient는 이 함수들로 만든 객체를 JSON.stringify 해서 WebSocket으로 보냅니다.
 * (경로/코드가 아닌 순수 데이터라도, 손으로 문자열을 잇지 않고 항상 객체 → JSON.stringify 로 만듭니다.)
 */
import type {
  ClientContentMessage,
  RealtimeAudioMessage,
  SetupMessage,
} from './types';

/** Gemini Live WebSocket 엔드포인트. 키는 쿼리스트링으로 전달. */
export const LIVE_WS_HOST =
  'generativelanguage.googleapis.com';
export const LIVE_WS_PATH =
  '/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

/** 입력(마이크): 16kHz, 16-bit PCM, mono, little-endian. */
export const INPUT_MIME_TYPE = 'audio/pcm;rate=16000';
export const INPUT_SAMPLE_RATE = 16000;
/** 출력(스피커): 24kHz, 16-bit PCM, mono. */
export const OUTPUT_SAMPLE_RATE = 24000;

export function buildWsUrl(apiKey: string): string {
  return `wss://${LIVE_WS_HOST}${LIVE_WS_PATH}?key=${encodeURIComponent(apiKey)}`;
}

export interface SetupOptions {
  model: string;
  systemInstruction: string;
  /** prebuilt 음성 이름 (예: 'Aoede', 'Puck', 'Charon'). */
  voiceName?: string;
}

export function buildSetupMessage(opts: SetupOptions): SetupMessage {
  return {
    setup: {
      model: opts.model.startsWith('models/')
        ? opts.model
        : `models/${opts.model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: opts.voiceName
          ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voiceName } } }
          : undefined,
      },
      systemInstruction: { parts: [{ text: opts.systemInstruction }] },
      // 서버 자동 VAD + barge-in(사용자 발화가 모델을 끊음)은 기본값이지만 명시해 둡니다.
      realtimeInputConfig: {
        automaticActivityDetection: {},
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
      },
    },
  };
}

/** 마이크 PCM 청크(base64)를 실시간 입력으로 감쌉니다. */
export function buildAudioChunk(base64Pcm16k: string): RealtimeAudioMessage {
  return {
    realtimeInput: {
      audio: { data: base64Pcm16k, mimeType: INPUT_MIME_TYPE },
    },
  };
}

/** 사용자 역할 텍스트 턴. AI가 먼저 인사하도록 세션 시작 직후 트리거로 사용. */
export function buildUserTextTurn(text: string): ClientContentMessage {
  return {
    clientContent: {
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    },
  };
}
