import ExpoModulesCore
import AlarmKit
import ActivityKit
import AppIntents
import SwiftUI

// MARK: - App Group 브릿지 (알람 버튼 → 앱 실행 사이 상태 전달)
//
// 알람의 [대화 시작] 버튼을 누르면 iOS는 그 버튼 코드를 "시스템 알람 프로세스"에서 실행한다.
// 여기서 App Group의 공유 UserDefaults에 "이 알람이 대화 시작을 요청했다"를 기록하고,
// 앱이 실행되면(cold start 포함) JS가 consumePendingStart()로 읽어 대화를 시작한다.
// (in-memory static 대신 App Group을 쓰는 이유: cold start에서 프로세스 경계를 확실히 넘김.)
enum RealAlarmBridge {
  // app.json ios.entitlements의 App Group과 반드시 일치해야 한다.
  static let suiteName = "group.com.k0nghaa.magpie"
  static let pendingKey = "magpie.pendingStartAlarmId"
  static let hourKey = "magpie.alarmHour"
  static let minuteKey = "magpie.alarmMinute"
  static let scheduledKey = "magpie.alarmScheduled"

  static var defaults: UserDefaults? { UserDefaults(suiteName: suiteName) }

  static func setPendingStart(_ alarmId: String) {
    defaults?.set(alarmId, forKey: pendingKey)
    // 크로스프로세스(시스템 알람 프로세스 → 앱 프로세스) 전파를 강제 플러시.
    // cold start에서 앱 JS가 consumePendingStart()로 읽기 전에 값이 보이도록 한다(R1 레이스 방어).
    // synchronize는 deprecated지만 App Group 크로스프로세스 즉시 플러시엔 여전히 유효·관용적.
    defaults?.synchronize()
  }

  /// pending 값을 읽고 즉시 지운다(중복 시작 방지). 없으면 nil.
  static func consumePendingStart() -> String? {
    guard let defaults = defaults else { return nil }
    let value = defaults.string(forKey: pendingKey)
    defaults.removeObject(forKey: pendingKey)
    return value
  }

  /// 설정 화면 복원용 예약 시각 저장(예약 = 곧 저장, M2의 content.data 패턴과 동일 취지).
  static func setScheduledTime(hour: Int, minute: Int) {
    defaults?.set(hour, forKey: hourKey)
    defaults?.set(minute, forKey: minuteKey)
    defaults?.set(true, forKey: scheduledKey)
    defaults?.synchronize()
  }

  static func clearScheduledTime() {
    defaults?.set(false, forKey: scheduledKey)
    defaults?.removeObject(forKey: hourKey)
    defaults?.removeObject(forKey: minuteKey)
    defaults?.synchronize()
  }

  static func scheduledTime() -> (hour: Int, minute: Int)? {
    guard let defaults = defaults, defaults.bool(forKey: scheduledKey) else { return nil }
    return (defaults.integer(forKey: hourKey), defaults.integer(forKey: minuteKey))
  }
}

// MARK: - AlarmKit 메타데이터
// Swift 6 동시성 요구: file-level + nonisolated (isolated 타입은 컴파일 실패).
@available(iOS 26.0, *)
nonisolated struct MagpieAlarmMetadata: AlarmMetadata {
  init() {}
}

// MARK: - 알람 버튼 App Intent
//
// AlarmKit 버튼 인텐트는 (plain AppIntent가 아니라) LiveActivityIntent를 따라야 한다.
// openAppWhenRun은 정적 프로퍼티라 런타임 토글 불가 → 동작별로 타입을 분리한다.

/// 정지 컨트롤(밀어서 끄기): AlarmKit이 필수로 요구하는 stopButton. 완전 제거 불가.
/// 밀어서 끄기도 앱을 열고 대화를 시작하게 한다(openAppWhenRun=true + pending-start 기록) →
/// 밀든 버튼을 누르든 결국 대화로 이어져 "그냥 끄고 스킵" 탈출구가 없어짐(각성 보장).
/// 단, 스와이프 해제 시 stopIntent 미발화 iOS 26 버그가 보고돼 있어 [대화 시작] 버튼을
/// 확실한 경로로 함께 유지한다(둘 다 같은 결과).
@available(iOS 26.0, *)
public struct MagpieStopAlarmIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "대화 시작"
  public static var openAppWhenRun: Bool = true

  public init() {}

  public func perform() async throws -> some IntentResult {
    // 정지 컨트롤엔 alarmId가 없으므로 존재 신호용 센티넬만 기록(App.tsx가 존재 여부로 판정).
    RealAlarmBridge.setPendingStart("pending")
    return .result()
  }
}

