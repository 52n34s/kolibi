import ActivityKit
import SwiftUI
import WidgetKit

// Keep in sync with modules/rest-live-activity/ios/RestLiveActivityModule.swift —
// ActivityKit matches the app's and the extension's attributes by type name and
// Codable shape. All texts arrive localized from the app (i18n `liveActivity.*`).
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

private enum RestActivityColors {
  static let indigo = Color(red: 0x4F / 255, green: 0x46 / 255, blue: 0xE5 / 255)
  static let lilac = Color(red: 0xA5 / 255, green: 0xB4 / 255, blue: 0xFC / 255)
}

/// Countdown that ticks on its own (no per-second updates from the app).
private struct RestCountdownText: View {
  let state: RestTimerAttributes.ContentState
  let isStale: Bool

  var body: some View {
    if state.isPaused {
      Text(state.remainingText)
    } else if isStale || state.endDate <= Date() {
      Text("0:00")
    } else {
      Text(timerInterval: Date()...state.endDate, countsDown: true)
    }
  }
}

private struct RestProgressBar: View {
  let state: RestTimerAttributes.ContentState
  let isStale: Bool

  var body: some View {
    if state.isPaused || isStale || state.endDate <= state.startDate {
      ProgressView(value: isStale ? 1 : progressWhilePaused)
    } else {
      ProgressView(
        timerInterval: state.startDate...state.endDate,
        countsDown: false,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
    }
  }

  /// Share of the rest already done, frozen while paused.
  private var progressWhilePaused: Double {
    min(1, max(0, state.pausedProgress))
  }
}

private struct RestStatusLine: View {
  let state: RestTimerAttributes.ContentState
  let isStale: Bool

  var body: some View {
    if isStale {
      Text(state.doneLabel)
    } else if state.isPaused {
      Text(state.pausedLabel)
    } else {
      Text(state.title)
    }
  }
}

private struct RestLockScreenView: View {
  let state: RestTimerAttributes.ContentState
  let isStale: Bool

  var body: some View {
    HStack(alignment: .center, spacing: 14) {
      Image("koli-focused")
        .resizable()
        .scaledToFit()
        .frame(width: 44, height: 52)

      VStack(alignment: .leading, spacing: 4) {
        RestStatusLine(state: state, isStale: isStale)
          .font(.caption.weight(.semibold))
          .foregroundStyle(RestActivityColors.indigo)
        if !state.exerciseName.isEmpty {
          Text(state.exerciseName)
            .font(.headline)
            .lineLimit(1)
        }
        if !state.setLabel.isEmpty {
          Text(state.setLabel)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }

      Spacer(minLength: 8)

      RestCountdownText(state: state, isStale: isStale)
        .font(.system(size: 34, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: 110, alignment: .trailing)
        .foregroundStyle(state.isPaused ? Color.secondary : Color.primary)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .overlay(alignment: .bottom) {
      RestProgressBar(state: state, isStale: isStale)
        .tint(RestActivityColors.indigo)
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
    }
  }
}

struct RestTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RestTimerAttributes.self) { context in
      RestLockScreenView(state: context.state, isStale: context.isStale)
        .activityBackgroundTint(nil)
    } dynamicIsland: { context in
      let state = context.state
      let isStale = context.isStale
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image("koli-focused")
            .resizable()
            .scaledToFit()
            .frame(width: 36, height: 42)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          RestCountdownText(state: state, isStale: isStale)
            .font(.system(size: 28, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: 96, alignment: .trailing)
            .foregroundStyle(RestActivityColors.lilac)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            RestStatusLine(state: state, isStale: isStale)
              .font(.caption.weight(.semibold))
              .foregroundStyle(RestActivityColors.lilac)
            if !state.exerciseName.isEmpty {
              Text(state.exerciseName)
                .font(.headline)
                .lineLimit(1)
            }
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            if !state.setLabel.isEmpty {
              Text(state.setLabel)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            RestProgressBar(state: state, isStale: isStale)
              .tint(RestActivityColors.lilac)
          }
        }
      } compactLeading: {
        Image(systemName: state.isPaused ? "pause.fill" : "timer")
          .foregroundStyle(RestActivityColors.lilac)
      } compactTrailing: {
        RestCountdownText(state: state, isStale: isStale)
          .monospacedDigit()
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 48)
          .foregroundStyle(RestActivityColors.lilac)
      } minimal: {
        Image(systemName: state.isPaused ? "pause.fill" : "timer")
          .foregroundStyle(RestActivityColors.lilac)
      }
      .keylineTint(RestActivityColors.lilac)
    }
  }
}
