export const BAD_WORDS = [
  "anjim", "anjing", "anjir", "anjrit", "anjrot", "asu", "babi", "bacot",
  "bajingan", "banci", "bangke", "bangor", "bangsat", "bego", "bejad",
  "bencong", "bodat", "bugil", "bundir", "bunuh", "burik", "burit", "cawek",
  "cemen", "cipok", "cium", "colai", "coli", "colmek", "cukimai", "cukimay",
  "culun", "cumbu", "dancuk", "dewasa", "dick", "dildo", "encuk", "gay",
  "gei", "gembel", "gey", "gigolo", "gila", "goblog", "goblok", "haram",
  "hencet", "hentai", "idiot", "jablai", "jablay", "jancok", "jancuk",
  "jangkik", "jembut", "jilat", "jingan", "kampang", "keparat", "kimak",
  "kirik", "klentit", "klitoris", "konthol", "kontol", "koplok", "kunyuk",
  "kutang", "kutis", "kwontol", "lonte", "maho", "masturbasi", "matane",
  "mati", "memek", "mesum", "modar", "modyar", "mokad", "najis", "nazi",
  "ndhasmu", "nenen", "ngentot", "ngolom", "ngulum", "nigga", "nigger",
  "onani", "orgasme", "paksa", "pantat", "pantek", "pecun", "peli", "penis",
  "pentil", "pepek", "perek", "perkosa", "piatu", "porno", "pukimak",
  "qontol", "selangkang", "sempak", "senggama", "setan", "setubuh", "silet",
  "silit", "sinting", "sodomi", "stres", "telanjang", "telaso", "tete",
  "tewas", "titit", "togel", "toket", "tolol", "tusbol", "urin", "vagina",
  "xxx", "yateam", "yatim"
];

const ANIMAL_WORDS = ["anjing", "babi", "kirik", "asu"];
const SAFE_CONTEXT_WORDS = ["hewan", "binatang", "ternak", "peliharaan", "satwa", "fauna"];

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  // Ganti karakter non-alfanumerik dengan spasi untuk mengisolasi kata
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = normalizedText.split(/\s+/);

  const hasSafeContext = SAFE_CONTEXT_WORDS.some(safeWord => words.includes(safeWord));

  for (const w of words) {
    if (BAD_WORDS.includes(w)) {
      // Jika kata kasar merupakan nama hewan dan terdapat kata konteks aman, abaikan
      if (hasSafeContext && ANIMAL_WORDS.includes(w)) {
        continue;
      }
      return true;
    }
  }
  return false;
}
