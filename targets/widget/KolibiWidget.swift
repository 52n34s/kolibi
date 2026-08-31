import WidgetKit
import SwiftUI

// MARK: - Colors

private enum KolibiWidgetColors {
  static let indigo = Color(hex: 0x4F46E5)
  static let amber = Color(hex: 0xD97706)
  static let progressTrack = Color(hex: 0xD3CDEE)
  static let macroTileBackground = Color(hex: 0xE5E1F7)
  static let mutedText = Color(hex: 0x6B7280)
  static let darkText = Color(hex: 0x1F2937)
  static let gradientTop = Color(hex: 0xEFEDFB)
  static let gradientMid = Color(hex: 0xF6F4FC)
  static let gradientBottom = Color(hex: 0xFAF9FE)
  static let meshBlobStrong = Color(hex: 0xDDD6F8)
  static let meshBlobSoft = Color(hex: 0xE8E4FA)
  static let meshBlobFaint = Color(hex: 0xEFEBFB)
}

private extension Color {
  init(hex: UInt32, opacity: Double = 1) {
    let red = Double((hex >> 16) & 0xFF) / 255
    let green = Double((hex >> 8) & 0xFF) / 255
    let blue = Double(hex & 0xFF) / 255
    self.init(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
  }
}

private struct WidgetMeshBackground: View {
  var body: some View {
    GeometryReader { geometry in
      let size = geometry.size

      ZStack {
        LinearGradient(
          colors: [
            KolibiWidgetColors.gradientTop,
            KolibiWidgetColors.gradientMid,
            KolibiWidgetColors.gradientBottom,
          ],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )

        // Stronger lilac blob — below center, slightly left
        Ellipse()
          .fill(
            RadialGradient(
              colors: [
                KolibiWidgetColors.meshBlobStrong.opacity(0.55),
                KolibiWidgetColors.meshBlobStrong.opacity(0),
              ],
              center: .center,
              startRadius: 0,
              endRadius: max(size.width, size.height) * 0.55
            )
          )
          .frame(width: size.width * 1.15, height: size.height * 0.95)
          .position(x: size.width * 0.32, y: size.height * 0.72)

        // Larger, softer blob — top right
        Ellipse()
          .fill(
            RadialGradient(
              colors: [
                KolibiWidgetColors.meshBlobSoft.opacity(0.45),
                KolibiWidgetColors.meshBlobSoft.opacity(0),
              ],
              center: .center,
              startRadius: 0,
              endRadius: max(size.width, size.height) * 0.7
            )
          )
          .frame(width: size.width * 1.35, height: size.height * 1.1)
          .position(x: size.width * 0.88, y: size.height * 0.18)

        // Very faint third blob — bottom right
        Ellipse()
          .fill(
            RadialGradient(
              colors: [
                KolibiWidgetColors.meshBlobFaint.opacity(0.35),
                KolibiWidgetColors.meshBlobFaint.opacity(0),
              ],
              center: .center,
              startRadius: 0,
              endRadius: max(size.width, size.height) * 0.45
            )
          )
          .frame(width: size.width * 0.9, height: size.height * 0.7)
          .position(x: size.width * 0.82, y: size.height * 0.92)
      }
      .frame(width: size.width, height: size.height)
    }
  }
}

// MARK: - Snapshot models

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
  let labelFooterCompact: String
  let macros: [WidgetMacroSnapshot]
  let premium: Bool
  let progress: Double
  let koliVariant: String
  let updatedAt: String

  static let suiteName = "group.com.steffen.kolibi"
  static let storageKey = "calorieSnapshot"
  static let currentSchemaVersion = 3
}

struct WidgetMacroItem: Equatable {
  let label: String
  let value: String
}

struct WidgetViewModel: Equatable {
  let labelRemaining: String
  let remainingValue: String
  let labelFooter: String
  let labelFooterCompact: String
  let isOverGoal: Bool
  let progress: Double
  let macros: [WidgetMacroItem]
  let koliVariant: String

  var accentColor: Color {
    isOverGoal ? KolibiWidgetColors.amber : KolibiWidgetColors.indigo
  }

