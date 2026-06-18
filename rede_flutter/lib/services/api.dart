import 'dart:convert';
import 'package:http/http.dart' as http;
import 'auth.dart';
import 'config.dart';
import 'device.dart';

class UserInfo {
  final String id;
  final String? name;
  final String? email;
  final int seconds;
  final int currentStreak;
  final int longestStreak;
  final String? lastSessionDate;
  final String createdAt;

  UserInfo({
    required this.id,
    this.name,
    this.email,
    required this.seconds,
    required this.currentStreak,
    required this.longestStreak,
    this.lastSessionDate,
    required this.createdAt,
  });

  factory UserInfo.fromJson(Map<String, dynamic> j) => UserInfo(
        id: j["id"],
        name: j["name"],
        email: j["email"],
        seconds: j["seconds"] ?? 0,
        currentStreak: j["current_streak"] ?? 0,
        longestStreak: j["longest_streak"] ?? 0,
        lastSessionDate: j["last_session_date"],
        createdAt: j["created_at"] ?? "",
      );
}

class CreditPack {
  final String key;
  final int amountChf; // in rappen / cents
  final int seconds;
  final String label;
  CreditPack({required this.key, required this.amountChf, required this.seconds, required this.label});
  factory CreditPack.fromJson(Map<String, dynamic> j) => CreditPack(
        key: j["key"], amountChf: j["amountChf"], seconds: j["seconds"], label: j["label"],
      );
}

class Api {
  static Future<Map<String, String>> _headers() async {
    final headers = <String, String>{
      "Content-Type": "application/json",
      "X-Device-Id": await DeviceService.id(),
    };
    final token = AuthService.instance.token;
    if (token != null) headers["Authorization"] = "Bearer $token";
    return headers;
  }

  static Future<UserInfo> me() async {
    final res = await http.get(Uri.parse("${Config.workerHttpUrl}/api/me"), headers: await _headers());
    if (res.statusCode != 200) throw Exception("me failed ${res.statusCode}");
    final j = jsonDecode(res.body);
    return UserInfo.fromJson(j["user"]);
  }

  static Future<List<CreditPack>> packs() async {
    final res = await http.get(Uri.parse("${Config.workerHttpUrl}/api/credits/packs"), headers: await _headers());
    if (res.statusCode != 200) throw Exception("packs failed ${res.statusCode}");
    final j = jsonDecode(res.body);
    return (j["packs"] as List).map((p) => CreditPack.fromJson(p)).toList();
  }

  static Future<String> checkout(String packKey) async {
    final res = await http.post(
      Uri.parse("${Config.workerHttpUrl}/api/credits/checkout"),
      headers: await _headers(),
      body: jsonEncode({"packKey": packKey}),
    );
    if (res.statusCode != 200) throw Exception("checkout failed ${res.statusCode}");
    return jsonDecode(res.body)["url"];
  }
}
