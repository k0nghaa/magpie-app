/**
 * [M2.5 스파이크 전용] AlarmKit 진짜 알람 온디바이스 검증 패널.
 *
 * 목적: iPhone(iOS 26.6.1)에서 (1) 알람이 무음/잠금에서 실제로 울리는지, (2) [대화 시작] 버튼으로
 * 앱이 실행되며 대화 세션이 시작되는지, (3) 완전 종료 상태에서도 되는지를 실증.
 *
 * 검증이 끝나면 이 파일과 SettingsScreen의 <AlarmSpikePanel/> 렌더 블록만 지우면 된다(격리됨).
 * 본구현에서는 이 로직을 매일 반복 예약 + fallback 분기로 정식화한다.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  cancelAllAlarms,
  getAlarmAuthState,
  isRealAlarmAvailable,
  requestAlarmAuthorization,
  scheduleTestAlarm,
  type AlarmAuthState,
} from '../alarm/realAlarm';

const TEST_DELAY_SECONDS = 15;

export default function AlarmSpikePanel() {
  const available = isRealAlarmAvailable();
  const [auth, setAuth] = useState<AlarmAuthState | '—'>('—');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!available) return;
    void getAlarmAuthState().then(setAuth).catch(() => setAuth('denied'));
  }, [available]);

  const onRequestAuth = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const state = await requestAlarmAuthorization();
      setAuth(state);
      if (state !== 'authorized') {
        Alert.alert(
          '알람 권한 필요',
          '설정 > 매그파이에서 알람을 허용해 주세요. (현재: ' + state + ')',
        );
      }
    } catch (e) {
      Alert.alert('권한 요청 실패', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onScheduleTest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let state = auth === '—' ? await getAlarmAuthState() : auth;
      if (state !== 'authorized') {
        state = await requestAlarmAuthorization();
        setAuth(state);
      }
      if (state !== 'authorized') {
        Alert.alert('알람 권한이 없어요', '먼저 [알람 권한 요청]을 눌러 허용해 주세요.');
        return;
      }
      await scheduleTestAlarm(
        TEST_DELAY_SECONDS,
        '까치가 깨우러 왔어요 🐦',
        '대화 시작',
        '끄기',
      );
      Alert.alert(
        `${TEST_DELAY_SECONDS}초 뒤 알람이 울려요`,
        '지금 화면을 끄고(무음 스위치 켜고) 기다려 보세요.\n\n알람이 뜨면 [대화 시작]을 눌러 앱이 열리고 대화가 시작되는지 확인하세요.\n\n※ 완전 종료 테스트: 예약 직후 앱을 스와이프로 완전히 종료한 뒤 기다려 보세요.',
      );
    } catch (e) {
      Alert.alert('예약 실패', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onCancelAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelAllAlarms();
      Alert.alert('알람 취소', '예약/울림 중인 알람을 모두 취소했어요.');
    } catch (e) {
      Alert.alert('취소 실패', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>🔔 AlarmKit 스파이크 (개발용)</Text>
      <Text style={styles.meta}>
        지원(iOS 26+): {available ? '예' : '아니오 (fallback)'} · 권한: {auth}
      </Text>

      {!available ? (
        <Text style={styles.note}>
          이 기기에서는 진짜 알람을 쓸 수 없어 M2 일반 알림으로 대체됩니다.
        </Text>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.btn, (pressed || busy) && styles.pressed]}
            onPress={onRequestAuth}
            disabled={busy}
          >
            <Text style={styles.btnText}>알람 권한 요청</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.primary,
              (pressed || busy) && styles.pressed,
            ]}
            onPress={onScheduleTest}
            disabled={busy}
          >
            <Text style={[styles.btnText, styles.primaryText]}>
              {TEST_DELAY_SECONDS}초 뒤 테스트 알람
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, (pressed || busy) && styles.pressed]}
            onPress={onCancelAll}
            disabled={busy}
          >
            <Text style={styles.btnText}>모든 알람 취소</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a3350',
    backgroundColor: '#141b2d',
    gap: 10,
  },
  title: { color: '#ffd166', fontSize: 15, fontWeight: '700' },
  meta: { color: '#8a93a6', fontSize: 13 },
  note: { color: '#8a93a6', fontSize: 13 },
  btn: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a4160',
  },
  primary: { backgroundColor: '#ffd166', borderColor: '#ffd166' },
  btnText: { color: '#c3c9d6', fontSize: 15, fontWeight: '600' },
  primaryText: { color: '#0f1420', fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
