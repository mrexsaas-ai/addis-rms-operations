"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "am", label: "Amharic", nativeLabel: "አማርኛ" },
  { code: "om", label: "Afaan Oromoo", nativeLabel: "Afaan Oromoo" },
  { code: "ti", label: "Tigrinya", nativeLabel: "ትግርኛ" },
];

const translations = {
  en: {
    language: "Language",
    chooseLanguage: "Choose your language",
    languageSaved: "Your preference is saved on this device.",
    close: "Close",
    openLanguage: "Open language selector",
    logOut: "Log out",
    signIn: "Sign in",
    signingIn: "Signing in...",
    welcomeBack: "Welcome back.",
    restaurantEmail: "Restaurant email",
    password: "Password",
    rememberMe: "Remember me",
    secureLogin: "SECURE LOGIN",
    authorizedStaff: "Authorized restaurant staff only.",
  },
  am: {
    language: "ቋንቋ",
    chooseLanguage: "ቋንቋዎን ይምረጡ",
    languageSaved: "ምርጫዎ በዚህ መሣሪያ ላይ ይቀመጣል።",
    close: "ዝጋ",
    openLanguage: "የቋንቋ መምረጫን ክፈት",
    logOut: "ውጣ",
    signIn: "ግባ",
    signingIn: "በመግባት ላይ...",
    welcomeBack: "እንኳን ደህና መጡ።",
    restaurantEmail: "የምግብ ቤት ኢሜይል",
    password: "የይለፍ ቃል",
    rememberMe: "አስታውሰኝ",
    secureLogin: "ደህንነቱ የተጠበቀ መግቢያ",
    authorizedStaff: "ለተፈቀደላቸው የምግብ ቤት ሰራተኞች ብቻ።",
  },
  om: {
    language: "Afaan",
    chooseLanguage: "Afaan kee filadhu",
    languageSaved: "Filannoon kee meeshaa kana irratti ni kuufama.",
    close: "Cufi",
    openLanguage: "Filannoo afaanii bani",
    logOut: "Ba'i",
    signIn: "Seeni",
    signingIn: "Seenaa jira...",
    welcomeBack: "Baga nagaan dhuftan.",
    restaurantEmail: "Imeelii mana nyaataa",
    password: "Jecha darbii",
    rememberMe: "Na yaadadhu",
    secureLogin: "SEENSA EEGUMSAA",
    authorizedStaff: "Hojjettoota mana nyaataa hayyamaman qofaaf.",
  },
  ti: {
    language: "ቋንቋ",
    chooseLanguage: "ቋንቋኻ ምረጽ",
    languageSaved: "ምርጫኻ ኣብዚ መሳርሒ ይዕቀብ።",
    close: "ዕጸው",
    openLanguage: "መምረጺ ቋንቋ ክፈት",
    logOut: "ውጻእ",
    signIn: "እቶ",
    signingIn: "ይኣቱ ኣሎ...",
    welcomeBack: "እንቋዕ ብደሓን መጻእኩም።",
    restaurantEmail: "ኢመይል ቤት ምግቢ",
    password: "መሕለፊ ቃል",
    rememberMe: "ዘክረኒ",
    secureLogin: "ውሑስ መእተዊ",
    authorizedStaff: "ንዝተፈቕደሎም ሰራሕተኛታት ቤት ምግቢ ጥራይ።",
  },
};

