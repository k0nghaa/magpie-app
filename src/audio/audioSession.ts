/**
 * 오디오 세션 & 마이크 권한 설정 (react-native-audio-api의 AudioManager).
 *
 * PRD F1-3: 무음 모드에서도 스피커로 재생, 이어폰 연결 시 이어폰.
 * - iosCategory 'playAndRecord' + iosOptions 'defaultToSpeaker' → 무음 스위치 무시하고 스피커 출력, 동시에 마이크 입력.
 *   (무음 스위치 무시·duplex는 카테고리가 담당하므로 iosMode와 무관하게 유지됨.)
 * - iosMode 'default' → 미디어 수준 볼륨으로 스피커 재생.
 *   과거엔 'voiceChat'(AEC 목적)을 썼으나, 설치된 react-native-audio-api@0.13.3은
 *   VoiceProcessingIO를 연결하지 않아 voiceChat으로도 실제 AEC가 걸리지 않는다(조사 확인).
 *   오히려 통신 모드 특유의 게인 억제·수화부 라우팅으로 AI 음성이 작게 들렸다.
 *   에코(스피커→마이크 되돌이)는 반이중 마이크 게이팅으로 별도 처리한다.
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
    iosMode: 'default',
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
