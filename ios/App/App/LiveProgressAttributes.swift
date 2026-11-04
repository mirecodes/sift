import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// The Live Activity's data (guidance_v2 Step 6.8, ADR-049). Shared by the app (`LiveProgressPlugin`) and the
/// `SiftLiveActivity` widget extension: this file must be a member of both targets.
@available(iOS 16.1, *)
struct SiftLiveAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// "focus" or "break".
        var phase: String
        var startedAt: Date
        /// The planned end. The widget counts down to it; Focus keeps counting up past it (overtime).
        var endsAt: Date
        /// What the activity says before the end ("Focus", "Break").
        var title: String
        /// What it says once Focus is past its end ("Time's up · open Sift to end focus").
        var overTitle: String
    }
}
#endif
