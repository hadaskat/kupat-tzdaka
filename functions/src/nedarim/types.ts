/**
 * One row from Nedarim Plus's GetHistoryJson response.
 *
 * Field names and meanings are taken verbatim from their developer document.
 * Everything is typed as `string | number` because the document does not state
 * the JSON types, and ASP.NET endpoints commonly return numbers as strings -
 * so every value is parsed defensively rather than trusted.
 */
export interface NedarimTransaction {
  /** מספר שובר בחברת האשראי */
  Shovar?: string | number;
  /** מספר זהות */
  Zeout?: string | number;
  /** שם לקוח */
  ClientName?: string;
  /** כתובת מלאה */
  Adresse?: string;
  Phone?: string | number;
  Mail?: string;
  /** סכום העסקה */
  Amount?: string | number;
  /** 1 = שקל, 2 = דולר */
  Currency?: string | number;
  /** תאריך ושעת ביצוע העסקה */
  TransactionTime?: string;
  /** מספר אישור */
  Confirmation?: string | number;
  /** 4 ספרות אחרונות */
  LastNum?: string | number;
  /** רגיל / תשלומים / הוראת קבע */
  TransactionType?: string;
  /** קטגוריה - שם השיעור, וזה מה שקובע את שיוך הקרן */
  Groupe?: string;
  /** הערות */
  Comments?: string;
  /** מספר תשלומים */
  Tashloumim?: string | number;
  FirstTashloum?: string | number;
  NextTashloum?: string | number;
  /** מזהה שיחה (תרומות דרך נדרים פון) */
  CallId?: string | number;
  AsRecord?: string | number;
  /** מספר/שם עמדה (תרומות מבתי כנסת) */
  MasofId?: string | number;
  MasofName?: string;
  /** מספר עסקה - ייחודי, משמש גם כמצביע הסנכרון וגם למניעת כפילויות */
  TransactionId?: string | number;
  CompagnyCard?: string;
  Solek?: string;
  Tayar?: string | number;
  /** מספר קבלה שהופק אצלם */
  KabalaId?: string | number;
  /** מזהה הוראת קבע - מקשר בין כל החיובים של אותה הוראה */
  KevaId?: string | number;
}

export const CURRENCY_ILS = 1;
export const CURRENCY_USD = 2;

/** Their API caps a single response at 2000 rows. */
export const NEDARIM_MAX_PAGE = 2000;
