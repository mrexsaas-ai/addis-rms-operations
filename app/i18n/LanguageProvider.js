"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const LANGUAGES = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
  },
  {
    code: "am",
    label: "Amharic",
    nativeLabel: "አማርኛ",
  },
  {
    code: "om",
    label: "Afaan Oromoo",
    nativeLabel: "Afaan Oromoo",
  },
  {
    code: "ti",
    label: "Tigrinya",
    nativeLabel: "ትግርኛ",
  },
];

const STORAGE_KEY = "addis-rms-language";

const translations = {
  en: {
    language: "Language",
    chooseLanguage: "Choose language",
    close: "Close",
    openLanguage: "Open language selector",
    languageSaved: "Your language preference is saved automatically.",
    logOut: "Log out",
    login: "Login",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    invalidCredentials: "Invalid email or password.",
  },

  am: {
    language: "ቋንቋ",
    chooseLanguage: "ቋንቋ ይምረጡ",
    close: "ዝጋ",
    openLanguage: "የቋንቋ መምረጫን ክፈት",
    languageSaved: "የቋንቋ ምርጫዎ በራስ-ሰር ይቀመጣል።",
    logOut: "ውጣ",
    login: "ግባ",
    email: "ኢሜይል",
    password: "የይለፍ ቃል",
    signIn: "ግባ",
    signingIn: "በመግባት ላይ...",
    invalidCredentials: "ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም።",
  },

  om: {
    language: "Afaan",
    chooseLanguage: "Afaan filadhu",
    close: "Cufi",
    openLanguage: "Filannoo afaanii bani",
    languageSaved: "Filannoon afaanii kee ofumaan ni kuufama.",
    logOut: "Ba'i",
    login: "Seeni",
    email: "Imeelii",
    password: "Jecha darbii",
    signIn: "Seeni",
    signingIn: "Seenaa jira...",
    invalidCredentials: "Imeelii ykn jechi darbii sirrii miti.",
  },

  ti: {
    language: "ቋንቋ",
    chooseLanguage: "ቋንቋ ምረጽ",
    close: "ዕጸው",
    openLanguage: "መምረጺ ቋንቋ ክፈት",
    languageSaved: "ምርጫ ቋንቋኻ ብሓደ ርእሱ ይዕቀብ።",
    logOut: "ውጻእ",
    login: "እቶ",
    email: "ኢመይል",
    password: "መሕለፊ ቃል",
    signIn: "እቶ",
    signingIn: "ይኣቱ ኣሎ...",
    invalidCredentials: "ኢመይል ወይ መሕለፊ ቃል ቅኑዕ ኣይኮነን።",
  },
};

/*
 * Key-based translations.
 * DashboardClient.js and other client components should use:
 * t("someKey")
 */
