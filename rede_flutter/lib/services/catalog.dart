// Ported from app/src/lib/catalog.ts — keep in sync.

class Dialect {
  final String key;
  final String name;
  final String region;
  final String speakers;
  final String canton;
  // When set with more than one entry, DialectCard renders a small grid of
  // all member shields instead of the single `canton` flag. Use for merged
  // regional clusters (Ost-/Innerschweiz).
  final List<String> cantons;
  const Dialect({
    required this.key,
    required this.name,
    required this.region,
    required this.speakers,
    this.canton = "",
    this.cantons = const [],
  });
}

class Scenario {
  final String key;
  final String name;
  final String description;
  final String image;
  const Scenario({
    required this.key,
    required this.name,
    required this.description,
    this.image = "",
  });
}

const String RUMANTSCH_KEY = "rumantsch";

const List<Dialect> DIALECTS = [
  Dialect(key: "hochdeutsch",  name: "Schweizer Hochdeutsch", region: "Schweiz",      speakers: "~5M",   canton: "CH"),
  Dialect(key: "francais",     name: "Français suisse",       region: "Romandie",     speakers: "~2M",   canton: "GE", cantons: ["GE", "VD", "NE", "JU", "FR", "VS"]),
  Dialect(key: "zuri",         name: "Züridütsch",            region: "Zürich",       speakers: "~1.5M", canton: "ZH"),
  Dialect(key: "bern",         name: "Berndütsch",            region: "Bern",         speakers: "~1M",   canton: "BE"),
  Dialect(key: "ostschweiz",   name: "Ostschwiizertüütsch",   region: "Ostschweiz",   speakers: "~900k", canton: "SG", cantons: ["SG", "TG", "AI", "AR", "SH"]),
  Dialect(key: "innerschweiz", name: "Innerschwiizertüütsch", region: "Innerschweiz", speakers: "~800k", canton: "LU", cantons: ["LU", "SZ", "ZG", "UR", "NW", "OW"]),
  Dialect(key: "basel",        name: "Baseldytsch",           region: "Basel",        speakers: "~500k", canton: "BS"),
  Dialect(key: "italiano",     name: "Italiano svizzero",     region: "Ticino + Grigioni", speakers: "~350k", canton: "TI"),
  Dialect(key: "rumantsch",    name: "Rumantsch Grischun",    region: "Graubünden",   speakers: "~40k",  canton: "GR"),
];

const List<Scenario> SCENARIOS = [
  Scenario(key: "free_talk", name: "Freis Gschpräch", description: "Open conversation, any topic", image: "/situations/freetalk.jpg"),
  Scenario(key: "migros", name: "Migros Kasse", description: "Checkout at Migros supermarket", image: "/situations/supermarket.jpg"),
  Scenario(key: "tram", name: "Im Tram", description: "Asking for help on the tram", image: "/situations/tram.jpg"),
  Scenario(key: "office", name: "Im Büro", description: "Office small talk with a colleague", image: "/situations/office.jpg"),
  Scenario(key: "beiz", name: "I de Beiz", description: "At the local pub / restaurant", image: "/situations/restaurant.jpg"),
  Scenario(key: "hausverwaltung", name: "Hausverwaltung", description: "Calling the landlord about an issue", image: "/situations/landlord.jpg"),
  Scenario(key: "doctor", name: "Bim Doggter", description: "At the doctor's appointment", image: "/situations/doctor.jpg"),
  Scenario(key: "bank", name: "Uf de Bank", description: "At the bank or post office", image: "/situations/bank.jpg"),
  Scenario(key: "neighbour", name: "S Nachbersgschpräch", description: "Meeting a neighbour in the stairwell", image: "/situations/stairwell.jpg"),
];

