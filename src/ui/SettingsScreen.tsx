/**
 * 알림 시간 설정 화면 (M2).
 *
 * - 최소한의 시간 picker(@react-native-community/datetimepicker)로 아침 알림 시각 설정.
 * - 저장 시: 알림 권한 확보 → 마이크 권한 선확보(ensureMicPermission, 아침 첫 대화에서
 *   권한 팝업이 뜨지 않게) → 매일 반복 알림 예약.
 * - 요일별 on/off는 이번 범위에서 생략(PRD F4-1의 요일 부분 제외).
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { ensureMicPermission } from '../audio/audioSession';
import {
  activeBackend,
  cancelAllScheduled,
  ensureAlarmPermission,
  getScheduledAlarmTime,
  scheduleDailyAlarm,
} from '../alarm/alarmScheduler';
import { useAppRoute } from './appRoute';

/** hour/minute → 오늘 날짜의 Date (picker는 Date를 다룸). */
function toDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function formatTime(hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function SettingsScreen() {
  const navigate = useAppRoute((s) => s.navigate);

  const [date, setDate] = useState<Date>(() => toDate(7, 0));
  const [scheduledLabel, setScheduledLabel] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // 마운트 시 현재 예약된 시각을 복원해 표시.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await getScheduledAlarmTime();
        if (cancelled) return;
        if (current) {
          setDate(toDate(current.hour, current.minute));
          setScheduledLabel(formatTime(current.hour, current.minute));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setDate(selected);
  };

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const hour = date.getHours();
      const minute = date.getMinutes();

      // 1) 알람/알림 권한 (iOS26+는 AlarmKit 권한, 그 외는 알림 권한)
      const permOk = await ensureAlarmPermission();
      if (!permOk) {
        const usesAlarm = activeBackend() === 'alarmkit';
        Alert.alert(
          usesAlarm ? '알람 권한이 필요해요' : '알림 권한이 필요해요',
          usesAlarm
            ? '설정 > 매그파이에서 알람을 허용해 주세요.'
            : '설정 > 앱 > 매그파이에서 알림을 허용해 주세요.',
        );
        return;
      }

      // 2) 마이크 권한 선확보 (아침 첫 대화에서 팝업이 뜨지 않게)
      const micOk = await ensureMicPermission();

      // 3) 매일 반복 예약 (백엔드는 기기에 따라 AlarmKit 또는 M2 알림)
      const backend = await scheduleDailyAlarm(hour, minute);
      setScheduledLabel(formatTime(hour, minute));

      // 진짜 알람은 무음/DND 관통을 안내, M2 알림 fallback은 Android 정확 알람 주의를 안내.
      const backendNote =
        backend === 'alarmkit'
          ? '\n\n무음·방해금지 모드에서도 알람처럼 확실히 울려요.'
          : '';
      const exactNote =
        backend === 'notification' && Platform.OS === 'android'
          ? '\n\n(안드로이드 14 이상에서 "정확한 알람" 권한이 꺼져 있으면 시각이 최대 1시간까지 늦어질 수 있어요.)'
          : '';
      const micNote = micOk
        ? ''
        : '\n\n마이크 권한이 아직 허용되지 않았어요. 아침 대화 시작 시 권한 팝업이 뜰 수 있습니다.';
      Alert.alert(
        '알림을 맞췄어요 🐦',
        `매일 ${formatTime(hour, minute)}에 까치가 깨워줄게요.${backendNote}${micNote}${exactNote}`,
      );
    } catch (e) {
      Alert.alert('문제가 발생했어요', String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelAllScheduled();
      setScheduledLabel(null);
      Alert.alert('알림을 껐어요', '아침 알림 예약이 해제되었습니다.');
    } catch (e) {
      Alert.alert('문제가 발생했어요', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => navigate('conversation')} hitSlop={12}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>알림 설정</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>아침 알림 시간</Text>

        {loading ? (
          <ActivityIndicator color="#ffd166" />
        ) : (
          <>
            <Text style={styles.time}>
              {formatTime(date.getHours(), date.getMinutes())}
            </Text>

            {Platform.OS === 'android' && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowPicker(true)}
              >
                <Text style={styles.secondaryText}>시간 선택</Text>
              </Pressable>
            )}

            {showPicker && (
              <DateTimePicker
                value={date}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
                themeVariant="dark"
              />
            )}

            <Text style={styles.status}>
              {scheduledLabel
                ? `현재 예약: 매일 ${scheduledLabel}`
                : '예약된 알림이 없어요'}
            </Text>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          저장하면 알림·마이크 권한을 미리 확보해요 (아침 첫 대화에서 팝업 방지).
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.saveButton,
            (pressed || busy) && styles.pressed,
          ]}
          onPress={onSave}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? '처리 중…' : '이 시간으로 알림 켜기'}
          </Text>
        </Pressable>

        {scheduledLabel && (
          <Pressable
            style={({ pressed }) => [
              styles.textButton,
              (pressed || busy) && styles.pressed,
            ]}
            onPress={onDisable}
            disabled={busy}
          >
            <Text style={styles.textButtonLabel}>알림 끄기</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1420',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: '#ffd166', fontSize: 16, fontWeight: '600', width: 64 },
  headerSpacer: { width: 64 },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  label: { color: '#c3c9d6', fontSize: 16 },
  time: { color: '#ffffff', fontSize: 56, fontWeight: '700', letterSpacing: 2 },
  status: { color: '#8a93a6', fontSize: 14, marginTop: 8 },
  footer: { alignItems: 'center', gap: 12 },
  footerHint: { color: '#6b7280', fontSize: 13, textAlign: 'center' },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 999,
    minWidth: 240,
    alignItems: 'center',
  },
  saveButton: { backgroundColor: '#ffd166' },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#0f1420' },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffd166',
  },
  secondaryText: { color: '#ffd166', fontSize: 15, fontWeight: '600' },
  textButton: { paddingVertical: 10 },
  textButtonLabel: { color: '#ef476f', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
