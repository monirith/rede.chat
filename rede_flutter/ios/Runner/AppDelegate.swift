import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    // Register our local PCM player as a plugin. The registrar API gives us
    // the binaryMessenger without poking at private bridge internals.
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "PcmPitchPlayer") {
      PcmPitchPlayer.register(with: registrar)
    }
  }
}