/// [대화 시작] 버튼: 앱을 실행하고(openAppWhenRun=true) pending-start를 기록.
/// 커스텀 secondary 버튼이 알람 링을 자동으로 멈추지 않을 수 있어 명시적으로 stop도 시도한다.
@available(iOS 26.0, *)
public struct MagpieStartConversationIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "대화 시작"
  public static var openAppWhenRun: Bool = true

  @Parameter(title: "alarmId")
  public var alarmId: String

  public init() {}

  public init(alarmId: String) {
    self.alarmId = alarmId
  }

  public func perform() async throws -> some IntentResult {
    // JS는 신호를 "존재 여부"로만 판정하므로 항상 비어있지 않은 값을 기록한다.
    // @Parameter(alarmId) 복원이 빈 값이어도 대화 시작 신호는 견고하게 전달됨(R2 교란변수 제거).
    RealAlarmBridge.setPendingStart(alarmId.isEmpty ? "pending" : alarmId)
    // 링이 계속되면 사용자 경험이 나쁘므로 이 알람을 정지 시도(실패해도 무시).
    if let uuid = UUID(uuidString: alarmId) {
      try? AlarmManager.shared.stop(id: uuid)
    }
    return .result()
  }
}

// MARK: - 스케줄러
@available(iOS 26.0, *)
enum RealAlarmScheduler {
  /// 우리가 만든 알람을 모두 취소(정지/취소) + 저장 시각 클리어. 중복 예약·이중 발화 방지.
  static func cancelAll() {
    let manager = AlarmManager.shared
    if let alarms = try? manager.alarms {
      for alarm in alarms {
        // alerting이면 먼저 울림을 정지한 뒤, 상태와 무관하게 cancel로 완전 제거한다.
        // (stop만 하면 반복 스케줄이 남아 다음날 유령 발화할 수 있음 — 리뷰 권장#2.)
        if case .alerting = alarm.state {
          try? manager.stop(id: alarm.id)
        }
        try? manager.cancel(id: alarm.id)
      }
    }
    RealAlarmBridge.clearScheduledTime()
  }

  /// 2버튼([끄기]/[대화 시작]) 프레젠테이션 + 인텐트 구성(고정/반복 공통).
  private static func buildConfig(
    alarmId: UUID,
    schedule: Alarm.Schedule,
    title: String,
    startLabel: String,
    stopLabel: String
  ) -> AlarmManager.AlarmConfiguration<MagpieAlarmMetadata> {
    let stopButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: stopLabel),
      textColor: .white,
      systemImageName: "bubble.left.and.bubble.right.fill"
    )
    let startButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: startLabel),
      textColor: .white,
      systemImageName: "bubble.left.and.bubble.right.fill"
    )

    // 2버튼: 정지 컨트롤(밀어서 끄기) + [대화 시작](.custom → 앱 실행 인텐트). 둘 다 앱 실행+대화 시작.
    // ⚠️ 컴파일 노브 1: secondaryButtonBehavior 케이스가 SDK에서 '.custom'이 아니면 여기서 실패(→ .countdown 확인).
    let alert = AlarmPresentation.Alert(
      title: LocalizedStringResource(stringLiteral: title),
      stopButton: stopButton,
      secondaryButton: startButton,
      secondaryButtonBehavior: .custom
    )
    let presentation = AlarmPresentation(alert: alert)

    let attributes = AlarmAttributes<MagpieAlarmMetadata>(
      presentation: presentation,
      metadata: MagpieAlarmMetadata(),
      tintColor: .orange
    )

    let stopIntent: any LiveActivityIntent = MagpieStopAlarmIntent()
    let secondaryIntent: any LiveActivityIntent = MagpieStartConversationIntent(alarmId: alarmId.uuidString)

    // 시스템 기본 알람음(전 iOS 26.x 버전에서 신뢰성 확인됨). 커스텀 사운드는 26.x 버그로 회피.
    let alarmSound: AlertConfiguration.AlertSound = .default

    // ⚠️ 컴파일 노브 2: countdownDuration이 옵셔널이 아니면 nil이 거부됨 →
    //    Alarm.CountdownDuration(preAlert: nil, postAlert: nil)로 교체.
    return AlarmManager.AlarmConfiguration<MagpieAlarmMetadata>(
      countdownDuration: nil,
      schedule: schedule,
      attributes: attributes,
      stopIntent: stopIntent,
      secondaryIntent: secondaryIntent,
      sound: alarmSound
    )
  }

  /// 매일 hour:minute에 반복되는 알람 예약(production). 기존 예약을 먼저 지워 중복을 막는다.
  static func scheduleDaily(
    hour: Int,
    minute: Int,
    title: String,
    startLabel: String,
    stopLabel: String
  ) async throws -> String {
    cancelAll()

    let uuid = UUID()
    // ⚠️ 컴파일 노브 3: 반복 스케줄 API는 스파이크에 없던 신규 조합이라 시그니처 드리프트 가능.
    //    컴파일 실패 시 Xcode Quick Help로 확인: Relative.Time(hour:minute:) 라벨,
    //    Recurrence.weekly의 인자 타입([Locale.Weekday]), Relative(time:repeats:) 라벨.
    let time = Alarm.Schedule.Relative.Time(hour: hour, minute: minute)
    // 매일 = 모든 요일 반복. (요일별 on/off는 향후 범위 — PRD F4-1)
    let recurrence = Alarm.Schedule.Relative.Recurrence.weekly([
      .sunday, .monday, .tuesday, .wednesday, .thursday, .friday, .saturday,
    ])
    let schedule = Alarm.Schedule.relative(
      Alarm.Schedule.Relative(time: time, repeats: recurrence)
    )

    let config = buildConfig(
      alarmId: uuid,
      schedule: schedule,
      title: title,
      startLabel: startLabel,
      stopLabel: stopLabel
    )

    try await AlarmManager.shared.schedule(id: uuid, configuration: config)
    RealAlarmBridge.setScheduledTime(hour: hour, minute: minute)
    return uuid.uuidString
  }
}

