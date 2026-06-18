package chat.rede.rede_flutter

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val player = PcmPitchPlayer()

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "chat.rede.app/pcm_player")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "setup" -> {
                        val sr = (call.argument<Number>("sampleRate")?.toInt()) ?: 24000
                        player.setup(sr)
                        result.success(null)
                    }
                    "start" -> { player.start(); result.success(null) }
                    "feed" -> {
                        val bytes = call.arguments as? ByteArray
                        if (bytes != null) player.feed(bytes)
                        result.success(null)
                    }
                    "setSpeed" -> {
                        val s = (call.argument<Number>("speed")?.toFloat()) ?: 1.0f
                        player.setSpeed(s)
                        result.success(null)
                    }
                    "stop" -> { player.stop(); result.success(null) }
                    "release" -> { player.release(); result.success(null) }
                    else -> result.notImplemented()
                }
            }
    }

    override fun onDestroy() {
        player.release()
        super.onDestroy()
    }
}