const uiTranslations = {
  "Overview": { am: "አጠቃላይ እይታ", om: "Cuunfaa", ti: "ሓፈሻዊ ርእይቶ" },
  "Tables": { am: "ጠረጴዛዎች", om: "Gabatee", ti: "ጠረጴዛታት" },
  "Menu": { am: "ምናሌ", om: "Tarree nyaataa", ti: "ሜኑ" },
  "Staff": { am: "ሰራተኞች", om: "Hojjettoota", ti: "ሰራሕተኛታት" },
  "Server": { am: "አስተናጋጅ", om: "Tajaajilaa", ti: "ሰርቨር" },
  "Kitchen": { am: "ወጥ ቤት", om: "Mana nyaataa", ti: "ማእድ ቤት" },
  "Bar": { am: "ባር", om: "Baar", ti: "ባር" },
  "Settings": { am: "ቅንብሮች", om: "Qindaa'ina", ti: "ቅንብር" },
  "Orders": { am: "ትዕዛዞች", om: "Ajajawwan", ti: "ትእዛዛት" },
  "Inventory": { am: "ዕቃ አስተዳደር", om: "Kuusaa", ti: "እቃ ኣስተዳደር" },
  "Restaurant operations": { am: "የምግብ ቤት ሥራዎች", om: "Hojii mana nyaataa", ti: "ስራሕ ቤት ምግቢ" },
  "Dashboard": { am: "ዳሽቦርድ", om: "Daashboordii", ti: "ዳሽቦርድ" },
  "Management": { am: "አስተዳደር", om: "Bulchiinsa", ti: "ምሕደራ" },
  "Restaurant": { am: "ምግብ ቤት", om: "Mana nyaataa", ti: "ቤት ምግቢ" },
  "Table management": { am: "የጠረጴዛ አስተዳደር", om: "Bulchiinsa gabatee", ti: "ምሕደራ ጠረጴዛ" },
  "Menu management": { am: "የምናሌ አስተዳደር", om: "Bulchiinsa tarree nyaataa", ti: "ምሕደራ ሜኑ" },
  "Staff management": { am: "የሰራተኞች አስተዳደር", om: "Bulchiinsa hojjettootaa", ti: "ምሕደራ ሰራሕተኛታት" },
  "SERVER WORKSPACE": { am: "የአስተናጋጅ የሥራ ቦታ", om: "IDDOO HOJII TAJAAJILAA", ti: "ቦታ ስራሕ ሰርቨር" },
  "KITCHEN WORKSPACE": { am: "የወጥ ቤት የሥራ ቦታ", om: "IDDOO HOJII MANA NYAATAA", ti: "ቦታ ስራሕ ማእድ ቤት" },
  "BAR WORKSPACE": { am: "የባር የሥራ ቦታ", om: "IDDOO HOJII BAAR", ti: "ቦታ ስራሕ ባር" },
  "Kitchen orders": { am: "የወጥ ቤት ትዕዛዞች", om: "Ajajawwan mana nyaataa", ti: "ትእዛዛት ማእድ ቤት" },
  "Bar orders": { am: "የባር ትዕዛዞች", om: "Ajajawwan baar", ti: "ትእዛዛት ባር" },
  "Inventory dashboard": { am: "የዕቃ አስተዳደር ዳሽቦርድ", om: "Daashboordii kuusaa", ti: "ዳሽቦርድ እቃ" },
  "New order": { am: "አዲስ ትዕዛዝ", om: "Ajaja haaraa", ti: "ሓድሽ ትእዛዝ" },
  "Current orders": { am: "የአሁኑ ትዕዛዞች", om: "Ajajawwan ammaa", ti: "ናይ ሕጂ ትእዛዛት" },
  "Total": { am: "ጠቅላላ", om: "Waliigala", ti: "ጠቕላላ" },
  "Subtotal": { am: "ንዑስ ድምር", om: "Waliigala xiqqaa", ti: "ንኡስ ድምር" },
  "Save changes": { am: "ለውጦችን አስቀምጥ", om: "Jijjiirama olkaa'i", ti: "ለውጥታት ዓቅብ" },
  "Cancel": { am: "ሰርዝ", om: "Haqi", ti: "ሰርዝ" },
  "Edit": { am: "አርትዕ", om: "Gulaali", ti: "ኣርም" },
  "Delete": { am: "ሰርዝ", om: "Haqi", ti: "ደምስስ" },
  "Add": { am: "ጨምር", om: "Dabali", ti: "ወስኽ" },
  "Create": { am: "ፍጠር", om: "Uumi", ti: "ፍጠር" },
  "Settings are restricted.": { am: "ቅንብሮች የተገደቡ ናቸው።", om: "Qindaa'inni daangeffameera.", ti: "ቅንብራት ዝተደረቡ እዮም።" },
  "Your account does not have Admin or Owner access to this area.": { am: "መለያዎ የአስተዳዳሪ ወይም የባለቤት መዳረሻ የለውም።", om: "Akkaawuntiin kee seensa Admin ykn Abbaa qabeenyaa hin qabu.", ti: "ሒሳብካ ናይ ኣስተዳዳሪ ወይ ዋና መዳረሻ የብሉን።" },
  "Restaurant settings": { am: "የምግብ ቤት ቅንብሮች", om: "Qindaa'ina mana nyaataa", ti: "ቅንብራት ቤት ምግቢ" },
  "Restaurant information": { am: "የምግብ ቤት መረጃ", om: "Odeeffannoo mana nyaataa", ti: "ሓበሬታ ቤት ምግቢ" },
  "Payment methods": { am: "የክፍያ ዘዴዎች", om: "Malawwan kaffaltii", ti: "ኣገባብ ክፍሊት" },
  "Bank accounts": { am: "የባንክ ሂሳቦች", om: "Herrega baankii", ti: "ሕሳባት ባንኪ" },
  "Active": { am: "ንቁ", om: "Hojii irra", ti: "ንጡፍ" },
  "Inactive": { am: "ንቁ ያልሆነ", om: "Hojii irra hin jirre", ti: "ንጡፍ ዘይኮነ" },
  "Live profile": { am: "ቀጥታ መገለጫ", om: "Ibsa jiraataa", ti: "ቀጥታ መግለጺ" },
  "Staff unavailable": { am: "ሰራተኞች አልተገኙም", om: "Hojjettoonni hin jiran", ti: "ሰራሕተኛታት ኣይርከቡን" },
  "Could not load staff data.": { am: "የሰራተኞች መረጃ መጫን አልተቻለም።", om: "Odeeffannoo hojjettootaa fe'uu hin dandeenye.", ti: "ሓበሬታ ሰራሕተኛታት ክጽዓን ኣይከኣለን።" },
  "Search menu items": { am: "ምናሌ ይፈልጉ", om: "Wantoota tarree nyaataa barbaadi", ti: "ኣቕሑ ሜኑ ድለ" },
  "All items": { am: "ሁሉም ዕቃዎች", om: "Wantoota hunda", ti: "ኩሎም ኣቕሑ" },
  "Select an item": { am: "ዕቃ ይምረጡ", om: "Wanta filadhu", ti: "ኣቕሓ ምረጽ" },
  "Select a table": { am: "ጠረጴዛ ይምረጡ", om: "Gabatee filadhu", ti: "ጠረጴዛ ምረጽ" },
  "RUN SMARTER. GROW FASTER.": { am: "በብልሃት ይሩጡ። በፍጥነት ያድጉ።", om: "Akiyaan fi saffisaan guddadhu.", ti: "ብብልሓት ስራሕ። ብቕልጡፍ ዓቢ።" },
  "Access not granted.": { am: "መዳረሻ አልተፈቀደም።", om: "Seensaan hin hayyamamne.", ti: "መእተዊ ኣይተፈቕደን።" },
  "Return to dashboard": { am: "ወደ ዳሽቦርድ ተመለስ", om: "Gara daashboordii deebi'i", ti: "ናብ ዳሽቦርድ ተመለስ" },
  "Available": { am: "ክፍት", om: "Qophaa'aa", ti: "ዝርከብ" },
  "Occupied": { am: "ተይዟል", om: "Kan qabame", ti: "ተታሒዙ" },
  "Reserved": { am: "ተይዟል", om: "Qabameera", ti: "ተሓዚ" },
  "Cleaning": { am: "በጽዳት ላይ", om: "Qulqulleessaa jira", ti: "ይጽረይ ኣሎ" },
  "AVAILABLE": { am: "ክፍት", om: "QOPHAA'AA", ti: "ዝርከብ" },
  "OCCUPIED": { am: "ተይዟል", om: "KAN QABAME", ti: "ተታሒዙ" },
  "RESERVED": { am: "ተይዟል", om: "QABAMEERA", ti: "ተሓዚ" },
  "CLEANING": { am: "በጽዳት ላይ", om: "QULQULLEESSAA JIRA", ti: "ይጽረይ ኣሎ" },
  "No orders yet.": { am: "እስካሁን ትዕዛዝ የለም።", om: "Hanga ammaatti ajajni hin jiru.", ti: "ክሳብ ሕጂ ትእዛዝ የለን።" },
  "No kitchen orders.": { am: "የወጥ ቤት ትዕዛዝ የለም።", om: "Ajajni mana nyaataa hin jiru.", ti: "ትእዛዝ ማእድ ቤት የለን።" },
  "No bar orders.": { am: "የባር ትዕዛዝ የለም።", om: "Ajajni baar hin jiru.", ti: "ትእዛዝ ባር የለን።" },
  "Today": { am: "ዛሬ", om: "Har'a", ti: "ሎሚ" },
  "Search": { am: "ፈልግ", om: "Barbaadi", ti: "ድለ" },
  "Add to cart": { am: "ወደ ጋሪ ጨምር", om: "Gara gaarii dabali", ti: "ናብ ጋሪ ወስኽ" },
  "Checkout": { am: "ክፍያ", om: "Kaffaltii", ti: "ክፍሊት" },
  "Confirm order": { am: "ትዕዛዝ አረጋግጥ", om: "Ajaja mirkaneessi", ti: "ትእዛዝ ኣረጋግጽ" },
  "Creating order...": { am: "ትዕዛዝ በመፍጠር ላይ...", om: "Ajaja uumaa jira...", ti: "ትእዛዝ ይፍጠር ኣሎ..." },
  "Cart is empty. Add menu items to begin.": { am: "ጋሪው ባዶ ነው። ለመጀመር ምናሌ ይጨምሩ።", om: "Gaariin duwwaa dha. Jalqabuuf wantoota dabali.", ti: "ጋሪ ባዶ እዩ። ንምጅማር ኣቕሑ ወስኽ።" },
  "Dine-in": { am: "በምግብ ቤት", om: "Mana nyaataa keessatti", ti: "ኣብ ቤት ምግቢ" },
  "Takeaway": { am: "ይዞ መሄጃ", om: "Fudhatee deemu", ti: "ተሰኪምካ ምኻድ" },
  "Delivery": { am: "ማድረስ", om: "Geejjibsiisa", ti: "ምብጻሕ" },
  "NEW": { am: "አዲስ", om: "HAARAA", ti: "ሓድሽ" },
  "PREPARING": { am: "በዝግጅት ላይ", om: "Qopheessaa jira", ti: "ይዳሎ ኣሎ" },
  "READY": { am: "ዝግጁ", om: "Qophaa'eera", ti: "ድሉው" },
  "COMPLETED": { am: "ተጠናቋል", om: "Xumurameera", ti: "ተወዲኡ" },
  "ON DUTY": { am: "በሥራ ላይ", om: "Hojii irra", ti: "ኣብ ስራሕ" },
  "OFF DUTY": { am: "ከሥራ ውጭ", om: "Hojii irraa ala", ti: "ካብ ስራሕ ወጻኢ" },
};

