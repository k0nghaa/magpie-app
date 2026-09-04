/**
 * PCM 변환 유틸.
 *
 * Gemini Live: 입력 16kHz PCM16 mono, 출력 24kHz PCM16 mono. (little-endian)
 * react-native-audio-api는 오디오를 Float32([-1,1])로 다루므로 Int16 PCM과 상호 변환이 필요합니다.
 * 엔디언은 DataView(littleEndian=true)로 명시해 플랫폼 의존성을 제거합니다.
 */
import { fromByteArray, toByteArray } from 'base64-js';

/** Float32([-1,1]) → PCM16 little-endian → base64. */
export function float32ToPcm16Base64(input: Float32Array): string {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    const s = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(i * 2, s, true);
  }
  return fromByteArray(bytes);
}

/** base64 PCM16 little-endian → Float32([-1,1]). */
export function pcm16Base64ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const bytes = toByteArray(base64);
  const sampleCount = bytes.length >> 1; // 2 bytes/sample
  const out = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < sampleCount; i++) {
    const s = view.getInt16(i * 2, true);
    out[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
  }
  return out;
}

/**
 * 선형 보간 리샘플러.
 * 마이크 하드웨어가 요청한 16kHz가 아닌 다른 샘플레이트(예: 48kHz)로 버퍼를 주는 경우,
 * Gemini가 요구하는 16kHz로 맞추기 위해 사용합니다.
 */
export function resampleLinear(
  input: Float32Array,
  inputRate: number,
  targetRate: number,
): Float32Array {
  if (inputRate === targetRate || input.length === 0) return input;
  const ratio = inputRate / targetRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcPos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}
