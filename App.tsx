import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import ConversationScreen from './src/ui/ConversationScreen';
import SettingsScreen from './src/ui/SettingsScreen';
import { useAppRoute } from './src/ui/appRoute';
import { useConversation } from './src/session/useConversation';
import { REMINDER_DATA_TYPE } from './src/notifications/notificationScheduler';

export default function App() {
  const screen = useAppRoute((s) => s.screen);
  const navigate = useAppRoute((s) => s.navigate);

  // 알림 탭으로 앱이 열렸을 때(백그라운드 복귀·완전 종료 cold start 모두)의 마지막 응답.
  // useLastNotificationResponse는 useLayoutEffect로 앱 시작 시 네이티브에 캐시된 응답을
  // 먼저 읽으므로, 이 훅을 App 루트(최상위)에서 호출해야 cold start 이벤트를 놓치지 않는다.
  const response = Notifications.useLastNotificationResponse();
  // 같은 응답 객체를 두 번 처리하지 않도록 참조로 가드(중복 start 방지).
  const handledResponse = useRef<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    if (!response) return;
    if (handledResponse.current === response) return;

    // 알림 본문/버튼이 아니라 "기본 탭(default action)"으로 열린 경우만 자동 시작.
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const data = response.notification.request.content.data as {
      type?: string;
    };
    if (data?.type !== REMINDER_DATA_TYPE) return;

    handledResponse.current = response;
    // F1-2: 추가 조작 없이 즉시 대화 세션 시작.
    // start()는 이미 connecting/active면 무시하므로 중복 호출에 안전(세션 코드 미수정, 호출만).
    navigate('conversation');
    useConversation.getState().start();

    // 처리한 응답을 네이티브에서 clear.
    // useLastNotificationResponse가 돌려주는 응답은 clear 전까지 네이티브에 영구 저장되므로,
    // clear하지 않으면 앱을 종료했다가 나중에 아이콘으로 직접 열 때 이 낡은 응답이 되살아나
    // (useRef 가드는 새 프로세스에서 초기화됨) 원치 않는 대화가 자동 시작된다(F1-4 붕괴).
    void Notifications.clearLastNotificationResponseAsync();
  }, [response, navigate]);

  return screen === 'settings' ? <SettingsScreen /> : <ConversationScreen />;
}