  var koliImageName: String {
    "koli-\(koliVariant)"
  }

  static var gallerySample: WidgetViewModel {
    WidgetViewModel(
      labelRemaining: String(localized: "widget.gallery.label"),
      remainingValue: String(localized: "widget.gallery.value"),
      labelFooter: String(localized: "widget.gallery.footer"),
      labelFooterCompact: "2000 · +146",
      isOverGoal: false,
      progress: 0.38,
      macros: [
        WidgetMacroItem(label: String(localized: "widget.gallery.protein"), value: "42g"),
        WidgetMacroItem(label: String(localized: "widget.gallery.carbs"), value: "110g"),
        WidgetMacroItem(label: String(localized: "widget.gallery.fat"), value: "28g"),
        WidgetMacroItem(label: String(localized: "widget.gallery.fiber"), value: "12g"),
      ],
      koliVariant: "confident"
    )
  }

  static var unavailable: WidgetViewModel {
    WidgetViewModel(
      labelRemaining: String(localized: "widget.unavailable.label"),
      remainingValue: String(localized: "widget.unavailable.value"),
      labelFooter: String(localized: "widget.unavailable.footer"),
      labelFooterCompact: "—",
      isOverGoal: false,
      progress: 0,
      macros: [],
      koliVariant: "neutral"
    )
  }
}

private let knownKoliVariants: Set<String> = [
  "confident",
  "curious",
  "thinking",
  "happy",
  "energetic",
  "focused",
  "neutral",
]

private func resolveKoliVariant(_ raw: String?) -> String {
  guard let raw, knownKoliVariants.contains(raw) else {
    return "neutral"
  }

  return raw
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
    labelFooter: snapshot.labelFooter,
    labelFooterCompact: snapshot.labelFooterCompact,
    isOverGoal: snapshot.isOverGoal,
    progress: min(1, max(0, snapshot.progress)),
    macros: snapshot.macros.map { WidgetMacroItem(label: $0.label, value: $0.value) },
    koliVariant: resolveKoliVariant(snapshot.koliVariant)
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

// MARK: - Shared chrome

private struct WidgetProgressBar: View {
  let progress: Double
  let fillColor: Color

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(KolibiWidgetColors.progressTrack)
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(fillColor)
          .frame(width: max(0, geometry.size.width * min(1, max(0, progress))))
      }
    }
    .frame(height: 5)
  }
}

private struct WidgetKoliImage: View {
  let imageName: String
  let width: CGFloat
  let maxHeight: CGFloat

  var body: some View {
    Image(imageName)
      .resizable()
      .aspectRatio(contentMode: .fit)
      .frame(width: width)
      .frame(maxHeight: maxHeight)
      .accessibilityHidden(true)
  }
}

private struct WidgetMacroTile: View {
  let item: WidgetMacroItem

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(item.label)
        .font(.system(size: 9))
        .foregroundStyle(KolibiWidgetColors.mutedText)
        .lineLimit(1)
      Text(item.value)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(KolibiWidgetColors.darkText)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(8)
    .background(
      RoundedRectangle(cornerRadius: 7, style: .continuous)
        .fill(KolibiWidgetColors.macroTileBackground)
    )
  }
}

private struct WidgetMacroGrid: View {
  let macros: [WidgetMacroItem]

  var body: some View {
    let rowOne = Array(macros.prefix(2))
    let rowTwo = Array(macros.dropFirst(2).prefix(2))

    VStack(spacing: 6) {
      if !rowOne.isEmpty {
        HStack(spacing: 6) {
          ForEach(Array(rowOne.enumerated()), id: \.offset) { _, item in
            WidgetMacroTile(item: item)
          }
          if rowOne.count == 1 {
            Spacer(minLength: 0)
          }
        }
      }
      if !rowTwo.isEmpty {
        HStack(spacing: 6) {
          ForEach(Array(rowTwo.enumerated()), id: \.offset) { _, item in
            WidgetMacroTile(item: item)
          }
          if rowTwo.count == 1 {
            Spacer(minLength: 0)
          }
        }
      }
    }
  }
}

