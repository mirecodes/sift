import UIKit
import Capacitor

/// The Capacitor bridge plus Sift's own app-local plugins, which Capacitor does not discover by itself.
class SiftBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveProgressPlugin())
    }
}
