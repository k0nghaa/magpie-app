/**
 * expo-real-alarm — iOS 26 AlarmKit 진짜 알람 (M2.5 스파이크) 네이티브 모듈 바인딩.
 *
 * 무음/Focus/DND를 뚫는 시스템 알람을 예약하고, 알람의 [대화 시작] 버튼으로 앱을 실행한다.
 * iOS 전용(expo-module.config.json platforms: ["apple"]). 안드로이드/미지원 분기는 src/alarm/realAlarm.ts에서 가드.
 */
import { requireNativeModule } from 'expo-modules-core';

export type AlarmAuthState = 'notDetermined' | 'authorized' | 'denied';

export interface RealAlarmNativeModule {
  /** iOS 26+ 여부. false면 호출자는 M2 로컬 알림으로 fallback해야 한다. */
  isAvailable(): boolean;
  /** 알람 버튼이 기록한 pending-start(alarm id)를 읽고 지운다. 없으면 null. (동기) */
  consumePendingStart(): string | null;
  getAuthorizationState(): Promise<AlarmAuthState>;
  requestAuthorization(): Promise<AlarmAuthState>;
  /** now + secondsFromNow에 1회성 테스트 알람 예약. 예약된 alarm id 반환. */
  scheduleTestAlarm(
    secondsFromNow: number,
    title: string,
    startLabel: string,
    stopLabel: string,
  ): Promise<string>;
  cancelAll(): Promise<void>;
}

// requireNativeModule은 네이티브 모듈이 없으면(예: Android 빌드, Expo Go) throw한다.
// 상위 래퍼(src/alarm/realAlarm.ts)가 Platform·try/catch로 가드하므로 여기서는 직접 export.
export default requireNativeModule<RealAlarmNativeModule>('RealAlarm');