const uiTranslations = {
  operationsOverview: {
    en: "Operations overview",
    am: "የስራ አስተዳደር አጠቃላይ እይታ",
    om: "Cuunfaa hojii",
    ti: "ሓፈሻዊ ርእይቶ ስራሕ",
  },

  floorPulse: {
    en: "Good day. Here is the pulse of your floor.",
    am: "መልካም ቀን። የምግብ ቤትዎ የዛሬ እንቅስቃሴ ይህን ይመስላል።",
    om: "Akkam jirtu. Kun haala hojii mana nyaataa keessanii har'aa ti.",
    ti: "ሰላም። እዚ ድማ ናይ ሎሚ ኩነታት ስራሕ እዩ።",
  },

  liveData: {
    en: "Live data",
    am: "ቀጥታ መረጃ",
    om: "Daataa yeroo ammaa",
    ti: "ቀጥታዊ ሓበሬታ",
  },

  staffAccess: {
    en: "Staff access",
    am: "የሰራተኛ መዳረሻ",
    om: "Seensa hojjetaa",
    ti: "መእተዊ ሰራሕተኛ",
  },

  supabaseConnected: {
    en: "Supabase connected",
    am: "Supabase ተገናኝቷል",
    om: "Supabase walqabateera",
    ti: "Supabase ተጣዪሩ",
  },

  overview: {
    en: "Overview",
    am: "አጠቃላይ እይታ",
    om: "Cuunfaa",
    ti: "ሓፈሻዊ ርእይቶ",
  },

  orders: {
    en: "Orders",
    am: "ትዕዛዞች",
    om: "Ajajawwan",
    ti: "ትእዛዛት",
  },

  tables: {
    en: "Tables",
    am: "ጠረጴዛዎች",
    om: "Minjaalota",
    ti: "ጠረጴዛታት",
  },

  menu: {
    en: "Menu",
    am: "ምናሌ",
    om: "Tarree nyaataa",
    ti: "ሜኑ",
  },

  staff: {
    en: "Staff",
    am: "ሰራተኞች",
    om: "Hojjettoota",
    ti: "ሰራሕተኛታት",
  },

  settings: {
    en: "Settings",
    am: "ቅንብሮች",
    om: "Qindaa'inoota",
    ti: "ቅንብራት",
  },

  todaysSales: {
    en: "Today's sales",
    am: "የዛሬ ሽያጭ",
    om: "Gurgurtaa har'aa",
    ti: "መሸጣ ሎሚ",
  },

  completedPayments: {
    en: "Completed payments",
    am: "የተጠናቀቁ ክፍያዎች",
    om: "Kaffaltii xumurame",
    ti: "ዝተዛዘመ ክፍሊት",
  },

  availableToFinanceRoles: {
    en: "Available to finance roles",
    am: "ለፋይናንስ ሚናዎች ይገኛል",
    om: "Gahee maallaqaaf qofa jira",
    ti: "ንሚናታት ፋይናንስ ጥራይ ይርከብ",
  },

  restricted: {
    en: "Restricted",
    am: "የተገደበ",
    om: "Daangeffame",
    ti: "ዝተደረበ",
  },

  todaysOrders: {
    en: "Today's orders",
    am: "የዛሬ ትዕዛዞች",
    om: "Ajaja har'aa",
    ti: "ትእዛዛት ሎሚ",
  },

  allOrderStatuses: {
    en: "All order statuses",
    am: "ሁሉም የትዕዛዝ ሁኔታዎች",
    om: "Haala ajajaa hunda",
    ti: "ኩሎም ኩነታት ትእዛዝ",
  },

  pendingOrders: {
    en: "Pending orders",
    am: "በመጠባበቅ ላይ ያሉ ትዕዛዞች",
    om: "Ajajawwan eegaa jiran",
    ti: "ዝጽበዩ ዘለዉ ትእዛዛት",
  },

  activeServiceQueue: {
    en: "Active service queue",
    am: "ንቁ የአገልግሎት ወረፋ",
    om: "Tarree tajaajilaa hojii irra jiru",
    ti: "ንጡፍ ሰልፊ ኣገልግሎት",
  },

  completedOrders: {
    en: "Completed orders",
    am: "የተጠናቀቁ ትዕዛዞች",
    om: "Ajajawwan xumuraman",
    ti: "ዝተዛዘሙ ትእዛዛት",
  },

  closedToday: {
    en: "Closed today",
    am: "ዛሬ የተዘጉ",
    om: "Har'a cufaman",
    ti: "ሎሚ ዝተዓጽዉ",
  },

  availableTables: {
    en: "Available tables",
    am: "ነጻ ጠረጴዛዎች",
    om: "Minjaalota jiran",
    ti: "ዝርከቡ ጠረጴዛታት",
  },

  readyForGuests: {
    en: "Ready for guests",
    am: "ለእንግዶች ዝግጁ",
    om: "Keessummootaaf qophaa'aa",
    ti: "ንኣጋይሽ ድሉው",
  },

  occupiedTables: {
    en: "Occupied tables",
    am: "ተይዘው ያሉ ጠረጴዛዎች",
    om: "Minjaalota qabaman",
    ti: "ዝተወስዱ ጠረጴዛታት",
  },

  currentlySeated: {
    en: "Currently seated",
    am: "አሁን የተቀመጡ",
    om: "Amma taa'aa jiran",
    ti: "ሕጂ ዝተቐመጡ",
  },

  reservedTables: {
    en: "Reserved tables",
    am: "የተያዙ ጠረጴዛዎች",
    om: "Minjaalota qabsiifaman",
    ti: "ዝተሓዙ ጠረጴዛታት",
  },

  reservedForGuests: {
    en: "Reserved for guests",
    am: "ለእንግዶች የተያዙ",
    om: "Keessummootaaf qabsiifaman",
    ti: "ንኣጋይሽ ዝተሓዙ",
  },

  cleaningTables: {
    en: "Cleaning tables",
    am: "እየተጸዱ ያሉ ጠረጴዛዎች",
    om: "Minjaalota qulqulleessaa jiran",
    ti: "ጸረይቲ ዝግበሩ ጠረጴዛታት",
  },

  beingCleaned: {
    en: "Being cleaned",
    am: "እየተጸዳ ነው",
    om: "Qulqulleeffamaa jira",
    ti: "ይጸረይ ኣሎ",
  },

  last7Days: {
    en: "Last 7 days",
    am: "ያለፉት 7 ቀናት",
    om: "Guyyoota 7 darban",
    ti: "ዝሓለፉ 7 መዓልታት",
  },

  salesSummary: {
    en: "Sales summary",
    am: "የሽያጭ ማጠቃለያ",
    om: "Cuunfaa gurgurtaa",
    ti: "ሓፈሻዊ ጸብጻብ መሸጣ",
  },

  noCompletedPaymentData: {
    en: "No completed payment data for this period.",
    am: "ለዚህ ጊዜ የተጠናቀቀ የክፍያ መረጃ የለም።",
    om: "Yeroo kanaaf daataan kaffaltii xumurame hin jiru.",
    ti: "ኣብዚ ግዜ ዝተዛዘመ ሓበሬታ ክፍሊት የለን።",
  },

  today: {
    en: "Today",
    am: "ዛሬ",
    om: "Har'a",
    ti: "ሎሚ",
  },

  bestSellingItems: {
    en: "Best-selling items",
    am: "በብዛት የተሸጡ እቃዎች",
    om: "Meeshaalee baay'inaan gurguraman",
    ti: "ብዝሒ ዝተሸጡ ነገራት",
  },

  noItemSalesToday: {
    en: "No item sales recorded today.",
    am: "ዛሬ ምንም የእቃ ሽያጭ አልተመዘገበም።",
    om: "Har'a gurgurtaan meeshaa hin galmoofne.",
    ti: "ሎሚ ዝተመዝገበ መሸጣ ነገር የለን።",
  },

  latestActivity: {
    en: "Latest activity",
    am: "የቅርብ ጊዜ እንቅስቃሴ",
    om: "Sochii haaraa",
    ti: "ናይ ቀረባ እዋን ንጥፈታት",
  },

  recentOrders: {
    en: "Recent orders",
    am: "የቅርብ ጊዜ ትዕዛዞች",
    om: "Ajajawwan dhihoo",
    ti: "ትእዛዛት ናይ ቀረባ እዋን",
  },

  noOrdersToday: {
    en: "No orders have been recorded today.",
    am: "ዛሬ ምንም ትዕዛዝ አልተመዘገበም።",
    om: "Har'a ajajni hin galmoofne.",
    ti: "ሎሚ ዝተመዝገበ ትእዛዝ የለን።",
  },

  sold: {
    en: "sold",
    am: "ተሽጧል",
    om: "gurgurame",
    ti: "ተሸይጡ",
  },

  order: {
    en: "Order",
    am: "ትዕዛዝ",
    om: "Ajaja",
    ti: "ትእዛዝ",
  },

  table: {
    en: "Table",
    am: "ጠረጴዛ",
    om: "Minjaala",
    ti: "ጠረጴዛ",
  },

  amount: {
    en: "Amount",
    am: "መጠን",
    om: "Hammamtaa",
    ti: "መጠን",
  },

  status: {
    en: "Status",
    am: "ሁኔታ",
    om: "Haala",
    ti: "ኩነታት",
  },

  time: {
    en: "Time",
    am: "ሰዓት",
    om: "Yeroo",
    ti: "ግዜ",
  },

  takeaway: {
    en: "Takeaway",
    am: "የውጭ ሽያጭ",
    om: "Fudhii deemuu",
    ti: "ንውጻኢ ዝወስድ",
  },

  mainNavigation: {
    en: "Main navigation",
    am: "ዋና ማሰሻ",
    om: "Qajeelcha ijoo",
    ti: "ቀንዲ ምርሓ",
  },

  roleADMIN: {
    en: "Admin",
    am: "አስተዳዳሪ",
    om: "Bulchaa",
    ti: "ኣስተዳዳሪ",
  },

  roleOWNER: {
    en: "Owner",
    am: "ባለቤት",
    om: "Abbaa qabeenyaa",
    ti: "ዋና በዓል",
  },

  roleMANAGER: {
    en: "Manager",
    am: "ማኔጀር",
    om: "Bulchaa hojii",
    ti: "ኣማሓዳሪ",
  },

  roleSERVER: {
    en: "Server",
    am: "ሰርቨር",
    om: "Tajaajilaa",
    ti: "ኣገልጋሊ",
  },

  roleCHEF: {
    en: "Chef",
    am: "ሼፍ",
    om: "Bilcheessaa",
    ti: "ሼፍ",
  },

  roleBARMAN: {
    en: "Barman",
    am: "ባርማን",
    om: "Nama baar",
    ti: "ባርማን",
  },

  /*
   * Legacy text mappings used by translateDocument().
   * These let existing hard-coded UI text continue to translate
   * while we gradually move pages to t("key").
   */
  "Overview": {
    en: "Overview",
    am: "አጠቃላይ እይታ",
    om: "Cuunfaa",
    ti: "ሓፈሻዊ ርእይቶ",
  },

  "Orders": {
    en: "Orders",
    am: "ትዕዛዞች",
    om: "Ajajawwan",
    ti: "ትእዛዛት",
  },

  "Tables": {
    en: "Tables",
    am: "ጠረጴዛዎች",
    om: "Minjaalota",
    ti: "ጠረጴዛታት",
  },

  "Menu": {
    en: "Menu",
    am: "ምናሌ",
    om: "Tarree nyaataa",
    ti: "ሜኑ",
  },

  "Staff": {
    en: "Staff",
    am: "ሰራተኞች",
    om: "Hojjettoota",
    ti: "ሰራሕተኛታት",
  },

  "Settings": {
    en: "Settings",
    am: "ቅንብሮች",
    om: "Qindaa'inoota",
    ti: "ቅንብራት",
  },

  "Search": {
    en: "Search",
    am: "ፈልግ",
    om: "Barbaadi",
    ti: "ድለ",
  },

  "Total": {
    en: "Total",
    am: "ጠቅላላ",
    om: "Ida'ama",
    ti: "ድምር",
  },

  "Subtotal": {
    en: "Subtotal",
    am: "ንዑስ ድምር",
    om: "Ida'ama xiqqaa",
    ti: "ንኡስ ድምር",
  },

  "Cancel": {
    en: "Cancel",
    am: "ሰርዝ",
    om: "Haqi",
    ti: "ሰርዝ",
  },

  "Save": {
    en: "Save",
    am: "አስቀምጥ",
    om: "Olkaa'i",
    ti: "ዕቅብ",
  },

  "Edit": {
    en: "Edit",
    am: "አርትዕ",
    om: "Gulaali",
    ti: "ኣርትዕ",
  },

  "Delete": {
    en: "Delete",
    am: "ሰርዝ",
    om: "Haqi",
    ti: "ሰርዝ",
  },

  "Add": {
    en: "Add",
    am: "ጨምር",
    om: "Dabali",
    ti: "ወስኽ",
  },

  "Available": {
    en: "Available",
    am: "ነጻ",
    om: "Jira",
    ti: "ዝርከብ",
  },

  "Occupied": {
    en: "Occupied",
    am: "ተይዟል",
    om: "Qabameera",
    ti: "ተወሲዱ",
  },

  "Reserved": {
    en: "Reserved",
    am: "ተይዟል",
    om: "Qabsiifameera",
    ti: "ተሓዚ",
  },

  "Cleaning": {
    en: "Cleaning",
    am: "በማጽዳት ላይ",
    om: "Qulqulleessaa jira",
    ti: "ይጸረይ ኣሎ",
  },

  "AVAILABLE": {
    en: "AVAILABLE",
    am: "ነጻ",
    om: "JIRA",
    ti: "ዝርከብ",
  },

  "OCCUPIED": {
    en: "OCCUPIED",
    am: "ተይዟል",
    om: "QABAMEERA",
    ti: "ተወሲዱ",
  },

  "RESERVED": {
    en: "RESERVED",
    am: "ተይዟል",
    om: "QABSIIFAMEERA",
    ti: "ተሓዚ",
  },

  "CLEANING": {
    en: "CLEANING",
    am: "በማጽዳት ላይ",
    om: "QULQULLEESSAA JIRA",
    ti: "ጸረይ ይግበር ኣሎ",
  },

  "Add to cart": {
    en: "Add to cart",
    am: "ወደ ጋሪ ጨምር",
    om: "Gara gaarii dabali",
    ti: "ናብ ጋሪ ወስኽ",
  },

  "Confirm order": {
    en: "Confirm order",
    am: "ትዕዛዙን አረጋግጥ",
    om: "Ajaja mirkaneessi",
    ti: "ትእዛዝ ኣረጋግጽ",
  },

  "Creating order...": {
    en: "Creating order...",
    am: "ትዕዛዙ በመፍጠር ላይ...",
    om: "Ajaja uumamaa jira...",
    ti: "ትእዛዝ ይፍጠር ኣሎ...",
  },

  "Cart is empty": {
    en: "Cart is empty",
    am: "ጋሪው ባዶ ነው",
    om: "Gaariin duwwaa dha",
    ti: "ጋሪ ባዶ እዩ",
  },

  "Dine-in": {
    en: "Dine-in",
    am: "በሬስቶራንቱ ውስጥ",
    om: "Mana nyaataa keessatti",
    ti: "ኣብ ምስራሕ ቤት ምግቢ",
  },

  "Takeaway": {
    en: "Takeaway",
    am: "የውጭ ሽያጭ",
    om: "Fudhii deemuu",
    ti: "ንውጻኢ ዝወስድ",
  },

  "Today": {
    en: "Today",
    am: "ዛሬ",
    om: "Har'a",
    ti: "ሎሚ",
  },

  "No orders yet.": {
    en: "No orders yet.",
    am: "እስካሁን ትዕዛዝ የለም።",
    om: "Ammas ajajni hin jiru.",
    ti: "ክሳብ ሕጂ ትእዛዝ የለን።",
  },

  "No kitchen orders.": {
    en: "No kitchen orders.",
    am: "የኩሽና ትዕዛዝ የለም።",
    om: "Ajaja kushiinaa hin jiru.",
    ti: "ትእዛዝ ናይ ኩሽና የለን።",
  },

  "No bar orders.": {
    en: "No bar orders.",
    am: "የባር ትዕዛዝ የለም።",
    om: "Ajaja baar hin jiru.",
    ti: "ትእዛዝ ናይ ባር የለን።",
  },

  "READY": {
    en: "READY",
    am: "ዝግጁ",
    om: "QOPHAA'AA",
    ti: "ድሉው",
  },

  "COMPLETED": {
    en: "COMPLETED",
    am: "ተጠናቋል",
    om: "Xumurame",
    ti: "ተዛዚሙ",
  },

  "ON DUTY": {
    en: "ON DUTY",
    am: "በስራ ላይ",
    om: "HOJII IRRA JIRA",
    ti: "ኣብ ስራሕ ኣሎ",
  },

  "OFF DUTY": {
    en: "OFF DUTY",
    am: "ከስራ ውጭ",
    om: "HOJII IRRA HIN JIRU",
    ti: "ካብ ስራሕ ወጻኢ",
  },
};

