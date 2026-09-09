# 플랫폼별 진행 로드맵 (iOS 우선 · Android 지연)

> 배경: 현재 Android 실기기 검증 환경이 없어(에뮬레이터 doze로 시간 알람 검증 불가 — M2에서 확인),
> **iOS를 먼저 끝까지 진행하고 Android는 실기기 확보 시점에 일괄 구현**한다.
> 결정 근거는 DECISIONS.md 2026-09-09 항목 참조.

## 진행 순서 (확정)
1. **M2.5 iOS (완료 → main 머지)** — AlarmKit 진짜 알람. 무음/DND 관통, 알람 버튼/밀어서 끄기 → 앱 실행 → 대화 시작.
2. **M3 iOS (다음)** — 보상/둥지. iPhone 버전만 먼저 진행.
3. **Android 일괄 (실기기 확보 후)** — M2.5(진짜 알람) + M3(둥지) Android 구현을 한 번에.

미지원/미구현 플랫폼에서도 앱이 잠기지 않도록, 현재 코드는 iOS<26/Android/Expo Go에서 M2 일반 로컬 알림으로
런타임 fallback한다(`src/alarm/alarmScheduler.ts`). 즉 Android도 지금 **일반 알림 수준으로는 동작**하며,
"진짜 알람(FSI)"만 미구현이다.

---

## iOS M2.5 — 남은 확인 항목 (실사용 게이트)
빌드·실행·핵심 시나리오는 실기기(iOS 26.6.1)에서 통과함. 아래만 실사용 중 확인:

- [ ] **매일 반복(익일 재발화)**: 알람 발화 → [대화 시작]/밀어서 끄기로 해제 → **다음 날 같은 시각에 다시 울리는가** + 설정에 시각 유지되는가.
  - 안 울리면: `MagpieStartConversationIntent.perform()`의 `try? AlarmManager.shared.stop(id:)`가 반복 스케줄까지 지운 것(리뷰 권장#1). → 해당 stop 호출을 제거하고 시스템 stopButton 처리에 위임하도록 수정.
- 검증됨(참고): 무음+잠금 발화 ✅, [대화 시작]·밀어서 끄기 둘 다 앱 실행+대화 시작 ✅, Swift 컴파일 노브 3곳(`.custom`·`countdownDuration: nil`·`Alarm.Schedule.Relative.*`) EAS 빌드 통과 ✅.

---

## Android M2.5 — 진짜 알람 구현 체크리스트 (실기기 확보 후 착수)
재검증 결론은 docs/alarm-feasibility.md(2026-09-08) 참조. 요약 체크리스트:

### 방식 결정
- [ ] **하이브리드 vs 자체 Kotlin 확정.** 권장: FSI **표시**는 `react-native-notify-kit`(v10.7.0, New Architecture 전용) 또는 자체 Kotlin, **신뢰성 핵심(exact alarm·BroadcastReceiver·부팅 재예약)은 얇은 자체 Kotlin**. 단일 메인테이너 포크에 신뢰성 경로를 통째로 맡기지 않음.
- [ ] notify-kit 채택 시 RN 0.86 + New Arch 실빌드 스모크테스트 먼저.

### 권한 / 매니페스트 (config plugin 주입)
- [ ] `USE_FULL_SCREEN_INTENT` 추가 (notify-kit config plugin은 자동 주입 안 함 → 수동/커스텀 플러그인).
- [ ] 기존 `SCHEDULE_EXACT_ALARM` 유지, **`USE_EXACT_ALARM`는 미선언**(Play 심사 거부 리스크).
- [ ] `RECEIVE_BOOT_COMPLETED` 추가(재부팅 후 알람 재예약).

### 구현
- [ ] `AlarmManager.setExactAndAllowWhileIdle` → BroadcastReceiver → foreground service + full-screen-intent 알림 → Activity가 앱 실행/딥링크 → JS가 pending 소비 → `useConversation.start()`. (iOS의 App Group 브릿지에 대응하는 Android 경로)
- [ ] `src/alarm/alarmScheduler.ts`에 Android 진짜 알람 백엔드 분기 추가(현재는 fallback으로 M2 알림).
- [ ] 세션 코드(conversationController/useConversation) 미수정 — 호출만.

### 런타임 권한 흐름
- [ ] exact alarm: `canScheduleExactAlarms()` + `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` 유도.
- [ ] FSI: `NotificationManager.canUseFullScreenIntent()` + `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` 유도, 미허용 시 60초 헤즈업으로 graceful degrade(≥1탭은 여전히 충족).

### Android 15+ 주의
- [ ] `BOOT_COMPLETED` 리시버에서 mediaPlayback/microphone FGS **직접 시작 금지** → 부팅 시엔 AlarmManager 재예약만, FGS는 알람 브로드캐스트가 시작.
- [ ] audio focus는 top-app 또는 FGS 실행 중에만 요청 가능.

### 검증
- [ ] 에뮬레이터 doze로는 검증 불가 → **실기기** 또는 `adb shell dumpsys deviceidle disable`.
- [ ] OEM 배터리 최적화 파편화(삼성/샤오미 등) 주의 — 설정 가이드 화면 고려.

### 배포 시 재검토
- [ ] Google Play 정책: `SCHEDULE_EXACT_ALARM`/`USE_FULL_SCREEN_INTENT` 선언은 알람시계/캘린더/통화 앱만 자동 부여 → 습관 앱은 심사 리스크. `SCHEDULE_EXACT_ALARM` + 런타임 grant + 헤즈업 fallback 경로로 대응.

---

## Android M3 — 둥지/보상
- iOS M3 완료 후 동일 로직을 Android로 이식(대부분 RN 공통 UI라 플랫폼 특이사항 적음). Android M2.5와 함께 실기기 확보 시점에 진행.
