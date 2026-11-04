import ActivityKit
import SwiftUI
import WidgetKit

// The Live Activity's look (guidance_v2 Step 6.8). Lives in the `SiftLiveActivity` widget extension target;
// docs/guides/MOBILE_SETUP.md §Live Activity explains how to add the target in Xcode.

@main
struct SiftLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        SiftLiveActivity()
    }
}

struct SiftLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SiftLiveAttributes.self) { context in
            LockScreenView(state: context.state, stale: context.isStale)
                .activityBackgroundTint(Color(red: 8 / 255, green: 8 / 255, blue: 8 / 255))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    LockScreenView(state: context.state, stale: context.isStale)
                }
            } compactLeading: {
                Text(context.state.title).font(.caption.weight(.semibold))
            } compactTrailing: {
                TimerText(state: context.state).frame(maxWidth: 56)
            } minimal: {
                TimerText(state: context.state)
            }
        }
    }
}

/// `.timer` counts down to the date and, past it, up again: Focus overtime with no app updates.
struct TimerText: View {
    let state: SiftLiveAttributes.ContentState
    var body: some View {
        Text(state.endsAt, style: .timer).monospacedDigit().multilineTextAlignment(.trailing)
    }
}

struct LockScreenView: View {
    let state: SiftLiveAttributes.ContentState
    let stale: Bool
    var body: some View {
        HStack {
            Text(stale && state.phase == "focus" ? state.overTitle : state.title)
                .font(.headline)
                .foregroundColor(.white)
            Spacer()
            TimerText(state: state)
                .font(.title2.weight(.semibold))
                .foregroundColor(.white)
        }
        .padding(16)
    }
}
