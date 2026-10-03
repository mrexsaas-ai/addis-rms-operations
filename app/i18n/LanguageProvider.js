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
    loggingOut: "Logging out...",
    logoutError: "Could not log out. Please try again.",
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
    loggingOut: "በመውጣት ላይ...",
    logoutError: "መውጣት አልተቻለም። እንደገና ይሞክሩ።",
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
    loggingOut: "Ba'aa jira...",
    logoutError: "Ba'uun hin danda'amne. Maaloo irra deebi'ii yaali.",
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
    loggingOut: "ይወጽእ ኣሎ...",
    logoutError: "ምውጻእ ኣይተኻእለን። በጃኻ እንደገና ፈትን።",
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
  platformAreaLabel: { en: "PLATFORM ADMINISTRATION", am: "የመድረክ አስተዳደር", om: "BULCHIINSA WALTAA", ti: "ምሕደራ መድረኽ" },
  platformTitle: { en: "Restaurant management", am: "የምግብ ቤቶች አስተዳደር", om: "Bulchiinsa mana nyaataa", ti: "ምሕደራ ሬስቶራንታት" },
  platformDescription: { en: "Review restaurant lifecycle status and manage platform access.", am: "የምግብ ቤቶችን ሁኔታ ይመልከቱ እና የመድረክ መዳረሻን ያስተዳድሩ።", om: "Haala mana nyaataa ilaalaa; seensa waltichaa bulchaa.", ti: "ኩነታት ሬስቶራንታት ርኣዩ እሞ መእተዊ መድረኽ ኣመሓድሩ።" },
  platformSummary: { en: "Restaurant status summary", am: "የምግብ ቤት ሁኔታ ማጠቃለያ", om: "Cuunfaa haala mana nyaataa", ti: "ጽማቕ ኩነታት ሬስቶራንት" },
  platformTotalRestaurants: { en: "Total restaurants", am: "ጠቅላላ የምግብ ቤቶች", om: "Ida'ama mana nyaataa", ti: "ጠቕላላ ሬስቶራንታት" },
  platformActiveRestaurants: { en: "Active", am: "ንቁ", om: "Hojii irra", ti: "ንጡፍ" },
  platformInactiveRestaurants: { en: "Inactive", am: "ንቁ ያልሆኑ", om: "Hojii irra hin jirre", ti: "ንጡፍ ዘይኮኑ" },
  platformSearch: { en: "Search restaurants", am: "የምግብ ቤቶችን ይፈልጉ", om: "Mana nyaataa barbaadi", ti: "ሬስቶራንታት ድለዩ" },
  platformSearchPlaceholder: { en: "Search name, business, or owner email", am: "በስም፣ በንግድ ወይም በባለቤት ኢሜይል ይፈልጉ", om: "Maqaa, daldala ykn imeelii abbaa barbaadi", ti: "ብስም፣ ንግዲ ወይ ኢመይል ወናኒ ድለዩ" },
  platformFilterRestaurants: { en: "Filter restaurants", am: "የምግብ ቤቶችን አጣራ", om: "Mana nyaataa calali", ti: "ሬስቶራንታት ምጽራይ" },
  platformFilterAll: { en: "All", am: "ሁሉም", om: "Hunda", ti: "ኩሎም" },
  platformFilterActive: { en: "Active", am: "ንቁ", om: "Hojii irra", ti: "ንጡፍ" },
  platformFilterInactive: { en: "Inactive", am: "ንቁ ያልሆኑ", om: "Hojii irra hin jirre", ti: "ንጡፍ ዘይኮኑ" },
  platformNoMatches: { en: "No restaurants match this search.", am: "ከዚህ ፍለጋ ጋር የሚዛመድ የምግብ ቤት የለም።", om: "Mana nyaataan barbaacha kanaan walsimu hin jiru.", ti: "ምስዚ ድለይቲ ዝሰማማዕ ሬስቶራንት የለን።" },
  platformNoRestaurants: { en: "No restaurants are available.", am: "ምንም የምግብ ቤት አልተገኘም።", om: "Mana nyaataan hin jiru.", ti: "ሬስቶራንት ኣይተረኽበን።" },
  platformRestaurantDetails: { en: "Restaurant details", am: "የምግብ ቤት ዝርዝሮች", om: "Bal'ina mana nyaataa", ti: "ዝርዝር ሬስቶራንት" },
  platformBusinessName: { en: "Business name", am: "የንግድ ስም", om: "Maqaa daldalaa", ti: "ስም ንግዲ" },
  platformOwnerEmail: { en: "Owner email", am: "የባለቤት ኢሜይል", om: "Imeelii abbaa qabeenyaa", ti: "ኢመይል ወናኒ" },
  platformCreated: { en: "Created", am: "የተፈጠረበት ቀን", om: "Guyyaa uumame", ti: "ዝተፈጥረሉ ዕለት" },
  platformStatus: { en: "Status", am: "ሁኔታ", om: "Haala", ti: "ኩነታት" },
  platformStatusActive: { en: "Active", am: "ንቁ", om: "Hojii irra", ti: "ንጡፍ" },
  platformStatusInactive: { en: "Inactive", am: "ንቁ ያልሆነ", om: "Hojii irra hin jiru", ti: "ንጡፍ ዘይኮነ" },
  platformSelectRestaurant: { en: "Select a restaurant to view details.", am: "ዝርዝሮችን ለማየት የምግብ ቤት ይምረጡ።", om: "Bal'ina ilaaluuf mana nyaataa filadhu.", ti: "ዝርዝር ንምርኣይ ሬስቶራንት ምረጹ።" },
  platformDeactivate: { en: "Deactivate restaurant", am: "የምግብ ቤቱን ያቦዝኑ", om: "Mana nyaataa hojii dhaabsiisi", ti: "ሬስቶራንት ኣቋርጹ" },
  platformActivate: { en: "Activate restaurant", am: "የምግብ ቤቱን ያንቁ", om: "Mana nyaataa hojii jalqabiisi", ti: "ሬስቶራንት ኣንቅሑ" },
  platformConfirmDeactivateTitle: { en: "Deactivate this restaurant?", am: "ይህን የምግብ ቤት ማቦዘን ይፈልጋሉ?", om: "Mana nyaataa kana hojii dhaabsiisuu barbaadduu?", ti: "ነዚ ሬስቶራንት ከተቋርጽዎ?" },
  platformConfirmActivateTitle: { en: "Activate this restaurant?", am: "ይህን የምግብ ቤት ማንቃት ይፈልጋሉ?", om: "Mana nyaataa kana hojii jalqabsiisuu barbaadduu?", ti: "ነዚ ሬስቶራንት ከተንቅሕዎ?" },
  platformConfirmDeactivateBody: { en: "Deactivate {restaurant}? Its owner and staff will lose operational access until it is activated again.", am: "{restaurant} ይቦዝን? እስኪነቃ ድረስ ባለቤቱና ሰራተኞቹ የስራ መዳረሻ ያጣሉ።", om: "{restaurant} hojii dhaabsiisaa? Hanga deebi'ee hojii jalqabutti abbaan isaa fi hojjettoonni seensa hojii ni dhabu.", ti: "{restaurant} ይቋረጽ? ዳግም ክሳብ ዝንቀሳቐስ ወናኒኡን ሰራሕተኛታቱን መእተዊ ስራሕ ክስእኑ እዮም።" },
  platformConfirmActivateBody: { en: "Activate {restaurant}? Its owner and staff will regain operational access.", am: "{restaurant} ይነቃ? ባለቤቱና ሰራተኞቹ የስራ መዳረሻቸውን ያገኛሉ።", om: "{restaurant} hojii jalqabsiisaa? Abbaan isaa fi hojjettoonni seensa hojii ni argatu.", ti: "{restaurant} ይንቀሳቐስ? ወናኒኡን ሰራሕተኛታቱን መእተዊ ስራሕ ክረኽቡ እዮም።" },
  platformCancel: { en: "Cancel", am: "ሰርዝ", om: "Dhiisi", ti: "ሰርዝ" },
  platformConfirm: { en: "Confirm", am: "አረጋግጥ", om: "Mirkaneessi", ti: "ኣረጋግጽ" },
  platformSaving: { en: "Saving...", am: "በማስቀመጥ ላይ...", om: "Kuusaa jira...", ti: "ይዕቀብ ኣሎ..." },
  platformRestaurantActivated: { en: "Restaurant activated.", am: "የምግብ ቤቱ ነቅቷል።", om: "Manni nyaataa hojii jalqabeera.", ti: "ሬስቶራንት ተንቂሱ።" },
  platformRestaurantDeactivated: { en: "Restaurant deactivated.", am: "የምግብ ቤቱ ቦዝኗል።", om: "Manni nyaataa hojii dhaabeera.", ti: "ሬስቶራንት ተቋሪጹ።" },
  platformStatusUnchanged: { en: "Restaurant already has that status.", am: "የምግብ ቤቱ ሁኔታ አልተቀየረም።", om: "Haalli mana nyaataa duraan kana ture.", ti: "ኩነታት ሬስቶራንት ድሮ ከምዚ እዩ።" },
  platformStatusChangeFailed: { en: "Restaurant status could not be changed.", am: "የምግብ ቤቱን ሁኔታ መቀየር አልተቻለም።", om: "Haala mana nyaataa jijjiiruun hin danda'amne.", ti: "ኩነታት ሬስቶራንት ምቕያር ኣይተኻእለን።" },
  platformStatusHistory: { en: "Status history", am: "የሁኔታ ታሪክ", om: "Seenaa haalaa", ti: "ታሪኽ ኩነታት" },
  platformLoadHistory: { en: "Load history", am: "ታሪክን ጫን", om: "Seenaa fe'i", ti: "ታሪኽ ጽዓን" },
  platformNoStatusEvents: { en: "No lifecycle changes recorded.", am: "ምንም የሁኔታ ለውጥ አልተመዘገበም።", om: "Jijjiiramni haalaa hin galmoofne.", ti: "ለውጢ ኩነታት ኣይተመዝገበን።" },
  platformHistoryLoadFailed: { en: "Status history could not be loaded.", am: "የሁኔታ ታሪክ ሊጫን አልቻለም።", om: "Seenaa haalaa fe'uun hin danda'amne.", ti: "ታሪኽ ኩነታት ክጽዓን ኣይከኣለን።" },
  platformActorId: { en: "Administrator ID", am: "የአስተዳዳሪ መለያ", om: "ID bulchaa", ti: "መለለዪ ኣስተዳዳሪ" },
  adminAreaLabel: { en: "ADMIN AREA", am: "የአስተዳዳሪ ክፍል", om: "KUTAA BULCHIINSAA", ti: "ክፍሊ ኣስተዳደር" },
  adminAccessExplanation: { en: "Admin and Owner settings are protected by the server-side role check and the restaurant membership RLS policies. Foundation settings will be added in later workflow steps.", am: "የአስተዳዳሪ እና የባለቤት ቅንብሮች በሰርቨር ሚና ማረጋገጫ እና በምግብ ቤት አባልነት RLS ፖሊሲዎች ይጠበቃሉ። የመሠረታዊ ቅንብሮች በሚቀጥሉት የስራ ደረጃዎች ይጨመራሉ።", om: "Qindaa'inni Admin fi Abbaa qabeenyaa mirkaneessa gahee gama sarvarii fi imaammata RLS miseensummaa mana nyaataatiin eegama. Qindaa'inni bu'uuraa tarkaanfii hojii itti aanutti dabalama.", ti: "ቅንብራት Adminን Ownerን ብመርመራ ግደ ሰርቨርን ብፖሊሲታት RLS ኣባልነት ሬስቶራንትን ይሕለዉ። መሰረታዊ ቅንብራት ኣብ ዝቕጽሉ ደረጃታት ስራሕ ክውሰኹ እዮም።" },
  settingsAdminArea: { en: "Admin area", am: "የአስተዳዳሪ ክፍል", om: "Kutaa bulchiinsaa", ti: "ክፍሊ ኣስተዳደር" },
  settingsControlCenter: { en: "CONTROL CENTER / SETTINGS", am: "የቁጥጥር ማዕከል / ቅንብሮች", om: "WIIRTUU TO'ANNAA / QINDAA'INOOTA", ti: "ማእከል ቁጽጽር / ቅንብራት" },
  settingsPageTitle: { en: "Restaurant settings", am: "የምግብ ቤት ቅንብሮች", om: "Qindaa'inoota mana nyaataa", ti: "ቅንብራት ሬስቶራንት" },
  settingsPageDescription: { en: "Manage the restaurant identity and manual payment methods used by your team.", am: "የምግብ ቤቱን መለያ እና ቡድንዎ የሚጠቀምባቸውን የእጅ ክፍያ ዘዴዎች ያስተዳድሩ።", om: "Eenummaa mana nyaataa fi maloota kaffaltii harkaan gareen keessan fayyadamu bulchi.", ti: "መንነት ሬስቶራንትን ብጉጅለኹም ዝጥቀመሎም ናይ ኢድ ክፍሊት መንገድታትን ኣመሓድሩ።" },
  settingsAdminAccess: { en: "Admin access", am: "የአስተዳዳሪ መዳረሻ", om: "Seensa bulchaa", ti: "መእተዊ ኣስተዳዳሪ" },
  settingsProfileSection: { en: "01 / Profile", am: "01 / መገለጫ", om: "01 / Eenyummaa", ti: "01 / መገለጺ" },
  settingsRestaurantInformation: { en: "Restaurant information", am: "የምግብ ቤት መረጃ", om: "Odeeffannoo mana nyaataa", ti: "ሓበሬታ ሬስቶራንት" },
  settingsLiveProfile: { en: "Live profile", am: "ወቅታዊ መገለጫ", om: "Eenyummaa yeroo ammaa", ti: "ቀጥታ መገለጺ" },
  settingsPhoneNumber: { en: "Phone Number", am: "ስልክ ቁጥር", om: "Lakkoofsa bilbilaa", ti: "ቁጽሪ ተሌፎን" },
  settingsCheckoutSection: { en: "02 / Checkout", am: "02 / ክፍያ", om: "02 / Kaffaltii", ti: "02 / ክፍሊት" },
  settingsPaymentMethods: { en: "Payment methods", am: "የክፍያ ዘዴዎች", om: "Maloota kaffaltii", ti: "ኣገባባት ክፍሊት" },
  settingsManualPaymentFlow: { en: "Manual payment flow", am: "በእጅ የክፍያ ሂደት", om: "Adeemsa kaffaltii harkaa", ti: "ናይ ኢድ ሂደት ክፍሊት" },
  settingsPaymentMethodsDescription: { en: "Choose which payment methods your team can record. Payment verification remains manual.", am: "ቡድንዎ መመዝገብ የሚችላቸውን የክፍያ ዘዴዎች ይምረጡ። የክፍያ ማረጋገጫ በእጅ ይቀጥላል።", om: "Maloota kaffaltii gareen keessan galmeessuu danda'u filadhaa. Mirkaneessi kaffaltii harkaan itti fufa.", ti: "ጉጅለኹም ክምዝግቦም ዝኽእል ኣገባባት ክፍሊት ምረጹ። ምርግጋጽ ክፍሊት ብኢድ ይቕጽል።" },
  settingsCashDescription: { en: "Record cash collected at the counter.", am: "በቆጣሪው የተሰበሰበ ጥሬ ገንዘብ ይመዝግቡ።", om: "Maallaqa kaawuntara irratti walitti qabame galmeessi.", ti: "ኣብ ካውንተር ዝተኣከበ ጥረ ገንዘብ መዝግቡ።" },
  settingsTelebirrDescription: { en: "Record manual Telebirr payments.", am: "በእጅ የተፈጸሙ የTelebirr ክፍያዎችን ይመዝግቡ።", om: "Kaffaltii Telebirr harkaan raawwatame galmeessi.", ti: "ብኢድ ዝተፈጸመ ክፍሊት Telebirr መዝግቡ።" },
  settingsCbeDescription: { en: "Record manual CBE payments.", am: "በእጅ የተፈጸሙ የCBE ክፍያዎችን ይመዝግቡ።", om: "Kaffaltii CBE harkaan raawwatame galmeessi.", ti: "ብኢድ ዝተፈጸመ ክፍሊት CBE መዝግቡ።" },
  settingsOtherBanks: { en: "Other Banks", am: "ሌሎች ባንኮች", om: "Baankota biroo", ti: "ካልኦት ባንክታት" },
  settingsOtherBanksDescription: { en: "Record manual bank payments.", am: "በእጅ የተፈጸሙ የባንክ ክፍያዎችን ይመዝግቡ።", om: "Kaffaltii baankii harkaan raawwatame galmeessi.", ti: "ብኢድ ዝተፈጸመ ክፍሊት ባንኪ መዝግቡ።" },
  settingsAccountsSection: { en: "03 / Accounts", am: "03 / ሂሳቦች", om: "03 / Herrega", ti: "03 / ሕሳባት" },
  settingsAccountConfiguration: { en: "Payment account configuration", am: "የክፍያ ሂሳብ ውቅር", om: "Qindaa'ina herrega kaffaltii", ti: "ምድላው ሕሳብ ክፍሊት" },
  settingsConfiguredCount: { en: "{count} configured", am: "{count} ተዋቅረዋል", om: "{count} qophaa'aniiru", ti: "{count} ተዳልዮም" },
  settingsAccountDescription: { en: "Store the account numbers shown to staff for manual payment collection.", am: "ለእጅ ክፍያ ሰብሳቢነት ለሰራተኞች የሚታዩ የሂሳብ ቁጥሮችን ያስቀምጡ።", om: "Lakkoofsota herregaa kaffaltii harkaa walitti qabuuf hojjettootatti agarsiifaman kuusi.", ti: "ንኣእዳዊ ምእካብ ክፍሊት ንሰራሕተኛታት ዝርአ ቁጽሪ ሕሳብ ኣቐምጡ።" },
  settingsCbeNumber: { en: "CBE Number", am: "የCBE ቁጥር", om: "Lakkoofsa CBE", ti: "ቁጽሪ CBE" },
  settingsBankNumber: { en: "Bank Number", am: "የባንክ ቁጥር", om: "Lakkoofsa baankii", ti: "ቁጽሪ ባንኪ" },
  settingsSaved: { en: "Saved", am: "ተቀምጧል", om: "Kuufameera", ti: "ተቐሚጡ" },
  settingsAccountHolderName: { en: "Account holder name", am: "የሂሳብ ባለቤት ስም", om: "Maqaa abbaa herregaa", ti: "ስም ወናኒ ሕሳብ" },
  settingsSaving: { en: "Saving...", am: "በማስቀመጥ ላይ...", om: "Kuusaa jira...", ti: "ይዕቀብ ኣሎ..." },
  settingsRemoveAccount: { en: "Remove {account}", am: "{account} አስወግድ", om: "{account} haqi", ti: "{account} ኣርሕቕ" },
  settingsNoAccountConfigured: { en: "No account configured", am: "ምንም ሂሳብ አልተዋቀረም", om: "Herregni hin qophoofne", ti: "ሕሳብ ኣይተዳለወን" },
  settingsChangesLocal: { en: "Changes apply to this restaurant only.", am: "ለውጦቹ በዚህ ምግብ ቤት ላይ ብቻ ይተገበራሉ።", om: "Jijjiiramoonni kun mana nyaataa kana qofa irratti hojiirra oolu.", ti: "እዞም ለውጥታት ኣብዚ ሬስቶራንት ጥራይ ይትግበሩ።" },
  settingsSavingChanges: { en: "Saving changes...", am: "ለውጦችን በማስቀመጥ ላይ...", om: "Jijjiirama kuusaa jira...", ti: "ለውጥታት ይዕቀብ ኣሎ..." },
  settingsSaveChanges: { en: "Save changes", am: "ለውጦችን አስቀምጥ", om: "Jijjiirama kuusi", ti: "ለውጥታት ዓቅብ" },
  settingsAccessControl: { en: "ACCESS CONTROL", am: "የመዳረሻ ቁጥጥር", om: "TO'ANNAA SEENSAA", ti: "ቁጽጽር መእተዊ" },
  settingsRestricted: { en: "Settings are restricted.", am: "የቅንብሮች መዳረሻ ተገድቧል።", om: "Qindaa'inni daangeffameera.", ti: "ቅንብራት ተገዲቡ እዮም።" },
  settingsAdminOwnerRequired: { en: "Your account does not have Admin or Owner access to this area.", am: "መለያዎ ወደዚህ ክፍል የአስተዳዳሪ ወይም የባለቤት መዳረሻ የለውም።", om: "Herregni keessanii kutaa kanaaf seensa Admin ykn Abbaa qabeenyaa hin qabu.", ti: "ሕሳብኩም ናብዚ ክፍሊ መእተዊ Admin ወይ Owner የብሉን።" },
  settingsReturnDashboard: { en: "Return to dashboard", am: "ወደ ዳሽቦርድ ተመለስ", om: "Gara dashboard deebi'i", ti: "ናብ dashboard ተመለስ" },
  settingsSavedSuccess: { en: "Settings saved successfully.", am: "ቅንብሮች በተሳካ ሁኔታ ተቀምጠዋል።", om: "Qindaa'inni milkaa'inaan kuufameera.", ti: "ቅንብራት ብዓወት ተቐሚጦም።" },
  settingsAccountUpdated: { en: "Bank account updated.", am: "የባንክ ሂሳብ ተዘምኗል።", om: "Herregni baankii haaromfameera.", ti: "ሕሳብ ባንኪ ተሓዲሱ።" },
  settingsAccountAdded: { en: "Bank account added.", am: "የባንክ ሂሳብ ተጨምሯል።", om: "Herregni baankii dabalameera.", ti: "ሕሳብ ባንኪ ተወሲኹ።" },
  settingsAccountDeleted: { en: "Bank account deleted.", am: "የባንክ ሂሳብ ተሰርዟል።", om: "Herregni baankii haqameera.", ti: "ሕሳብ ባንኪ ተደምሲሱ።" },
  settingsSignInRequired: { en: "You must be signed in.", am: "መጀመሪያ መግባት አለብዎት።", om: "Dura seenuu qabdu.", ti: "ቅድሚ ኩሉ ክትኣትዉ ኣለኩም።" },
  settingsPermissionDenied: { en: "You do not have permission to manage settings.", am: "ቅንብሮችን ለማስተዳደር ፈቃድ የለዎትም።", om: "Qindaa'inoota bulchuuf hayyama hin qabdu.", ti: "ቅንብራት ንምምሕዳር ፍቓድ የብልኩምን።" },
  settingsRestaurantNameRequired: { en: "Restaurant name is required.", am: "የምግብ ቤት ስም ያስፈልጋል።", om: "Maqaan mana nyaataa barbaachisaa dha.", ti: "ስም ሬስቶራንት የድሊ እዩ።" },
  settingsRestaurantNameTooLong: { en: "Restaurant name is too long.", am: "የምግብ ቤት ስም ከመጠን በላይ ረጅም ነው።", om: "Maqaan mana nyaataa baay'ee dheeraa dha.", ti: "ስም ሬስቶራንት ኣዝዩ ነዊሕ እዩ።" },
  settingsFieldTooLong: { en: "One of the fields is too long.", am: "ከመስኮቹ አንዱ ከመጠን በላይ ረጅም ነው።", om: "Dirreewwan keessaa tokko baay'ee dheeraa dha.", ti: "ሓደ ካብቶም መስኮታት ኣዝዩ ነዊሕ እዩ።" },
  settingsPaymentMethodRequired: { en: "Select at least one payment method.", am: "ቢያንስ አንድ የክፍያ ዘዴ ይምረጡ።", om: "Yoo xiqqaate mala kaffaltii tokko filadhu.", ti: "እንተወሓደ ሓደ ኣገባብ ክፍሊት ምረጹ።" },
  settingsLanguageUnsupported: { en: "Choose a supported application language.", am: "የሚደገፍ የመተግበሪያ ቋንቋ ይምረጡ።", om: "Afaan aplikeeshinii deeggarame filadhu.", ti: "ዝድገፍ ቋንቋ ኣፕሊኬሽን ምረጹ።" },
  settingsBankNameRequired: { en: "Bank name is required.", am: "የባንክ ስም ያስፈልጋል።", om: "Maqaan baankii barbaachisaa dha.", ti: "ስም ባንኪ የድሊ እዩ።" },
  settingsBankNameTooLong: { en: "Bank name is too long.", am: "የባንክ ስም ከመጠን በላይ ረጅም ነው።", om: "Maqaan baankii baay'ee dheeraa dha.", ti: "ስም ባንኪ ኣዝዩ ነዊሕ እዩ።" },
  settingsAccountNameRequired: { en: "Account name is required.", am: "የሂሳብ ስም ያስፈልጋል።", om: "Maqaan herregaa barbaachisaa dha.", ti: "ስም ሕሳብ የድሊ እዩ።" },
  settingsAccountNameTooLong: { en: "Account name is too long.", am: "የሂሳብ ስም ከመጠን በላይ ረጅም ነው።", om: "Maqaan herregaa baay'ee dheeraa dha.", ti: "ስም ሕሳብ ኣዝዩ ነዊሕ እዩ።" },
  settingsAccountNumberRequired: { en: "Account number is required.", am: "የሂሳብ ቁጥር ያስፈልጋል።", om: "Lakkoofsi herregaa barbaachisaa dha.", ti: "ቁጽሪ ሕሳብ የድሊ እዩ።" },
  settingsAccountNumberTooLong: { en: "Account number is too long.", am: "የሂሳብ ቁጥር ከመጠን በላይ ረጅም ነው።", om: "Lakkoofsi herregaa baay'ee dheeraa dha.", ti: "ቁጽሪ ሕሳብ ኣዝዩ ነዊሕ እዩ።" },
  settingsAccountTypeUnsupported: { en: "Choose a supported account type.", am: "የሚደገፍ የሂሳብ አይነት ይምረጡ።", om: "Gosa herregaa deeggarame filadhu.", ti: "ዝድገፍ ዓይነት ሕሳብ ምረጹ።" },
  settingsAccountSaveFailed: { en: "The payment account was not saved for this restaurant.", am: "የክፍያ ሂሳቡ ለዚህ ምግብ ቤት አልተቀመጠም።", om: "Herregni kaffaltii mana nyaataa kanaaf hin kuufamne.", ti: "ሕሳብ ክፍሊት ንዚ ሬስቶራንት ኣይተቐመጠን።" },
  settingsAccountIdRequired: { en: "Account ID is required.", am: "የሂሳብ ID ያስፈልጋል።", om: "ID herregaa barbaachisaa dha.", ti: "ID ሕሳብ የድሊ እዩ።" },
  settingsAccountIdTooLong: { en: "Account ID is too long.", am: "የሂሳብ ID ከመጠን በላይ ረጅም ነው።", om: "ID herregaa baay'ee dheeraa dha.", ti: "ID ሕሳብ ኣዝዩ ነዊሕ እዩ።" },
  settingsGenericError: { en: "Something went wrong. Please try again.", am: "ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።", om: "Dogoggorri uumameera. Maaloo irra deebi'ii yaali.", ti: "ጌጋ ተፈጢሩ። በጃኹም እንደገና ፈትኑ።" },
  settingsRequiredField: { en: "This field is required.", am: "ይህ መስክ ያስፈልጋል።", om: "Dirreen kun barbaachisaa dha.", ti: "እዚ መስክ የድሊ እዩ።" },
  menuFilters: { en: "Menu filters", am: "የምናሌ ማጣሪያዎች", om: "Calallii tarree nyaataa", ti: "መጻረዪ ሜኑ" },
  staffManagement: { en: "Staff management", am: "የሰራተኞች አስተዳደር", om: "Bulchiinsa hojjettootaa", ti: "ምሕደራ ሰራሕተኛታት" },
  addStaff: { en: "Add staff", am: "ሰራተኛ ጨምር", om: "Hojjetaa dabali", ti: "ሰራሕተኛ ወስኽ" },
  addShift: { en: "Add Shift", am: "ፈረቃ ጨምር", om: "Shiftii dabali", ti: "ፈረቓ ወስኽ" },
  staffAccess: { en: "Staff access", am: "የሰራተኛ መዳረሻ", om: "Seensa hojjetaa", ti: "መእተዊ ሰራሕተኛ" },
  teamOperations: { en: "Team operations", am: "የቡድን ስራዎች", om: "Hojii garee", ti: "ንጥፈታት ጉጅለ" },
  staffShifts: { en: "Staff & shifts", am: "ሰራተኞች እና ፈረቃዎች", om: "Hojjettootaa fi shiftii", ti: "ሰራሕተኛታትን ፈረቓታትን" },
  totalStaff: { en: "Total staff", am: "ጠቅላላ ሰራተኞች", om: "Ida'ama hojjettootaa", ti: "ጠቕላላ ሰራሕተኛታት" },
  restaurantTeam: { en: "Restaurant team", am: "የምግብ ቤት ቡድን", om: "Garee mana nyaataa", ti: "ጉጅለ ሬስቶራንት" },
  onDuty: { en: "On duty", am: "በስራ ላይ", om: "Hojii irra jira", ti: "ኣብ ስራሕ ላይ" },
  workingNow: { en: "Working right now", am: "አሁን በስራ ላይ", om: "Amma hojii irra jira", ti: "ሕጂ ኣብ ስራሕ ኣሎ" },
  offDuty: { en: "Off duty", am: "ከስራ ውጪ", om: "Hojii irra hin jiru", ti: "ካብ ስራሕ ወጻኢ" },
  notWorking: { en: "Not currently working", am: "አሁን በስራ ላይ አይደሉም", om: "Amma hojii irra hin jiru", ti: "ሕጂ ኣብ ስራሕ የለን" },
  todaysTeam: { en: "Today's team", am: "የዛሬ ቡድን", om: "Garee har'aa", ti: "ጉጅለ ሎሚ" },
  staffSchedule: { en: "Staff schedule", am: "የሰራተኞች መርሃ ግብር", om: "Sagantaa hojjettootaa", ti: "መደብ ሰራሕተኛታት" },
  actions: { en: "Actions", am: "ድርጊቶች", om: "Gochaalee", ti: "ተግባራት" },
  noShift: { en: "No shift", am: "ፈረቃ የለም", om: "Shiftiin hin jiru", ti: "ፈረቃ የለን" },
  noDate: { en: "No date", am: "ቀን የለም", om: "Guyyaan hin jiru", ti: "ዕለት የለን" },
  noStaffFound: { en: "No staff members found.", am: "ምንም ሰራተኛ አልተገኘም።", om: "Hojjetaan hin argamne.", ti: "ሰራሕተኛ ኣይተረኽበን።" },
  staffCount: { en: "staff", am: "ሰራተኞች", om: "hojjettoota", ti: "ሰራሕተኛታት" },
  addStaffMember: { en: "Add staff member", am: "ሰራተኛ አባል ጨምር", om: "Miseensa hojjetaa dabali", ti: "ኣባል ሰራሕተኛ ወስኽ" },
  createStaff: { en: "Create staff", am: "ሰራተኛ ፍጠር", om: "Hojjetaa uumi", ti: "ሰራሕተኛ ፍጠር" },
  creating: { en: "Creating...", am: "በመፍጠር ላይ...", om: "Uumaa jira...", ti: "ይፍጠር ኣሎ..." },
  adding: { en: "Adding...", am: "በመጨመር ላይ...", om: "Dabalaa jira...", ti: "ይውሰኽ ኣሎ..." },
  saving: { en: "Saving...", am: "በማስቀመጥ ላይ...", om: "Kuusaa jira...", ti: "ይዕቀብ ኣሎ..." },
  editStaff: { en: "Edit", am: "አስተካክል", om: "Gulaali", ti: "ኣስተኻኽል" },
  removeStaffAccess: { en: "Remove access", am: "መዳረሻን አስወግድ", om: "Seensa irraa haqi", ti: "መእተዊ ኣልግስ" },
  confirmRemoveStaffAccess: { en: "Remove staff access?", am: "የሰራተኛ መዳረሻ ይወገድ?", om: "Seensa hojjetaa haa haqamu?", ti: "መእተዊ ሰራሕተኛ ይልገስ?" },
  removeStaffAccessWarning: { en: "They will lose access to this restaurant. Their sign-in account, shifts, and historical records will be kept.", am: "የዚህን ምግብ ቤት መዳረሻ ያጣሉ። የመግቢያ መለያቸው፣ ፈረቃዎቻቸው እና ታሪካዊ መዝገቦቻቸው ይጠበቃሉ።", om: "Seensa mana nyaataa kanaa ni dhabu. Herregni seensaa, shiftii fi galmeen isaanii ni hafa.", ti: "ናይዚ ሬስቶራንት መእተዊ ክስእኑ እዮም። ኣካውንቶም፣ ፈረቓታቶምን ታሪኻዊ መዝገባቶምን ክቕጽሉ እዮም።" },
  removingStaffAccess: { en: "Removing access...", am: "መዳረሻን በማስወገድ ላይ...", om: "Seensa haqaa jira...", ti: "መእተዊ ይልገስ ኣሎ..." },
  staffAccessRemoved: { en: "Staff access removed.", am: "የሰራተኛ መዳረሻ ተወግዷል።", om: "Seenni hojjetaa haqameera.", ti: "መእተዊ ሰራሕተኛ ተላጊሱ።" },
  couldNotRemoveStaff: { en: "Could not remove staff access.", am: "የሰራተኛ መዳረሻን ማስወገድ አልተቻለም።", om: "Seensa hojjetaa haqaa hin dandeenye.", ti: "መእተዊ ሰራሕተኛ ምልጋስ ኣይተኻእለን።" },
  cannotRemoveOwnAccount: { en: "You cannot remove your own account.", am: "የራስዎን መለያ ማስወገድ አይችሉም።", om: "Herrega kee ofii kee haqachuu hin dandeessu.", ti: "ናይ ገዛእ ርእስኻ ኣካውንት ከተልግስ ኣይትኽእልን።" },
  staffMemberNotFound: { en: "Staff member was not found.", am: "የሰራተኛ አባሉ አልተገኘም።", om: "Miseensi hojjetaa hin argamne.", ti: "ኣባል ሰራሕተኛ ኣይተረኽበን።" },
  staffUserIdRequired: { en: "Staff user ID is required.", am: "የሰራተኛ የተጠቃሚ መለያ ያስፈልጋል።", om: "ID fayyadamaa hojjetaa barbaachisaa dha.", ti: "መለለዪ ተጠቃሚ ሰራሕተኛ የድሊ እዩ።" },
  staffAdminOnly: { en: "You do not have permission to manage staff.", am: "ሰራተኞችን ለማስተዳደር ፈቃድ የለዎትም።", om: "Hojjettoota bulchuuf hayyama hin qabdu.", ti: "ሰራሕተኛታት ንምምሕዳር ፍቓድ የብልካን።" },
  newPassword: { en: "New password", am: "አዲስ የይለፍ ቃል", om: "Jecha darbii haaraa", ti: "ሓድሽ መሕለፊ ቃል" },
  leaveBlankPassword: { en: "Leave blank to keep current password", am: "የአሁኑን የይለፍ ቃል ለመጠበቅ ባዶ ይተዉ", om: "Jecha darbii ammaa eeguuf duwwaa dhiisi", ti: "ነቲ ናይ ሕጂ መሕለፊ ቃል ንምዕቃብ ባዶ ግደፎ" },
  selectStaffMember: { en: "Select staff member", am: "ሰራተኛ አባል ይምረጡ", om: "Miseensa hojjetaa filadhu", ti: "ኣባል ሰራሕተኛ ምረጽ" },
  shiftName: { en: "Shift Name", am: "የፈረቃ ስም", om: "Maqaa shiftii", ti: "ስም ፈረቓ" },
  morningRush: { en: "Morning rush", am: "የጠዋት ጥድፊያ", om: "Daddaffii ganamaa", ti: "ቅልጡፍ ስራሕ ንግሆ" },
  shiftDate: { en: "Shift date", am: "የፈረቃ ቀን", om: "Guyyaa shiftii", ti: "ዕለት ፈረቓ" },
  startTime: { en: "Start Time", am: "የመጀመሪያ ሰዓት", om: "Yeroo jalqabaa", ti: "ግዜ መጀመርታ" },
  endTime: { en: "End Time", am: "የመጨረሻ ሰዓት", om: "Yeroo xumuraa", ti: "ግዜ መወዳእታ" },
  enterFullName: { en: "Enter full name", am: "ሙሉ ስም ያስገቡ", om: "Maqaa guutuu galchi", ti: "ምሉእ ስም ኣእትዉ" },
  staffEmailPlaceholder: { en: "staff@example.com", am: "staff@example.com", om: "staff@example.com", ti: "staff@example.com" },
  minimumPassword: { en: "Minimum 6 characters", am: "ቢያንስ 6 ቁምፊዎች", om: "Yoo xiqqaate arfiilee 6", ti: "እንተወሓደ 6 ፊደላት" },
  show: { en: "Show", am: "አሳይ", om: "Mul'isi", ti: "ኣርእይ" },
  hide: { en: "Hide", am: "ደብቅ", om: "Dhoksi", ti: "ሓብእ" },
  showPassword: { en: "Show password", am: "የይለፍ ቃል አሳይ", om: "Jecha darbii mul'isi", ti: "መሕለፊ ቃል ኣርእይ" },
  hidePassword: { en: "Hide password", am: "የይለፍ ቃል ደብቅ", om: "Jecha darbii dhoksi", ti: "መሕለፊ ቃል ሓብእ" },
  couldNotCreateStaff: { en: "Could not create staff member.", am: "የሰራተኛ አባል መፍጠር አልተቻለም።", om: "Miseensa hojjetaa uumuu hin dandeenye.", ti: "ኣባል ሰራሕተኛ ምፍጣር ኣይተኻእለን።" },
  couldNotAddShift: { en: "Could not add shift.", am: "ፈረቃ መጨመር አልተቻለም።", om: "Shiftii dabalu hin dandeenye.", ti: "ፈረቓ ምውሳኽ ኣይተኻእለን።" },
  shiftFieldsRequired: { en: "Shift date, start time and end time are required.", am: "የፈረቃ ቀን፣ መጀመሪያ እና መጨረሻ ሰዓት ያስፈልጋሉ።", om: "Guyyaa, yeroo jalqabaa fi yeroo xumuraa shiftii barbaachisaa dha.", ti: "ዕለት ፈረቓን ግዜ መጀመርታን መወዳእታን የድሊ።" },
  shiftEndMustBeLater: { en: "Shift end time must be later than start time.", am: "የፈረቃ መጨረሻ ሰዓት ከመጀመሪያ ሰዓት በኋላ መሆን አለበት።", om: "Yeroon xumuraa yeroo jalqabaa caalaa boodarra ta'uu qaba.", ti: "ግዜ መወዳእታ ካብ ግዜ መጀመርታ ድሕሪ ክኸውን ኣለዎ።" },
  staffCreated: { en: "Staff member created successfully.", am: "የሰራተኛ አባል በተሳካ ሁኔታ ተፈጥሯል።", om: "Miseensi hojjetaa milkaa'inaan uumameera.", ti: "ኣባል ሰራሕተኛ ብዓወት ተፈጢሩ።" },
  shiftAdded: { en: "Shift added successfully.", am: "ፈረቃ በተሳካ ሁኔታ ተጨምሯል።", om: "Shiftiin milkaa'inaan dabalameera.", ti: "ፈረቓ ብዓወት ተወሲኹ።" },
  couldNotUpdateStaff: { en: "Could not update staff member.", am: "የሰራተኛ አባል ማስተካከል አልተቻለም።", om: "Miseensa hojjetaa haaromsuu hin dandeenye.", ti: "ኣባል ሰራሕተኛ ምሕዳስ ኣይተኻእለን።" },
  menuManagement: { en: "MENU MANAGEMENT", am: "የምናሌ አስተዳደር", om: "BULCHIINSA TARREE NYAATAA", ti: "ምሕደራ ሜኑ" },
  foodDrinkCatalog: { en: "Food and drink catalog.", am: "የምግብ እና መጠጥ ዝርዝር።", om: "Tarree nyaataa fi dhugaatii.", ti: "ዝርዝር መግቢን መስተን።" },
  restaurant: { en: "Restaurant", am: "ምግብ ቤት", om: "Mana nyaataa", ti: "ቤት ምግቢ" },
  chooseFile: { en: "Choose File", am: "ፋይል ይምረጡ", om: "Faayila filadhu", ti: "ፋይል ምረጽ" },
  noFileChosen: { en: "No file chosen", am: "ምንም ፋይል አልተመረጠም", om: "Faayilaan hin filatamne", ti: "ሓደ እኳ ፋይል ኣይተመርጸን" },
  searchMenu: { en: "Search menu", am: "ምናሌ ፈልግ", om: "Tarree nyaataa barbaadi", ti: "ሜኑ ድለ" },
  searchByItem: { en: "Search by item name...", am: "በእቃ ስም ይፈልጉ...", om: "Maqaa meeshaatiin barbaadi...", ti: "ብስም እቃ ድለ..." },
  filterByCategory: { en: "Filter by category", am: "በምድብ አጣራ", om: "Ramaddiin calali", ti: "ብምድብ ምጽራይ" },
  uncategorized: { en: "Uncategorized", am: "ምድብ የሌለው", om: "Ramaddii hin qabne", ti: "ምድብ ዘይብሉ" },
  fastFoodCategory: { en: "Fast Food", am: "ፈጣን ምግብ", om: "Nyaata saffisaa", ti: "ቅልጡፍ መግቢ" },
  hotDrinkCategory: { en: "Hot Drink", am: "ትኩስ መጠጥ", om: "Dhugaatii ho'aa", ti: "ውዑይ መስተ" },
  jpegOnlyError: { en: "Only JPG or JPEG images are allowed.", am: "JPG ወይም JPEG ምስሎች ብቻ ይፈቀዳሉ።", om: "Suuraalee JPG ykn JPEG qofa hayyamamu.", ti: "ስእሊታት JPG ወይ JPEG ጥራይ ይፍቀዱ።" },
  imageTooLargeError: { en: "Image is too large. Please choose a smaller image.", am: "ምስሉ በጣም ትልቅ ነው። እባክዎ ትንሽ ምስል ይምረጡ።", om: "Suuraan guddaa dha. Maaloo suura xiqqaa filadhu.", ti: "ስእሊ ኣዝዩ ዓቢ እዩ። በጃኹም ንእሽቶ ስእሊ ምረጹ።" },
  menuSaveFailed: { en: "The menu change could not be saved. Please try again.", am: "የምናሌ ለውጡን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።", om: "Jijjiirama tarree nyaataa kuusuun hin danda'amne. Maaloo irra deebi'ii yaali.", ti: "ለውጢ ሜኑ ምቕማጥ ኣይተኻእለን። በጃኹም እንደገና ፈትኑ።" },
  addCategory: { en: "Add category", am: "ምድብ ጨምር", om: "Ramaddii dabali", ti: "ምድብ ወስኽ" },
  categoryName: { en: "Category name", am: "የምድብ ስም", om: "Maqaa ramaddii", ti: "ስም ምድብ" },
  addMenuItem: { en: "Add menu item", am: "የምናሌ እቃ ጨምር", om: "Meeshaa tarree nyaataa dabali", ti: "እቃ ሜኑ ወስኽ" },
  addFoodDrink: { en: "Add food or drink", am: "ምግብ ወይም መጠጥ ጨምር", om: "Nyaata ykn dhugaatii dabali", ti: "ምግቢ ወይ መስተ ወስኽ" },
  name: { en: "Name", am: "ስም", om: "Maqaa", ti: "ስም" },
  category: { en: "Category", am: "ምድብ", om: "Ramaddii", ti: "ምድብ" },
  priceETB: { en: "Price (ETB)", am: "ዋጋ (ETB)", om: "Gatii (ETB)", ti: "ዋጋ (ETB)" },
  preparationStation: { en: "Preparation station", am: "የዝግጅት ጣቢያ", om: "Buufata qophii", ti: "ቦታ ምድላው" },
  description: { en: "Description", am: "መግለጫ", om: "Ibsa", ti: "መግለጺ" },
  photoJpegOnly: { en: "Photo — JPG / JPEG only", am: "ፎቶ — JPG / JPEG ብቻ", om: "Suura — JPG / JPEG qofa", ti: "ስእሊ — JPG / JPEG ጥራይ" },
  unavailableItem: { en: "Unavailable", am: "አይገኝም", om: "Hin argamu", ti: "የለን" },
  editMenuItem: { en: "Edit menu item", am: "የምናሌ እቃ አስተካክል", om: "Meeshaa tarree nyaataa gulaali", ti: "እቃ ሜኑ ኣስተኻኽል" },
  deleteItem: { en: "Delete item", am: "እቃ ሰርዝ", om: "Meeshaa haqi", ti: "እቃ ደምስስ" },
  saveChanges: { en: "Save changes", am: "ለውጦችን አስቀምጥ", om: "Jijjiirama kuusi", ti: "ለውጢ ዓቅብ" },
  replacePhoto: { en: "Replace photo — JPG/JPEG", am: "ፎቶ ቀይር — JPG/JPEG", om: "Suura bakka buusi — JPG/JPEG", ti: "ስእሊ ተካእ — JPG/JPEG" },
  availability: { en: "Availability", am: "መገኘት", om: "Argama", ti: "ምህላው" },
  noDescription: { en: "No description added.", am: "መግለጫ አልተጨመረም።", om: "Ibsi hin dabalamin.", ti: "መግለጺ ኣይተወሰኸን።" },
  noMenuItems: { en: "No menu items yet.", am: "እስካሁን ምንም የምናሌ እቃ የለም።", om: "Hanga ammaatti meeshaaleen tarree nyaataa hin jiran.", ti: "ክሳብ ሕጂ እቃታት ሜኑ የለዉን።" },
  addFirstMenuItem: { en: "Add your first food or drink from the setup panel.", am: "የመጀመሪያ ምግብ ወይም መጠጥዎን ከዝግጅት ፓነል ይጨምሩ።", om: "Nyaata ykn dhugaatii jalqabaa kee paanaalii qophii irraa dabali.", ti: "ቀዳማይ ምግብኻ ወይ መስተኻ ካብ ፓነል ምድላው ወስኽ።" },
  "TABLE MANAGEMENT": { en: "TABLE MANAGEMENT", am: "የጠረጴዛ አስተዳደር", om: "BULCHIINSA MINJAALAA", ti: "ምሕደራ ጠረጴዛ" },
  "Access not granted.": { en: "Access not granted.", am: "መዳረሻ አልተሰጠም።", om: "Seensi hin kennamne.", ti: "መእተዊ ኣይተዋህበን።" },
  "Your account is not connected to a restaurant.": { en: "Your account is not connected to a restaurant.", am: "መለያዎ ከምግብ ቤት ጋር አልተገናኘም።", om: "Herregni kee mana nyaataa waliin wal hin qabanne.", ti: "ሕሳብካ ምስ ሬስቶራንት ኣይተራኸበን።" },
  "Manage your dining floor.": { en: "Manage your dining floor.", am: "የመመገቢያ ቦታዎን ያስተዳድሩ።", om: "Bakka nyaataa kee bulchi.", ti: "ቦታ መግቢኻ ኣመሓድር።" },
  "Add table": { en: "Add table", am: "ጠረጴዛ ጨምር", om: "Minjaala dabali", ti: "ጠረጴዛ ወስኽ" },
  "All": { en: "All", am: "ሁሉም", om: "Hunda", ti: "ኩሎም" },
  "Could not load tables:": { en: "Could not load tables:", am: "ጠረጴዛዎችን መጫን አልተቻለም፦", om: "Minjaalota fe'uu hin dandeenye:", ti: "ጠረጴዛታት ምጽዓን ኣይተኻእለን፦" },
  "FLOOR VIEW": { en: "FLOOR VIEW", am: "የወለል እይታ", om: "RAGAA BAKKAA", ti: "ርእይቶ ወለል" },
  "Live table status": { en: "Live table status", am: "የጠረጴዛ ወቅታዊ ሁኔታ", om: "Haala minjaalaa yeroo ammaa", ti: "ቀጥታ ኩነታት ጠረጴዛ" },
  "SETUP": { en: "SETUP", am: "ዝግጅት", om: "QOPHII", ti: "ምድላው" },
  "Table number": { en: "Table number", am: "የጠረጴዛ ቁጥር", om: "Lakkoofsa minjaalaa", ti: "ቁጽሪ ጠረጴዛ" },
  "Display name": { en: "Display name", am: "የሚታይ ስም", om: "Maqaa mul'atu", ti: "ዝርአ ስም" },
  "Capacity": { en: "Capacity", am: "አቅም", om: "Dandeettii", ti: "ዓቕሚ" },
  "Seats": { en: "Seats", am: "መቀመጫዎች", om: "Teessumsa", ti: "መቐመጢ" },
  "Dining table": { en: "Dining table", am: "የመመገቢያ ጠረጴዛ", om: "Minjaala nyaataa", ti: "ጠረጴዛ መግቢ" },
  "Save details": { en: "Save details", am: "ዝርዝሮችን አስቀምጥ", om: "Bal'ina kuusi", ti: "ዝርዝር ዓቅብ" },
  "Delete table": { en: "Delete table", am: "ጠረጴዛ ሰርዝ", om: "Minjaala haqi", ti: "ጠረጴዛ ደምስስ" },
  "No tables have been created yet.": { en: "No tables have been created yet.", am: "እስካሁን ምንም ጠረጴዛ አልተፈጠረም።", om: "Hanga ammaatti minjaalli hin uumamne.", ti: "ክሳብ ሕጂ ጠረጴዛ ኣይተፈጥረን።" },
  "Use the Add table form to create your first table.": { en: "Use the Add table form to create your first table.", am: "የመጀመሪያ ጠረጴዛዎን ለመፍጠር የጠረጴዛ መጨመሪያ ቅጹን ይጠቀሙ።", om: "Minjaala jalqabaa uumuuf unka Minjaala dabali fayyadami.", ti: "ቀዳማይ ጠረጴዛኻ ንምፍጣር ቅጥዒ ጠረጴዛ ወስኽ ተጠቐም።" },
  all: { en: "All", am: "ሁሉም", om: "Hunda", ti: "ኩሎም" },
  cleaning: { en: "Cleaning", am: "በጽዳት ላይ", om: "Qulqulleessaa jira", ti: "ይጸረይ ኣሎ" },
  filterTablesByStatus: { en: "Filter tables by status", am: "ጠረጴዛዎችን በሁኔታ አጣራ", om: "Minjaalota haalaan calali", ti: "ጠረጴዛታት ብኩነታት ምፍላይ" },
  availableStatus: { en: "Available", am: "ነጻ", om: "Qophaa'aa", ti: "ድሉው" },
  occupiedStatus: { en: "Occupied", am: "ተይዟል", om: "Qabameera", ti: "ተታሒዙ" },
  reservedStatus: { en: "Reserved", am: "ተይዟል", om: "Qoodameera", ti: "ተሓዚኡ" },
  cleaningStatus: { en: "Cleaning", am: "በጽዳት ላይ", om: "Qulqulleessaa jira", ti: "ይጸረይ ኣሎ" },
  diningTable: { en: "Dining table", am: "የመመገቢያ ጠረጴዛ", om: "Minjaala nyaataa", ti: "ጠረጴዛ መግቢ" },
  seats: { en: "Seats", am: "መቀመጫዎች", om: "Teessumsa", ti: "መቐመጢ" },
  guests: { en: "guests", am: "እንግዶች", om: "keessummoota", ti: "ኣጋይሽ" },
  changeStatus: { en: "Change status", am: "ሁኔታ ቀይር", om: "Haala jijjiiri", ti: "ኩነታት ቀይር" },
  save: { en: "Save", am: "አስቀምጥ", om: "Kuusi", ti: "ዓቅብ" },
  editTable: { en: "Edit table", am: "ጠረጴዛ አስተካክል", om: "Minjaala gulaali", ti: "ጠረጴዛ ኣስተኻኽል" },
  tableNumber: { en: "Table number", am: "የጠረጴዛ ቁጥር", om: "Lakkoofsa minjaalaa", ti: "ቁጽሪ ጠረጴዛ" },
  displayName: { en: "Display name", am: "የሚታይ ስም", om: "Maqaa mul'atu", ti: "ዝርአ ስም" },
  capacity: { en: "Capacity", am: "አቅም", om: "Dandeettii", ti: "ዓቕሚ" },
  saveDetails: { en: "Save details", am: "ዝርዝሮችን አስቀምጥ", om: "Bal'ina kuusi", ti: "ዝርዝር ዓቅብ" },
  deleteTable: { en: "Delete table", am: "ጠረጴዛ ሰርዝ", om: "Minjaala haqi", ti: "ጠረጴዛ ደምስስ" },
  total: { en: "Total", am: "ጠቅላላ", om: "Ida'ama", ti: "ጠቕላላ" },
  tableManagement: { en: "TABLE MANAGEMENT", am: "የጠረጴዛ አስተዳደር", om: "BULCHIINSA MINJAALAA", ti: "ምሕደራ ጠረጴዛ" },
  manageDiningFloor: { en: "Manage your dining floor.", am: "የመመገቢያ ቦታዎን ያስተዳድሩ።", om: "Bakka nyaataa kee bulchi.", ti: "ቦታ መግቢኻ ኣመሓድር።" },
  access: { en: "access", am: "መዳረሻ", om: "seensa", ti: "መእተዊ" },
  floorView: { en: "FLOOR VIEW", am: "የወለል እይታ", om: "RAGAA BAKKAA", ti: "ርእይቶ ወለል" },
  liveTableStatus: { en: "Live table status", am: "የጠረጴዛ ወቅታዊ ሁኔታ", om: "Haala minjaalaa yeroo ammaa", ti: "ቀጥታ ኩነታት ጠረጴዛ" },
  setup: { en: "SETUP", am: "ዝግጅት", om: "QOPHII", ti: "ምድላው" },
  addTable: { en: "Add table", am: "ጠረጴዛ ጨምር", om: "Minjaala dabali", ti: "ጠረጴዛ ወስኽ" },
  noTables: { en: "No tables have been created yet.", am: "እስካሁን ምንም ጠረጴዛ አልተፈጠረም።", om: "Hanga ammaatti minjaalli hin uumamne.", ti: "ክሳብ ሕጂ ጠረጴዛ ኣይተፈጥረን።" },
  useAddTable: { en: "Use the Add table form to create your first table.", am: "የመጀመሪያ ጠረጴዛዎን ለመፍጠር የጠረጴዛ መጨመሪያ ቅጹን ይጠቀሙ።", om: "Minjaala jalqabaa uumuuf unka Minjaala dabali fayyadami.", ti: "ቀዳማይ ጠረጴዛኻ ንምፍጣር ቅጥዒ ጠረጴዛ ወስኽ ተጠቐም።" },
  serverWorkspace: { en: "SERVER WORKSPACE", am: "የሰርቨር የስራ ቦታ", om: "IDDOO HOJII SERVER", ti: "ቦታ ስራሕ SERVER" },
  serverPos: { en: "SERVER POS", am: "የሰርቨር POS", om: "SERVER POS", ti: "SERVER POS" },
  fastService: { en: "Fast service, real tables, live menu access.", am: "ፈጣን አገልግሎት፣ እውነተኛ ጠረጴዛዎች፣ የቀጥታ ምናሌ መዳረሻ።", om: "Tajaajila saffisaa, minjaalota dhugaa, fi tarree nyaataa yeroo ammaa.", ti: "ቅልጡፍ ኣገልግሎት፣ ናይ ሓቂ ጠረጴዛታት፣ ቀጥታ መእተዊ ሜኑ።" },
  orders: { en: "Orders", am: "ትዕዛዞች", om: "Ajajawwan", ti: "ትእዛዛት" },
  kitchenWorkspaceTitle: { en: "Kitchen workspace", am: "የኩሽና የስራ ቦታ", om: "Iddoo hojii kushiinaa", ti: "ቦታ ስራሕ ኩሽና" },
  barWorkspaceTitle: { en: "Bar workspace", am: "የባር የስራ ቦታ", om: "Iddoo hojii baarii", ti: "ቦታ ስራሕ ባር" },
  kitchenOrdersTitle: { en: "Kitchen orders", am: "የኩሽና ትዕዛዞች", om: "Ajajawwan kushiinaa", ti: "ትእዛዛት ኩሽና" },
  barOrdersTitle: { en: "Bar orders", am: "የባር ትዕዛዞች", om: "Ajajawwan baarii", ti: "ትእዛዛት ባር" },
  workspaceInventoryLabel: { en: "Inventory", am: "እቃ አስተዳደር", om: "Kuusaa", ti: "ክዛና" },
  workspaceNavigation: { en: "workspace navigation", am: "የስራ ቦታ ማሰሻ", om: "Qajeelcha iddoo hojii", ti: "ምርሓ ቦታ ስራሕ" },
  stockRequestAddTitle: { en: "Add stock request", am: "የእቃ ጥያቄ ጨምር", om: "Gaaffii kuusaa dabali", ti: "ሕቶ ክዛና ወስኽ" },
  stockRequestDescription: { en: "Describe what your station needs without changing inventory.", am: "እቃ አስተዳደሩን ሳይቀይሩ ጣቢያዎ የሚፈልገውን ይግለጹ።", om: "Kuusaa osoo hin jijjiirin waan buufatni keessan barbaadu ibsaa.", ti: "ክዛና ከይቀየርኩም እቲ መደብኩም ዘድልዮ ግለጹ።" },
  stockRequestItemName: { en: "Item name", am: "የእቃ ስም", om: "Maqaa meeshaa", ti: "ስም እቃ" },
  stockRequestItemNamePlaceholder: { en: "Enter item name...", am: "የእቃውን ስም ያስገቡ...", om: "Maqaa meeshaa galchi...", ti: "ስም እቲ እቃ ኣእትዉ..." },
  stockRequestItemType: { en: "Item type", am: "የእቃ አይነት", om: "Gosa meeshaa", ti: "ዓይነት እቃ" },
  stockRequestUnit: { en: "Unit", am: "መለኪያ", om: "Safartuu", ti: "መለክዒ" },
  stockRequestReasonNote: { en: "Reason / note", am: "ምክንያት / ማስታወሻ", om: "Sababa / yaadannoo", ti: "ምኽንያት / መዘኻኸሪ" },
  stockRequestOptional: { en: "Optional", am: "አማራጭ", om: "Dirqama miti", ti: "ኣማራጺ" },
  stockRequestNotePlaceholder: { en: "Kitchen stock needed", am: "ለኩሽና የሚያስፈልግ እቃ", om: "Kuusaa kushiinaaf barbaachisu", ti: "ንኩሽና ዘድሊ ክዛና" },
  stockRequestSubmitting: { en: "Submitting request...", am: "ጥያቄውን በመላክ ላይ...", om: "Gaaffii ergaa jira...", ti: "ሕቶ ይለኣኽ ኣሎ..." },
  stockRequestSubmit: { en: "Add stock request", am: "የእቃ ጥያቄ ጨምር", om: "Gaaffii kuusaa dabali", ti: "ሕቶ ክዛና ወስኽ" },
  stockRequestSuccessTitle: { en: "Stock request submitted", am: "የእቃ ጥያቄ ተልኳል", om: "Gaaffiin kuusaa ergameera", ti: "ሕቶ ክዛና ተላኢኹ" },
  stockRequestResultsTitle: { en: "Your stock request results", am: "የእቃ ጥያቄዎ ውጤቶች", om: "Bu'aa gaaffii kuusaa keetii", ti: "ውጽኢት ሕቶ ክዛናኻ" },
  stockRequestResultApproved: { en: "Your stock request for {item} ({quantity} {unit}) was approved.", am: "ለ{item} ({quantity} {unit}) ያቀረቡት የእቃ ጥያቄ ጸድቋል።", om: "Gaaffiin kuusaa {item} ({quantity} {unit}) gaafatte mirkanaa'eera.", ti: "ን{item} ({quantity} {unit}) ዘቕረብካዮ ሕቶ ክዛና ጸዲቑ እዩ።" },
  stockRequestResultRejected: { en: "Your stock request for {item} ({quantity} {unit}) was rejected.", am: "ለ{item} ({quantity} {unit}) ያቀረቡት የእቃ ጥያቄ ውድቅ ተደርጓል።", om: "Gaaffiin kuusaa {item} ({quantity} {unit}) gaafatte kufameera.", ti: "ን{item} ({quantity} {unit}) ዘቕረብካዮ ሕቶ ክዛና ተነጺጉ እዩ።" },
  stockRequestResultNote: { en: "Note: {note}", am: "ማስታወሻ፦ {note}", om: "Yaadannoo: {note}", ti: "መዘኻኸሪ፦ {note}" },
  stockRequestRequired: { en: "This field is required.", am: "ይህ መስክ ያስፈልጋል።", om: "Dirreen kun barbaachisaa dha.", ti: "እዚ መስክ የድሊ እዩ።" },
  stockRequestPermissionDenied: { en: "You do not have permission to create stock requests.", am: "የእቃ ጥያቄዎችን ለመፍጠር ፈቃድ የለዎትም።", om: "Gaaffii kuusaa uumuuf hayyama hin qabdu.", ti: "ሕቶ ክዛና ንምፍጣር ፍቓድ የብልኩምን።" },
  stockRequestNameRequired: { en: "Item name is required.", am: "የእቃ ስም ያስፈልጋል።", om: "Maqaan meeshaa barbaachisaa dha.", ti: "ስም እቃ የድሊ እዩ።" },
  stockRequestStationRequired: { en: "A valid station is required.", am: "ትክክለኛ ጣቢያ ያስፈልጋል።", om: "Buufata sirrii barbaachisa.", ti: "ቅኑዕ መደብ የድሊ።" },
  stockRequestQuantityInvalid: { en: "Quantity must be a valid number.", am: "ብዛቱ ትክክለኛ ቁጥር መሆን አለበት።", om: "Baay'inni lakkoofsa sirrii ta'uu qaba.", ti: "ብዝሒ ቅኑዕ ቁጽሪ ክኸውን ኣለዎ።" },
  stockRequestQuantityPositive: { en: "Requested quantity must be greater than zero.", am: "የተጠየቀው ብዛት ከዜሮ በላይ መሆን አለበት።", om: "Baay'inni gaafatame zeeroo ol ta'uu qaba.", ti: "ዝተሓተተ ብዝሒ ካብ ዜሮ ክበልጽ ኣለዎ።" },
  stockRequestUnitUnsupported: { en: "Choose a supported request unit.", am: "የሚደገፍ የጥያቄ መለኪያ ይምረጡ።", om: "Safartuu gaaffii deeggarame filadhu.", ti: "ዝድገፍ መለክዒ ሕቶ ምረጹ።" },
  inventoryUnitInUse: { en: "This item's unit is locked because it has stock, movement or recipe history, or nonzero unit-based settings.", am: "ይህ እቃ ክምችት፣ የእንቅስቃሴ ወይም የአሰራር ታሪክ፣ ወይም ዜሮ ያልሆኑ በመለኪያ ላይ የተመሰረቱ ቅንብሮች ስላሉት መለኪያው ተቆልፏል።", om: "Safartuun meeshaa kanaa kuusaa, seenaa sochii ykn recipe, yookaan qindaa'inoota safartuu irratti hundaa'an zeeroo hin taane waan qabuuf cufameera.", ti: "እዚ እቃ ክዛና፣ ታሪኽ ምንቅስቓስ ወይ ሬሲፒ፣ ወይ ዜሮ ዘይኮኑ ኣብ መለክዒ ዝተመርኮሱ ቅንብራት ስለዘለዉዎ መለክዒኡ ተዓጽዩ እዩ።" },
  stockRequestAssignedStationOnly: { en: "You can only request stock for your assigned station.", am: "ለተመደቡበት ጣቢያ ብቻ እቃ መጠየቅ ይችላሉ።", om: "Kuusaa buufata siif ramadame qofaaf gaafachuu dandeessa.", ti: "ንእተመደበልኩም መደብ ጥራይ ክዛና ክትሓትቱ ትኽእሉ።" },
  stockRequestPendingDuplicate: { en: "You already have a pending request for this item.", am: "ለዚህ እቃ በመጠባበቅ ላይ ያለ ጥያቄ አለዎት።", om: "Meeshaa kanaaf gaaffii eeggataa duraan qabda.", ti: "ንዚ እቃ ዝጽበ ዘሎ ሕቶ ድሮ ኣለኩም።" },
  stockRequestGenericError: { en: "Unable to send stock request.", am: "የእቃ ጥያቄውን መላክ አልተቻለም።", om: "Gaaffii kuusaa erguun hin danda'amne.", ti: "ሕቶ ክዛና ምልኣኽ ኣይተኻእለን።" },
  kitchenWorkspaceTitle: { en: "Kitchen workspace", am: "የኩሽና የስራ ቦታ", om: "Iddoo hojii kushiinaa", ti: "ቦታ ስራሕ ኩሽና" },
  barWorkspaceTitle: { en: "Bar workspace", am: "የባር የስራ ቦታ", om: "Iddoo hojii baarii", ti: "ቦታ ስራሕ ባር" },
  kitchenOrdersTitle: { en: "Kitchen orders", am: "የኩሽና ትዕዛዞች", om: "Ajajawwan kushiinaa", ti: "ትእዛዛት ኩሽና" },
  barOrdersTitle: { en: "Bar orders", am: "የባር ትዕዛዞች", om: "Ajajawwan baarii", ti: "ትእዛዛት ባር" },
  workspaceInventoryLabel: { en: "Inventory", am: "እቃ አስተዳደር", om: "Kuusaa", ti: "ክዛና" },
  workspaceNavigation: { en: "workspace navigation", am: "የስራ ቦታ ማሰሻ", om: "Qajeelcha iddoo hojii", ti: "ምርሓ ቦታ ስራሕ" },
  justNow: { en: "Just now", am: "አሁን", om: "Amma", ti: "ሕጂ" },
  minutesAgo: { en: "{count}m ago", am: "ከ{count} ደቂቃ በፊት", om: "Daqiiqaa {count} dura", ti: "ቅድሚ {count} ደቒቕ" },
  hoursMinutesAgo: { en: "{hours}h {minutes}m ago", am: "ከ{hours} ሰዓት {minutes} ደቂቃ በፊት", om: "Sa'aatii {hours} daqiiqaa {minutes} dura", ti: "ቅድሚ {hours} ሰዓት {minutes} ደቒቕ" },
  takeawayDelivery: { en: "Takeaway / delivery", am: "ይዞ መሄድ / ማድረስ", om: "Fudhanii deemuu / geessuu", ti: "ወሲድካ ምኻድ / ምብጻሕ" },
  prepareOrder: { en: "Prepare", am: "አዘጋጅ", om: "Qopheessi", ti: "ኣዳሉ" },
  completeOrder: { en: "Complete", am: "አጠናቅቅ", om: "Xumuri", ti: "ዛዝም" },
  updating: { en: "Updating...", am: "በማዘመን ላይ...", om: "Haaromsaa jira...", ti: "የሕድስ ኣሎ..." },
  noStationOrders: { en: "No {station} orders.", am: "ምንም የ{station} ትዕዛዞች የሉም።", om: "Ajajawwan {station} hin jiran.", ti: "ምንም ትእዛዛት {station} የለዉን።" },
  stationOrderMovedTo: { en: "Order moved to {status}.", am: "ትዕዛዙ ወደ {status} ተቀይሯል።", om: "Ajajni gara {status} jijjiirameera.", ti: "ትእዛዝ ናብ {status} ተቐይሩ።" },
  stationAccessDenied: { en: "Station access denied.", am: "የጣቢያ መዳረሻ አልተፈቀደም።", om: "Seensi buufataa hin hayyamamne.", ti: "መእተዊ መደብ ኣይተፈቕደን።" },
  stationInvalidStatus: { en: "Invalid station status.", am: "ትክክል ያልሆነ የጣቢያ ሁኔታ።", om: "Haalli buufataa sirrii miti.", ti: "ኩነታት መደብ ቅኑዕ ኣይኮነን።" },
  stationOrderNotFound: { en: "Station order was not found in this restaurant.", am: "በዚህ ምግብ ቤት የጣቢያ ትዕዛዙ አልተገኘም።", om: "Ajajni buufataa mana nyaataa kana keessatti hin argamne.", ti: "ትእዛዝ መደብ ኣብዚ ሬስቶራንት ኣይተረኽበን።" },
  stationOrderTransitionInvalid: { en: "Order cannot move from {current} to {next}.", am: "ትዕዛዙ ከ{current} ወደ {next} መቀየር አይችልም።", om: "Ajajni {current} irraa gara {next} jijjiiramuu hin danda'u.", ti: "ትእዛዝ ካብ {current} ናብ {next} ክቕየር ኣይኽእልን።" },
  stationOrderUpdateFailed: { en: "Unable to update order.", am: "ትዕዛዙን ማዘመን አልተቻለም።", om: "Ajaja haaromsuun hin danda'amne.", ti: "ትእዛዝ ምሕዳስ ኣይተኻእለን።" },
  stationCompletionPermissionDenied: { en: "You do not have permission to complete this station order.", am: "ይህን የጣቢያ ትዕዛዝ ለማጠናቀቅ ፈቃድ የለዎትም።", om: "Ajaja buufataa kana xumuruuf hayyama hin qabdu.", ti: "ነዚ ትእዛዝ መደብ ንምዝዛም ፍቓድ የብልኩምን።" },
  stationCompletionRequiresPreparation: { en: "Only orders being prepared can be completed.", am: "በዝግጅት ላይ ያሉ ትዕዛዞች ብቻ ሊጠናቀቁ ይችላሉ።", om: "Ajajawwan qophaa'aa jiran qofa xumuramuu danda'u.", ti: "ኣብ ምድላው ዘለዉ ትእዛዛት ጥራይ ክዛዘሙ ይኽእሉ።" },
  stationInsufficientInventory: { en: "Insufficient inventory for this order.", am: "ለዚህ ትዕዛዝ በቂ እቃ የለም።", om: "Kuusaan ajaja kanaaf gahaa miti.", ti: "ንዚ ትእዛዝ እኹል ክዛና የለን።" },
  newStationOrderReceived: { en: "New {station} order received", am: "አዲስ የ{station} ትዕዛዝ ደርሷል", om: "Ajajni {station} haaraan gaheera", ti: "ሓድሽ ትእዛዝ {station} መጺኡ" },
  kitchenOrderCompleted: { en: "Kitchen order completed", am: "የኩሽና ትዕዛዝ ተጠናቋል", om: "Ajajni kushiinaa xumurameera", ti: "ትእዛዝ ኩሽና ተዛዚሙ" },
  barOrderCompleted: { en: "Bar order completed", am: "የባር ትዕዛዝ ተጠናቋል", om: "Ajajni baarii xumurameera", ti: "ትእዛዝ ባር ተዛዚሙ" },
  createOrderDescription: { en: "Create an order and send it to the right station.", am: "ትዕዛዝ ይፍጠሩ እና ወደ ትክክለኛው ጣቢያ ይላኩ።", om: "Ajaja uumiitii gara buufata sirriitti ergi.", ti: "ትእዛዝ ፍጠሩ ናብ ቦታ ስራሕ ትኽክል ልኣኹ።" },
  overview: { en: "Overview", am: "አጠቃላይ እይታ", om: "Cuunfaa", ti: "ሓፈሻዊ ርእይቶ" },
  operations: { en: "OPERATIONS", am: "ስራዎች", om: "HOJII", ti: "ንጥፈታት" },
  recentOrders: { en: "Recent orders", am: "የቅርብ ጊዜ ትዕዛዞች", om: "Ajajawwan dhihoo", ti: "ናይ ቀረባ ትእዛዛት" },
  storedOrders: { en: "stored orders", am: "የተቀመጡ ትዕዛዞች", om: "ajajawwan kuufaman", ti: "ዝተዓቀቡ ትእዛዛት" },
  noOrders: { en: "No orders yet.", am: "እስካሁን ምንም ትዕዛዝ የለም።", om: "Hanga ammaatti ajajni hin jiru.", ti: "ክሳብ ሕጂ ትእዛዝ የለን።" },
  noStatusOrders: { en: "No {status} orders.", am: "ምንም {status} ትዕዛዝ የለም።", om: "Ajaja {status} hin jiru.", ti: "ምንም ትእዛዝ {status} የለን።" },
  newOrder: { en: "NEW ORDER", am: "አዲስ ትዕዛዝ", om: "AJAJA HAARAA", ti: "ሓድሽ ትእዛዝ" },
  sendToStation: { en: "Send to kitchen or bar", am: "ወደ ኩሽና ወይም ባር ይላኩ", om: "Gara kushiinaa ykn baarii ergi", ti: "ናብ ኩሽና ወይ ባር ልኣኽ" },
  menuItem: { en: "Menu item", am: "የምናሌ እቃ", om: "Meeshaa tarree nyaataa", ti: "እቃ ሜኑ" },
  items: { en: "items", am: "እቃዎች", om: "meeshaalee", ti: "እቃታት" },
  selectItem: { en: "Select an item", am: "እቃ ይምረጡ", om: "Meeshaa filadhu", ti: "እቃ ምረጽ" },
  quantity: { en: "Quantity", am: "ብዛት", om: "Baay'ina", ti: "ብዝሒ" },
  table: { en: "Table", am: "ጠረጴዛ", om: "Minjaala", ti: "ጠረጴዛ" },
  takeaway: { en: "Takeaway", am: "ይዞ መሄድ", om: "Fudhatanii deemuu", ti: "ወሲድካ ምኻድ" },
  notes: { en: "Notes", am: "ማስታወሻዎች", om: "Yaadannoo", ti: "መዘኻኸሪ" },
  createOrder: { en: "Create order", am: "ትዕዛዝ ይፍጠሩ", om: "Ajaja uumi", ti: "ትእዛዝ ፍጠር" },
  currentOrders: { en: "CURRENT ORDERS", am: "ያሉ ትዕዛዞች", om: "AJAJAWWAN AMMAA", ti: "ናይ ሕጂ ትእዛዛት" },
  order: { en: "Order", am: "ትዕዛዝ", om: "Ajaja", ti: "ትእዛዝ" },
  payment: { en: "Payment", am: "ክፍያ", om: "Kaffaltii", ti: "ክፍሊት" },
  unpaid: { en: "UNPAID", am: "ያልተከፈለ", om: "HIN KAFFALAMNE", ti: "ዘይተኸፍለ" },
  paid: { en: "PAID", am: "ተከፍሏል", om: "KAFFALAMEERA", ti: "ተኸፊሉ" },
  payRecordPayment: { en: "PAY / Record payment", am: "ክፈል / ክፍያ መዝግብ", om: "KAFFALI / Kaffaltii galmeessi", ti: "ክፈል / ክፍሊት መዝግብ" },
  cash: { en: "Cash", am: "ጥሬ ገንዘብ", om: "Maallaqa", ti: "ጥረ ገንዘብ" },
  telebirr: { en: "Telebirr", am: "ቴሌብር", om: "Telebirr", ti: "Telebirr" },
  bankTransfer: { en: "CBE / Other bank", am: "CBE / ሌላ ባንክ", om: "CBE / Baankii biraa", ti: "CBE / ካልእ ባንኪ" },
  dineIn: { en: "Dine-in", am: "በምግብ ቤት መመገብ", om: "Bakka nyaataa", ti: "ኣብ ቤት ምግቢ" },
  delivery: { en: "Delivery", am: "ማድረስ", om: "Geessuu", ti: "ምብጻሕ" },
  orderSetup: { en: "Order setup", am: "የትዕዛዝ ዝግጅት", om: "Qophii ajajaa", ti: "ምድላው ትእዛዝ" },
  checkout: { en: "Checkout", am: "ክፍያ መፈጸሚያ", om: "Xumura kaffaltii", ti: "መወዳእታ ክፍሊት" },
  tables: { en: "Tables", am: "ጠረጴዛዎች", om: "Minjaalota", ti: "ጠረጴዛታት" },
  available: { en: "Available", am: "ነጻ", om: "Qophaa'aa", ti: "ድሉው" },
  occupied: { en: "Occupied", am: "ተይዟል", om: "Qabameera", ti: "ተታሒዙ" },
  reserved: { en: "Reserved", am: "ተይዟል", om: "Qoodameera", ti: "ተሓዚኡ" },
  search: { en: "Search", am: "ፈልግ", om: "Barbaadi", ti: "ድለ" },
  searchMenuItems: { en: "Search menu items", am: "የምናሌ እቃዎችን ይፈልጉ", om: "Meeshaalee tarree nyaataa barbaadi", ti: "እቃታት ሜኑ ድለ" },
  allItems: { en: "All items", am: "ሁሉም እቃዎች", om: "Meeshaalee hunda", ti: "ኩሎም እቃታት" },
  availableItem: { en: "Available", am: "ይገኛል", om: "Jira", ti: "ይርከብ" },
  freshlyPrepared: { en: "Freshly prepared item.", am: "አዲስ የተዘጋጀ እቃ።", om: "Meeshaa haaraa qophaa'e.", ti: "ሓድሽ ዝተዳለወ እቃ።" },
  noImage: { en: "No image", am: "ምስል የለም", om: "Suura hin jiru", ti: "ስእሊ የለን" },
  imageUnavailable: { en: "Image unavailable", am: "ምስሉ አይገኝም", om: "Suuraan hin argamu", ti: "ምስሉ ኣይርከብን" },
  addToCart: { en: "Add to cart", am: "ወደ ጋሪ ጨምር", om: "Gara gaarii dabali", ti: "ናብ ጋሪ ወስኽ" },
  orderType: { en: "Order type", am: "የትዕዛዝ አይነት", om: "Gosa ajajaa", ti: "ዓይነት ትእዛዝ" },
  currentOrderType: { en: "Current order type", am: "የአሁኑ የትዕዛዝ አይነት", om: "Gosa ajajaa ammaa", ti: "ዓይነት ናይ ሕጂ ትእዛዝ" },
  selectedTable: { en: "Selected table", am: "የተመረጠ ጠረጴዛ", om: "Minjaala filatame", ti: "ዝተመርጸ ጠረጴዛ" },
  selectTable: { en: "Select table", am: "ጠረጴዛ ይምረጡ", om: "Minjaala filadhu", ti: "ጠረጴዛ ምረጽ" },
  tableStatus: { en: "Table status", am: "የጠረጴዛ ሁኔታ", om: "Haala minjaalaa", ti: "ኩነታት ጠረጴዛ" },
  noEligibleTable: { en: "No eligible table selected", am: "ተስማሚ ጠረጴዛ አልተመረጠም", om: "Minjaalli mijataan hin filatamne", ti: "ብቑዕ ጠረጴዛ ኣይተመርጸን" },
  notRequiredTable: { en: "Not required for takeaway or delivery", am: "ለይዞ መሄድ ወይም ማድረስ አያስፈልግም", om: "Fudhanii deemuu ykn geessuuf hin barbaachisu", ti: "ንወሲድካ ምኻድ ወይ ምብጻሕ ኣየድልን" },
  guestNotes: { en: "Guest notes or delivery details", am: "የእንግዳ ማስታወሻ ወይም የማድረስ ዝርዝሮች", om: "Yaada keessumm aa ykn odeeffannoo geessuu", ti: "መዘኻኸሪ ኣጋይሽ ወይ ዝርዝር ምብጻሕ" },
  decrease: { en: "Decrease", am: "ቀንስ", om: "Xiqqeessi", ti: "ንክን" },
  increase: { en: "Increase", am: "ጨምር", om: "Dabali", ti: "ወስኽ" },
  remove: { en: "Remove", am: "አስወግድ", om: "Haqi", ti: "ኣርሕቕ" },
  cartEmpty: { en: "Cart is empty. Add menu items to begin.", am: "ጋሪው ባዶ ነው። ለመጀመር የምናሌ እቃዎችን ይጨምሩ።", om: "Gaariin duwwaa dha. Jalqabuuf meeshaalee dabali.", ti: "ጋሪ ባዶ እዩ። ንምጅማር እቃታት ሜኑ ወስኽ።" },
  subtotal: { en: "Subtotal", am: "ንዑስ ድምር", om: "Ida'ama xiqqaa", ti: "ንኡስ ድምር" },
  creatingOrder: { en: "Creating order...", am: "ትዕዛዝ በመፍጠር ላይ...", om: "Ajaja uumaa jira...", ti: "ትእዛዝ ይፍጠር ኣሎ..." },
  confirmOrder: { en: "Confirm order", am: "ትዕዛዝ አረጋግጥ", om: "Ajaja mirkaneessi", ti: "ትእዛዝ ኣረጋግጽ" },
  orderCreatedDue: { en: "Order created successfully. Total due:", am: "ትዕዛዝ በተሳካ ሁኔታ ተፈጥሯል። ጠቅላላ የሚከፈል:", om: "Ajajni milkaa'inaan uumameera. Ida'ama kaffalamu:", ti: "ትእዛዝ ብዓወት ተፈጢሩ። ጠቕላላ ዝኽፈል:" },
  existingOrderFound: { en: "This table already has an unpaid order. Continue to payment:", am: "እዚ ጠረጴዛ ያልተከፈለ ትዕዛዝ አለው። ወደ ክፍያ ይቀጥሉ:", om: "Minjaalli kun ajaja hin kaffalamiin qaba. Gara kaffaltiitti itti fufi:", ti: "እዚ ጠረጴዛ ዘይተኸፍለ ትእዛዝ ኣለዎ። ናብ ክፍሊት ቀጽል:" },
    serverExistingOrderNotSubmitted: { en: "Unpaid order {orderNumber} already exists for this table ({amount}). Your new cart was not submitted.", am: "ያልተከፈለ ትዕዛዝ {orderNumber} ለዚህ ጠረጴዛ አስቀድሞ አለ ({amount}). አዲሱ ጋሪ አልተላከም።", om: "Ajajni hin kaffalamiin {orderNumber} minjaala kanaaf duraan jira ({amount}). Gaariin kee haaraan hin ergamne.", ti: "ዘይተኸፍለ ትእዛዝ {orderNumber} ንዚ ጠረጴዛ ኣሎ ({amount}). ሓድሽ ካርትኹም ኣይተላእከን።" },
  paymentMethod: { en: "Payment method", am: "የክፍያ ዘዴ", om: "Mala kaffaltii", ti: "ዓይነት ክፍሊት" },
  pay: { en: "Pay", am: "ክፈል", om: "Kaffali", ti: "ክፈል" },
  completePayment: { en: "Complete payment", am: "ክፍያ አጠናቅቅ", om: "Kaffaltii xumuri", ti: "ክፍሊት ወድእ" },
  orderTotal: { en: "Order total", am: "ጠቅላላ የትዕዛዝ ዋጋ", om: "Ida'ama ajajaa", ti: "ጠቕላላ ትእዛዝ" },
  orderNumber: { en: "Order number", am: "የትዕዛዝ ቁጥር", om: "Lakkoofsa ajajaa", ti: "ቁጽሪ ትእዛዝ" },
  cashReceived: { en: "Cash received", am: "የተቀበለው ጥሬ ገንዘብ", om: "Maallaqa fudhatame", ti: "ዝተቐበልናዮ ጥረ ገንዘብ" },
  changeAmount: { en: "Change", am: "ተመላሽ ገንዘብ", om: "Haftee", ti: "ተመላሺ" },
  confirmPayment: { en: "Confirm payment", am: "ክፍያ አረጋግጥ", om: "Kaffaltii mirkaneessi", ti: "ክፍሊት ኣረጋግጽ" },
  customerPayInstruction: { en: "Customer should pay this amount using their own phone.", am: "ደንበኛው ይህን መጠን በራሱ ስልክ መክፈል አለበት።", om: "Maamilaan maallaqa kana bilbila mataa isaatiin kaffaluu qaba.", ti: "ዓሚል ነዚ መጠን ብስልኩ ክኸፍሎ ኣለዎ።" },
  paymentStatus: { en: "Payment status", am: "የክፍያ ሁኔታ", om: "Haala kaffaltii", ti: "ኩነታት ክፍሊት" },
  customerPaid: { en: "Customer paid", am: "ደንበኛው ከፍሏል", om: "Maamilaan kaffaleera", ti: "ዓሚል ከፊሉ" },
  creatingPayment: { en: "Creating payment...", am: "ክፍያ በመፍጠር ላይ...", om: "Kaffaltii uumaa jira...", ti: "ክፍሊት ይፍጠር ኣሎ..." },
  markAsPaid: { en: "Mark as Paid", am: "እንደተከፈለ ምልክት አድርግ", om: "Kaffalameera jedhii mallatteessi", ti: "ከፊሉ ኢሉ ምልክት ግበር" },
  confirmingPayment: { en: "Confirming...", am: "በማረጋገጥ ላይ...", om: "Mirkaneessaa jira...", ti: "የረጋግጽ ኣሎ..." },
  rejectPayment: { en: "Reject payment", am: "ክፍያውን ውድቅ አድርግ", om: "Kaffaltii didi", ti: "ነቲ ክፍሊት ነጽጎ" },
  cbe: { en: "CBE", am: "CBE", om: "CBE", ti: "CBE" },
  telebirrNumber: { en: "Telebirr Number", am: "የቴሌብር ቁጥር", om: "Lakkoofsa Telebirr", ti: "ቁጽሪ ቴሌብር" },
  cbeAccountNumber: { en: "CBE Account Number", am: "የCBE ሂሳብ ቁጥር", om: "Lakkoofsa herrega CBE", ti: "ቁጽሪ ሕሳብ CBE" },
  payToTelebirr: { en: "Pay to Telebirr", am: "ወደ ቴሌብር ክፈል", om: "Gara Telebirr kaffali", ti: "ናብ ቴሌብር ክፈል" },
  payToCbe: { en: "Pay to CBE", am: "ወደ CBE ክፈል", om: "Gara CBE kaffali", ti: "ናብ CBE ክፈል" },
  noPaymentMethods: { en: "No payment methods enabled", am: "ምንም የክፍያ ዘዴ አልነቃም", om: "Malli kaffaltii hin dandeenye", ti: "ዝተነቐሐ ዓይነት ክፍሊት የለን" },
  noConfiguredAccount: { en: "No configured account", am: "የተዋቀረ መለያ የለም", om: "Herregni qophaa'e hin jiru", ti: "ዝተዳለወ ሕሳብ የለን" },
  accountNotConfigured: { en: "account not configured", am: "መለያ አልተዋቀረም", om: "herregni hin qophoofne", ti: "ሕሳብ ኣይተዳለወን" },
  loadingPaymentAccount: { en: "Loading payment account...", am: "የክፍያ መለያ በመጫን ላይ...", om: "Herrega kaffaltii fe'aa jira...", ti: "ሕሳብ ክፍሊት ይጽዓን ኣሎ..." },
  configureAccount: { en: "Configure an account in Settings.", am: "በቅንብሮች ውስጥ መለያ ያዋቅሩ።", om: "Qindaa'inoota keessatti herrega qopheessi.", ti: "ኣብ ቅንብራት ሕሳብ ኣዳልዉ።" },
  transactionReference: { en: "Transaction reference", am: "የግብይት ማጣቀሻ", om: "Wabii daldalaa", ti: "መወከሲ ግብይት" },
  recordingPayment: { en: "Recording payment...", am: "ክፍያ በመመዝገብ ላይ...", om: "Kaffaltii galmeessaa jira...", ti: "ክፍሊት ይመዝገብ ኣሎ..." },
  recordPayment: { en: "Record payment", am: "ክፍያ መዝግብ", om: "Kaffaltii galmeessi", ti: "ክፍሊት መዝግብ" },
  ordersOtherStatus: { en: "Other status", am: "ሌላ ሁኔታ", om: "Haala biroo", ti: "ካልእ ኩነታት" },
  ordersHistoryTitle: { en: "Orders history", am: "የትዕዛዞች ታሪክ", om: "Seenaa ajajawwan", ti: "ታሪኽ ትእዛዛት" },
  ordersCountLabel: { en: "orders", am: "ትዕዛዞች", om: "ajajawwan", ti: "ትእዛዛት" },
  ordersThisWeek: { en: "This week", am: "በዚህ ሳምንት", om: "Torban kana", ti: "ኣብዚ ሰሙን" },
  ordersAllHistory: { en: "All history", am: "ሁሉም ታሪክ", om: "Seenaa hunda", ti: "ኩሉ ታሪኽ" },
  ordersNoItems: { en: "No items", am: "ምንም እቃ የለም", om: "Meeshaan hin jiru", ti: "እቃ የለን" },
  ordersNoHistoryForPeriod: { en: "No orders found for this period.", am: "ለዚህ ጊዜ ምንም ትዕዛዝ አልተገኘም።", om: "Yeroo kanaaf ajajni hin argamne.", ti: "ንዚ ግዜ ትእዛዝ ኣይተረኽበን።" },
  ordersMethod: { en: "Method", am: "ዘዴ", om: "Mala", ti: "ኣገባብ" },
  ordersPaymentAt: { en: "Payment: {date}", am: "ክፍያ፦ {date}", om: "Kaffaltii: {date}", ti: "ክፍሊት፦ {date}" },
  ordersOrderAt: { en: "Order: {date}", am: "ትዕዛዝ፦ {date}", om: "Ajaja: {date}", ti: "ትእዛዝ፦ {date}" },
  ordersAmountPlaceholder: { en: "Amount", am: "መጠን", om: "Hamma", ti: "መጠን" },
  ordersCashReceivedPlaceholder: { en: "Cash received (cash only)", am: "የተቀበለ ጥሬ ገንዘብ (ጥሬ ገንዘብ ብቻ)", om: "Maallaqa fudhatame (maallaqa qofa)", ti: "ዝተቐበለ ጥረ ገንዘብ (ጥረ ገንዘብ ጥራይ)" },
  ordersReferenceOptionalPlaceholder: { en: "Reference (optional)", am: "ማጣቀሻ (አማራጭ)", om: "Wabii (dirqama miti)", ti: "መወከሲ (ኣማራጺ)" },
  ordersOrderCreated: { en: "Order created successfully.", am: "ትዕዛዙ በተሳካ ሁኔታ ተፈጥሯል።", om: "Ajajni milkaa'inaan uumameera.", ti: "ትእዛዝ ብዓወት ተፈጢሩ።" },
  ordersCreatePermissionDenied: { en: "You do not have permission to create orders.", am: "ትዕዛዝ ለመፍጠር ፈቃድ የለዎትም።", om: "Ajaja uumuuf hayyama hin qabdu.", ti: "ትእዛዝ ንምፍጣር ፍቓድ የብልኩምን።" },
  ordersPaymentPermissionDenied: { en: "You do not have permission to record payments.", am: "ክፍያ ለመመዝገብ ፈቃድ የለዎትም።", om: "Kaffaltii galmeessuuf hayyama hin qabdu.", ti: "ክፍሊት ንምምዝጋብ ፍቓድ የብልኩምን።" },
  ordersMenuQuantityRequired: { en: "Choose a menu item and a positive quantity.", am: "የምናሌ እቃ እና ከዜሮ በላይ ብዛት ይምረጡ።", om: "Meeshaa tarree nyaataa fi baay'ina zeeroo ol filadhu.", ti: "እቃ ሜኑን ካብ ዜሮ ዝዓቢ ብዝሕን ምረጹ።" },
  ordersMenuItemUnavailable: { en: "That menu item is not available.", am: "ያ የምናሌ እቃ አይገኝም።", om: "Meeshaan tarree nyaataa sun hin jiru.", ti: "እቲ እቃ ሜኑ ኣይርከብን።" },
  ordersInvalidMenuItemStation: { en: "The selected menu item has an invalid station.", am: "የተመረጠው የምናሌ እቃ ትክክለኛ ጣቢያ የለውም።", om: "Meeshaan filatame buufata sirrii hin qabu.", ti: "እቲ ዝተመርጸ እቃ ሜኑ ቅኑዕ መደብ የብሉን።" },
  ordersTableInvalid: { en: "That table does not belong to this restaurant.", am: "ያ ጠረጴዛ የዚህ ምግብ ቤት አይደለም።", om: "Minjaalli sun mana nyaataa kanaa miti.", ti: "እታ ጠረጴዛ ናይዚ ሬስቶራንት ኣይኮነትን።" },
  ordersOrderNotFound: { en: "Order not found.", am: "ትዕዛዙ አልተገኘም።", om: "Ajajni hin argamne.", ti: "ትእዛዝ ኣይተረኽበን።" },
  ordersCancelledCannotPay: { en: "Cancelled orders cannot be paid.", am: "የተሰረዙ ትዕዛዞች ሊከፈሉ አይችሉም።", om: "Ajajawwan haqaman kaffalamuu hin danda'an.", ti: "ዝተሰረዙ ትእዛዛት ክኽፈሉ ኣይኽእሉን።" },
  ordersPaymentFinalizationFailed: { en: "The order could not be marked paid.", am: "ትዕዛዙን እንደተከፈለ ምልክት ማድረግ አልተቻለም።", om: "Ajaja kaffalameera jedhanii mallatteessuun hin danda'amne.", ti: "ትእዛዝ ተኸፊሉ ኢልካ ምምልካት ኣይተኻእለን።" },
  paymentConfirmed: { en: "Payment confirmed and order marked PAID.", am: "ክፍያ ተረጋግጦ ትዕዛዙ እንደተከፈለ ተመዝግቧል።", om: "Kaffaltiin mirkanaa'ee ajajni KAFFALAMEERA jedhamee galmaa'e.", ti: "ክፍሊት ተረጋጊጹ ትእዛዝ ተኸፊሉ ተባሂሉ ተመዝጊቡ።" },
  paymentRecorded: { en: "Payment recorded.", am: "ክፍያ ተመዝግቧል።", om: "Kaffaltiin galmaa'eera.", ti: "ክፍሊት ተመዝጊቡ።" },
  unableCreateOrder: { en: "Unable to create this order.", am: "ይህን ትዕዛዝ መፍጠር አልተቻለም።", om: "Ajaja kana uumuu hin dandeenye.", ti: "ነዚ ትእዛዝ ምፍጣር ኣይተኻእለን።" },
  unableRecordPayment: { en: "Unable to record payment.", am: "ክፍያውን መመዝገብ አልተቻለም።", om: "Kaffaltii galmeessuu hin dandeenye.", ti: "ክፍሊት ምምዝጋብ ኣይተኻእለን።" },
  alreadyPaidError: { en: "This order has already been paid.", am: "ይህ ትዕዛዝ ተከፍሏል።", om: "Ajajni kun duraan kaffalameera.", ti: "እዚ ትእዛዝ ድሮ ተኸፊሉ እዩ።" },
  activePaymentExistsError: { en: "An active payment already exists for this order. Continue that attempt or resolve it before starting another.", am: "ለዚህ ትዕዛዝ ንቁ ክፍያ አለ። ሌላ ክፍያ ከመጀመርዎ በፊት ያንኑ ይቀጥሉ ወይም ይፍቱ።", om: "Ajaja kanaaf kaffaltiin hojii irra jiru jira. Kaffaltii biraa jalqabuu dura isa sana itti fufi ykn xumuri.", ti: "ንዚ ትእዛዝ ንጡፍ ክፍሊት ኣሎ። ካልእ ክፍሊት ቅድሚ ምጅማርካ ነቲ ቀጽሎ ወይ ፍታሕ።" },
  disabledPaymentError: { en: "This payment method is not enabled for this restaurant.", am: "ይህ የክፍያ ዘዴ ለዚህ ምግብ ቤት አልነቃም።", om: "Malli kaffaltii kun mana nyaataa kanaaf hin dandeenye.", ti: "እዚ ዓይነት ክፍሊት ንዚ ሬስቶራንት ኣይተነቐሐን።" },
  invalidPaymentError: { en: "Enter a valid amount and payment method.", am: "ትክክለኛ መጠን እና የክፍያ ዘዴ ያስገቡ።", om: "Hanga fi mala kaffaltii sirrii galchi.", ti: "ቅኑዕ መጠንን ዓይነት ክፍሊትን ኣእትዉ።" },
  invalidPaymentMethod: { en: "Enter a valid payment method.", am: "ትክክለኛ የክፍያ ዘዴ ያስገቡ።", om: "Mala kaffaltii sirrii galchi.", ti: "ቅኑዕ ዓይነት ክፍሊት ኣእቱ።" },
  referenceRequiredError: { en: "A transaction reference is required for this payment method.", am: "ለዚህ የክፍያ ዘዴ የግብይት ማጣቀሻ ያስፈልጋል።", om: "Mallii kaffaltii kun wabii daldalaa barbaada.", ti: "እዚ ዓይነት ክፍሊት መወከሲ ግብይት የድልዮ።" },
  cashInsufficientError: { en: "Cash received must be sufficient for the order total.", am: "የተቀበሉት ጥሬ ገንዘብ ከጠቅላላ ትዕዛዙ በቂ መሆን አለበት።", om: "Maallaqni fudhatame ida'ama ajajaa caaluu qaba.", ti: "ዝተቐበልካዮ ጥረ ገንዘብ ንጠቕላላ ትእዛዝ እኹል ክኸውን ኣለዎ።" },
  unableCreateOrder: { en: "Unable to create this order.", am: "ይህን ትዕዛዝ መፍጠር አልተቻለም።", om: "Ajaja kana uumuu hin dandeenye.", ti: "ነዚ ትእዛዝ ምፍጣር ኣይተኻእለን።" },
  emptyCartError: { en: "Add at least one item to the cart.", am: "ቢያንስ አንድ እቃ ወደ ጋሪ ይጨምሩ።", om: "Yoo xiqqaate meeshaa tokko gara gaariitti dabali.", ti: "እንተወሓደ ሓደ እቃ ናብ ጋሪ ወስኽ።" },
  invalidItemError: { en: "A cart item has an invalid price or quantity:", am: "አንድ የጋሪ እቃ ዋጋ ወይም ብዛት ትክክል አይደለም፦", om: "Meeshaan gaarii tokko gatii ykn baay'ina sirrii hin qabu:", ti: "ሓደ እቃ ጋሪ ዘይቅኑዕ ዋጋ ወይ ብዝሒ ኣለዎ፦" },
  invalidOrderTotalError: { en: "The order total must be greater than zero.", am: "ጠቅላላ የትዕዛዝ ዋጋ ከዜሮ መብለጥ አለበት።", om: "Ida'ama ajajaa zeeroo caaluu qaba.", ti: "ጠቕላላ ዋጋ ትእዛዝ ካብ ዜሮ ክዓቢ ኣለዎ።" },
  selectTableError: { en: "Select a table for dine-in orders.", am: "ለበምግብ ቤት ትዕዛዝ ጠረጴዛ ይምረጡ።", om: "Ajaja bakka nyaataaf minjaala filadhu.", ti: "ንትእዛዝ ኣብ ቤት ምግቢ ጠረጴዛ ምረጽ።" },
  staffAttendance: { en: "Staff attendance", am: "የሰራተኛ መገኘት", om: "Argama hojjetaa", ti: "ምህላው ሰራሕተኛ" },
  todaysShift: { en: "Today's shift", am: "የዛሬ ፈረቃ", om: "Jijjiirama hojii har'aa", ti: "ፈረቓ ሎሚ" },
  scheduledShift: { en: "Scheduled shift", am: "የተመደበ ፈረቃ", om: "Jijjiirama hojii ramadame", ti: "ዝተመደበ ፈረቓ" },
  noShift: { en: "No shift scheduled for today.", am: "ለዛሬ ምንም ፈረቃ አልተመደበም።", om: "Har'a jijjiiramni hojii hin ramadamne.", ti: "ንሎሚ ፈረቓ ኣይተመደበን።" },
  shift: { en: "Shift", am: "ፈረቃ", om: "Shiftii", ti: "ፈረቓ" },
  noShiftAssigned: { en: "No shift assigned", am: "ምንም ፈረቃ አልተመደበም", om: "Shiftiin hin ramadamne", ti: "ፈረቓ ኣይተመደበን" },
  clockIn: { en: "Clock In", am: "ወደ ስራ ግባ", om: "Hojii seeni", ti: "ናብ ስራሕ እቶ" },
  confirmClockIn: { en: "Confirm Clock In", am: "ወደ ስራ መግባትን ያረጋግጡ", om: "Hojii seenuu mirkaneessi", ti: "ናብ ስራሕ ምእታው ኣረጋግጽ" },
  confirmClockInDescription: { en: "Review your assigned shift before clocking in.", am: "ወደ ስራ ከመግባትዎ በፊት የተመደበዎትን ፈረቃ ይገምግሙ።", om: "Hojii seenuu kee dura shiftii siif ramadame ilaali.", ti: "ቅድሚ ናብ ስራሕ ምእታውካ ዝተመደበልካ ፈረቓ ገምግም።" },
  clockInWithoutScheduledShiftDescription: { en: "No shift is scheduled. You can still start work and your attendance will be recorded for today.", am: "ፈረቃ አልተመደበም። አሁንም ስራ መጀመር ይችላሉ፤ መገኘትዎም ለዛሬ ይመዘገባል።", om: "Shiftiin hin ramadamne. Hojii jalqabuu dandeessa; argamni kees har'aaf ni galmaa'a.", ti: "ፈረቓ ኣይተመደበን። ኣብ ስራሕ ክትጅምር ትኽእል ኢኻ፣ ህላወኻ ድማ ንሎሚ ክምዝገብ እዩ።" },
  clockingIn: { en: "Clocking In...", am: "ወደ ስራ በመግባት ላይ...", om: "Hojii seenaa jira...", ti: "ናብ ስራሕ ይኣቱ ኣሎ..." },
  clockInError: { en: "Could not clock in.", am: "ወደ ስራ መግባት አልተቻለም።", om: "Hojii seenuun hin danda'amne.", ti: "ናብ ስራሕ ምእታው ኣይተኻእለን።" },
  clockInSuccess: { en: "Clock In successful.", am: "ወደ ስራ በተሳካ ሁኔታ ገብተዋል።", om: "Hojii seenuun milkaa'eera.", ti: "ናብ ስራሕ ብዓወት ኣቲኻ።" },
  clockInNoShiftError: { en: "No scheduled shift was found for your account today.", am: "ዛሬ ለመለያዎ የተመደበ ፈረቃ አልተገኘም።", om: "Har'a herrega keetiif shiftiin ramadame hin argamne.", ti: "ንሎሚ ንሕሳብካ ዝተመደበ ፈረቓ ኣይተረኽበን።" },
  clockInAlreadyError: { en: "You are already clocked in for this shift.", am: "ለዚህ ፈረቃ አስቀድመው ገብተዋል።", om: "Shiftii kanaaf duraan hojii seenteetta.", ti: "ንዚ ፈረቓ ድሮ ኣቲኻ ኢኻ።" },
  clockInCompletedError: { en: "This shift has already been completed.", am: "ይህ ፈረቃ አስቀድሞ ተጠናቋል።", om: "Shiftiin kun duraan xumurameera.", ti: "እዚ ፈረቓ ድሮ ተወዲኡ እዩ።" },
  clockInShiftNotFoundError: { en: "This scheduled shift could not be found for your account.", am: "ይህ የተመደበ ፈረቃ ለመለያዎ አልተገኘም።", om: "Shiftiin ramadame kun herrega keetiif hin argamne.", ti: "እዚ ዝተመደበ ፈረቓ ንሕሳብካ ኣይተረኽበን።" },
  attendanceMembershipError: { en: "Active staff membership was not found for this restaurant.", am: "ለዚህ ምግብ ቤት ንቁ የሰራተኛ አባልነት አልተገኘም።", om: "Miseensi hojjetaa mana nyaataa kanaa hojii irra jiru hin argamne.", ti: "ንዚ ሬስቶራንት ኣክቲቭ ኣባልነት ሰራሕተኛ ኣይተረኽበን።" },
  clockInLateError: { en: "Clock In is unavailable because the scheduled start time has already passed. This shift is marked late.", am: "የተመደበው መጀመሪያ ሰዓት ስላለፈ ወደ ስራ መግባት አይቻልም። ይህ ፈረቃ ዘግይቷል ተብሎ ተመዝግቧል።", om: "Yeroon jalqabaa ramadame waan darbeef hojii seenuun hin danda'amu. Shiftiin kun tureera jedhamee mallatteeffameera.", ti: "ግዜ መጀመርታ ስለ ዝሓለፈ ናብ ስራሕ ምእታው ኣይከኣልን። እዚ ፈረቓ ደንጒዩ ተባሂሉ ተመዝጊቡ።" },
  inventoryApproval: { en: "Management approval", am: "የአስተዳደር ማጽደቂያ", om: "Mirkaneessa bulchiinsaa", ti: "ምጽዳቕ ምሕደራ" },
  inventoryRequests: { en: "Inventory requests", am: "የእቃ ጥያቄዎች", om: "Gaaffilee inventarii", ti: "ሕቶታት እቃ" },
  item: { en: "Item", am: "እቃ", om: "Meeshaa", ti: "እቃ" },
  requestedBy: { en: "Requested by", am: "የጠየቀው", om: "Kan gaafate", ti: "ዝሓተተ" },
  station: { en: "Station", am: "ጣቢያ", om: "Buufata", ti: "መደብ" },
  requestDate: { en: "Request date", am: "የጥያቄ ቀን", om: "Guyyaa gaaffii", ti: "ዕለት ሕቶ" },
  reason: { en: "Reason", am: "ምክንያት", om: "Sababa", ti: "ምኽንያት" },
  approve: { en: "Approve", am: "አጽድቅ", om: "Mirkaneessi", ti: "ኣጽድቕ" },
  reject: { en: "Reject", am: "ውድቅ አድርግ", om: "Kufisi", ti: "ንጸግ" },
  noPendingInventoryRequests: { en: "No pending inventory requests.", am: "ምንም ያልተጠናቀቁ የእቃ ጥያቄዎች የሉም።", om: "Gaaffiin inventarii eeggataa hin jiru.", ti: "ዝጽበ ዘሎ ሕቶ እቃ የለን።" },
  clockOut: { en: "Clock Out", am: "ከስራ ውጣ", om: "Hojii ba'i", ti: "ካብ ስራሕ ውጻእ" },
  clockingOut: { en: "Clocking Out...", am: "ከስራ በመውጣት ላይ...", om: "Hojii keessaa ba'aa jira...", ti: "ካብ ስራሕ ይወጽእ ኣሎ..." },
  clockOutNotClockedInError: { en: "You must clock in before you can clock out.", am: "ከስራ ከመውጣትዎ በፊት ወደ ስራ መግባት አለብዎት።", om: "Hojii keessaa ba'uu kee dura hojii seenuu qabda.", ti: "ካብ ስራሕ ቅድሚ ምውጻእካ ናብ ስራሕ ክትኣቱ ኣለካ።" },
  clockOutAlreadyError: { en: "You are already clocked out for this shift.", am: "ከዚህ ፈረቃ አስቀድመው ወጥተዋል።", om: "Shiftii kana keessaa duraan baateetta.", ti: "ካብዚ ፈረቓ ድሮ ወጺእካ ኢኻ።" },
  clockedIn: { en: "CLOCKED IN", am: "ስራ ጀምሯል", om: "HOJII EEGALEERA", ti: "ስራሕ ጀሚሩ" },
  clockedOut: { en: "CLOCKED OUT", am: "ስራ አቁሟል", om: "HOJII DHAABEERA", ti: "ስራሕ ወዲኡ" },
  clockedInAt: { en: "Clocked in", am: "ስራ የጀመረበት ሰዓት", om: "Yeroo hojii eegale", ti: "ግዜ ስራሕ ዝጀመረሉ" },
  clockedOutAt: { en: "Clocked out", am: "ስራ ያቆመበት ሰዓት", om: "Yeroo hojii dhaabe", ti: "ግዜ ስራሕ ዘቋረጸሉ" },
  onDuty: { en: "ON DUTY", am: "በስራ ላይ", om: "HOJII IRRA JIRA", ti: "ኣብ ስራሕ ኣሎ" },
  late: { en: "LATE", am: "ዘግይቷል", om: "TURAA" , ti: "ደንጒዩ" },
  offDuty: { en: "OFF DUTY", am: "ከስራ ውጭ", om: "HOJII IRRA HIN JIRU", ti: "ካብ ስራሕ ወጻኢ" },
  kitchen: { en: "KITCHEN", am: "ኩሽና", om: "KUSHIINAA", ti: "ኩሽና" },
  bar: { en: "BAR", am: "ባር", om: "BAAR", ti: "ባር" },
  signupEyebrow: {
    en: "CLIENT ONBOARDING",
    am: "የደንበኛ ምዝገባ",
    om: "GALMEE MAAMILAA",
    ti: "ምዝገባ ዓማዊል",
  },
  signupTitle: {
    en: "Create your",
    am: "የእርስዎን",
    om: "Iddoo",
    ti: "ናትኩም",
  },
  signupTitleAccent: {
    en: "workspace.",
    am: "የስራ ቦታ ይፍጠሩ።",
    om: "hojii keessanii uumaa.",
    ti: "ቦታ ስራሕ ፍጠሩ።",
  },
  signupDescription: {
    en: "Set up your business workspace with a verified email.",
    am: "የንግድ የስራ ቦታዎን በተረጋገጠ ኢሜይል ያዘጋጁ።",
    om: "Iddoo hojii daldalaa keessanii imeelii mirkanaa'een qopheessaa.",
    ti: "ቦታ ስራሕ ንግድኹም ብዝተረጋገጸ ኢመይል ኣዳልዉ።",
  },
  fullName: {
    en: "Full name",
    am: "ሙሉ ስም",
    om: "Maqaa guutuu",
    ti: "ምሉእ ስም",
  },
  restaurantName: {
    en: "Restaurant name",
    am: "የምግብ ቤት ስም",
    om: "Maqaa mana nyaataa",
    ti: "ስም ቤት ምግቢ",
  },
  requiredField: {
    en: "is required.",
    am: "ያስፈልጋል።",
    om: "barbaachisaa dha.",
    ti: "የድሊ እዩ።",
  },
  invalidEmail: {
    en: "Please enter a valid email address.",
    am: "እባክዎ ትክክለኛ ኢሜይል ያስገቡ።",
    om: "Maaloo teessoo imeelii sirrii galchi.",
    ti: "በጃኹም ቅኑዕ ኣድራሻ ኢመይል ኣእትዉ።",
  },
  passwordLength: {
    en: "Password must be at least 6 characters.",
    am: "የይለፍ ቃል ቢያንስ 6 ቁምፊዎች ሊኖሩት ይገባል።",
    om: "Jechi darbii yoo xiqqaate arfiilee 6 qabaachuu qaba.",
    ti: "መሕለፊ ቃል እንተወሓደ 6 ፊደላት ክህልዎ ኣለዎ።",
  },
  businessType: {
    en: "Business type",
    am: "የንግድ አይነት",
    om: "Gosa daldalaa",
    ti: "ዓይነት ንግዲ",
  },
  businessCategory: {
    en: "Business category",
    am: "የንግድ ምድብ",
    om: "Ramaddii daldalaa",
    ti: "ምድብ ንግዲ",
  },
  businessName: {
    en: "Business name",
    am: "የንግድ ስም",
    om: "Maqaa daldalaa",
    ti: "ስም ንግዲ",
  },
  businessNamePlaceholder: {
    en: "Addis Habesha PLC",
    am: "Addis Habesha PLC",
    om: "Addis Habesha PLC",
    ti: "Addis Habesha PLC",
  },
  businessLegalNameHelper: {
    en: "Use the legal or registered name. It is separate from the name shown to customers.",
    am: "ሕጋዊ ወይም የተመዘገበውን ስም ይጠቀሙ። ለደንበኞች ከሚታየው ስም የተለየ ነው።",
    om: "Maqaa seeraan galmaa'e fayyadami. Maqaa maamiltootaaf mul'atu irraa adda.",
    ti: "እቲ ብሕጊ ዝተመዝገበ ስም ተጠቐም። ካብቲ ንዓማዊል ዝርአ ስም ዝተፈልየ እዩ።",
  },
  restaurantDisplayName: {
    en: "Restaurant name",
    am: "የምግብ ቤት ስም",
    om: "Maqaa mana nyaataa",
    ti: "ስም ቤት ምግቢ",
  },
  cafeDisplayName: {
    en: "Cafe name",
    am: "የካፌ ስም",
    om: "Maqaa kaafee",
    ti: "ስም ካፌ",
  },
  hotelDisplayName: {
    en: "Hotel name",
    am: "የሆቴል ስም",
    om: "Maqaa hoteelaa",
    ti: "ስም ሆቴል",
  },
  otherBusinessDisplayName: {
    en: "Business display name",
    am: "የንግድ ማሳያ ስም",
    om: "Maqaa mul'ataa daldalaa",
    ti: "ስም ማሳያ ንግዲ",
  },
  businessDisplayNameHelper: {
    en: "This is the public name shown to customers.",
    am: "ይህ ለደንበኞች የሚታየው የንግድ ስም ነው።",
    om: "Kun maqaa daldalaa maamiltootaaf mul'atu dha.",
    ti: "እዚ ንዓማዊል ዝርአ ስም ንግዲ እዩ።",
  },
  restaurantDisplayNamePlaceholder: {
    en: "Addis Habesha Restaurant",
    am: "Addis Habesha ምግብ ቤት",
    om: "Addis Habesha Mana nyaataa",
    ti: "Addis Habesha ቤት ምግቢ",
  },
  cafeDisplayNamePlaceholder: {
    en: "Addis Habesha Cafe",
    am: "Addis Habesha ካፌ",
    om: "Addis Habesha Kaafee",
    ti: "Addis Habesha ካፌ",
  },
  hotelDisplayNamePlaceholder: {
    en: "Addis Habesha Hotel",
    am: "Addis Habesha ሆቴል",
    om: "Addis Habesha Hoteela",
    ti: "Addis Habesha ሆቴል",
  },
  otherBusinessDisplayNamePlaceholder: {
    en: "Addis Habesha Business",
    am: "Addis Habesha ንግድ",
    om: "Addis Habesha Daldala",
    ti: "Addis Habesha ንግዲ",
  },
  ownerName: {
    en: "Owner name",
    am: "የባለቤት ስም",
    om: "Maqaa abbaa qabeenyaa",
    ti: "ስም ወናኒ",
  },
  ownerNamePlaceholder: {
    en: "Owner Full Name",
    am: "የባለቤቱ ሙሉ ስም",
    om: "Maqaa guutuu abbaa qabeenyaa",
    ti: "ምሉእ ስም ወናኒ",
  },
  ownerEmail: {
    en: "Owner email",
    am: "የባለቤት ኢሜይል",
    om: "Imeelii abbaa qabeenyaa",
    ti: "ኢመይል ወናኒ",
  },
  ownerEmailPlaceholder: {
    en: "you@gmail.com",
    am: "you@gmail.com",
    om: "you@gmail.com",
    ti: "you@gmail.com",
  },
  businessCategoryInvalid: {
    en: "Choose a supported business category.",
    am: "የሚደገፍ የንግድ ምድብ ይምረጡ።",
    om: "Ramaddii daldalaa deeggarame filadhu.",
    ti: "ዝድገፍ ምድብ ንግዲ ምረጹ።",
  },
  businessNameRequired: {
    en: "Business name is required.",
    am: "የንግድ ስም ያስፈልጋል።",
    om: "Maqaan daldalaa barbaachisaa dha.",
    ti: "ስም ንግዲ የድሊ እዩ።",
  },
  ownerEmailRequired: {
    en: "An authenticated owner email is required.",
    am: "የተረጋገጠ የባለቤት ኢሜይል ያስፈልጋል።",
    om: "Imeelii abbaa qabeenyaa mirkanaa'e barbaachisa.",
    ti: "ናይ ወናኒ ዝተረጋገጸ ኢመይል የድሊ እዩ።",
  },
  ownerEmailExampleNotAllowed: {
    en: "Enter the owner's real email address, not the example placeholder.",
    am: "ከምሳሌ የተቀመጠውን ሳይሆን የባለቤቱን እውነተኛ ኢሜይል ያስገቡ።",
    om: "Imeelii dhugaa abbaa qabeenyaa galchi; fakkeenya bakka bu'aa hin galchin.",
    ti: "ናይ ወናኒ ናይ ሓቂ ኢመይል ኣእቱ፤ እቲ ኣብነት ቦታ ዝሕዝ ኣይኮነን።",
  },
  businessNameTooLong: {
    en: "Business name is too long.",
    am: "የንግድ ስም ከመጠን በላይ ረጅም ነው።",
    om: "Maqaan daldalaa baay'ee dheeraa dha.",
    ti: "ስም ንግዲ ኣዝዩ ነዊሕ እዩ።",
  },
  businessDisplayNameRequired: {
    en: "Business display name is required.",
    am: "የንግድ ማሳያ ስም ያስፈልጋል።",
    om: "Maqaan mul'ataa daldalaa barbaachisaa dha.",
    ti: "ስም ማሳያ ንግዲ የድሊ እዩ።",
  },
  businessDisplayNameTooLong: {
    en: "Business display name is too long.",
    am: "የንግድ ማሳያ ስም ከመጠን በላይ ረጅም ነው።",
    om: "Maqaan mul'ataa daldalaa baay'ee dheeraa dha.",
    ti: "ስም ማሳያ ንግዲ ኣዝዩ ነዊሕ እዩ።",
  },
  businessRestaurant: {
    en: "Restaurant",
    am: "ምግብ ቤት",
    om: "Mana nyaataa",
    ti: "ቤት ምግቢ",
  },
  businessCafe: {
    en: "Cafe",
    am: "ካፌ",
    om: "Kaafee",
    ti: "ካፌ",
  },
  businessHotel: {
    en: "Hotel",
    am: "ሆቴል",
    om: "Hoteela",
    ti: "ሆቴል",
  },
  businessOtherFoodService: {
    en: "Other Business",
    am: "ሌላ ንግድ",
    om: "Daldala biraa",
    ti: "ካልእ ንግዲ",
  },
  showPasswordSignup: {
    en: "Show",
    am: "አሳይ",
    om: "Agarsiisi",
    ti: "ኣርእይ",
  },
  hidePasswordSignup: {
    en: "Hide",
    am: "ደብቅ",
    om: "Dhoksi",
    ti: "ሓብእ",
  },
  createWorkspace: {
    en: "Create workspace",
    am: "የስራ ቦታ ይፍጠሩ",
    om: "Iddoo hojii uumi",
    ti: "ቦታ ስራሕ ፍጠር",
  },
  creatingWorkspace: {
    en: "Creating workspace...",
    am: "የስራ ቦታ በመፍጠር ላይ...",
    om: "Iddoo hojii uumaa jira...",
    ti: "ቦታ ስራሕ ይፍጠር ኣሎ...",
  },
  alreadyHaveAccess: {
    en: "Already have access?",
    am: "አስቀድመው መዳረሻ አለዎት?",
    om: "Duraan seensa qabdaa?",
    ti: "ድሮ መእተዊ ኣለኩምዶ?",
  },
  login: {
    en: "Login",
    am: "ግባ",
    om: "Seeni",
    ti: "እቶ",
  },
  signupVerifyEmail: {
    en: "Check your email to verify your account, then sign in to finish setting up your restaurant.",
    am: "መለያዎን ለማረጋገጥ ኢሜይልዎን ይመልከቱ፣ ከዚያም የምግብ ቤትዎን ማዘጋጀት ለመጨረስ ይግቡ።",
    om: "Herrega kee mirkaneessuuf imeelii kee ilaali, sana booda mana nyaataa kee qopheessuu xumuruuf seeni.",
    ti: "ሕሳብኩም ንምርግጋጽ ኢመይልኩም ርኣዩ፣ ድሕሪኡ ምድላው ሬስቶራንትኩም ንምዝዛም እተዉ።",
  },
  signupError: {
    en: "Unable to create your account right now. Please try again.",
    am: "አሁን መለያዎን መፍጠር አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
    om: "Amma herrega kee uumuu hin dandeenye. Maaloo irra deebi'ii yaali.",
    ti: "ሕጂ ሕሳብኩም ምፍጣር ኣይተኻእለን። በጃኹም እንደገና ፈትኑ።",
  },
  restaurantCreationError: {
    en: "Your restaurant could not be created.",
    am: "የምግብ ቤትዎ ሊፈጠር አልቻለም።",
    om: "Manni nyaataa kee uumamuu hin dandeenye.",
    ti: "ሬስቶራንትኩም ክፍጠር ኣይከኣለን።",
  },
  signupBack: {
    en: "← ADDIS RMS",
    am: "← ADDIS RMS",
    om: "← ADDIS RMS",
    ti: "← ADDIS RMS",
  },

  loginEyebrow: {
    en: "RESTAURANT OPERATIONS",
    am: "የምግብ ቤት ስራ አስተዳደር",
    om: "HOJII MANA NYAATAA",
    ti: "ምሕደራ ንጥፈታት ሬስቶራንት",
  },
  loginTagline: {
    en: "RUN SMARTER. GROW FASTER.",
    am: "በብልሃት ይስሩ። በፍጥነት ያድጉ።",
    om: "OGUMMAAN HOJJADHU. ARIITIIN GUDDADHU.",
    ti: "ብብልሓት ስራሕ። ብፍጥነት ዓቢ።",
  },
  welcomeBack: {
    en: "Welcome back.",
    am: "እንኳን ደህና መጡ።",
    om: "Baga nagaan dhuftan.",
    ti: "እንቋዕ ብደሓን መጻእኩም።",
  },
  loginDescription: {
    en: "Sign in to your restaurant workspace and keep your operations moving.",
    am: "ወደ የምግብ ቤትዎ የስራ ቦታ ይግቡ እና ስራዎን ያስቀጥሉ።",
    om: "Iddoo hojii mana nyaataa keessaniitti seenaatii hojii keessan itti fufsiisaa.",
    ti: "ናብ ቦታ ስራሕ ሬስቶራንትኩም እተዉ እሞ ንጥፈታትኩም ቀጽሉ።",
  },
  restaurantEmail: {
    en: "Restaurant email",
    am: "የምግብ ቤት ኢሜይል",
    om: "Imeelii mana nyaataa",
    ti: "ኢመይል ቤት ምግቢ",
  },
  emailPlaceholder: {
    en: "you@restaurant.com",
    am: "you@restaurant.com",
    om: "you@restaurant.com",
    ti: "you@restaurant.com",
  },
  passwordPlaceholder: {
    en: "Enter your password",
    am: "የይለፍ ቃልዎን ያስገቡ",
    om: "Jecha darbii kee galchi",
    ti: "መሕለፊ ቃልኩም ኣእትዉ",
  },
  rememberMe: {
    en: "Remember me",
    am: "አስታውሰኝ",
    om: "Na yaadadhu",
    ti: "ዘክረኒ",
  },
  secureLogin: {
    en: "SECURE LOGIN",
    am: "ደህንነቱ የተጠበቀ መግቢያ",
    om: "SEENSA EEGUMSAA",
    ti: "ውሑስ መእተዊ",
  },
  showPassword: {
    en: "Show password",
    am: "የይለፍ ቃል አሳይ",
    om: "Jecha darbii agarsiisi",
    ti: "መሕለፊ ቃል ኣርእይ",
  },
  hidePassword: {
    en: "Hide password",
    am: "የይለፍ ቃል ደብቅ",
    om: "Jecha darbii dhoksi",
    ti: "መሕለፊ ቃል ሓብእ",
  },
  authorizedStaff: {
    en: "Authorized restaurant staff only.",
    am: "ለተፈቀደላቸው የምግብ ቤት ሰራተኞች ብቻ።",
    om: "Hojjettoota mana nyaataa hayyamaman qofaaf.",
    ti: "ንዝተፈቕደሎም ሰራሕተኛታት ቤት ምግቢ ጥራይ።",
  },
  staffLogin: {
    en: "Staff Login",
    am: "የሰራተኛ መግቢያ",
    om: "Seensa hojjetaa",
    ti: "መእተዊ ሰራሕተኛ",
  },
  staffLoginDescription: {
    en: "Sign in to your restaurant workspace.",
    am: "ወደ የምግብ ቤትዎ የስራ ቦታ ይግቡ።",
    om: "Iddoo hojii mana nyaataa keessaniitti seenaa.",
    ti: "ናብ ቦታ ስራሕ ሬስቶራንትኩም እተዉ።",
  },
  adminOwnerLogin: {
    en: "Admin / Owner Login",
    am: "የአስተዳዳሪ / ባለቤት መግቢያ",
    om: "Seensa Admin / Abbaa qabeenyaa",
    ti: "መእተዊ Admin / Owner",
  },
  confirmEmailError: {
    en: "Please confirm your email before signing in.",
    am: "ከመግባትዎ በፊት ኢሜይልዎን ያረጋግጡ።",
    om: "Seenuu kee dura imeelii kee mirkaneessi.",
    ti: "ቅድሚ ምእታውኩም ኢመይልኩም ኣረጋግጹ።",
  },
  restaurantInactive: {
    en: "This restaurant is inactive. Contact ADDIS RMS platform support.",
    am: "ይህ የምግብ ቤት ንቁ አይደለም። የADDIS RMS መድረክ ድጋፍን ያነጋግሩ።",
    om: "Manni nyaataa kun hojii irra hin jiru. Deeggarsa waltajjii ADDIS RMS qunnami.",
    ti: "እዚ ሬስቶራንት ንጡፍ ኣይኮነን። ደገፍ መድረኽ ADDIS RMS ርኸቡ።",
  },
  emailVerified: {
    en: "Email verified. Sign in to finish setting up your workspace.",
    am: "ኢሜይልዎ ተረጋግጧል። የስራ ቦታዎን ለማዘጋጀት ይግቡ።",
    om: "Imeeliin kee mirkanaa'eera. Iddoo hojii kee xumuruuf seeni.",
    ti: "ኢመይልኩም ተረጋጊጹ። ቦታ ስራሕኩም ንምዝዛም እተዉ።",
  },
  verificationLinkInvalid: {
    en: "This verification link is invalid or expired. Sign in if your email is already verified, or request a new link.",
    am: "ይህ የማረጋገጫ ሊንክ ልክ ያልሆነ ወይም ጊዜው ያለፈበት ነው። ኢሜይልዎ ከተረጋገጠ ይግቡ፣ ካልሆነ አዲስ ሊንክ ይጠይቁ።",
    om: "Linkiin mirkaneessaa kun sirrii miti ykn yeroon isaa darbeera. Imeeliin kee yoo mirkanaa'e seeni; yoo hin taane linkii haaraa gaafadhu.",
    ti: "እዚ መረጋገጺ ሊንክ ቅኑዕ ኣይኮነን ወይ ግዜኡ ሓሊፉ። ኢመይልኩም እንተተረጋጊጹ እተዉ፣ እንተዘይኮይኑ ሓድሽ ሊንክ ሕተቱ።",
  },
  invalidLoginError: {
    en: "Invalid email or password.",
    am: "ልክ ያልሆነ ኢሜይል ወይም የይለፍ ቃል።",
    om: "Imeelii ykn jecha darbii sirrii miti.",
    ti: "ኢመይል ወይ መሕለፊ ቃል ቅኑዕ ኣይኮነን።",
  },
  signInError: {
    en: "Unable to sign in right now. Please try again.",
    am: "አሁን መግባት አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
    om: "Amma seenuun hin danda'amu. Maaloo irra deebi'ii yaali.",
    ti: "ሕጂ ምእታው ኣይተኻእለን። በጃኹም እንደገና ፈትኑ።",
  },
  sessionError: {
    en: "Unable to establish your session right now.",
    am: "አሁን ክፍለ ጊዜዎን ማስጀመር አልተቻለም።",
    om: "Amma yeroo seensaa kee hundeessuun hin danda'amu.",
    ti: "ሕጂ ክፍለ ጊዜኹም ምትካል ኣይተኻእለን።",
  },
  accountLoadError: {
    en: "Your account could not be loaded correctly.",
    am: "መለያዎ በትክክል ሊጫን አልቻለም።",
    om: "Herregni kee sirriitti fe'amuu hin dandeenye.",
    ti: "ሕሳብኩም ብትኽክል ክጽዓን ኣይከኣለን።",
  },
  workspaceCreationError: {
    en: "Your restaurant workspace could not be created.",
    am: "የምግብ ቤትዎ የስራ ቦታ ሊፈጠር አልቻለም።",
    om: "Iddoon hojii mana nyaataa kee uumamuu hin dandeenye.",
    ti: "ቦታ ስራሕ ሬስቶራንትኩም ክፍጠር ኣይከኣለን።",
  },
  unauthorizedRoleError: {
    en: "This account is not connected to an authorized restaurant role.",
    am: "ይህ መለያ ከተፈቀደ የምግብ ቤት ሚና ጋር አልተገናኘም።",
    om: "Herregni kun gahee mana nyaataa hayyamame waliin wal hin qabatu.",
    ti: "እዚ ሕሳብ ምስ ዝተፈቕደ ግደ ሬስቶራንት ኣይተራኸበን።",
  },
  membershipAmbiguous: {
    en: "This account is connected to multiple restaurants. Contact support to resolve access.",
    am: "ይህ መለያ ከብዙ የምግብ ቤቶች ጋር ተገናኝቷል። መዳረሻውን ለማስተካከል ድጋፍን ያነጋግሩ።",
    om: "Herregni kun mana nyaataa hedduu waliin walqabateera. Seensa sirreessuuf deeggarsa qunnamaa.",
    ti: "እዚ ሕሳብ ምስ ብዙሓት ሬስቶራንታት ተራኺቡ ኣሎ። መእተዊ ንምፍታሕ ደገፍ ርኸቡ።",
  },
  expiredSessionError: {
    en: "Your session has expired. Please sign in again.",
    am: "የክፍለ ጊዜዎ አብቅቷል። እባክዎ እንደገና ይግቡ።",
    om: "Yeroon seensaa kee darbeera. Maaloo irra deebi'ii seeni.",
    ti: "ክፍለ ጊዜኹም ኣብቂዑ። በጃኹም እንደገና እተዉ።",
  },

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

  history: {
    en: "History",
    am: "ታሪክ",
    om: "Seenaa",
    ti: "ታሪኽ",
  },

  historyRestaurantActivity: { en: "Restaurant activity across orders, payments, stock, and stations.", am: "በትዕዛዞች፣ ክፍያዎች፣ እቃዎች እና ጣቢያዎች ያለው የምግብ ቤት እንቅስቃሴ።", om: "Sochii mana nyaataa ajajawwan, kaffaltii, kuusaa fi buufatawwan hunda keessatti.", ti: "ንጥፈታት ሬስቶራንት ኣብ ትእዛዛት፣ ክፍሊት፣ ክዛናን መደባትን።" },
  historyTotalRecords: { en: "Total records", am: "ጠቅላላ መዝገቦች", om: "Ida'ama galmeewwanii", ti: "ጠቕላላ መዝገባታት" },
  historyTotalOrders: { en: "Total orders", am: "ጠቅላላ ትዕዛዞች", om: "Ida'ama ajajawwan", ti: "ጠቕላላ ትእዛዛት" },
  historyStockRequests: { en: "Stock requests", am: "የእቃ ጥያቄዎች", om: "Gaaffilee kuusaa", ti: "ሕቶታት ክዛና" },
  historyStockMovements: { en: "Stock movements", am: "የእቃ እንቅስቃሴዎች", om: "Sochii kuusaa", ti: "ምንቅስቓስ ክዛና" },
  historyPayments: { en: "Payments", am: "ክፍያዎች", om: "Kaffaltiiwwan", ti: "ክፍሊታት" },
  historyRevenue: { en: "Revenue", am: "ገቢ", om: "Galii", ti: "እቶት" },
  historyKitchenActivity: { en: "Kitchen activity", am: "የኩሽና እንቅስቃሴ", om: "Sochii kushiinaa", ti: "ንጥፈት ኩሽና" },
  historyBarActivity: { en: "Bar activity", am: "የባር እንቅስቃሴ", om: "Sochii baarii", ti: "ንጥፈት ባር" },
  historyLast7Days: { en: "Last 7 days", am: "ያለፉት 7 ቀናት", om: "Guyyoota 7 darban", ti: "ዝሓለፉ 7 መዓልታት" },
  historyWeek: { en: "Week {number}", am: "ሳምንት {number}", om: "Torban {number}", ti: "ሰሙን {number}" },
  historyMonth: { en: "Month {number}", am: "ወር {number}", om: "Ji'a {number}", ti: "ወርሒ {number}" },
  historyYearOne: { en: "Year 1", am: "ዓመት 1", om: "Waggaa 1", ti: "ዓመት 1" },
  historyYear: { en: "Year", am: "ዓመት", om: "Waggaa", ti: "ዓመት" },
  historyApplyYear: { en: "Apply year", am: "ዓመቱን ተግብር", om: "Waggaa hojii irra oolchi", ti: "ዓመት ተግብር" },
  historyFrom: { en: "From", am: "ከ", om: "Irraa", ti: "ካብ" },
  historyTo: { en: "To", am: "እስከ", om: "Hanga", ti: "ክሳብ" },
  historyRecordType: { en: "Record type", am: "የመዝገብ አይነት", om: "Gosa galmee", ti: "ዓይነት መዝገብ" },
  historyAllRecords: { en: "All records", am: "ሁሉም መዝገቦች", om: "Galmeewwan hunda", ti: "ኩሎም መዝገባታት" },
  historyStockMovement: { en: "Stock movement", am: "የእቃ እንቅስቃሴ", om: "Sochii kuusaa", ti: "ምንቅስቓስ ክዛና" },
  historyStockRequest: { en: "Stock request", am: "የእቃ ጥያቄ", om: "Gaaffii kuusaa", ti: "ሕቶ ክዛና" },
  historyTypeStation: { en: "Station", am: "ጣቢያ", om: "Buufata", ti: "መደብ" },
  historyAllStations: { en: "All stations", am: "ሁሉም ጣቢያዎች", om: "Buufatawwan hunda", ti: "ኩሎም መደባት" },
  historyKitchenLabel: { en: "Kitchen", am: "ኩሽና", om: "Kushiinaa", ti: "ኩሽና" },
  historyBarLabel: { en: "Bar", am: "ባር", om: "Baar", ti: "ባር" },
  historyApplyFilters: { en: "Apply filters", am: "ማጣሪያዎችን ተግብር", om: "Calaltuu hojii irra oolchi", ti: "መጻረዪታት ተግብር" },
  historyClear: { en: "Clear", am: "አጽዳ", om: "Qulqulleessi", ti: "ኣጽርይ" },
  historyAuditTrail: { en: "AUDIT TRAIL", am: "የኦዲት መዝገብ", om: "GALMEE SAKATTA'IINSAA", ti: "መዝገብ ኦዲት" },
  historyRecentActivity: { en: "Recent activity", am: "የቅርብ ጊዜ እንቅስቃሴ", om: "Sochii dhihoo", ti: "ናይ ቀረባ ንጥፈት" },
  historyRecordsPerSource: { en: "Up to {limit} records per source", am: "ከእያንዳንዱ ምንጭ እስከ {limit} መዝገቦች", om: "Madda tokko irraa galmeewwan hanga {limit}", ti: "ካብ ነፍሲ ወከፍ ምንጪ ክሳብ {limit} መዝገባታት" },
  historySearchPlaceholder: { en: "Order, item, note, reference", am: "ትዕዛዝ፣ እቃ፣ ማስታወሻ፣ ማጣቀሻ", om: "Ajaja, meeshaa, yaadannoo, wabii", ti: "ትእዛዝ፣ እቃ፣ መዘኻኸሪ፣ መወከሲ" },
  historyStatusPlaceholder: { en: "Enter a status", am: "ሁኔታ ያስገቡ", om: "Haala galchi", ti: "ኩነታት ኣእቱ" },
  historyNoRecordsMatch: { en: "No records match these filters.", am: "ከእነዚህ ማጣሪያዎች ጋር የሚዛመድ መዝገብ የለም።", om: "Galmeen calaltuuwwan kanaan walsimu hin jiru.", ti: "ምስዞም መጻረዪታት ዝሰማማዕ መዝገብ የለን።" },
  historyTryClearingFilters: { en: "Try clearing a filter or widening the date range.", am: "ማጣሪያ ያጽዱ ወይም የቀን ክልሉን ያስፉ።", om: "Calaltuu haqi ykn daangaa guyyaa bal'isi.", ti: "መጻረዪ ኣጽርይ ወይ ክልል ዕለት ኣስፍሕ።" },
  historyNoHistoryYet: { en: "No history yet.", am: "እስካሁን ታሪክ የለም።", om: "Hanga ammaatti seenaa hin jiru.", ti: "ክሳብ ሕጂ ታሪኽ የለን።" },
  historyActivityAppears: { en: "Activity will appear here as your restaurant operates.", am: "ምግብ ቤትዎ ሲሰራ እንቅስቃሴዎች እዚህ ይታያሉ።", om: "Yeroo manni nyaataa keessan hojjetu sochiin asitti mul'ata.", ti: "ሬስቶራንትኩም እና ዝሰርሕ ንጥፈታት ኣብዚ ክርአ እዩ።" },
  historySummary: { en: "History summary", am: "የታሪክ ማጠቃለያ", om: "Cuunfaa seenaa", ti: "ሓፈሻዊ ታሪኽ" },
  historyOpen: { en: "Open", am: "ክፈት", om: "Bani", ti: "ክፈት" },
  historyWorkflow: { en: "workflow", am: "የስራ ሂደት", om: "adeemsa hojii", ti: "ስርዓት ስራሕ" },
  historyOperationalRecord: { en: "Kitchen / Bar operational record", am: "የኩሽና / ባር የስራ መዝገብ", om: "Galmee hojii kushiinaa / baarii", ti: "መዝገብ ስራሕ ኩሽና / ባር" },
  historyInventoryItem: { en: "Inventory item", am: "የእቃ ንጥል", om: "Meeshaa kuusaa", ti: "እቃ ክዛና" },
  historyStaffMember: { en: "Staff member", am: "የሰራተኛ አባል", om: "Miseensa hojjetaa", ti: "ኣባል ሰራሕተኛ" },
  historyNoNote: { en: "No note", am: "ማስታወሻ የለም", om: "Yaadannoon hin jiru", ti: "መዘኻኸሪ የለን" },
  historyNoReason: { en: "No reason", am: "ምክንያት የለም", om: "Sababni hin jiru", ti: "ምኽንያት የለን" },
  historyCreatedLabel: { en: "Created", am: "የተፈጠረ", om: "Kan uumame", ti: "ዝተፈጥረ" },
  historyUpdatedLabel: { en: "Updated", am: "የተዘመነ", om: "Kan haaromfame", ti: "ዝተሓደሰ" },
  historyStatusRecorded: { en: "Recorded", am: "ተመዝግቧል", om: "Galmaa'eera", ti: "ተመዝጊቡ" },
  historyBankTransferMethod: { en: "Bank transfer", am: "የባንክ ዝውውር", om: "Dabarsa baankii", ti: "ምትሕልላፍ ባንኪ" },
  historyStatusConfirmed: { en: "Confirmed", am: "የተረጋገጠ", om: "Mirkanaa'e", ti: "ዝተረጋገጸ" },
  historyStatusServed: { en: "Served", am: "የቀረበ", om: "Dhiyaateera", ti: "ቀሪቡ" },
  historyStatusCancelled: { en: "Cancelled", am: "የተሰረዘ", om: "Haqameera", ti: "ተሰሪዙ" },
  historyStatusPaid: { en: "Paid", am: "የተከፈለ", om: "Kaffalameera", ti: "ዝተኸፍለ" },
  historyStatusPending: { en: "Pending", am: "በመጠባበቅ ላይ", om: "Eegaa jira", ti: "ይጽበ ኣሎ" },
  historyStatusFailed: { en: "Failed", am: "ያልተሳካ", om: "Hin milkoofne", ti: "ኣይተሳኸዐን" },
  historyStatusRefunded: { en: "Refunded", am: "ተመላሽ የተደረገ", om: "Deebi'eera", ti: "ተመሊሱ" },
  historyStatusApproved: { en: "Approved", am: "የጸደቀ", om: "Mirkanaa'e", ti: "ዝጸደቐ" },
  historyStatusRejected: { en: "Rejected", am: "ውድቅ የተደረገ", om: "Kufameera", ti: "ተነጺጉ" },
  historyStatusFulfilled: { en: "Fulfilled", am: "የተሟላ", om: "Guutameera", ti: "ተፈጺሙ" },
  historyMovementAddStock: { en: "Stock added", am: "እቃ ተጨምሯል", om: "Kuusaan dabalameera", ti: "ክዛና ተወሲኹ" },
  historyMovementUsage: { en: "Usage", am: "አጠቃቀም", om: "Fayyadama", ti: "ኣጠቓቕማ" },
  historyMovementAdjustment: { en: "Adjustment", am: "ማስተካከያ", om: "Sirreeffama", ti: "ምትዕርራይ" },
  historyMovementTransfer: { en: "Transfer", am: "ዝውውር", om: "Dabarsa", ti: "ምትሕልላፍ" },
  historyMovementReturn: { en: "Return", am: "መመለስ", om: "Deebisuu", ti: "ምምላስ" },
  historyMovementWaste: { en: "Waste", am: "ብክነት", om: "Badiisa", ti: "ብኽነት" },

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
  historyQuantitySold: { en: "Quantity sold", am: "የተሸጠ ብዛት", om: "Baay'ina gurgurame", ti: "ዝተሸጠ ብዝሒ" },
  historyTotalSales: { en: "Total sales", am: "ጠቅላላ ሽያጭ", om: "Ida'ama gurgurtaa", ti: "ጠቕላላ መሸጣ" },
  historyNoSalesData: { en: "No sales data", am: "የሽያጭ መረጃ የለም", om: "Odeeffannoon gurgurtaa hin jiru", ti: "ሓበሬታ መሸጣ የለን" },

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
    ti: "በዓል ቤት",
  },

  roleMANAGER: {
    en: "Manager",
    am: "ስራ አስኪያጅ",
    om: "Bulchaa",
    ti: "ኣማሓዳሪ",
  },

  roleSERVER: {
    en: "Server",
    am: "አገልጋይ",
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
    om: "Tajaajilaa Baarii",
    ti: "ኣገልጋሊ ባር",
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

  "Staff management": { en: "Staff management", am: "የሰራተኞች አስተዳደር", om: "Bulchiinsa hojjettootaa", ti: "ምሕደራ ሰራሕተኛታት" },
  "Staff access": { en: "Staff access", am: "የሰራተኛ መዳረሻ", om: "Seensa hojjetaa", ti: "መእተዊ ሰራሕተኛ" },
  "Team operations": { en: "Team operations", am: "የቡድን ስራዎች", om: "Hojii garee", ti: "ንጥፈታት ጉጅለ" },
  "Staff & shifts": { en: "Staff & shifts", am: "ሰራተኞች እና ፈረቃዎች", om: "Hojjettootaa fi shiftii", ti: "ሰራሕተኛታትን ፈረቓታትን" },
  "Total staff": { en: "Total staff", am: "ጠቅላላ ሰራተኞች", om: "Ida'ama hojjettootaa", ti: "ጠቕላላ ሰራሕተኛታት" },
  "Restaurant team": { en: "Restaurant team", am: "የምግብ ቤት ቡድን", om: "Garee mana nyaataa", ti: "ጉጅለ ሬስቶራንት" },
  "On duty": { en: "On duty", am: "በስራ ላይ", om: "HOJII IRRA JIRA", ti: "ኣብ ስራሕ ላይ" },
  "Working right now": { en: "Working right now", am: "አሁን በስራ ላይ", om: "Amma hojii irra jira", ti: "ሕጂ ኣብ ስራሕ ኣሎ" },
  "Off duty": { en: "Off duty", am: "ከስራ ውጪ", om: "HOJII IRRA HIN JIRU", ti: "ካብ ስራሕ ወጻኢ" },
  "Not currently working": { en: "Not currently working", am: "አሁን በስራ ላይ አይደሉም", om: "Amma hojii irra hin jiru", ti: "ሕጂ ኣብ ስራሕ የለን" },
  "Today's team": { en: "Today's team", am: "የዛሬ ቡድን", om: "Garee har'aa", ti: "ጉጅለ ሎሚ" },
  "Staff schedule": { en: "Staff schedule", am: "የሰራተኞች መርሃ ግብር", om: "Sagantaa hojjettootaa", ti: "መደብ ሰራሕተኛታት" },
  "Actions": { en: "Actions", am: "ድርጊቶች", om: "Gochaalee", ti: "ተግባራት" },
  "No shift": { en: "No shift", am: "ፈረቃ የለም", om: "Shiftiin hin jiru", ti: "ፈረቃ የለን" },
  "No date": { en: "No date", am: "ቀን የለም", om: "Guyyaan hin jiru", ti: "ዕለት የለን" },
  "staff": { en: "staff", am: "ሰራተኞች", om: "hojjettoota", ti: "ሰራሕተኛታት" },
  "Restaurant": { en: "Restaurant", am: "ምግብ ቤት", om: "Mana nyaataa", ti: "ቤት ምግቢ" },
  "A staff member must be selected.": { en: "A staff member must be selected.", am: "አንድ ሰራተኛ መመረጥ አለበት።", om: "Hojjetaan tokko filatamuu qaba.", ti: "ሓደ ሰራሕተኛ ክምረጽ ኣለዎ።" },
  "Shift date, start time and end time are required.": { en: "Shift date, start time and end time are required.", am: "የፈረቃ ቀን፣ መጀመሪያ እና መጨረሻ ሰዓት ያስፈልጋሉ።", om: "Guyyaa shiftii, yeroo jalqabaa fi xumuraa barbaachisaa dha.", ti: "ዕለት ፈረቓ፣ ግዜ መጀመርታን መወዳእታን የድሊ።" },
  "Shift end time must be later than start time.": { en: "Shift end time must be later than start time.", am: "የፈረቃ መጨረሻ ሰዓት ከመጀመሪያው በኋላ መሆን አለበት።", om: "Yeroon xumuraa yeroo jalqabaa booda ta'uu qaba.", ti: "ግዜ መወዳእታ ፈረቓ ድሕሪ ግዜ መጀመርታ ክኸውን ኣለዎ።" },
  "Full name is required.": { en: "Full name is required.", am: "ሙሉ ስም ያስፈልጋል።", om: "Maqaan guutuun barbaachisaa dha.", ti: "ምሉእ ስም የድሊ እዩ።" },
  "Email is required.": { en: "Email is required.", am: "ኢሜይል ያስፈልጋል።", om: "Imeeliin barbaachisaa dha.", ti: "ኢመይል የድሊ እዩ።" },
  "Password must be at least 6 characters.": { en: "Password must be at least 6 characters.", am: "የይለፍ ቃል ቢያንስ 6 ቁምፊዎች ሊኖሩት ይገባል።", om: "Jechi darbii yoo xiqqaate arfiilee 6 qabaachuu qaba.", ti: "መሕለፊ ቃል እንተወሓደ 6 ፊደላት ክህልዎ ኣለዎ።" },
  "Invalid staff role.": { en: "Invalid staff role.", am: "ልክ ያልሆነ የሰራተኛ ሚና።", om: "Gahee hojjetaa sirrii miti.", ti: "ዘይቅኑዕ ሚና ሰራሕተኛ።" },
  "Selected staff member was not found in this restaurant.": { en: "Selected staff member was not found in this restaurant.", am: "የተመረጠው ሰራተኛ በዚህ ምግብ ቤት አልተገኘም።", om: "Miseensi hojjetaa filatame mana nyaataa kana keessatti hin argamne.", ti: "እቲ ዝተመርጸ ኣባል ሰራሕተኛ ኣብዚ ሬስቶራንት ኣይተረኽበን።" },
  "You must clock in before you can clock out.": { en: "You must clock in before you can clock out.", am: "ከስራ ለመውጣት መጀመሪያ ወደ ስራ መግባት አለብዎት።", om: "Hojii ba'uuf dura hojii seenuu qabda.", ti: "ካብ ስራሕ ንምውጻእ ቅድሚኡ ናብ ስራሕ ክትኣቱ ኣለካ።" },
  "This shift has already been clocked out.": { en: "This shift has already been clocked out.", am: "ይህ ፈረቃ ቀድሞ ተጠናቋል።", om: "Shiftiin kun duraan xumurameera.", ti: "እዚ ፈረቓ ድሮ ተወዲኡ እዩ።" },
  "No staff members found.": { en: "No staff members found.", am: "ምንም ሰራተኛ አልተገኘም።", om: "Hojjetaan hin argamne.", ti: "ሰራሕተኛ ኣይተረኽበን።" },
  "Staff unavailable": { en: "Staff unavailable", am: "ሰራተኞች አይገኙም", om: "Hojjettoonni hin jiran", ti: "ሰራሕተኛታት የለዉን" },
  "Sign in to continue": { en: "Sign in to continue", am: "ለመቀጠል ይግቡ", om: "Itti fufuuf seeni", ti: "ንምቕጻል እቶ" },
  "Access not granted": { en: "Access not granted", am: "መዳረሻ አልተሰጠም", om: "Seensi hin kennamne", ti: "መእተዊ ኣይተዋህበን" },
  "Supabase connected": { en: "Supabase connected", am: "Supabase ተገናኝቷል", om: "Supabase walqabateera", ti: "Supabase ተራኺቡ" },
  "Main navigation": { en: "Main navigation", am: "ዋና ማሰሻ", om: "Qajeelcha ijoo", ti: "ቀንዲ ምርሓ" },
  "Server": { en: "Server", am: "አገልጋይ", om: "Tajaajilaa", ti: "ኣገልጋሊ" },
  "Owner": { en: "Owner", am: "ባለቤት", om: "Abbaa qabeenyaa", ti: "በዓል ቤት" },
  "Manager": { en: "Manager", am: "ስራ አስኪያጅ", om: "Bulchaa", ti: "ኣመሓዳሪ" },
  "Chef": { en: "Chef", am: "ሼፍ", om: "Qopheessaa", ti: "ሼፍ" },
  "Barman": { en: "Barman", am: "ባርማን", om: "Tajaajilaa Baarii", ti: "ኣገልጋሊ ባር" },
  "LATE": { en: "LATE", am: "ዘግይቷል", om: "TURAA", ti: "ደንጒዩ" },
  "ON DUTY": { en: "ON DUTY", am: "በስራ ላይ", om: "HOJII IRRA JIRA", ti: "ኣብ ስራሕ ላይ" },
  "OFF DUTY": { en: "OFF DUTY", am: "ከስራ ውጪ", om: "HOJII IRRA HIN JIRU", ti: "ካብ ስራሕ ወጻኢ" },
  "Clock In": { en: "Clock In", am: "ወደ ስራ ግባ", om: "Hojii seeni", ti: "ናብ ስራሕ እቶ" },
  "Clock Out": { en: "Clock Out", am: "ከስራ ውጣ", om: "Hojii ba'i", ti: "ካብ ስራሕ ውጻእ" },
  "Shift": { en: "Shift", am: "ፈረቃ", om: "Shiftii", ti: "ፈረቓ" },
  "Status": { en: "Status", am: "ሁኔታ", om: "Haala", ti: "ኩነታት" },
  "Role": { en: "Role", am: "ሚና", om: "Gahee", ti: "ሚና" },
  "Edit": { en: "Edit", am: "አስተካክል", om: "Gulaali", ti: "ኣስተኻኽል" },
  "Cancel": { en: "Cancel", am: "ሰርዝ", om: "Haqi", ti: "ሰርዝ" },
  "Could not load staff data.": { en: "Could not load staff data.", am: "የሰራተኞች መረጃ መጫን አልተቻለም።", om: "Daataa hojjettootaa fe'uu hin dandeenye.", ti: "ሓበሬታ ሰራሕተኛታት ምጽዓን ኣይተኻእለን።" },
  "Your Supabase session is not active.": { en: "Your Supabase session is not active.", am: "የSupabase ክፍለ ጊዜዎ ንቁ አይደለም።", om: "Yeroon Supabase kee hojii irra hin jiru.", ti: "ናይ Supabase ክፍለ ግዜኻ ንጡፍ ኣይኮነን።" },
  "Your account is not connected to a restaurant.": { en: "Your account is not connected to a restaurant.", am: "መለያዎ ከምግብ ቤት ጋር አልተገናኘም።", om: "Herregni kee mana nyaataa waliin wal hin qabanne.", ti: "ሕሳብካ ምስ ሬስቶራንት ኣይተራኸበን።" },
  "You must be signed in.": { en: "You must be signed in.", am: "እባክዎ ይግቡ።", om: "Maaloo seeni.", ti: "በጃኹም እተዉ።" },
  "No shift": { en: "No shift", am: "ፈረቃ የለም", om: "Shiftiin hin jiru", ti: "ፈረቃ የለን" },

  "MENU MANAGEMENT": {
    en: "MENU MANAGEMENT",
    am: "የምናሌ አስተዳደር",
    om: "BULCHIINSA TARREE NYAATAA",
    ti: "ምሕደራ ሜኑ",
  },
  "Add menu item": { en: "Add menu item", am: "የምናሌ እቃ ጨምር", om: "Meeshaa tarree nyaataa dabali", ti: "እቃ ሜኑ ወስኽ" },
  "← Overview": { en: "← Overview", am: "← አጠቃላይ እይታ", om: "← Cuunfaa", ti: "← ሓፈሻዊ ርእይቶ" },
  "CATEGORY": { en: "CATEGORY", am: "ምድብ", om: "RAMADDII", ti: "ምድብ" },
  "MENU ITEM": { en: "MENU ITEM", am: "እቃ ምናሌ", om: "MEESHAA TARREE NYAATAA", ti: "እቃ ሜኑ" },
  "Add food or drink": { en: "Add food or drink", am: "ምግብ ወይም መጠጥ ጨምር", om: "Nyaata ykn dhugaatii dabali", ti: "ምግቢ ወይ መስተ ወስኽ" },
  "Name": { en: "Name", am: "ስም", om: "Maqaa", ti: "ስም" },
  "Category": { en: "Category", am: "ምድብ", om: "Ramaddii", ti: "ምድብ" },
  "Price (ETB)": { en: "Price (ETB)", am: "ዋጋ (ETB)", om: "Gatii (ETB)", ti: "ዋጋ (ETB)" },
  "Preparation station": { en: "Preparation station", am: "የዝግጅት ጣቢያ", om: "Buufata qophii", ti: "ቦታ ምድላው" },
  "Description": { en: "Description", am: "መግለጫ", om: "Ibsa", ti: "መግለጺ" },
  "Add category": { en: "Add category", am: "ምድብ ጨምር", om: "Ramaddii dabali", ti: "ምድብ ወስኽ" },
  "Edit menu item": { en: "Edit menu item", am: "የምናሌ እቃ አስተካክል", om: "Meeshaa tarree nyaataa gulaali", ti: "እቃ ሜኑ ኣስተኻኽል" },
  "Delete item": { en: "Delete item", am: "እቃ ሰርዝ", om: "Meeshaa haqi", ti: "እቃ ደምስስ" },
  "Save changes": { en: "Save changes", am: "ለውጦችን አስቀምጥ", om: "Jijjiirama kuusi", ti: "ለውጢ ዓቅብ" },
  "Availability": { en: "Availability", am: "መገኘት", om: "Argama", ti: "ምህላው" },
  "No menu items yet.": { en: "No menu items yet.", am: "እስካሁን ምንም የምናሌ እቃ የለም።", om: "Hanga ammaatti meeshaaleen tarree nyaataa hin jiran.", ti: "ክሳብ ሕጂ እቃታት ሜኑ የለዉን።" },
  "Food and drink catalog.": {
    en: "Food and drink catalog.",
    am: "የምግብ እና የመጠጥ ዝርዝር።",
    om: "Tarree nyaataa fi dhugaatii.",
    ti: "ዝርዝር መግቢን መስተን።",
  },
  "Category name": { en: "Category name", am: "የምድብ ስም", om: "Maqaa ramaddii", ti: "ስም ምድብ" },
  "Main Dishes": { en: "Main Dishes", am: "ዋና ምግቦች", om: "Nyaata ijoo", ti: "ቀንዲ ምግብታት" },
  "Doro Wot": { en: "Doro Wot", am: "ዶሮ ወጥ", om: "Doro Wot", ti: "ዶሮ ወጥ" },
  "Traditional Ethiopian chicken stew": { en: "Traditional Ethiopian chicken stew", am: "ባህላዊ የኢትዮጵያ ዶሮ ወጥ", om: "Wot lukkuu aadaa Itoophiyaa", ti: "ባህላዊ ኢትዮጵያዊ ወጥ ዶሮ" },
  "Photo — JPG / JPEG only": { en: "Photo — JPG / JPEG only", am: "ፎቶ — JPG / JPEG ብቻ", om: "Suura — JPG / JPEG qofa", ti: "ስእሊ — JPG / JPEG ጥራይ" },
  "Photo — JPG/JPEG": { en: "Photo — JPG/JPEG", am: "ፎቶ — JPG/JPEG", om: "Suura — JPG/JPEG", ti: "ስእሊ — JPG/JPEG" },
  "Kitchen": { en: "Kitchen", am: "ኩሽና", om: "Mana nyaataa", ti: "ክሽነ" },
  "Bar": { en: "Bar", am: "ባር", om: "Baarii", ti: "ባር" },
  "Unavailable": { en: "Unavailable", am: "አይገኝም", om: "Hin argamu", ti: "የለን" },
  "NO IMAGE": { en: "NO IMAGE", am: "ምስል የለም", om: "SUURA HIN JIRU", ti: "ስእሊ የለን" },
  "No description added.": { en: "No description added.", am: "መግለጫ አልተጨመረም።", om: "Ibsi hin dabalamin.", ti: "መግለጺ ኣይተወሰኸን።" },
  "Uncategorized": { en: "Uncategorized", am: "ምድብ የሌለው", om: "Ramaddii hin qabne", ti: "ምድብ ዘይብሉ" },
  "Replace photo — JPG/JPEG": { en: "Replace photo — JPG/JPEG", am: "ፎቶ ቀይር — JPG/JPEG", om: "Suura bakka buusi — JPG/JPEG", ti: "ስእሊ ተካእ — JPG/JPEG" },
  "You must be signed in.": { en: "You must be signed in.", am: "እባክዎ ይግቡ።", om: "Maaloo seeni.", ti: "በጃኹም እተዉ።" },
  "Restaurant membership not found.": { en: "Restaurant membership not found.", am: "የምግብ ቤት አባልነት አልተገኘም።", om: "Miseensummaan mana nyaataa hin argamne.", ti: "ኣባልነት ሬስቶራንት ኣይተረኽበን።" },
  "You do not have permission to create categories.": { en: "You do not have permission to create categories.", am: "ምድቦችን ለመፍጠር ፈቃድ የለዎትም።", om: "Ramaddii uumuuf hayyama hin qabdu.", ti: "ምድባት ንምፍጣር ፍቓድ የብልኩምን።" },
  "Category name is required.": { en: "Category name is required.", am: "የምድብ ስም ያስፈልጋል።", om: "Maqaan ramaddii barbaachisaa dha.", ti: "ስም ምድብ የድሊ እዩ።" },
  "You do not have permission to create menu items.": { en: "You do not have permission to create menu items.", am: "የምናሌ እቃዎችን ለመፍጠር ፈቃድ የለዎትም።", om: "Meeshaalee tarree nyaataa uumuuf hayyama hin qabdu.", ti: "እቃታት ሜኑ ንምፍጣር ፍቓድ የብልኩምን።" },
  "Food name is required.": { en: "Food name is required.", am: "የምግብ ስም ያስፈልጋል።", om: "Maqaan nyaataa barbaachisaa dha.", ti: "ስም ምግቢ የድሊ እዩ።" },
  "Price must be a valid amount.": { en: "Price must be a valid amount.", am: "ዋጋው ትክክለኛ መጠን መሆን አለበት።", om: "Gatiin hamma sirrii ta'uu qaba.", ti: "ዋጋ ቅኑዕ መጠን ክኸውን ኣለዎ።" },
  "Choose a valid preparation station.": { en: "Choose a valid preparation station.", am: "ትክክለኛ የዝግጅት ጣቢያ ይምረጡ።", om: "Buufata qophii sirrii filadhu.", ti: "ቅኑዕ ቦታ ምድላው ምረጽ።" },
  "You do not have permission to edit menu items.": { en: "You do not have permission to edit menu items.", am: "የምናሌ እቃዎችን ለማስተካከል ፈቃድ የለዎትም።", om: "Meeshaalee tarree nyaataa gulaaluuf hayyama hin qabdu.", ti: "እቃታት ሜኑ ንምስትኽኻል ፍቓድ የብልኩምን።" },
  "Menu item and name are required.": { en: "Menu item and name are required.", am: "የምናሌ እቃ እና ስም ያስፈልጋሉ።", om: "Meeshaa tarree nyaataa fi maqaan barbaachisaa dha.", ti: "እቃ ሜኑን ስምን የድሊ።" },
  "You do not have permission to delete menu items.": { en: "You do not have permission to delete menu items.", am: "የምናሌ እቃዎችን ለመሰረዝ ፈቃድ የለዎትም።", om: "Meeshaalee tarree nyaataa haquuf hayyama hin qabdu.", ti: "እቃታት ሜኑ ንምድምሳስ ፍቓድ የብልኩምን።" },
  "Menu item ID is required.": { en: "Menu item ID is required.", am: "የምናሌ እቃ ID ያስፈልጋል።", om: "IDn meeshaa tarree nyaataa barbaachisaa dha.", ti: "ID እቃ ሜኑ የድሊ እዩ።" },

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

  "NEW": {
    en: "NEW",
    am: "አዲስ",
    om: "HAARAA",
    ti: "ሓድሽ",
  },

  "PREPARING": {
    en: "PREPARING",
    am: "በዝግጅት ላይ",
    om: "QOPHAA'AA JIRA",
    ti: "ይዳሎ ኣሎ",
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
    ti: "ኣብ ስራሕ ላይ",
  },

  "OFF DUTY": {
    en: "OFF DUTY",
    am: "ከስራ ውጪ",
    om: "HOJII IRRA HIN JIRU",
    ti: "ካብ ስራሕ ወጻኢ",
  },

  landingNavFeatures: { en: "Features", am: "ባህሪያት", om: "Amaloota", ti: "ባህርያት" },
  landingNavWhy: { en: "Why ADDIS RMS", am: "ለምን ADDIS RMS", om: "Maaliif ADDIS RMS", ti: "ስለምንታይ ADDIS RMS" },
  landingNavTrial: { en: "7-day trial", am: "7 ቀናት ሙከራ", om: "Qormaata guyyaa 7", ti: "7 መዓልታት ፈተነ" },
  landingNavPricing: { en: "Pricing", am: "ዋጋ", om: "Gatii", ti: "ዋጋ" },
  landingNavContact: { en: "Contact", am: "አግኙን", om: "Nu qunnami", ti: "ርኸቡና" },
  landingKicker: { en: "RESTAURANT OPERATIONS / MADE IN ETHIOPIA", am: "የምግብ ቤት ስራ / በኢትዮጵያ የተሰራ", om: "HOJII MANA NYAATAA / ITOOPHIYAA KEESSATTI HOJJETAME", ti: "ንጥፈታት ሬስቶራንት / ኣብ ኢትዮጵያ ዝተሰርሐ" },
  landingSlogan: { en: "RUN SMARTER. GROW FASTER.", am: "በብልሃት ይስሩ። በፍጥነት ያድጉ።", om: "OGUMMAAN HOJJADHU. ARIITIIN GUDDADHU.", ti: "ብብልሓት ስራሕ። ብፍጥነት ዓቢ።" },
  landingLede: { en: "One connected operating system for restaurants, hotels, cafés and food-service teams.", am: "ለሬስቶራንቶች፣ ሆቴሎች፣ ካፌዎች እና የምግብ አገልግሎት ቡድኖች አንድ የተገናኘ ስርዓት።", om: "Sirna hojii walitti hidhame tokko mana nyaataa, hoteelaa, kaafee fi garee tajaajila nyaataaf.", ti: "ንሬስቶራንታት፣ ሆቴላት፣ ካፌታትን ጉጅለታት ኣገልግሎት ምግብን ዝኸውን ሓደ ዝተራኸበ ስርዓት።" },
  landingStart: { en: "Start 7-day trial", am: "7 ቀናት ሙከራ ይጀምሩ", om: "Qormaata guyyaa 7 jalqabi", ti: "7 መዓልታት ፈተነ ጀምር" },
  landingDemo: { en: "Request a demo", am: "ማሳያ ይጠይቁ", om: "Agarsiisa gaafadhu", ti: "ማሳያ ሕተት" },
  landingLogin: { en: "Login", am: "ግባ", om: "Seeni", ti: "እቶ" },
  landingWhat: { en: "WHAT IS ADDIS RMS?", am: "ADDIS RMS ምንድነው?", om: "ADDIS RMS MAALI?", ti: "ADDIS RMS እንታይ እዩ?" },
  landingConnected: { en: "Make every shift feel connected.", am: "እያንዳንዱ የስራ ፈረቃ የተገናኘ እንዲሰማ ያድርጉ።", om: "Jijjiirama hojii hunda walitti hidhame godhi.", ti: "ኩሉ ፈረቓ ስራሕ ዝተራኸበ ክመስል ግበሮ።" },
  landingWhatBody: { en: "ADDIS RMS connects front-of-house, kitchen, bar, inventory, staff, payments, tables, orders and reports in one focused workspace.", am: "ADDIS RMS የፊት ቢሮን፣ ኩሽናን፣ ባርን፣ እቃ አስተዳደርን፣ ሰራተኞችን፣ ክፍያዎችን፣ ጠረጴዛዎችን፣ ትዕዛዞችን እና ሪፖርቶችን ያገናኛል።", om: "ADDIS RMS fuula tajaajilaa, kushiinaa, baar, kuusaa, hojjettoota, kaffaltii, minjaalota, ajajawwan fi gabaasa walitti qaba.", ti: "ADDIS RMS ኣገልግሎት ቅድሚት፣ ኩሽና፣ ባር፣ ክዛና፣ ሰራሕተኛታት፣ ክፍሊት፣ ጠረጴዛታት፣ ትእዛዛትን ጸብጻባትን የራኽብ።" },
  landingInside: { en: "WHAT'S INSIDE ADDIS RMS V10", am: "በADDIS RMS V10 ውስጥ ምን አለ?", om: "ADDIS RMS V10 KEESSA MAAL JIRA?", ti: "ኣብ ADDIS RMS V10 እንታይ ኣሎ?" },
  landingWhy: { en: "WHY CHOOSE ADDIS RMS", am: "ለምን ADDIS RMS?", om: "MAALIIF ADDIS RMS FILATTU?", ti: "ስለምንታይ ADDIS RMS?" },
  landingBusiness: { en: "BUILT FOR YOUR BUSINESS", am: "ለንግድዎ የተሰራ", om: "DHAABBATAA KEESSANIIF HOJJETAME", ti: "ንንግድኹም ዝተሰርሐ" },
  landingFirstOrder: { en: "From the first order to the last table.", am: "ከመጀመሪያው ትዕዛዝ እስከ መጨረሻው ጠረጴዛ።", om: "Ajaja jalqabaa irraa hanga minjaala dhumaatti.", ti: "ካብ መጀመርታ ትእዛዝ ክሳብ መወዳእታ ጠረጴዛ።" },
  landingTrial: { en: "START WITH ROOM TO GROW", am: "ለእድገት ቦታ ይጀምሩ", om: "BAKKA GUDDINAATIIN JALQABI", ti: "ብቦታ ዕቤት ጀምር" },
  landingFree: { en: "7 DAYS FREE.", am: "7 ቀናት ነፃ።", om: "GUYYAA 7 BILISA.", ti: "7 መዓልቲ ነጻ።" },
  landingPricing: { en: "PRICING", am: "ዋጋ", om: "GATII", ti: "ዋጋ" },
  landingContact: { en: "REQUEST A DEMO / CONTACT", am: "ማሳያ ይጠይቁ / ያግኙን", om: "AGARSIISA GAAFADHU / NU QUNNAMI", ti: "ማሳያ ሕተት / ርኸቡና" },
  landingTalk: { en: "Let's talk operations.", am: "ስለ ስራዎች እንነጋገር።", om: "Waa'ee hojii haa mari'annu.", ti: "ብዛዕባ ንጥፈታት ንዘራረብ።" },
  landingContactBody: { en: "Contact ADDIS RMS for onboarding, support and product questions.", am: "ለመጀመር፣ ለድጋፍ እና ለምርት ጥያቄዎች ADDIS RMSን ያግኙ።", om: "Jalqabaa, deeggarsaa fi gaaffii oomishaaf ADDIS RMS qunnami.", ti: "ንምጅማር፣ ደገፍን ሕቶ ፍርያትን ADDIS RMS ርኸቡ።" },
  contactPhone: { en: "Phone", am: "ስልክ", om: "Bilbila", ti: "ተሌፎን" },
  contactEmail: { en: "Email", am: "ኢሜይል", om: "Imeelii", ti: "ኢመይል" },
  contactTelegram: { en: "Telegram", am: "ቴሌግራም", om: "Telegram", ti: "ቴሌግራም" },
  contactInstagram: { en: "Instagram", am: "ኢንስታግራም", om: "Instagram", ti: "ኢንስታግራም" },
  contactTikTok: { en: "TikTok", am: "ቲክቶክ", om: "TikTok", ti: "ቲክቶክ" },
  landingMonthly: { en: "MONTHLY", am: "ወርሃዊ", om: "JI'AA", ti: "ወርሓዊ" },
  landingAnnual: { en: "ANNUAL", am: "ዓመታዊ", om: "WAGGAA", ti: "ዓመታዊ" },
  landingContactUs: { en: "Contact us", am: "ያግኙን", om: "Nu qunnami", ti: "ርኸቡና" },
  landingMade: { en: "Made in Ethiopia.", am: "በኢትዮጵያ የተሰራ።", om: "Itoophiyaa keessatti hojjetame.", ti: "ኣብ ኢትዮጵያ ዝተሰርሐ።" },
  landingFooterCredit: { en: "Produced by @Review Addis", am: "በ @Review Addis የተዘጋጀ", om: "Kan @Review Addis qopheesse", ti: "ብ @Review Addis ዝተዳለወ" },
  landingFooterVersion: { en: "ADDIS RMS V10", am: "ADDIS RMS V10", om: "ADDIS RMS V10", ti: "ADDIS RMS V10" },
  landingFooterRights: { en: "All rights reserved.", am: "መብቶች በሙሉ የተጠበቁ ናቸው።", om: "Mirgoonni hundi eegamaniiru.", ti: "ኩሎም መሰላት ተሓልዮም።" },
  featureDashboard: { en: "DASHBOARD & OVERVIEW", am: "ዳሽቦርድ እና አጠቃላይ እይታ", om: "DASHBOORDII FI CUUNFAA", ti: "ዳሽቦርድን ሓፈሻዊ ርእይቶን" },
  featureDashboardBody: { en: "Today's sales, orders, operations, last 7 days and best-selling information.", am: "የዛሬ ሽያጭ፣ ትዕዛዞች፣ ስራዎች፣ ያለፉት 7 ቀናት እና ተወዳጅ ምርቶች።", om: "Gurgurtaa har'aa, ajajawwan, hojii, guyyoota 7 darban fi odeeffannoo gurgurtaa olaanaa.", ti: "መሸጣ ሎሚ፣ ትእዛዛት፣ ንጥፈታት፣ ዝሓለፉ 7 መዓልታትን ሓበሬታ ዝሽየጥ ንብረትን።" },
  featurePos: { en: "SERVER POS", am: "የሰርቨር POS", om: "SERVER POS", ti: "SERVER POS" },
  featurePosBody: { en: "Tables, menu, cart, DINE_IN, TAKEAWAY and DELIVERY in one service flow.", am: "ጠረጴዛዎች፣ ምናሌ፣ ጋሪ፣ በሬስቶራንት፣ ውጭ ሽያጭ እና ማድረስ።", om: "Minjaalota, tarree nyaataa, gaarii, DINE_IN, TAKEAWAY fi DELIVERY.", ti: "ጠረጴዛታት፣ ሜኑ፣ ጋሪ፣ DINE_IN፣ TAKEAWAYን DELIVERYን።" },
  featureKitchen: { en: "KITCHEN + BAR", am: "ኩሽና + ባር", om: "KUSHIINAA FI BAAR", ti: "ኩሽናን ባርን" },
  featureKitchenBody: { en: "Station routing with NEW to PREPARING to COMPLETED workflows and realtime updates.", am: "የጣቢያ ማዘዣ ከአዲስ ወደ ዝግጅት ወደ ተጠናቀቀ እና ቀጥታ ማሻሻያዎች።", om: "Qajeelfama buufataa NEW irraa PREPARING hanga COMPLETED fi haaromsa yeroo ammaa.", ti: "መስመር ጣቢያ ካብ NEW ናብ PREPARING ክሳብ COMPLETED ምስ ቀጥታዊ ሓደሳ።" },
  featureInventory: { en: "INVENTORY", am: "እቃ አስተዳደር", om: "KUUSAA", ti: "ክዛና" },
  featureInventoryBody: { en: "Chef and Barman Add Stock, Admin and Manager View Stock, low-stock monitoring and audit history.", am: "ሼፍ እና ባርማን እቃ ይጨምራሉ፣ አድሚን እና ማናጀር ያያሉ፣ ዝቅተኛ እቃ ክትትል።", om: "Chef fi Barman kuusaa dabalu, Admin fi Manager kuusaa ilaalu, hordoffii fi seenaa.", ti: "Chefን Barmanን ክዛና ይውስኹ፣ Adminን Managerን ይርእዩ፣ ክትትልን ታሪኽን።" },
  featureStaff: { en: "STAFF", am: "ሰራተኞች", om: "HOJJETTOOTA", ti: "ሰራሕተኛታት" },
  featureStaffBody: { en: "Staff management, editing, shifts and persisted ON DUTY / OFF DUTY state.", am: "የሰራተኞች አስተዳደር፣ ማስተካከያ፣ ፈረቃ እና በስራ ላይ/ከስራ ውጭ ሁኔታ።", om: "Bulchiinsa, gulaalaa, jijjiirama hojii fi ON DUTY / OFF DUTY.", ti: "ምምሕዳር ሰራሕተኛ፣ ምስትኽኻል፣ ፈረቓን ON DUTY / OFF DUTYን።" },
  featurePayments: { en: "PAYMENTS", am: "ክፍያዎች", om: "KAFFALTII", ti: "ክፍሊት" },
  featurePaymentsBody: { en: "Cash, Telebirr and BANK_TRANSFER with manual references and cash change.", am: "ጥሬ ገንዘብ፣ ቴሌብር እና የባንክ ማስተላለፍ ከማጣቀሻ እና ተመላሽ ገንዘብ ጋር።", om: "Maallaqa, Telebirr fi BANK_TRANSFER ragaa harkaan galmeessuu fi jijjiirama maallaqaa.", ti: "ጥረ ገንዘብ፣ Telebirrን BANK_TRANSFERን ምስ ማጣቀሲን ለውጢ ገንዘብን።" },
  benefitOne: { en: "ONE OPERATING SYSTEM", am: "አንድ የስራ ስርዓት", om: "SIRNA HOJII TOKKO", ti: "ሓደ ስርዓት ስራሕ" },
  benefitOneBody: { en: "Run orders, kitchen, bar, inventory, staff and payments in one place.", am: "ትዕዛዝ፣ ኩሽና፣ ባር፣ እቃ፣ ሰራተኞች እና ክፍያዎችን በአንድ ቦታ ያስኬዱ።", om: "Ajaja, kushiinaa, baar, kuusaa, hojjettoota fi kaffaltii bakka tokkotti gaggeessi.", ti: "ትእዛዝ፣ ኩሽና፣ ባር፣ ክዛና፣ ሰራሕተኛታትን ክፍሊትን ብሓደ ቦታ ምሓዝ።" },
  benefitTwo: { en: "REAL-TIME OPERATIONS", am: "ቀጥታ ስራዎች", om: "HOJII YEROO AMMAA", ti: "ቀጥታዊ ንጥፈታት" },
  benefitTwoBody: { en: "Keep front-of-house and production teams connected.", am: "የፊት ቢሮን እና የምርት ቡድኖችን ተገናኝተው ያቆዩ።", om: "Garee fuula tajaajilaa fi oomishaa walitti hidhi.", ti: "ጉጅለ ቅድሚትን ምርትን ተራኺቦም ኣቆይ።" },
  benefitThree: { en: "ROLE-BASED ACCESS", am: "በሚና የተመሰረተ መዳረሻ", om: "SEENSA GAHEE IRRATTI HUNDAA'E", ti: "መእተዊ ብሚና" },
  benefitThreeBody: { en: "Each role sees the tools relevant to its work.", am: "እያንዳንዱ ሚና ለስራው የሚያስፈልጉትን መሳሪያዎች ያያል።", om: "Gaheen hundi meeshaalee hojii isaaf barbaachisan ilaala.", ti: "ነፍሲ ወከፍ ሚና ንስራሑ ዝምልከቱ መሳርሒታት ይርእዮም።" },
  benefitFour: { en: "MULTI-RESTAURANT READY", am: "ለብዙ ሬስቶራንቶች ዝግጁ", om: "MANA NYAATAA HEDDUUF QOPHAA'E", ti: "ንብዙሓት ሬስቶራንታት ድሉው" },
  benefitFourBody: { en: "Restaurant-level data isolation is built into the operating model.", am: "የሬስቶራንት ደረጃ የመረጃ መለያየት በስርዓቱ ውስጥ ተገንብቷል።", om: "Addaan bahuun daataa mana nyaataa sirna hojii keessatti ijaarameera.", ti: "ምፍላይ ሓበሬታ ሬስቶራንት ኣብ ስርዓት ስራሕ ተሃኒጹ ኣሎ።" },
  benefitFive: { en: "BUILT FOR ETHIOPIAN OPERATIONS", am: "ለኢትዮጵያ ስራዎች የተሰራ", om: "HOJII ITOOPHIYAAFIIF HOJJETAME", ti: "ንኢትዮጵያዊ ንጥፈታት ዝተሰርሐ" },
  benefitFiveBody: { en: "ETB support and local payment workflows.", am: "የETB ድጋፍ እና የአካባቢ ክፍያ ሂደቶች።", om: "Deeggarsa ETB fi adeemsa kaffaltii naannoo.", ti: "ደገፍ ETBን ናይ ከባቢ ኣከፋፍላ ክፍሊትን።" },
  benefitSix: { en: "MULTI-LANGUAGE", am: "ብዙ ቋንቋዎች", om: "AFAANOTA HEDDUU", ti: "ብዙሓት ቋንቋታት" },
  benefitSixBody: { en: "English, Amharic, Afaan Oromoo and Tigrinya.", am: "እንግሊዝኛ፣ አማርኛ፣ አፋን ኦሮሞ እና ትግርኛ።", om: "Ingiliffa, Amaariffa, Afaan Oromoo fi Tigiriffa.", ti: "እንግሊዝኛ፣ ኣማርኛ፣ Afaan Oromooን ትግርኛን።" },
  landingTools: { en: "The tools your shift actually needs.", am: "ፈረቃዎ በእውነት የሚፈልጋቸው መሳሪያዎች።", om: "Meeshaalee jijjiiramni hojii keessan dhugumaan barbaadu.", ti: "እቶም ፈረቓኹም ብሓቂ ዝደልዮም መሳርሒታት።" },
  landingFrontBack: { en: "FRONT OF HOUSE / BACK OF HOUSE", am: "የፊት ቢሮ / የኋላ ቢሮ", om: "FUULA TAJAAJILAA / DUUBA TAJAAJILAA", ti: "ቅድሚት ኣገልግሎት / ድሕሪት ኣገልግሎት" },
  landingRestaurants: { en: "RESTAURANTS", am: "ሬስቶራንቶች", om: "MANAA NYAATAA", ti: "ሬስቶራንታት" },
  landingHotels: { en: "HOTELS", am: "ሆቴሎች", om: "HOTEELLA", ti: "ሆቴላት" },
  landingCafes: { en: "CAFÉS", am: "ካፌዎች", om: "KAAFEW", ti: "ካፌታት" },
  landingFoodService: { en: "FOOD-SERVICE BUSINESSES", am: "የምግብ አገልግሎት ንግዶች", om: "DHAABBATAA TAJAAJILA NYAATAA", ti: "ንግዲ ኣገልግሎት ምግቢ" },
  landingDiscovered: { en: "Discovered by", am: "ያገኘው በ", om: "Kan argameen", ti: "ዝተረኽበ ብ" },
  landingHeroTitle: { en: "RUN SMARTER. GROW FASTER.", am: "በብልሃት ይስሩ። በፍጥነት ያድጉ።", om: "OGUMMAAN HOJJADHU. ARIITIIN GUDDADHU.", ti: "ብብልሓት ስራሕ። ብፍጥነት ዓቢ።" },
  landingHeroBody: { en: "A modern restaurant management system for restaurants, hotels, cafés and food-service businesses.", am: "ለሬስቶራንቶች፣ ሆቴሎች፣ ካፌዎች እና የምግብ ንግዶች ዘመናዊ የሬስቶራንት አስተዳደር ስርዓት።", om: "Sirna bulchiinsa mana nyaataa ammayyaa mana nyaataa, hoteelaa, kaafee fi daldala tajaajila nyaataaf.", ti: "ንሬስቶራንታት፣ ሆቴላት፣ ካፌታትን ንግዲ ኣገልግሎት ምግብን ዝኸውን ዘመናዊ ስርዓት ምሕደራ ሬስቶራንት።" },
  landingWhyTitle: { en: "Built for the whole shift.", am: "ለሙሉ ፈረቃ የተሰራ።", om: "Jijjiirama hojii guutuuf ijaarame.", ti: "ንምሉእ ፈረቓ ዝተሃንጸ።" },
  landingTrialBody: { en: "Start with your daily operation and keep your history connected as you grow.", am: "በዕለታዊ ስራዎ ይጀምሩ እና ሲያድጉ ታሪክዎን ተገናኝቶ ያቆዩ።", om: "Hojii guyyaa keessaniin jalqabaatii seenaa keessan guddachaa deemuun walitti qabaa.", ti: "ብናይ መዓልቲ ስራሕኩም ጀሚርኩም እና እናዓበኹም ታሪኽኩም ተራኺቡ ኣቆይዎ።" },
  featureTables: { en: "TABLES", am: "ጠረጴዛዎች", om: "MINJAALOTA", ti: "ጠረጴዛታት" },
  featureTablesBody: { en: "Keep floor status clear from AVAILABLE to OCCUPIED to CLEANING.", am: "የወለል ሁኔታን ከነጻ እስከ ተይዞ እስከ ጽዳት ግልጽ ያድርጉ።", om: "Haala minjaalaa AVAILABLE irraa OCCUPIED hanga CLEANING ifa godhi.", ti: "ኩነታት ጠረጴዛ ካብ AVAILABLE ናብ OCCUPIED ክሳብ CLEANING ግልጺ ግበሮ።" },
  featureReports: { en: "REPORTS & SUMMARIES", am: "ሪፖርቶች እና ማጠቃለያዎች", om: "GABAASA FI CUUNFAA", ti: "ጸብጻባትን ሓፈሻዊ ሓበሬታን" },
  featureReportsBody: { en: "See sales summaries, best sellers and recent operational activity.", am: "የሽያጭ ማጠቃለያዎችን፣ ተወዳጅ ምርቶችን እና የቅርብ ስራዎችን ይመልከቱ።", om: "Cuunfaa gurgurtaa, gurgurtoota olaanoo fi hojii dhihoo ilaali.", ti: "ሓፈሻዊ ሽያጭ፣ ዝበለጸ ዝሽየጡን ናይ ቀረባ ንጥፈታትን ርአ።" },
  audienceRestaurantBody: { en: "One clear control center for every service shift.", am: "ለእያንዳንዱ የአገልግሎት ፈረቃ አንድ ግልጽ መቆጣጠሪያ።", om: "Jijjiirama tajaajilaa hundaaf wiirtuu to'annoo ifa ta'e.", ti: "ንነፍሲ ወከፍ ፈረቓ ኣገልግሎት ግልጺ ማእከል ቁጽጽር።" },
  audienceHotelBody: { en: "Coordinate restaurant operations inside a larger hospitality team.", am: "በትልቅ የእንግዳ አገልግሎት ቡድን ውስጥ የሬስቶራንት ስራዎችን ያስተባብሩ።", om: "Hojii mana nyaataa garee keessummaa guddaa keessatti qindeessi.", ti: "ኣብ ዓቢ ጉጅለ ኣገልግሎት እንግዶት ንጥፈታት ሬስቶራንት ኣወሃህድ።" },
  audienceCafeBody: { en: "Keep fast-moving service simple, visible and organized.", am: "ፈጣን የአገልግሎት ስራን ቀላል፣ ግልጽ እና የተደራጀ ያድርጉ።", om: "Tajaajila saffisaa salphaa, ifa fi qindaa'aa godhi.", ti: "ቅልጡፍ ኣገልግሎት ቀሊል፣ ግልጺን ስርዑን ግበሮ።" },
  audienceFoodBody: { en: "Adapt the same operational rhythm to your food-service business.", am: "ተመሳሳይ የስራ ሂደትን ለምግብ አገልግሎት ንግድዎ ያስማሙ።", om: "Ritima hojii walfakkaataa daldala tajaajila nyaata keessaniif madaqi.", ti: "እቲ ሓደ ስርዓት ስራሕ ንንግዲ ኣገልግሎት ምግብኹም ኣመዓራርዮ።" },
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