const LanguageContext = createContext(null);

function translateValue(value, language) {
  if (!value || typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  const entry = uiTranslations[trimmed];

  if (entry) {
    const translated = entry[language] || entry.en || trimmed;
    return value.replace(trimmed, translated);
  }

  for (const [source, translationsForSource] of Object.entries(
    uiTranslations
  )) {
    const translated = Object.values(translationsForSource).find(
      (candidate) => candidate === trimmed
    );

    if (translated) {
      return value.replace(
        trimmed,
        language === "en"
          ? translationsForSource.en || source
          : translationsForSource[language] ||
              translationsForSource.en ||
              source
      );
    }
  }

  return value;
}

function translateDocument(language) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.body;

  if (!root) {
    return;
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT
  );

  const nodes = [];
  let node = walker.nextNode();

  while (node) {
    if (
      node.parentElement &&
      !node.parentElement.closest("script, style")
    ) {
      nodes.push(node);
    }

    node = walker.nextNode();
  }

  nodes.forEach((textNode) => {
    textNode.nodeValue = translateValue(
      textNode.nodeValue,
      language
    );
  });

  root
    .querySelectorAll(
      "input, textarea, [aria-label], [title]"
    )
    .forEach((element) => {
      ["placeholder", "aria-label", "title"].forEach(
        (attribute) => {
          if (element.hasAttribute(attribute)) {
            element.setAttribute(
              attribute,
              translateValue(
                element.getAttribute(attribute),
                language
              )
            );
          }
        }
      );
    });
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");

 useEffect(() => {
  const savedLanguage =
    window.localStorage.getItem(STORAGE_KEY);

  if (
    savedLanguage &&
    LANGUAGES.some(
      (entry) => entry.code === savedLanguage
    )
  ) {
    const frame = window.requestAnimationFrame(() => {
      setLanguage(savedLanguage);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }
}, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      language
    );

    document.documentElement.lang = language;

    const frame = window.requestAnimationFrame(() => {
      translateDocument(language);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      languages: LANGUAGES,

      t(key) {
        return (
          translations[language]?.[key] ||
          uiTranslations[key]?.[language] ||
          translations.en?.[key] ||
          uiTranslations[key]?.en ||
          key
        );
      },
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider."
    );
  }

  return context;
}