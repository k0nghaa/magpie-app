# M2.5 "진짜 알람" 실현 가능성 조사

> 상태: **조사만 완료, 미구현.** M2(일반 푸시 알림)와 분리된 별도 마일스톤. M3(둥지/보상)보다 우선.
> 조사 기준일: 2026-09-07. 결정 요약은 [DECISIONS.md](./DECISIONS.md)의 동일 날짜 "[범위 확정]" 항목 참조.

## 목표
무음 스위치·Focus/DND를 뚫고 알람시계처럼 확실히 깨우고, 알람의 버튼 1탭으로 앱을 열어 대화 세션을 시작한다. (창업 가설: "무시되는 푸시 알림" 해결 — PRD §1)

**핵심 제약(확정):** iOS·Android 모두 **버튼 조작 없이 자동으로 AI 대화 오디오가 재생되는 것은 불가.** 최소 1탭(알람 버튼) 필요 — 이는 PRD의 "탭 1회 → 핸즈프리" 전제와 일치. 진짜 알람의 이득은 "탭 제거"가 아니라 "확실한 각성(무음 관통)".

---

## iOS — AlarmKit (iOS 26+)
- **가능**: 시스템 Clock 앱과 동일 취급 → 무음 스위치·DND·Focus 관통, 지속 울림, 정지/스누즈 버튼.
- **앱 실행**: `AlarmButton` + `LiveActivityIntent` 준수 App Intent를 secondary 버튼에 연결, `openAppWhenRun = true`, `secondaryButtonBehavior = .custom` → 완전 종료 상태에서도 버튼 탭으로 앱 실행. UX: [대화 시작](앱 열기) + [끄기](정지) 2버튼.
- **권한/설정**: Info.plist `NSAlarmKitUsageDescription`(필수), 런타임 `AlarmManager.shared.authorizationState` 확인 + `requestAuthorization()`. 최소 iOS/iPadOS 26 (macOS·tvOS 미지원, Mac Catalyst 지원).
- **불확실/재검증**: iOS 26.0/26.1 GA 시점 커스텀 알람음 관련 버그 다수 보고(시스템 에러음 대체, 반복 안 됨, 30초 제한 등). → **온디바이스 스파이크 1순위 검증 대상.** iOS 26.6.1(테스트 기기)에서 해소됐는지 실측 필요.
- **RN 통합**: AlarmKit은 Swift 전용 → **커스텀 Expo 네이티브 모듈(Swift) 필수.**

## Android — Full-Screen Intent 알람
- **가능**: `USE_FULL_SCREEN_INTENT` + high-importance 채널 + AlarmManager exact alarm + foreground service → 잠금화면 풀스크린 알람 UI, 지속 울림, 앱 실행 버튼.
- **정책(targetSdk 34+)**: `USE_FULL_SCREEN_INTENT`는 특별 액세스 권한 — Google Play가 "calling/alarm" 앱에만 자동 부여, 그 외는 사용자 수동 허용. 권한 없으면 60초 지속 헤즈업으로 다운그레이드. 잠금 해제(사용 중) 상태에선 풀스크린 대신 헤즈업.
- **exact alarm**: Android 13+ 기본 거부(`canScheduleExactAlarms()` 확인, `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` 유도). "알람시계" 자격 시 `USE_EXACT_ALARM` 자동 부여.
- **불확실/재검증**: Android 15(API 35) 고유 변경사항 미확인 — targetSdk 35 빌드 시 공식 behavior-changes 재확인.
- **RN 통합**: `react-native-notify-kit`(Notifee 포크, Notifee는 2026-04 아카이브) 후보. New Architecture 전용, config plugin 보유, `USE_FULL_SCREEN_INTENT` 권한은 수동 추가 필요. RN 0.86 호환 실측 필요.

---

## 구현 경로 & 난이도
| 경로 | 난이도 | 리스크 | 유지보수성 |
|---|---|---|---|
| iOS (A) 기존 라이브러리 | 소~중 | 高 (★10~30대 1인 프로젝트, config plugin 없음, iOS 26 버그) | 低 |
| iOS (B) 커스텀 Swift 모듈 | 중~대 | 中 (신규 API 불안정성 직접 흡수) | 中 |
| Android (A) notify-kit 기반 | 중 | 中 (신생 포크, OEM 파편화) | 中 |
| Android (B) 커스텀 Kotlin 모듈 | 중 | 低~中 (패턴 잘 문서화됨) | 高 |

