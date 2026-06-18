// Endpoints. Same backend as the web app.

class Config {
  static const String workerHttpUrl = "https://rede.chat";
  static const String workerWsUrl = "wss://rede.chat";

  // Audio: must match the web client + worker pipeline so the worker can
  // forward bytes to Gemini Live without resampling.
  static const int inputSampleRate = 16000;  // PCM16 → Gemini
  static const int outputSampleRate = 24000; // Gemini PCM16 → speaker
}
