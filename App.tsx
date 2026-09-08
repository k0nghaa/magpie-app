import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import ConversationScreen from './src/ui/ConversationScreen';
import SettingsScreen from './src/ui/SettingsScreen';
import { useAppRoute } from './src/ui/appRoute';
import { useConversation } from './src/session/useConversation';
import { REMINDER_DATA_TYPE } from './src/notifications/notificationScheduler';
import { consumePendingAlarmStart } from './src/alarm/realAlarm';

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

  // M2.5: AlarmKit 알람의 [대화 시작] 버튼으로 앱이 실행됐을 때의 처리.
  // 알람 버튼의 인텐트가 App Group에 pending-start(alarm id)를 기록해 두므로,
  // 앱 실행 시(cold start)와 포그라운드 복귀 시(백그라운드에서 알람 탭) 그 값을 소비해 대화를 시작한다.
  // consumePendingStart는 읽는 즉시 native에서 clear되므로 중복 시작에 안전(별도 useRef 가드 불필요).
  // 미지원 기기(iOS<26/Android)에서는 consumePendingAlarmStart()가 항상 null → 무해.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const consumeAlarmStart = (): boolean => {
      const alarmId = consumePendingAlarmStart();
      if (!alarmId) return false;
      // 알림 탭 경로와 동일: 화면 전환 후 세션 시작(세션 코드 미수정, 호출만).
      // start()는 이미 connecting/active면 무시하므로 중복 호출에 안전.
      navigate('conversation');
      useConversation.getState().start();
      return true;
    };

    // cold start(알람 버튼으로 앱이 새로 실행된 경우). App Group의 크로스프로세스 전파가
    // JS 부팅보다 늦을 극단적 경우를 대비해 짧게 재시도한다(R1). cold start는 이미 active로
    // 부팅돼 AppState 'active' 리스너가 재발화하지 않으므로, 여기서 놓치면 복구 기회가 없다.
    // consumePendingStart는 읽는 즉시 clear + start()가 idempotent라 재시도는 중복 시작을 안 만든다.
    if (!consumeAlarmStart()) {
      timers.push(setTimeout(() => consumeAlarmStart(), 400));
      timers.push(setTimeout(() => consumeAlarmStart(), 1200));
    }

    const sub = AppState.addEventListener('change', (state) => {
      // 백그라운드에 있던 앱을 알람 버튼이 다시 띄운 경우(warm) — 활성화 시점에 재확인.
      if (state === 'active') consumeAlarmStart();
    });
    return () => {
      timers.forEach(clearTimeout);
      sub.remove();
    };
  }, [navigate]);

  return screen === 'settings' ? <SettingsScreen /> : <ConversationScreen />;
}
