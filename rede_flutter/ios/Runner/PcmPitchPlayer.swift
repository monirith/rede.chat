// Native PCM player with pitch-preserved time stretching.
// Wraps AVAudioEngine + AVAudioPlayerNode + AVAudioUnitTimePitch so we can
// adjust playback tempo without dropping pitch. Replaces flutter_pcm_sound.
//
// Flutter side calls via the "chat.rede.app/pcm_player" method channel:
//   setup({sampleRate}), start(), feed(<bytes>), setSpeed({speed}), stop()
//
// Feed expects 16-bit signed little-endian mono PCM. We convert to float32
// inside this class — AVAudioEngine wants float buffers.

import AVFoundation
import Flutter

public final class PcmPitchPlayer: NSObject, FlutterPlugin {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let timePitch = AVAudioUnitTimePitch()
    private var format: AVAudioFormat?
    private var started = false

    public override init() {
        super.init()
        engine.attach(player)
        engine.attach(timePitch)
        timePitch.rate = 1.0
        timePitch.pitch = 0.0
    }

    // MARK: - FlutterPlugin

    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(
            name: "chat.rede.app/pcm_player",
            binaryMessenger: registrar.messenger()
        )
        let instance = PcmPitchPlayer()
        registrar.addMethodCallDelegate(instance, channel: channel)
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "setup":
            let args = call.arguments as? [String: Any]
            let rate = (args?["sampleRate"] as? Double) ?? 24000
            setup(sampleRate: rate)
            result(nil)
        case "start":
            start()
            result(nil)
        case "feed":
            if let data = call.arguments as? FlutterStandardTypedData {
                feed(data.data)
            }
            result(nil)
        case "setSpeed":
            let args = call.arguments as? [String: Any]
            let speed = (args?["speed"] as? Double) ?? 1.0
            setSpeed(speed)
            result(nil)
        case "stop":
            stop()
            result(nil)
        case "release":
            stop()
            result(nil)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    // MARK: - Audio

    private func setup(sampleRate: Double) {
        let fmt = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: false
        )
        format = fmt
        engine.disconnectNodeOutput(player)
        engine.disconnectNodeOutput(timePitch)
        engine.connect(player, to: timePitch, format: fmt)
        engine.connect(timePitch, to: engine.mainMixerNode, format: fmt)

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .voiceChat,
            options: [.defaultToSpeaker, .allowBluetooth])
        try? session.setActive(true)
    }

    private func start() {
        if started { return }
        do {
            try engine.start()
            player.play()
            started = true
        } catch {
            NSLog("[PcmPitchPlayer] engine start failed: \(error)")
        }
    }

    private func feed(_ data: Data) {
        guard let fmt = format else { return }
        let frames = data.count / 2
        guard frames > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(frames))
        else { return }
        buffer.frameLength = AVAudioFrameCount(frames)

        data.withUnsafeBytes { raw in
            guard let int16Ptr = raw.bindMemory(to: Int16.self).baseAddress,
                  let floatPtr = buffer.floatChannelData?[0] else { return }
            for i in 0..<frames {
                floatPtr[i] = Float(int16Ptr[i]) / 32768.0
            }
        }

        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
    }

    private func setSpeed(_ speed: Double) {
        let v = max(0.25, min(4.0, speed))
        timePitch.rate = Float(v)
    }

    private func stop() {
        if !started { return }
        player.stop()
        engine.stop()
        started = false
    }
}
