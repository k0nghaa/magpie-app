/**
 * Gemini Live API 어댑터 (순수 WebSocket).
 *
 * @google/genai SDK의 Live 클라이언트는 Node 전용 `ws`에 의존해 RN/Hermes에서
 * 깨질 수 있으므로, RN 전역 WebSocket으로 BidiGenerateContent 엔드포인트에 직접 연결합니다.
 * PRD 6.2의 "엔진 교체가 쉬운 어댑터"를 위해, 상위 로직은 이 클래스의 콜백 인터페이스만 봅니다.
 */
import {
  buildAudioChunk,
  buildSetupMessage,
  buildUserTextTurn,
  buildWsUrl,
  type SetupOptions,
} from './protocol';
import type { ServerMessage } from './types';

export interface LiveClientCallbacks {
  /** setup 완료 → 이제 오디오/텍스트를 보낼 수 있음. */
  onSetupComplete?: () => void;
  /** 모델 오디오 청크 수신(base64 PCM16 @ 24kHz). */
  onAudio?: (base64Pcm: string) => void;
  /** 모델이 텍스트를 함께 보낼 때(있으면). */
  onText?: (text: string) => void;
  /** 사용자가 끼어들어 모델 발화가 중단됨(barge-in) → 재생 즉시 정지해야 함. */
  onInterrupted?: () => void;
  /** 현재 모델 턴 종료. */
  onTurnComplete?: () => void;
  /** 서버가 곧 세션을 종료함. */
  onGoAway?: (timeLeft?: string) => void;
  onError?: (message: string) => void;
  onClose?: (code: number, reason: string) => void;
}

type State = 'idle' | 'connecting' | 'open' | 'closed';

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private state: State = 'idle';
  private readonly apiKey: string;
  private readonly setupOptions: SetupOptions;
  private readonly cb: LiveClientCallbacks;

  constructor(params: {
    apiKey: string;
    setup: SetupOptions;
    callbacks: LiveClientCallbacks;
  }) {
    this.apiKey = params.apiKey;
    this.setupOptions = params.setup;
    this.cb = params.callbacks;
  }

  getState(): State {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  /** WebSocket 연결 후 setup 메시지 전송. setupComplete는 onSetupComplete 콜백으로 통지. */
  connect(): void {
    if (this.state === 'connecting' || this.state === 'open') return;
    this.state = 'connecting';

    const ws = new WebSocket(buildWsUrl(this.apiKey));
    // 서버가 바이너리 프레임(JSON payload)으로 보내는 경우를 위해 ArrayBuffer로 받음.
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      // 연결되면 곧바로 setup 메시지를 보냄. setupComplete를 받기 전까지 다른 메시지 금지.
      this.sendRaw(buildSetupMessage(this.setupOptions));
    };

    ws.onmessage = (event: WebSocketMessageEvent) => {
      this.handleMessage(event.data);
    };

    ws.onerror = (event: Event) => {
      const message =
        // RN의 WebSocket error 이벤트는 message 필드를 담기도 함
        (event as unknown as { message?: string }).message ??
        'WebSocket 오류';
      this.cb.onError?.(message);
    };

    ws.onclose = (event: WebSocketCloseEvent) => {
      this.state = 'closed';
      this.cb.onClose?.(event.code ?? 0, event.reason ?? '');
    };
  }

  /** 마이크 PCM16(16kHz) base64 청크 전송. */
  sendAudioChunk(base64Pcm16k: string): void {
    if (this.state !== 'open') return;
    this.sendRaw(buildAudioChunk(base64Pcm16k));
  }

  /** 텍스트 턴 전송(AI 첫 발화 트리거 등). */
  sendUserText(text: string): void {
    if (this.state !== 'open') return;
    this.sendRaw(buildUserTextTurn(text));
  }

  close(): void {
    this.state = 'closed';
    if (this.ws) {
      // 콜백이 더 불리지 않도록 핸들러 제거 후 닫음.
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // 이미 닫혔으면 무시
      }
      this.ws = null;
    }
  }

  // ─────────────────────────── 내부 ───────────────────────────

  private sendRaw(obj: unknown): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify(obj));
  }

  private handleMessage(data: string | ArrayBuffer): void {
    let text: string;
    try {
      text = typeof data === 'string' ? data : utf8Decode(data);
    } catch (e) {
      this.cb.onError?.(`메시지 디코딩 실패: ${String(e)}`);
      return;
    }

    let msg: ServerMessage;
    try {
      msg = JSON.parse(text) as ServerMessage;
    } catch {
      this.cb.onError?.(`메시지 JSON 파싱 실패: ${text.slice(0, 120)}`);
      return;
    }

    if (msg.setupComplete !== undefined) {
      this.state = 'open';
      this.cb.onSetupComplete?.();
      return;
    }

    // [debug] 오디오가 아닌 서버 신호는 키를 로그로 남겨 활동 감지(activityStart 등)를 눈으로 확인.
    if (__DEV__) {
      const topKeys = Object.keys(msg);
      const nonAudio = topKeys.some((k) => k !== 'serverContent');
      const scDbg = msg.serverContent;
      const scKeys = scDbg ? Object.keys(scDbg) : [];
      const onlyAudio =
        scKeys.length === 1 && scKeys[0] === 'modelTurn';
      if (nonAudio || !onlyAudio) {
        console.log('[live] recv:', topKeys.join(','), 'sc:', scKeys.join(','));
      }
      const inTx = msg.serverContent?.inputTranscription?.text;
      if (inTx) console.log('[live] 사용자 전사:', JSON.stringify(inTx));
    }

    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) {
        this.cb.onInterrupted?.();
      }
      const parts = sc.modelTurn?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          this.cb.onAudio?.(part.inlineData.data);
        }
        if (part.text) {
          this.cb.onText?.(part.text);
        }
      }
      if (sc.turnComplete) {
        this.cb.onTurnComplete?.();
      }
    }

    if (msg.goAway) {
      this.cb.onGoAway?.(msg.goAway.timeLeft);
    }
  }
}

/**
 * ArrayBuffer(UTF-8) → string.
 * Hermes에 TextDecoder가 있으면 사용하고, 없으면 legacy escape 트릭으로 폴백.
 */
function utf8Decode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const Decoder = (globalThis as { TextDecoder?: typeof TextDecoder }).TextDecoder;
  if (Decoder) {
    return new Decoder('utf-8').decode(bytes);
  }
  // 폴백: 바이트를 latin1 문자열로 만든 뒤 UTF-8 디코드.
  let latin1 = '';
  for (let i = 0; i < bytes.length; i++) {
    latin1 += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(latin1));
}
