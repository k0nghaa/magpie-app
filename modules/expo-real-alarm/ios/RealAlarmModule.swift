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

/// [끄기] 버튼: 알람만 정지(앱 실행 안 함). 시스템이 정지를 처리하므로 perform은 비워둔다.
@available(iOS 26.0, *)
public struct MagpieStopAlarmIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "끄기"
  public static var openAppWhenRun: Bool = false

  public init() {}

  public func perform() async throws -> some IntentResult {
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
  /// now + secondsFromNow에 1회성 알람을 예약(스파이크 테스트용). 예약된 alarm id(UUID 문자열) 반환.
  /// 본구현에서는 이 자리에 Alarm.Schedule.relative(daily)로 매일 반복을 넣는다.
  static func scheduleFixed(
    secondsFromNow: Double,
    title: String,
    startLabel: String,
    stopLabel: String
  ) async throws -> String {
    let uuid = UUID()
    let fireDate = Date().addingTimeInterval(secondsFromNow)

    let stopButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: stopLabel),
      textColor: .white,
      systemImageName: "stop.circle"
    )
    let startButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: startLabel),
      textColor: .white,
      systemImageName: "bubble.left.and.bubble.right.fill"
    )

    // 2버튼: [끄기](정지) + [대화 시작](.custom → 앱 실행 인텐트).
    // ⚠️ 컴파일 노브 1: secondaryButtonBehavior 케이스가 SDK에서 '.custom'이 아니면 여기서 실패.
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
    let secondaryIntent: any LiveActivityIntent = MagpieStartConversationIntent(alarmId: uuid.uuidString)

    // 시스템 기본 알람음(전 iOS 26.x 버전에서 신뢰성 확인됨). 커스텀 사운드는 26.x 버그로 회피.
    let alarmSound: AlertConfiguration.AlertSound = .default

    // ⚠️ 컴파일 노브 2: countdownDuration이 옵셔널이 아니면 nil이 거부됨 →
    //    Alarm.CountdownDuration(preAlert: nil, postAlert: nil)로 교체.
    let config = AlarmManager.AlarmConfiguration<MagpieAlarmMetadata>(
      countdownDuration: nil,
      schedule: .fixed(fireDate),
      attributes: attributes,
      stopIntent: stopIntent,
      secondaryIntent: secondaryIntent,
      sound: alarmSound
    )

    try await AlarmManager.shared.schedule(id: uuid, configuration: config)
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

    AsyncFunction("scheduleTestAlarm") { (secondsFromNow: Double, title: String, startLabel: String, stopLabel: String) -> String in
      guard #available(iOS 26.0, *) else {
        throw Exception(name: "E_UNSUPPORTED", description: "AlarmKit은 iOS 26+에서만 사용할 수 있습니다.")
      }
      return try await RealAlarmScheduler.scheduleFixed(
        secondsFromNow: secondsFromNow,
        title: title,
        startLabel: startLabel,
        stopLabel: stopLabel
      )
    }

    AsyncFunction("cancelAll") { () -> Void in
      guard #available(iOS 26.0, *) else { return }
      let manager = AlarmManager.shared
      guard let alarms = try? manager.alarms else { return }
      for alarm in alarms {
        if case .alerting = alarm.state {
          try? manager.stop(id: alarm.id)
        } else {
          try? manager.cancel(id: alarm.id)
        }
      }
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