// MARK: - Expo 모듈 정의
public class RealAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RealAlarm")

    /// 이 기기에서 AlarmKit(진짜 알람)을 쓸 수 있는가(iOS 26+). 미만이면 false → JS가 M2 알림으로 fallback.
    Function("isAvailable") { () -> Bool in
      if #available(iOS 26.0, *) {
        return true
      } else {
        return false
      }
    }

    /// 알람 버튼이 기록한 pending-start(alarm id)를 읽고 지운다. 없으면 nil.
    Function("consumePendingStart") { () -> String? in
      return RealAlarmBridge.consumePendingStart()
    }

    AsyncFunction("getAuthorizationState") { () -> String in
      guard #available(iOS 26.0, *) else { return "denied" }
      return RealAlarmModule.stateString(AlarmManager.shared.authorizationState)
    }

    AsyncFunction("requestAuthorization") { () -> String in
      guard #available(iOS 26.0, *) else { return "denied" }
      let current = AlarmManager.shared.authorizationState
      if current == .authorized { return "authorized" }
      do {
        let newState = try await AlarmManager.shared.requestAuthorization()
        return RealAlarmModule.stateString(newState)
      } catch {
        return "denied"
      }
    }

    /// 매일 hour:minute에 반복되는 알람 예약. 예약된 alarm id 반환.
    AsyncFunction("scheduleDaily") { (hour: Int, minute: Int, title: String, startLabel: String, stopLabel: String) -> String in
      guard #available(iOS 26.0, *) else {
        throw Exception(name: "E_UNSUPPORTED", description: "AlarmKit은 iOS 26+에서만 사용할 수 있습니다.")
      }
      return try await RealAlarmScheduler.scheduleDaily(
        hour: hour,
        minute: minute,
        title: title,
        startLabel: startLabel,
        stopLabel: stopLabel
      )
    }

    /// 우리가 만든 알람을 모두 취소 + 저장 시각 클리어.
    AsyncFunction("cancelAll") { () -> Void in
      guard #available(iOS 26.0, *) else { return }
      RealAlarmScheduler.cancelAll()
    }

    /// 설정 화면 복원용: 예약된 시각 {hour, minute}. 없으면 nil.
    /// App Group 저장값 + 실제 예약 잔존(manager.alarms)을 교차 확인해 stale 표시를 막는다.
    Function("getScheduledTime") { () -> [String: Int]? in
      guard #available(iOS 26.0, *) else { return nil }
      guard let time = RealAlarmBridge.scheduledTime() else { return nil }
      if let alarms = try? AlarmManager.shared.alarms, !alarms.isEmpty {
        return ["hour": time.hour, "minute": time.minute]
      }
      // 스토어엔 남았는데 실제 알람이 없으면(외부 취소 등) stale → 정리하고 nil.
      RealAlarmBridge.clearScheduledTime()
      return nil
    }
  }

  @available(iOS 26.0, *)
  static func stateString(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }
}
