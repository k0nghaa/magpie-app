/**
 * 마이크 캡처 → 16kHz PCM16 base64 청크 스트림.
 *
 * AudioRecorder.onAudioReady 콜백은 요청한 설정(16kHz/mono)에 맞춘 AudioBuffer를 주지만,
 * 하드웨어에 따라 실제 샘플레이트가 다를 수 있어(예: 48kHz) 필요 시 16kHz로 리샘플합니다.
 */
import { AudioRecorder } from 'react-native-audio-api';
import { INPUT_SAMPLE_RATE } from '../gemini/protocol';
import { float32ToPcm16Base64, resampleLinear } from './pcm';

const CHUNK_SAMPLES = 1600; // 16kHz 기준 약 100ms

export class MicRecorder {
  private recorder: AudioRecorder | null = null;
  private running = false;
  /** 실기기에서 실제 전달된 샘플레이트(디버그/검증용). */
  private lastSampleRate = 0;

  /** 캡처 시작. onChunk로 16kHz PCM16 base64 청크가 흘러나옵니다. */
  async start(onChunk: (base64Pcm16k: string) => void): Promise<void> {
    if (this.running) return;
    const recorder = new AudioRecorder();
    this.recorder = recorder;

    recorder.onAudioReady(
      {
        sampleRate: INPUT_SAMPLE_RATE,
        bufferLength: CHUNK_SAMPLES,
        channelCount: 1,
      },
      (event) => {
        const rate = event.buffer.sampleRate;
        this.lastSampleRate = rate;
        const mono = event.buffer.getChannelData(0);
        const pcm16k =
          rate === INPUT_SAMPLE_RATE
            ? mono
            : resampleLinear(mono, rate, INPUT_SAMPLE_RATE);
        onChunk(float32ToPcm16Base64(pcm16k));
      },
    );

    await recorder.start();
    this.running = true;
  }

  getActualSampleRate(): number {
    return this.lastSampleRate;
  }

  async stop(): Promise<void> {
    if (!this.recorder) return;
    this.running = false;
    try {
      this.recorder.clearOnAudioReady();
      await this.recorder.stop();
    } catch {
      // 이미 정지된 경우 무시
    }
    this.recorder = null;
  }
}
