/**
 * 대화 오케스트레이터.
 * 마이크(recorder) ↔ Gemini Live(client) ↔ 스피커(player)를 배선합니다.
 *
 * 흐름: 권한/세션 → 연결 → setupComplete → AI 첫 인사 트리거(F2-1) →
 *       마이크 스트리밍 시작(F2-2, 서버 VAD가 턴 감지) → 모델 오디오 재생.
 */
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/env';
import {
  activateConversationSession,
  deactivateSession,
  ensureMicPermission,
} from '../audio/audioSession';
import { PcmStreamPlayer } from '../audio/player';
import { MicRecorder } from '../audio/recorder';
import { GeminiLiveClient } from '../gemini/liveClient';
import {
  GREETING_TRIGGER,
  MAGPIE_SYSTEM_PROMPT,
  MAGPIE_VOICE,
} from '../prompts/magpiePersona';

export interface ConversationEvents {
  onConnecting?: () => void;
  /** 연결·마이크 스트리밍까지 준비 완료(대화 진행 중). */
  onActive?: () => void;
  /** AI가 말하는 중 여부(상태 표시용). */
  onAiSpeaking?: (speaking: boolean) => void;
  onError?: (message: string) => void;
  /** 세션 종료(사용자 종료 또는 서버 연결 종료). */
  onEnded?: () => void;
}

export class ConversationController {
  private client: GeminiLiveClient | null = null;
  private readonly recorder = new MicRecorder();
  private readonly player = new PcmStreamPlayer();
  private readonly events: ConversationEvents;
  private active = false;
  /**
   * 반이중(half-duplex) 게이팅 플래그.
   * true(AI 발화 중)일 때는 마이크 청크를 서버로 보내지 않는다.
   * 0.13.3에는 iOS AEC가 없어(조사 확인) 스피커로 나온 AI 음성이 마이크로 되돌아가
   * "사용자 발화"로 전사되며 가짜 barge-in을 유발하는데, 발화 국면 자체를 막아 이를 차단한다.
   * 트레이드오프: AI가 말하는 동안에는 사용자가 끼어들어도(barge-in) 서버가 감지하지 못한다.
   */
  private aiSpeaking = false;

  constructor(events: ConversationEvents) {
    this.events = events;
  }

  async start(): Promise<void> {
    if (this.active) return;

    if (!GEMINI_API_KEY) {
      this.events.onError?.(
        'API 키가 없습니다. .env의 EXPO_PUBLIC_GEMINI_API_KEY를 설정하고 다시 빌드하세요.',
      );
      return;
    }

    this.events.onConnecting?.();

    // 1) 마이크 권한 + 오디오 세션
    const granted = await ensureMicPermission();
    if (!granted) {
      this.events.onError?.('마이크 권한이 필요합니다.');
      return;
    }
    await activateConversationSession();
    this.player.init();

    // 2) Gemini Live 연결
    const client = new GeminiLiveClient({
      apiKey: GEMINI_API_KEY,
      setup: {
        model: GEMINI_MODEL,
        systemInstruction: MAGPIE_SYSTEM_PROMPT,
        voiceName: MAGPIE_VOICE,
      },
      callbacks: {
        onSetupComplete: () => {
          void this.handleSetupComplete();
        },
        onAudio: (base64) => {
          // AI 발화 시작 → 반이중 게이팅 ON (이 동안 마이크 전송 스킵)
          this.aiSpeaking = true;
          this.events.onAiSpeaking?.(true);
          this.player.enqueue(base64);
        },
        onTurnComplete: () => {
          // AI 발화 종료 → 게이팅 OFF (마이크 전송 재개)
          this.aiSpeaking = false;
          this.events.onAiSpeaking?.(false);
        },
        onError: (message) => {
          this.events.onError?.(message);
        },
        onClose: () => {
          if (this.active) {
            this.events.onEnded?.();
            void this.cleanup();
          }
        },
      },
    });

    this.client = client;
    this.active = true;
    client.connect();
  }

  private async handleSetupComplete(): Promise<void> {
    // AI가 먼저 인사하고 첫 질문 (F2-1)
    this.client?.sendUserText(GREETING_TRIGGER);
    // 마이크 스트리밍 시작 → 사용자가 말을 마치면 서버 VAD가 감지해 AI가 자동 응답 (F2-2)
    // 반이중: AI가 말하는 동안(aiSpeaking)에는 청크를 보내지 않아 에코가 서버로 유입되는 것을 막는다.
    // 턴 종료 판단은 서버 auto-VAD에 맡긴다(클라 Hybrid VAD는 전송 중지로 데드락을 유발해 제거).
    await this.recorder.start((chunk) => {
      if (this.aiSpeaking) return;
      this.client?.sendAudioChunk(chunk);
    });
    this.events.onActive?.();
  }

  async stop(): Promise<void> {
    if (!this.active) return;
    this.events.onEnded?.();
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    this.active = false;
    await this.recorder.stop();
    await this.player.dispose();
    this.client?.close();
    this.client = null;
    await deactivateSession();
  }

  /** 디버그: 마이크 실제 샘플레이트(0이면 아직 콜백 전). */
  getMicSampleRate(): number {
    return this.recorder.getActualSampleRate();
  }
}
