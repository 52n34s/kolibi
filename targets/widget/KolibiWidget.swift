import WidgetKit
import SwiftUI

private struct WidgetMacroSnapshot: Codable, Equatable {
  let label: String
  let value: String
}

private struct WidgetCalorieSnapshot: Codable, Equatable {
  let schemaVersion: Int
  let dateKey: String
  let remainingValue: String
  let isOverGoal: Bool
  let labelRemaining: String
  let labelFooter: String
  let macros: [WidgetMacroSnapshot]
  let premium: Bool
  let progress: Double
  let updatedAt: String

  static let suiteName = "group.com.steffen.kolibi"
  static let storageKey = "calorieSnapshot"
  static let currentSchemaVersion = 1
}

struct WidgetViewModel: Equatable {
  let labelRemaining: String
  let remainingValue: String
  let labelFooter: String

  static let gallerySample = WidgetViewModel(
    labelRemaining: "Remaining today",
    remainingValue: "1240",
    labelFooter: "Daily goal: 2000 kcal"
  )

  static let unavailable = WidgetViewModel(
    labelRemaining: "Open Kolibi",
    remainingValue: "—",
    labelFooter: "Remaining calories appear here"
  )
}

private func localDateKey(for date: Date = Date()) -> String {
  let calendar = Calendar.current
  let parts = calendar.dateComponents([.year, .month, .day], from: date)
  let year = parts.year ?? 0
  let month = parts.month ?? 0
  let day = parts.day ?? 0
  return String(format: "%04d-%02d-%02d", year, month, day)
}

private func loadWidgetSnapshot() -> WidgetCalorieSnapshot? {
  guard let defaults = UserDefaults(suiteName: WidgetCalorieSnapshot.suiteName) else {
    return nil
  }

  let data: Data?
  if let storedData = defaults.data(forKey: WidgetCalorieSnapshot.storageKey) {
    data = storedData
  } else if let storedString = defaults.string(forKey: WidgetCalorieSnapshot.storageKey),
            let stringData = storedString.data(using: .utf8) {
    data = stringData
  } else {
    data = nil
  }

  guard let data else {
    return nil
  }

  do {
    return try JSONDecoder().decode(WidgetCalorieSnapshot.self, from: data)
  } catch {
    return nil
  }
}

private func resolveViewModel(now: Date = Date()) -> WidgetViewModel {
  guard let snapshot = loadWidgetSnapshot() else {
    return .unavailable
  }

  guard snapshot.schemaVersion == WidgetCalorieSnapshot.currentSchemaVersion else {
    return .unavailable
  }

  guard snapshot.dateKey == localDateKey(for: now) else {
    return .unavailable
  }

  return WidgetViewModel(
    labelRemaining: snapshot.labelRemaining,
    remainingValue: snapshot.remainingValue,
    labelFooter: snapshot.labelFooter
  )
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry {
    SimpleEntry(date: Date(), viewModel: .gallerySample)
  }

  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
    let viewModel = context.isPreview ? WidgetViewModel.gallerySample : resolveViewModel()
    completion(SimpleEntry(date: Date(), viewModel: viewModel))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
    let now = Date()
    let calendar = Calendar.current
    let startOfToday = calendar.startOfDay(for: now)
    let nextMidnight =
      calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? now.addingTimeInterval(86_400)

    let entries = [
      SimpleEntry(date: now, viewModel: resolveViewModel(now: now)),
      SimpleEntry(date: nextMidnight, viewModel: .unavailable),
    ]

    completion(Timeline(entries: entries, policy: .after(nextMidnight)))
  }
}

struct SimpleEntry: TimelineEntry {
  let date: Date
  let viewModel: WidgetViewModel
}

struct KolibiWidgetEntryView: View {
  var entry: Provider.Entry

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(entry.viewModel.labelRemaining)
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(entry.viewModel.remainingValue)
        .font(.title)
        .fontWeight(.semibold)
        .foregroundStyle(.primary)
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      Text(entry.viewModel.labelFooter)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(for: .widget) {
      Color(.systemBackground)
    }
  }
}

struct KolibiWidget: Widget {
  let kind: String = "KolibiWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      KolibiWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Kolibi")
    .description("Remaining calories today")
    .supportedFamilies([.systemSmall])
  }
}