private struct WidgetBottomChrome: View {
  let viewModel: WidgetViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      WidgetProgressBar(progress: viewModel.progress, fillColor: viewModel.accentColor)
        .padding(.bottom, 6)

      Text(viewModel.labelFooter)
        .font(.system(size: 10))
        .foregroundStyle(KolibiWidgetColors.mutedText)
        .lineLimit(2)
    }
  }
}

// MARK: - Families

private struct KolibiWidgetSmallView: View {
  let viewModel: WidgetViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(viewModel.labelRemaining)
        .font(.system(size: 12))
        .foregroundStyle(KolibiWidgetColors.mutedText)
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)

      HStack(alignment: .center, spacing: 8) {
        Text(viewModel.remainingValue)
          .font(.system(size: 34, weight: .semibold))
          .foregroundStyle(viewModel.accentColor)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)

        WidgetKoliImage(imageName: viewModel.koliImageName, width: 40, maxHeight: 48)
      }
      .padding(.top, 2)

      Spacer(minLength: 0)

      WidgetBottomChrome(viewModel: viewModel)
    }
    .padding(13)
  }
}

private struct KolibiWidgetMediumView: View {
  let viewModel: WidgetViewModel

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 0) {
        Text(viewModel.labelRemaining)
          .font(.system(size: 12))
          .foregroundStyle(KolibiWidgetColors.mutedText)
          .lineLimit(1)

        Text(viewModel.remainingValue)
          .font(.system(size: 40, weight: .semibold))
          .foregroundStyle(viewModel.accentColor)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
          .padding(.top, 2)

        Spacer(minLength: 0)

        WidgetBottomChrome(viewModel: viewModel)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

      WidgetKoliImage(imageName: viewModel.koliImageName, width: 46, maxHeight: 56)
        .padding(.top, 2)

      if !viewModel.macros.isEmpty {
        WidgetMacroGrid(macros: viewModel.macros)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .padding(13)
  }
}

private struct KolibiWidgetCircularView: View {
  let viewModel: WidgetViewModel

  private var ringProgress: Double {
    viewModel.isOverGoal ? 1 : min(1, max(0, viewModel.progress))
  }

  var body: some View {
    ZStack {
      Circle()
        .stroke(Color.secondary.opacity(0.25), lineWidth: 5)

      Circle()
        .trim(from: 0, to: ringProgress)
        .stroke(
          Color.primary,
          style: StrokeStyle(lineWidth: 5, lineCap: .round)
        )
        .rotationEffect(.degrees(-90))

      Text(viewModel.remainingValue)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.primary)
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .padding(.horizontal, 6)
    }
  }
}

private struct KolibiWidgetRectangularView: View {
  let viewModel: WidgetViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(viewModel.labelRemaining)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)

      Text(viewModel.remainingValue)
        .font(.title2)
        .fontWeight(.semibold)
        .foregroundStyle(.primary)
        .minimumScaleFactor(0.6)
        .lineLimit(1)

      Text(viewModel.labelFooterCompact)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct KolibiWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: Provider.Entry

  var body: some View {
    switch family {
    case .systemMedium:
      KolibiWidgetMediumView(viewModel: entry.viewModel)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) {
          WidgetMeshBackground()
        }
    case .accessoryCircular:
      KolibiWidgetCircularView(viewModel: entry.viewModel)
        .containerBackground(for: .widget) {
          Color.clear
        }
    case .accessoryRectangular:
      KolibiWidgetRectangularView(viewModel: entry.viewModel)
        .containerBackground(for: .widget) {
          Color.clear
        }
    default:
      KolibiWidgetSmallView(viewModel: entry.viewModel)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) {
          WidgetMeshBackground()
        }
    }
  }
}

struct KolibiWidget: Widget {
  let kind: String = "KolibiWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      KolibiWidgetEntryView(entry: entry)
    }
    .configurationDisplayName(String(localized: "widget.displayName"))
    .description(String(localized: "widget.description"))
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryCircular,
      .accessoryRectangular,
    ])
  }
}
