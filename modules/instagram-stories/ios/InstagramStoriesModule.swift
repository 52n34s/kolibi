import ExpoModulesCore
import UIKit

struct InstagramStoryItems: Record {
  /// file:// URL of a PNG shown as a movable sticker.
  @Field var stickerUri: String?
  /// file:// URL of a full-screen (9:16) background image.
  @Field var backgroundUri: String?
  /// Hex colors (#RRGGBB) behind a sticker without a background image.
  @Field var backgroundTopColor: String?
  @Field var backgroundBottomColor: String?
}

/// Meta's documented pasteboard flow for Instagram Stories:
/// typed items on UIPasteboard.general (short expiry), then open
/// instagram-stories://share?source_application=<Facebook App ID>.
public class InstagramStoriesModule: Module {
  private static let pasteboardLifetime: TimeInterval = 5 * 60

  public func definition() -> ModuleDefinition {
    Name("InstagramStories")

    AsyncFunction("share") { (appId: String, items: InstagramStoryItems) -> Bool in
      guard !appId.isEmpty,
        var components = URLComponents(string: "instagram-stories://share")
      else {
        return false
      }
      components.queryItems = [URLQueryItem(name: "source_application", value: appId)]
      guard let url = components.url else {
        return false
      }

      var item: [String: Any] = [:]
      if let data = Self.fileData(items.stickerUri) {
        item["com.instagram.sharedSticker.stickerImage"] = data
      }
      if let data = Self.fileData(items.backgroundUri) {
        item["com.instagram.sharedSticker.backgroundImage"] = data
      }
      guard !item.isEmpty else {
        return false
      }
      if let top = items.backgroundTopColor {
        item["com.instagram.sharedSticker.backgroundTopColor"] = top
      }
      if let bottom = items.backgroundBottomColor {
        item["com.instagram.sharedSticker.backgroundBottomColor"] = bottom
      }

      let pasteboardItem = item
      return await MainActor.run { () -> Bool in
        guard UIApplication.shared.canOpenURL(url) else {
          return false
        }
        UIPasteboard.general.setItems(
          [pasteboardItem],
          options: [.expirationDate: Date().addingTimeInterval(Self.pasteboardLifetime)]
        )
        UIApplication.shared.open(url)
        return true
      }
    }
  }

  private static func fileData(_ uri: String?) -> Data? {
    guard let uri, !uri.isEmpty else {
      return nil
    }
    let url = URL(string: uri).flatMap { $0.isFileURL ? $0 : nil } ?? URL(fileURLWithPath: uri)
    return try? Data(contentsOf: url)
  }
}