**결론**: 성숙한 RN/Expo 라이브러리 없음 → 사실상 커스텀 네이티브 모듈 필요. Expo config plugin(`withInfoPlist`/`withEntitlementsPlist`/`withAndroidManifest`)으로 권한·엔타이틀먼트 주입. Expo Go 불가, dev client 재빌드 반복 필요.

## 착수 순서 (제안)
1. **iOS AlarmKit 온디바이스 스파이크** (iPhone iOS 26.6.1): 최소 알람(뜨기 + [대화 시작] 버튼 → 앱 실행) + **알람음 안정성 실측**. 여기서 iOS 26 버그가 치명적이면 방향 재검토.
2. 스파이크 통과 시 Android full-screen intent 구현.
3. iOS 26+ → AlarmKit / 미만 → 기존 M2 알림으로 런타임 분기(또는 최소 iOS 26 제한).

## 재검증 결과 (2026-09-08 공식 문서 재확인 완료)
1. **AlarmKit 커스텀 사운드 버그 → 미해소/불확실.** 26.0→26.1→2026-02까지 형태를 바꿔가며 지속 보고(에러음 대체·미반복·30초 제한 등), 26.6.x 해소 확인 사례 없음. `.default`(시스템 기본음)는 전 버전 정상. → **MVP는 `.default`만 사용, 커스텀 사운드는 실기기 검증 후 옵션**(결정 기록: DECISIONS 2026-09-08).
2. **Android 15(API 35) FSI/exact alarm 자체 변경 없음.** 단 `BOOT_COMPLETED` 리시버에서 mediaPlayback/microphone FGS 직접 시작 금지 + audio focus는 top/FGS 상태에서만 요청 가능 → 부팅 시 AlarmManager 재예약만, FGS는 알람 브로드캐스트가 시작.
3. **react-native-notify-kit → New Arch(TurboModules) 전용으로 확정**(하드 요구). peerDep `react-native >=0.73.0`(상한 없음), RN 0.86은 0.85 대비 breaking change 0 → 실호환 가능성 높음(실빌드 스모크테스트 필요). config plugin은 있으나 `USE_FULL_SCREEN_INTENT` 자동 주입 안 함(수동).
4. **AlarmKit 엔타이틀먼트 → 애초에 특별 엔타이틀먼트 불필요.** `com.apple.developer.alarmkit`는 존재하지 않는 가짜 키(Apple 엔지니어 확인). `NSAlarmKitUsageDescription`(Info.plist) + 런타임 `requestAuthorization()`만. App Group은 AlarmKit 요구가 아니라 앱 실행 브릿지용 선택 — app.json `ios.entitlements`로 주입 가능.

## 구현 착수 결정 (2026-09-08)
- **순서**: iOS 온디바이스 스파이크 먼저(게이트) → 통과 시 Android → fallback 분기. (상세: DECISIONS 2026-09-08 [M2.5] 항목들)
- **iOS**: 커스텀 Swift Expo 네이티브 모듈 `modules/expo-real-alarm`(성숙한 라이브러리 없음). 2버튼(끄기/대화 시작), `.custom` secondary + `openAppWhenRun` 인텐트 → App Group 브릿지 → App.tsx 소비 → `useConversation.start()`.
- **Android**: 방식 보류(하이브리드 notify-kit vs 자체 Kotlin), iOS 스파이크 후 결정.
- **스파이크 코드 위치**: `modules/expo-real-alarm/`, `src/alarm/realAlarm.ts`, `src/ui/AlarmSpikePanel.tsx`(SettingsScreen에 `SHOW_ALARM_SPIKE` 플래그로 노출), App.tsx 소비 배선.

## 출처
- https://developer.apple.com/documentation/AlarmKit
- https://developer.apple.com/videos/play/wwdc2025/230/
- https://developer.apple.com/documentation/BundleResources/Information-Property-List/NSAlarmKitUsageDescription
- https://developer.android.com/about/versions/14/behavior-changes-14
- https://developer.android.com/about/versions/14/changes/schedule-exact-alarms
- https://source.android.com/docs/core/permissions/fsi-limits
- https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/
- https://github.com/invertase/notifee (archived)
- https://github.com/marcocrupi/react-native-notify-kit
