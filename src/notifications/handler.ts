/**
 * 알림 표시 핸들러 설정.
 *
 * 앱이 포그라운드일 때 도착한 알림도 배너로 띄운다.
 * (사용자가 앱을 켜 둔 상태에서도 아침 알림을 보고 탭 → 대화 진입할 수 있게.)
 *
 * setNotificationHandler는 앱 렌더 이전 최대한 이른 시점에 1회 호출해야 하므로
 * index.ts에서 registerRootComponent 전에 configureNotifications()를 부른다.
 */
import * as Notifications from 'expo-notifications';

export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    // SDK 53+ 신규 필드(shouldShowAlert 대체): 배너/목록/소리/배지를 개별 제어.
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
