/**
 * 24kHz PCM16 스트림 재생 (무갭) + barge-in 정지.
 *
 * Gemini가 청크로 보내는 오디오를 AudioBufferQueueSourceNode에 enqueue 하면
 * 백투백으로 이어 재생됩니다. 사용자가 끼어들면(interrupted) clearBuffers()로
 * 큐에 남은 오디오를 즉시 비웁니다.
 */
import {
  AudioContext,
  AudioBufferQueueSourceNode,
} from 'react-native-audio-api';
import { OUTPUT_SAMPLE_RATE } from '../gemini/protocol';
import { pcm16Base64ToFloat32 } from './pcm';

export class PcmStreamPlayer {
  private ctx: AudioContext | null = null;
  private queue: AudioBufferQueueSourceNode | null = null;

  /** 재생 그래프 초기화. */
  init(): void {
    if (this.ctx) return;
    const ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    const queue = ctx.createBufferQueueSource();
    queue.connect(ctx.destination);
    queue.start();
    this.ctx = ctx;
    this.queue = queue;
  }

  /** 모델 오디오 청크(base64 PCM16 @ 24kHz) 재생 큐에 추가. */
  enqueue(base64Pcm24k: string): void {
    if (!this.ctx || !this.queue) return;
    const float32 = pcm16Base64ToFloat32(base64Pcm24k);
    if (float32.length === 0) return;
    const buffer = this.ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);
    this.queue.enqueueBuffer(buffer);
  }

  /** barge-in: 큐에 남은 오디오 즉시 비우기. */
  flush(): void {
    this.queue?.clearBuffers();
  }

  /** 재생 그래프 정리. */
  async dispose(): Promise<void> {
    try {
      this.queue?.stop();
    } catch {
      // 무시
    }
    this.queue = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        // 무시
      }
      this.ctx = null;
    }
  }
}
