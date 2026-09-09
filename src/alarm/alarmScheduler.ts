/**
 * 알람 예약 추상화 — 설정 화면은 이 계층만 호출한다.
 *
 * - iOS 26+ (AlarmKit 사용 가능): 무음/DND를 뚫는 "진짜 알람"으로 매일 예약(M2.5).
 * - 그 외(iOS<26 / Android / Expo Go): 기존 M2 로컬 알림으로 fallback(아무도 잠기지 않게).
 *
 * 두 백엔드가 동시에 예약되면 이중 발화하므로, 예약할 때 반대편을 항상 취소한다.
 * 세션 코드/알림 스케줄러/네이티브 모듈은 수정하지 않고 이 계층에서 조합한다.
 */
import {
  cancelReminders,
  ensureNotificationPermission,
  getScheduledReminderTime,
  scheduleDailyReminder,
  type ReminderTime,
} from '../notifications/notificationScheduler';
import {
  cancelAllAlarms,
  getScheduledRealAlarmTime,
  isRealAlarmAvailable,
  requestAlarmAuthorization,
  scheduleDailyRealAlarm,
} from './realAlarm';

export type AlarmBackend = 'alarmkit' | 'notification';

/** 알람 문구(까치 페르소나). AlarmKit 제목·버튼 라벨에 사용. */
const ALARM_TITLE = '까치가 깨우러 왔어요 🐦';
const START_LABEL = '대화 시작';
const STOP_LABEL = '끄기';

/** 이 기기에서 실제로 쓰이는 백엔드. */
export function activeBackend(): AlarmBackend {
  return isRealAlarmAvailable() ? 'alarmkit' : 'notification';
}

/**
 * 알람 발화 권한 확보. AlarmKit이면 알람 권한, 아니면 알림 권한.
 * 허용됐으면 true.
 */
export async function ensureAlarmPermission(): Promise<boolean> {
  if (isRealAlarmAvailable()) {
    const state = await requestAlarmAuthorization();
    return state === 'authorized';
  }
  return ensureNotificationPermission();
}

/**
 * 매일 hour:minute에 알람 예약. 사용된 백엔드를 반환.
 * 반대편 백엔드의 잔여 예약을 취소해 이중 발화를 막는다.
 */
export async function scheduleDailyAlarm(
  hour: number,
  minute: number,
): Promise<AlarmBackend> {
  if (isRealAlarmAvailable()) {
    // 진짜 알람으로 예약. 과거 M2 알림 예약이 남아 있으면 취소(이중 발화 방지).
    await cancelReminders();
    await scheduleDailyRealAlarm(hour, minute, ALARM_TITLE, START_LABEL, STOP_LABEL);
    return 'alarmkit';
  }
  // fallback: M2 알림. 혹시 남아 있을 진짜 알람도 취소(미지원 기기면 no-op).
  await cancelAllAlarms();
  await scheduleDailyReminder(hour, minute);
  return 'notification';
}

/** 모든 알람/알림 예약 취소(양쪽 백엔드 모두). */
export async function cancelAllScheduled(): Promise<void> {
  await cancelAllAlarms(); // AlarmKit (미지원이면 no-op)
  await cancelReminders(); // M2 알림
}

/**
 * 현재 예약된 시각(설정 화면 표시용). 없으면 null.
 * AlarmKit 예약을 우선 확인하고, 없으면 M2 알림 예약을 확인(백엔드 전환 케이스 대비).
 */
export async function getScheduledAlarmTime(): Promise<ReminderTime | null> {
  const real = getScheduledRealAlarmTime();
  if (real) return real;
  return getScheduledReminderTime();
}
