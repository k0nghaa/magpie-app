/**
 * 진짜 알람(AlarmKit) 접근 래퍼 — 플랫폼·모듈 존재를 가드한다.
 *
 * iOS 26+ & 네이티브 모듈이 있을 때만 실제 AlarmKit을 쓰고, 그 외(iOS<26, Android, Expo Go)에서는
 * isRealAlarmAvailable()이 false를 반환해 호출자가 M2 로컬 알림으로 fallback하게 한다.
 * (세션 코드/알림 스케줄러는 수정하지 않고 이 계층에서 분기.)
 */
import { Platform } from 'react-native';
import type {
  AlarmAuthState,
  RealAlarmNativeModule,
  ScheduledTime,
} from '../../modules/expo-real-alarm';

export type { AlarmAuthState, ScheduledTime };

// iOS에서만 네이티브 모듈을 로드. 모듈이 없으면(빌드에 미포함/Expo Go) null로 두고 전부 fallback.
let native: RealAlarmNativeModule | null = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    native = require('../../modules/expo-real-alarm').default as RealAlarmNativeModule;
  } catch {
    native = null;
  }
}

/** 이 기기에서 진짜 알람(AlarmKit)을 쓸 수 있는가. false면 M2 알림으로 fallback. */
export function isRealAlarmAvailable(): boolean {
  try {
    return !!native && native.isAvailable();
  } catch {
    return false;
  }
}

/** 알람 버튼이 기록한 pending-start(alarm id)를 소비. 없으면 null. (앱 실행/포그라운드 복귀 시 호출) */
export function consumePendingAlarmStart(): string | null {
  if (!native) return null;
  try {
    return native.consumePendingStart();
  } catch {
    return null;
  }
}

export async function getAlarmAuthState(): Promise<AlarmAuthState> {
  if (!native) return 'denied';
  return native.getAuthorizationState();
}

export async function requestAlarmAuthorization(): Promise<AlarmAuthState> {
  if (!native) return 'denied';
  return native.requestAuthorization();
}

export async function scheduleDailyRealAlarm(
  hour: number,
  minute: number,
  title: string,
  startLabel: string,
  stopLabel: string,
): Promise<string> {
  if (!native) throw new Error('AlarmKit을 사용할 수 없는 기기입니다.');
  return native.scheduleDaily(hour, minute, title, startLabel, stopLabel);
}

/** 예약된 시각(설정 화면 복원용). 없거나 미지원이면 null. */
export function getScheduledRealAlarmTime(): ScheduledTime | null {
  if (!native) return null;
  try {
    return native.getScheduledTime();
  } catch {
    return null;
  }
}

export async function cancelAllAlarms(): Promise<void> {
  if (!native) return;
  return native.cancelAll();
}
