/**
 * Gemini Live API (BidiGenerateContent) 메시지 타입.
 * 실제 스키마는 방대하지만, M1에서 실제로 주고받는 필드만 최소로 정의합니다.
 * 참고: https://ai.google.dev/api/live
 */

// ─────────────────────────── 클라이언트 → 서버 ───────────────────────────

export interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

/** 세션 시작 시 최초 1회 보내는 setup 메시지. */
export interface SetupMessage {
  setup: {
    model: string;
    generationConfig?: {
      responseModalities?: Array<'AUDIO' | 'TEXT'>;
      speechConfig?: {
        voiceConfig?: { prebuiltVoiceConfig?: { voiceName: string } };
        languageCode?: string;
      };
    };
    systemInstruction?: { parts: Part[] };
    realtimeInputConfig?: {
      automaticActivityDetection?: {
        disabled?: boolean;
        startOfSpeechSensitivity?: string;
        endOfSpeechSensitivity?: string;
        prefixPaddingMs?: number;
        silenceDurationMs?: number;
      };
      activityHandling?: 'START_OF_ACTIVITY_INTERRUPTS' | 'NO_INTERRUPTION';
    };
  };
}

/** 실시간 오디오 청크 전송(마이크). */
export interface RealtimeAudioMessage {
  realtimeInput: {
    audio: { data: string; mimeType: string };
  };
}

/** 텍스트 턴 전송(예: AI가 먼저 말하게 하는 트리거). */
export interface ClientContentMessage {
  clientContent: {
    turns: Content[];
    turnComplete: boolean;
  };
}

export type ClientMessage =
  | SetupMessage
  | RealtimeAudioMessage
  | ClientContentMessage;

// ─────────────────────────── 서버 → 클라이언트 ───────────────────────────

export interface ServerContent {
  modelTurn?: { parts?: Part[] };
  /** 사용자가 끼어들어 모델 발화가 중단됨(barge-in). */
  interrupted?: boolean;
  /** 현재 턴의 모델 발화 종료. */
  turnComplete?: boolean;
  /** 모델 생성 완료(오디오 스트림 끝). */
  generationComplete?: boolean;
}

export interface ServerMessage {
  setupComplete?: Record<string, never>;
  serverContent?: ServerContent;
  /** 세션이 곧 종료됨(타임아웃 등). */
  goAway?: { timeLeft?: string };
  // toolCall, sessionResumptionUpdate 등은 M1에서 사용하지 않음.
  [key: string]: unknown;
}
