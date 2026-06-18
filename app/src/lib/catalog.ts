// Static catalog of dialects + scenarios shown in the picker UI.
// This is display metadata only. The actual system prompts live in the Worker
// (worker/src/prompts/). Keys must match between this file and the Worker;
// drift would result in 400-class errors on session start.

export interface DialectInfo {
  key: string;
  name: string;
  region: string;
  speakers: string;
  canton?: string;        // single ISO 3166-2:CH canton code for COA SVG
  cantons?: string[];     // when set, DialectCard shows a small grid of all shields
}

export interface ScenarioInfo {
  key: string;
  name: string;
  description: string;
  image?: string;
}

// Ordered by number of speakers, descending. Adjust speaker estimates here
// and the order will be visually consistent without a runtime sort.
export const DIALECTS: DialectInfo[] = [
  { key: "hochdeutsch",   name: "Schweizer Hochdeutsch", region: "Schweiz",                speakers: "~5M",   canton: "CH" },
  { key: "francais",      name: "Français suisse",       region: "Romandie",               speakers: "~2M",   canton: "GE", cantons: ["GE", "VD", "NE", "JU", "FR", "VS"] },
  { key: "zuri",          name: "Züridütsch",            region: "Zürich",                 speakers: "~1.5M", canton: "ZH" },
  { key: "bern",          name: "Berndütsch",            region: "Bern",                   speakers: "~1M",   canton: "BE" },
  { key: "ostschweiz",    name: "Ostschwiizertüütsch",   region: "Ostschweiz",             speakers: "~900k", canton: "SG", cantons: ["SG", "TG", "AI", "AR", "SH"] },
  { key: "innerschweiz",  name: "Innerschwiizertüütsch", region: "Innerschweiz",           speakers: "~800k", canton: "LU", cantons: ["LU", "SZ", "ZG", "UR", "NW", "OW"] },
  { key: "basel",         name: "Baseldytsch",           region: "Basel",                  speakers: "~500k", canton: "BS" },
  { key: "italiano",      name: "Italiano svizzero",     region: "Ticino + Grigioni",      speakers: "~350k", canton: "TI" },
  { key: "rumantsch",     name: "Rumantsch Grischun",    region: "Graubünden",             speakers: "~40k",  canton: "GR" },
];

export const SCENARIOS: ScenarioInfo[] = [
  { key: "free_talk",      name: "Freis Gschpräch",     description: "Open conversation, any topic",    image: "/situations/freetalk.jpg" },
  { key: "migros",         name: "Migros Kasse",        description: "Checkout at Migros supermarket",     image: "/situations/supermarket.jpg" },
  { key: "tram",           name: "Im Tram",             description: "Asking for help on the tram",        image: "/situations/tram.jpg" },
  { key: "office",         name: "Im Büro",             description: "Office small talk with a colleague",  image: "/situations/office.jpg" },
  { key: "beiz",           name: "I de Beiz",           description: "At the local pub / restaurant",      image: "/situations/restaurant.jpg" },
  { key: "hausverwaltung", name: "Hausverwaltung",      description: "Calling the landlord about an issue", image: "/situations/landlord.jpg" },
  { key: "doctor",         name: "Bim Doggter",         description: "At the doctor's appointment",        image: "/situations/doctor.jpg" },
  { key: "bank",           name: "Uf de Bank",          description: "At the bank or post office",         image: "/situations/bank.jpg" },
  { key: "neighbour",      name: "S Nachbersgschpräch", description: "Meeting a neighbour in the stairwell", image: "/situations/stairwell.jpg" },
];

export const RUMANTSCH_KEY = "rumantsch";

