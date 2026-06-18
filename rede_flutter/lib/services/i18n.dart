// Mirrors app/src/lib/i18n.svelte.ts.
//
// - On first load, reads the saved language; falls back to browser/system.
// - `t(key)` returns the translated string for the current language.
// - Components call `i18n.t("key")` after listening to the I18n notifier.

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'translations.dart';

class I18n extends ChangeNotifier {
  static final I18n instance = I18n._();
  I18n._() { code = _detect(); }

  String code = "en";

  void setLanguage(String c) {
    code = c;
    notifyListeners();
  }

  static String _detect() {
    final locale = PlatformDispatcher.instance.locale.toLanguageTag().toLowerCase();
    if (locale.startsWith("gsw") || locale == "de-ch") return "gsw";
    final primary = locale.split("-").first;
    if (TRANSLATIONS.containsKey(primary)) return primary;
    return "en";
  }

  String t(String key) {
    final dict = TRANSLATIONS[code] ?? TRANSLATIONS["en"]!;
    return dict[key] ?? TRANSLATIONS["en"]![key] ?? key;
  }
}