const Map<String, Map<String, String>> SCENARIO_NAMES_BY_DIALECT = {
  "bern": {
    "free_talk": "Fryes Gschpräch",
    "migros": "Migros Kasse",
    "tram": "Im Tram",
    "office": "Im Büro",
    "beiz": "I dr Beiz",
    "hausverwaltung": "Husverwautig",
    "doctor": "Bim Dökter",
    "bank": "Uf dr Bank",
    "neighbour": "Ds Nachbergschpräch",
    "news": "Aktuelli Nüüs",
  },
  "ostschweiz": {
    "free_talk": "Freis Gschpröch",
    "migros": "Migros Kasse",
    "tram": "Im Bus",
    "office": "Im Büro",
    "beiz": "I de Beiz",
    "hausverwaltung": "Husverwaltig",
    "doctor": "Bim Doktor",
    "bank": "Uf de Bank",
    "neighbour": "Es Nochbersgschpröch",
    "news": "Aktuelli Nüüs",
  },
  "basel": {
    "free_talk": "Freis Gsprööch",
    "migros": "Migros Kasse",
    "tram": "Im Drämmli",
    "office": "Im Büro",
    "beiz": "I dr Baiz",
    "hausverwaltung": "Hüüsverwaltig",
    "doctor": "Bim Dogder",
    "bank": "Uff dr Bangg",
    "neighbour": "S Noochbersgsprooch",
    "news": "Aktuelli Naachrichte",
  },
  "innerschweiz": {
    "free_talk": "Freis Gschpröch",
    "migros": "Migros Kasse",
    "tram": "Im Bus",
    "office": "Im Büro",
    "beiz": "I de Beiz",
    "hausverwaltung": "Husverwaltig",
    "doctor": "Bim Doggter",
    "bank": "Uf de Bank",
    "neighbour": "Es Nochbersgschpröch",
    "news": "Aktuelli Nüüs",
  },
  "rumantsch": {
    "free_talk": "Discurs liber",
    "migros": "Cassa dal supermartgà",
    "tram": "En il tram",
    "office": "En l'uffizi",
    "beiz": "En l'ustaria",
    "hausverwaltung": "Administraziun da chasa",
    "doctor": "Tar il docter",
    "bank": "A la banca",
    "neighbour": "Discurs cun il vischin",
    "news": "Novitads actualas",
  },
  "hochdeutsch": {
    "free_talk": "Freies Gespräch",
    "migros": "Migros-Kasse",
    "tram": "Im Tram",
    "office": "Im Büro",
    "beiz": "In der Beiz",
    "hausverwaltung": "Hausverwaltung",
    "doctor": "Beim Arzt",
    "bank": "Auf der Bank",
    "neighbour": "Das Nachbargespräch",
    "news": "Aktuelle Nachrichten",
  },
  "francais": {
    "free_talk": "Conversation libre",
    "migros": "Caisse Migros",
    "tram": "Dans le tram",
    "office": "Au bureau",
    "beiz": "Au bistrot",
    "hausverwaltung": "Gérance",
    "doctor": "Chez le médecin",
    "bank": "À la banque",
    "neighbour": "Conversation avec le voisin",
    "news": "Actualités",
  },
  "italiano": {
    "free_talk": "Conversazione libera",
    "migros": "Cassa Migros",
    "tram": "Sul tram",
    "office": "In ufficio",
    "beiz": "Al bar",
    "hausverwaltung": "Amministrazione",
    "doctor": "Dal medico",
    "bank": "In banca",
    "neighbour": "Conversazione col vicino",
    "news": "Notizie",
  },
};

// Returns the scenario's **title in the TARGET language** (the dialect the
// user is learning). Pass the user-UI translation of `scenario.X.name` as
// fallback for dialects that don't have an override.
//
// Pairing convention used everywhere a scenario card is rendered:
//   - TITLE   → scenarioNameFor(dialect, key, …)     // target language
//   - SUBTITLE → i18n.t("scenario.<key>.desc")        // user UI language
// Do NOT swap them — the title must be the foreign word the user is learning;
// the subtitle is the description they read in their own language.
String scenarioNameFor(String dialect, String scenarioKey, String fallback) {
  return SCENARIO_NAMES_BY_DIALECT[dialect]?[scenarioKey] ?? fallback;
}