// Per-dialect overrides for scenario card titles. Missing entries fall back to
// the default `name` in SCENARIOS above (generic Schwyzerdütsch). Fill in a
// dialect block only when its variant differs from the default — for most
// Swiss-German dialects the Zürich-flavoured default is close enough.
export const SCENARIO_NAMES_BY_DIALECT: Record<string, Partial<Record<string, string>>> = {
  // Zürich is the default in SCENARIOS above — no override needed.
  bern: {
    free_talk:      "Fryes Gschpräch",
    migros:         "Migros Kasse",
    tram:           "Im Tram",
    office:         "Im Büro",
    beiz:           "I dr Beiz",
    hausverwaltung: "Husverwautig",
    doctor:         "Bim Dökter",
    bank:           "Uf dr Bank",
    neighbour:      "Ds Nachbergschpräch",
    news:           "Aktuelli Nüüs",
  },
  ostschweiz: {
    free_talk:      "Freis Gschpröch",
    migros:         "Migros Kasse",
    tram:           "Im Bus",
    office:         "Im Büro",
    beiz:           "I de Beiz",
    hausverwaltung: "Husverwaltig",
    doctor:         "Bim Doktor",
    bank:           "Uf de Bank",
    neighbour:      "Es Nochbersgschpröch",
    news:           "Aktuelli Nüüs",
  },
  basel: {
    free_talk:      "Freis Gsprööch",
    migros:         "Migros Kasse",
    tram:           "Im Drämmli",
    office:         "Im Büro",
    beiz:           "I dr Baiz",
    hausverwaltung: "Hüüsverwaltig",
    doctor:         "Bim Dogder",
    bank:           "Uff dr Bangg",
    neighbour:      "S Noochbersgsprooch",
    news:           "Aktuelli Naachrichte",
  },
  innerschweiz: {
    free_talk:      "Freis Gschpröch",
    migros:         "Migros Kasse",
    tram:           "Im Bus",
    office:         "Im Büro",
    beiz:           "I de Beiz",
    hausverwaltung: "Husverwaltig",
    doctor:         "Bim Doggter",
    bank:           "Uf de Bank",
    neighbour:      "Es Nochbersgschpröch",
    news:           "Aktuelli Nüüs",
  },
  rumantsch: {
    free_talk:      "Discurs liber",
    migros:         "Cassa dal supermartgà",
    tram:           "En il tram",
    office:         "En l'uffizi",
    beiz:           "En l'ustaria",
    hausverwaltung: "Administraziun da chasa",
    doctor:         "Tar il docter",
    bank:           "A la banca",
    neighbour:      "Discurs cun il vischin",
    news:           "Novitads actualas",
  },
  hochdeutsch: {
    free_talk:      "Freies Gespräch",
    migros:         "Migros-Kasse",
    tram:           "Im Tram",
    office:         "Im Büro",
    beiz:           "In der Beiz",
    hausverwaltung: "Hausverwaltung",
    doctor:         "Beim Arzt",
    bank:           "Auf der Bank",
    neighbour:      "Das Nachbargespräch",
    news:           "Aktuelle Nachrichten",
  },
  francais: {
    free_talk:      "Conversation libre",
    migros:         "Caisse Migros",
    tram:           "Dans le tram",
    office:         "Au bureau",
    beiz:           "Au bistrot",
    hausverwaltung: "Gérance",
    doctor:         "Chez le médecin",
    bank:           "À la banque",
    neighbour:      "Conversation avec le voisin",
    news:           "Actualités",
  },
  italiano: {
    free_talk:      "Conversazione libera",
    migros:         "Cassa Migros",
    tram:           "Sul tram",
    office:         "In ufficio",
    beiz:           "Al bar",
    hausverwaltung: "Amministrazione",
    doctor:         "Dal medico",
    bank:           "In banca",
    neighbour:      "Conversazione col vicino",
    news:           "Notizie",
  },
};

// Returns the scenario's **title in the TARGET language** (the dialect the
// user is learning). Pass the user-UI translation of `scenario.X.name` as
// fallback for dialects that don't have an override.
//
// Pairing convention used everywhere a scenario card is rendered:
//   - TITLE   → scenarioNameFor(dialect, key)         // target language (Swiss German)
//   - SUBTITLE → t("scenario.<key>.desc")             // user UI language
// Do NOT swap them. The title must be the foreign word the user is learning;
// the subtitle is the description they read in their own language.
//
// The fallback is the Swiss German name from SCENARIOS (Zurich default).
// Earlier callers passed t("scenario.X.name") as a fallback, which leaked the
// user's UI language into the title. That broke the title-stays-in-target rule
// for any dialect lacking an explicit SCENARIO_NAMES_BY_DIALECT entry (Zürich,
// Hochdeutsch, Français suisse, Italiano svizzero).
export function scenarioNameFor(dialect: string, scenarioKey: string, fallback?: string): string {
  const override = SCENARIO_NAMES_BY_DIALECT[dialect]?.[scenarioKey];
  if (override) return override;
  const catalogDefault = SCENARIOS.find((s) => s.key === scenarioKey)?.name;
  if (catalogDefault) return catalogDefault;
  // Pseudo-scenarios like "news" aren't in SCENARIOS; caller passes a literal
  // Swiss German fallback. Final fallback to the key itself if nothing given.
  return fallback ?? scenarioKey;
}
