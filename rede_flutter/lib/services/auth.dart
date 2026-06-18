// Self-hosted auth client (Better Auth) for Flutter, mirroring the web
// `app/src/lib/auth.ts`. Talks to the Worker's /api/auth/* endpoints.
//
// Login: passwordless email OTP (send code → verify code).
// OAuth (Google / Apple) is not handled here yet — it requires native
// deep-link callback wiring per platform. The web client covers both.
//
// The session is a bearer token issued by Better Auth's bearer plugin,
// stored in SharedPreferences and attached as Authorization: Bearer on
// every authenticated request. Anonymous device users keep their identity
// via a UUID stored under X-Device-Id, exactly like the web flow.

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'config.dart';

class User {
  final String id;
  final String? email;
  final String? name;
  const User({required this.id, this.email, this.name});

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        email: j['email'] as String?,
        name: j['name'] as String?,
      );
}

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const _tokenKey = 'rede:auth-token';
  static const _deviceKey = 'rede:device-id';

  late SharedPreferences _prefs;
  User? _currentUser;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    if (_prefs.getString(_deviceKey) == null) {
      _prefs.setString(_deviceKey, const Uuid().v4());
    }
    // Best-effort session refresh; failures fall back to anonymous.
    try {
      _currentUser = await _fetchSession();
    } catch (_) {
      _currentUser = null;
    }
  }

  User? get currentUser => _currentUser;
  bool get isSignedIn => _currentUser != null;
  String? get token => _prefs.getString(_tokenKey);
  String get deviceId => _prefs.getString(_deviceKey)!;

  /// Headers every authenticated request should carry. Device id is always
  /// sent so the Worker can attribute anonymous activity; bearer token is
  /// added once the user signs in.
  Map<String, String> authHeaders() {
    final h = <String, String>{'X-Device-Id': deviceId};
    final t = token;
    if (t != null && t.isNotEmpty) h['Authorization'] = 'Bearer $t';
    return h;
  }

  /// Step 1 of email login: ask the Worker to send a one-time code.
  /// Returns an error message or null on success.
  Future<String?> sendOtp(String email) async {
    final res = await http.post(
      Uri.parse('${Config.workerHttpUrl}/api/auth/email-otp/send-verification-otp'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode({'email': email, 'type': 'sign-in'}),
    );
    if (res.statusCode == 200) return null;
    return _decodeError(res.body) ?? 'Could not send code (${res.statusCode})';
  }

  /// Step 2 of email login: verify the code, store the bearer token, refresh
  /// the cached user. Returns an error message or null on success.
  Future<String?> verifyOtp(String email, String code) async {
    final res = await http.post(
      Uri.parse('${Config.workerHttpUrl}/api/auth/sign-in/email-otp'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode({'email': email, 'otp': code}),
    );
    if (res.statusCode != 200) {
      return _decodeError(res.body) ?? 'Invalid code';
    }
    final bearer = res.headers['set-auth-token'];
    if (bearer != null && bearer.isNotEmpty) {
      await _prefs.setString(_tokenKey, bearer);
    }
    _currentUser = await _fetchSession();
    return null;
  }

  Future<void> signOut() async {
    try {
      await http.post(
        Uri.parse('${Config.workerHttpUrl}/api/auth/sign-out'),
        headers: authHeaders(),
      );
    } catch (_) {/* ignore network failures on sign-out */}
    await _prefs.remove(_tokenKey);
    _currentUser = null;
  }

  Future<User?> _fetchSession() async {
    final res = await http.get(
      Uri.parse('${Config.workerHttpUrl}/api/auth/get-session'),
      headers: authHeaders(),
    );
    if (res.statusCode != 200 || res.body.isEmpty || res.body == 'null') {
      return null;
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>?;
    final userJson = data?['user'] as Map<String, dynamic>?;
    if (userJson == null) return null;
    return User.fromJson(userJson);
  }

  String? _decodeError(String body) {
    try {
      final m = jsonDecode(body);
      if (m is Map && m['message'] is String) return m['message'] as String;
    } catch (_) {}
    return null;
  }
}