const LanguageContext = createContext(null);
const STORAGE_KEY = "addis-rms-language";

function translateValue(value, language) {
  const trimmed = value.trim();
  const entry = uiTranslations[trimmed];
  if (entry) {
    const translated = entry[language] || trimmed;
    return value.replace(trimmed, translated);
  }

  for (const [source, translationsForSource] of Object.entries(uiTranslations)) {
    const translated = Object.values(translationsForSource).find((candidate) => candidate === trimmed);
    if (translated) {
      return value.replace(trimmed, language === "en" ? source : translationsForSource[language] || source);
    }
  }

  return value;
}

function translateDocument(language) {
  const root = document.body;
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    if (node.parentElement && !node.parentElement.closest("script, style")) nodes.push(node);
    node = walker.nextNode();
  }
  nodes.forEach((textNode) => {
    textNode.nodeValue = translateValue(textNode.nodeValue, language);
  });
  root.querySelectorAll("input, textarea, [aria-label], [title]").forEach((element) => {
    ["placeholder", "aria-label", "title"].forEach((attribute) => {
      if (element.hasAttribute(attribute)) {
        element.setAttribute(attribute, translateValue(element.getAttribute(attribute), language));
      }
    });
  });
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    if (!translations[savedLanguage]) return;
    const frame = window.requestAnimationFrame(() => setLanguage(savedLanguage));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    const frame = window.requestAnimationFrame(() => translateDocument(language));
    const observer = new MutationObserver(() => translateDocument(language));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    languages: LANGUAGES,
    t(key) {
      return translations[language]?.[key] || translations.en[key] || key;
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }
  return context;
}
