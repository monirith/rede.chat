package chat.rede.rede_flutter

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.PlaybackParams

// Pitch-preserved PCM player on Android. AudioTrack.setPlaybackParams gives
// us independent setSpeed (tempo) and setPitch — exactly what we need to
// slow down the AI voice without dropping pitch.
//
// Feed expects 16-bit signed little-endian mono PCM matching the configured
// sample rate. Uses non-blocking writes so the method-channel thread never
// stalls when the user holds the slow-speed button.
class PcmPitchPlayer {
    private var track: AudioTrack? = null
    private var currentSpeed: Float = 1.0f

    fun setup(sampleRate: Int) {
        release() // idempotent — wipe any previous state
        val minBuf = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        // Headroom for slow-speed: at 0.5× we feed 2× as many bytes per
        // wall-clock second from Gemini, so a generous buffer is essential.
        val bufBytes = (minBuf * 8).coerceAtLeast(sampleRate * 2)

        track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .build()
            )
            .setBufferSizeInBytes(bufBytes)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        applyParams()
    }

    fun start() {
        track?.play()
    }

    fun feed(bytes: ByteArray) {
        val t = track ?: return
        // Non-blocking so the Flutter method channel thread doesn't stall.
        // Anything that doesn't fit just gets dropped — better a glitch
        // than a deadlock.
        t.write(bytes, 0, bytes.size, AudioTrack.WRITE_NON_BLOCKING)
    }

    fun setSpeed(speed: Float) {
        currentSpeed = speed.coerceIn(0.25f, 4.0f)
        applyParams()
    }

    fun stop() {
        try { track?.stop() } catch (_: Throwable) {}
    }

    fun release() {
        try { track?.stop() } catch (_: Throwable) {}
        try { track?.release() } catch (_: Throwable) {}
        track = null
    }

    private fun applyParams() {
        val t = track ?: return
        try {
            t.playbackParams = PlaybackParams()
                .setSpeed(currentSpeed) // tempo, doesn't change pitch
                .setPitch(1.0f)         // explicit no-shift
        } catch (e: Throwable) {
            // Some devices throw if speed is set before play() — ignore.
        }
    }
}
