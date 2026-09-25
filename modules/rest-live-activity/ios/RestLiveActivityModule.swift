import ActivityKit
import ExpoModulesCore
import Foundation

// Keep in sync with targets/widget/RestTimerLiveActivity.swift — ActivityKit
// matches the app's and the extension's attributes by type name and Codable shape.
struct RestTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var title: String
    var exerciseName: String
    var setLabel: String
    var pausedLabel: String
    var doneLabel: String
    var isPaused: Bool
    var startDate: Date
    var endDate: Date
    var remainingText: String
    var pausedProgress: Double
  }
}

struct RestLiveActivityProps: Record {
  @Field var title: String = ""
  @Field var exerciseName: String = ""
  @Field var setLabel: String = ""
  @Field var pausedLabel: String = ""
  @Field var doneLabel: String = ""
  @Field var isPaused: Bool = false
  /// Epoch milliseconds.
  @Field var startMs: Double = 0
  /// Epoch milliseconds; also the stale date while running.
  @Field var endMs: Double = 0
  @Field var remainingText: String = ""
  /// 0–1, shown while paused.
  @Field var pausedProgress: Double = 0

  var contentState: RestTimerAttributes.ContentState {
    RestTimerAttributes.ContentState(
      title: title,
      exerciseName: exerciseName,
      setLabel: setLabel,
      pausedLabel: pausedLabel,
      doneLabel: doneLabel,
      isPaused: isPaused,
      startDate: Date(timeIntervalSince1970: startMs / 1000),
      endDate: Date(timeIntervalSince1970: endMs / 1000),
      remainingText: remainingText,
      pausedProgress: pausedProgress
    )
  }

  /// Running rests turn stale at their end so the extension can show the done state
  /// even when the app is suspended and cannot end the activity itself.
  var staleDate: Date? {
    isPaused ? nil : Date(timeIntervalSince1970: endMs / 1000)
  }
}

public class RestLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RestLiveActivity")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    /// Ends every running rest activity and starts a fresh one.
    AsyncFunction("start") { (props: RestLiveActivityProps) -> Bool in
      guard #available(iOS 16.2, *) else {
        return false
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        return false
      }
      await Self.endAll()
      do {
        _ = try Activity<RestTimerAttributes>.request(
          attributes: RestTimerAttributes(),
          content: ActivityContent(state: props.contentState, staleDate: props.staleDate),
          pushType: nil
        )
        return true
      } catch {
        return false
      }
    }

    /// Updates the running rest activity; false when there is none.
    AsyncFunction("update") { (props: RestLiveActivityProps) -> Bool in
      guard #available(iOS 16.2, *) else {
        return false
      }
      let activities = Activity<RestTimerAttributes>.activities
      guard !activities.isEmpty else {
        return false
      }
      let content = ActivityContent(state: props.contentState, staleDate: props.staleDate)
      for activity in activities {
        await activity.update(content)
      }
      return true
    }

    AsyncFunction("end") { () in
      guard #available(iOS 16.2, *) else {
        return
      }
      await Self.endAll()
    }
  }

  @available(iOS 16.2, *)
  private static func endAll() async {
    for activity in Activity<RestTimerAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
