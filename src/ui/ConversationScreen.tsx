/**
 * M1 최소 화면: [대화 시작] 버튼 · 대화 중 상태 표시 · [종료] 버튼.
 * (알림/보상/설정은 M2~M3 범위라 여기 없음)
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { hasApiKey } from '../config/env';
import { useConversation } from '../session/useConversation';

export default function ConversationScreen() {
  const status = useConversation((s) => s.status);
  const isAiSpeaking = useConversation((s) => s.isAiSpeaking);
  const error = useConversation((s) => s.error);
  const start = useConversation((s) => s.start);
  const stop = useConversation((s) => s.stop);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>🐦 매그파이</Text>
        <Text style={styles.subtitle}>아침 영어 회화</Text>
      </View>

      <View style={styles.center}>
        {status === 'idle' && (
          <>
            <Text style={styles.hint}>버튼을 누르면 까치가 영어로 말을 걸어요.</Text>
            {!hasApiKey && (
              <Text style={styles.warn}>
                ⚠️ API 키가 없습니다. .env에 키를 넣고 다시 빌드하세요.
              </Text>
            )}
          </>
        )}

        {status === 'connecting' && (
          <>
            <ActivityIndicator size="large" color="#ffd166" />
            <Text style={styles.status}>연결 중…</Text>
          </>
        )}

        {status === 'active' && (
          <>
            <View style={[styles.orb, isAiSpeaking && styles.orbSpeaking]}>
              <Text style={styles.orbEmoji}>{isAiSpeaking ? '💬' : '👂'}</Text>
            </View>
            <Text style={styles.status}>
              {isAiSpeaking ? '까치가 말하고 있어요' : '듣고 있어요… 편하게 말해보세요'}
            </Text>
            <Text style={styles.hintSmall}>
              끼어들어 말해도 돼요. 까치가 멈추고 들어줍니다.
            </Text>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.errorEmoji}>😵</Text>
            <Text style={styles.status}>문제가 발생했어요</Text>
            <Text style={styles.errorMsg}>{error}</Text>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {status === 'active' || status === 'connecting' ? (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.stopButton,
              pressed && styles.pressed,
            ]}
            onPress={stop}
          >
            <Text style={styles.buttonText}>종료</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.startButton,
              pressed && styles.pressed,
            ]}
            onPress={start}
          >
            <Text style={styles.buttonText}>
              {status === 'error' ? '다시 시도' : '대화 시작'}
            </Text>
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
  header: { alignItems: 'center', gap: 4 },
  title: { color: '#ffffff', fontSize: 30, fontWeight: '700' },
  subtitle: { color: '#8a93a6', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  hint: { color: '#c3c9d6', fontSize: 16, textAlign: 'center' },
  hintSmall: { color: '#6b7280', fontSize: 13, textAlign: 'center' },
  warn: { color: '#ffb4a2', fontSize: 14, textAlign: 'center', marginTop: 8 },
  status: { color: '#ffffff', fontSize: 20, fontWeight: '600', textAlign: 'center' },
  orb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1f2740',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbSpeaking: { backgroundColor: '#3a2f10', borderWidth: 2, borderColor: '#ffd166' },
  orbEmoji: { fontSize: 56 },
  errorEmoji: { fontSize: 56 },
  errorMsg: { color: '#ffb4a2', fontSize: 14, textAlign: 'center' },
  footer: { alignItems: 'center' },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  startButton: { backgroundColor: '#ffd166' },
  stopButton: { backgroundColor: '#ef476f' },
  pressed: { opacity: 0.7 },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#0f1420' },
});
