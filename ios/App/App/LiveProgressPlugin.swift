import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Lock-screen progress (guidance_v2 Step 6.8, ADR-049): one Live Activity, driven by dates so it stays right
/// while the app is suspended. The web layer calls `update` on every phase change and `end` when there is
/// nothing to show. Passive: no buttons; a tap opens the app.
@objc(LiveProgressPlugin)
public class LiveProgressPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveProgressPlugin"
    public let jsName = "SiftLiveProgress"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.resolve() }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return call.resolve() }
        guard let phase = call.getString("phase"), let startedAt = call.getDouble("startedAt"), let endsAt = call.getDouble("endsAt") else {
            return call.reject("phase, startedAt and endsAt are required")
        }
        let state = SiftLiveAttributes.ContentState(
            phase: phase,
            startedAt: Date(timeIntervalSince1970: startedAt / 1000),
            endsAt: Date(timeIntervalSince1970: endsAt / 1000),
            title: call.getString("title") ?? "",
            overTitle: call.getString("overTitle") ?? ""
        )
        // Focus turns stale at its planned end, and the widget then shows the "Time's up" line.
        let content = ActivityContent(state: state, staleDate: state.endsAt)
        Task {
            await Self.endAll()
            do {
                let activity = try Activity.request(attributes: SiftLiveAttributes(), content: content, pushType: nil)
                // A break removes itself when it ends, without the app: ended now, dismissed at the break end.
                if phase == "break" { await activity.end(content, dismissalPolicy: .after(state.endsAt)) }
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { return call.resolve() }
        Task {
            await Self.endAll()
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private static func endAll() async {
        for activity in Activity<SiftLiveAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
