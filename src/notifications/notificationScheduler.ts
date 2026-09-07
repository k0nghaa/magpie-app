/**
 * 로컬 알림 예약/취소 (expo-notifications).
 *
 * PRD F1-1: 사용자가 지정한 시각에 매일 반복되는 로컬 알림.
 * - DAILY 트리거는 iOS에서 UNCalendarNotificationTrigger(repeats:true)로,
 *   Android에서 fire될 때마다 다음 날을 재예약하는 방식으로 "매일 반복"된다.
 *   (repeats 필드는 불필요 — 라이브러리가 처리)
 *
 * 저장: 별도 저장소(AsyncStorage 등)를 두지 않고, 예약 알림의 content.data에
 *       { hour, minute }를 실어 두고 getAllScheduledNotificationsAsync로 되읽어
 *       현재 설정 시각을 복원한다(새 네이티브 의존성 회피).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** 이 앱이 만든 알림을 식별하는 태그(다른 알림과 구분·중복 예약 제거용). */
export const REMINDER_DATA_TYPE = 'morning-conversation';
/** Android 알림 채널 ID. */
const ANDROID_CHANNEL_ID = 'morning-reminder';

export interface ReminderTime {
  hour: number;
  minute: number;
}

/** content.data에서 우리 태그와 시각을 안전하게 읽기 위한 헬퍼. */
function readReminderData(
  data: unknown,
): { type?: string; hour?: number; minute?: number } {
  return (data ?? {}) as { type?: string; hour?: number; minute?: number };
}

/** Android 알림 채널 보장(8.0+는 모든 알림이 채널에 속해야 함). iOS는 무시. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: '아침 대화 알림',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * 알림 표시 권한 확보. 이미 허용돼 있으면 즉시 true.
 * Android 13+ 런타임 프롬프트는 채널이 하나 이상 있어야 뜨므로 채널을 먼저 만든다.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** 이 앱이 예약한 알림만 취소(다른 알림 영향 없이 중복 예약 제거). */
export async function cancelReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => readReminderData(n.content.data).type === REMINDER_DATA_TYPE)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * 매일 hour:minute에 반복되는 알림 예약.
 * 기존 예약을 먼저 지워 중복(여러 개가 쌓이는 것)을 막는다.
 */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
): Promise<string> {
  await cancelReminders();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '까치가 왔어요! 🐦',
      body: '오늘의 아침 영어 대화를 시작할까요?',
      sound: 'default',
      // 되읽기용 + 알림 탭 라우팅용 식별 데이터
      data: { type: REMINDER_DATA_TYPE, hour, minute },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      // iOS는 무시됨. Android에서만 채널 지정.
      channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
    },
  });
}

/**
 * 현재 예약된 알림 시각 조회(설정 화면 표시용). 예약이 없으면 null.
 * content.data에 저장해 둔 hour/minute을 우선 사용한다.
 */
export async function getScheduledReminderTime(): Promise<ReminderTime | null> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.find(
    (n) => readReminderData(n.content.data).type === REMINDER_DATA_TYPE,
  );
  if (!ours) return null;
  const { hour, minute } = readReminderData(ours.content.data);
  if (typeof hour === 'number' && typeof minute === 'number') {
    return { hour, minute };
  }
  return null;
}
