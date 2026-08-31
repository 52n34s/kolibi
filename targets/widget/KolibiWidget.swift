import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry {
    SimpleEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
    completion(SimpleEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
    let entry = SimpleEntry(date: Date())
    let timeline = Timeline(entries: [entry], policy: .never)
    completion(timeline)
  }
}

struct SimpleEntry: TimelineEntry {
  let date: Date
}

struct KolibiWidgetEntryView: View {
  var entry: Provider.Entry

  var body: some View {
    Text("Kolibi")
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
