/**
 * 오디오 세션 & 마이크 권한 설정 (react-native-audio-api의 AudioManager).
 *
 * PRD F1-3: 무음 모드에서도 스피커로 재생, 이어폰 연결 시 이어폰.
 * - iosCategory 'playAndRecord' + iosOptions 'defaultToSpeaker' → 무음 스위치 무시하고 스피커 출력, 동시에 마이크 입력.
 * - iosMode 'voiceChat' → 에코 제거(AEC) 활성화. 스피커로 나온 AI 음성이 마이크로 되돌아가
 *   barge-in을 오검출하는 것을 막아줌(핸즈프리 대화의 핵심).
 */
import { AudioManager } from 'react-native-audio-api';

/** 마이크 권한 확보. 이미 허용돼 있으면 즉시 true. */
export async function ensureMicPermission(): Promise<boolean> {
  const current = await AudioManager.checkRecordingPermissions();
  if (current === 'Granted') return true;
  const result = await AudioManager.requestRecordingPermissions();
  return result === 'Granted';
}

/** 대화용 오디오 세션 활성화. */
export async function activateConversationSession(): Promise<void> {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'voiceChat',
    iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP', 'allowBluetoothA2DP'],
  });
  await AudioManager.setAudioSessionActivity(true);
}

/** 세션 비활성화(대화 종료 시). */
export async function deactivateSession(): Promise<void> {
  try {
    await AudioManager.setAudioSessionActivity(false);
  } catch {
    // 이미 비활성 상태면 무시
  }
}
