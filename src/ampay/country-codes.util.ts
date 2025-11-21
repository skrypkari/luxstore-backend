export const COUNTRY_CODE_MAP: Record<string, string> = {

  'AD': 'AND', 'AL': 'ALB', 'AT': 'AUT', 'BA': 'BIH', 'BE': 'BEL',
  'BG': 'BGR', 'BY': 'BLR', 'CH': 'CHE', 'CY': 'CYP', 'CZ': 'CZE',
  'DE': 'DEU', 'DK': 'DNK', 'EE': 'EST', 'ES': 'ESP', 'FI': 'FIN',
  'FR': 'FRA', 'GB': 'GBR', 'GE': 'GEO', 'GR': 'GRC', 'HR': 'HRV',
  'HU': 'HUN', 'IE': 'IRL', 'IS': 'ISL', 'IT': 'ITA', 'LI': 'LIE',
  'LT': 'LTU', 'LU': 'LUX', 'LV': 'LVA', 'MC': 'MCO', 'MD': 'MDA',
  'ME': 'MNE', 'MK': 'MKD', 'MT': 'MLT', 'NL': 'NLD', 'NO': 'NOR',
  'PL': 'POL', 'PT': 'PRT', 'RO': 'ROU', 'RS': 'SRB', 'RU': 'RUS',
  'SE': 'SWE', 'SI': 'SVN', 'SK': 'SVK', 'SM': 'SMR', 'UA': 'UKR',
  'VA': 'VAT', 'XK': 'XKX',
  

  'AM': 'ARM', 'AZ': 'AZE', 'KZ': 'KAZ', 'KG': 'KGZ', 'TJ': 'TJK',
  'TM': 'TKM', 'UZ': 'UZB',
  

  'US': 'USA', 'CA': 'CAN', 'AU': 'AUS', 'JP': 'JPN', 'CN': 'CHN',
  'IN': 'IND', 'BR': 'BRA', 'MX': 'MEX', 'AR': 'ARG', 'CL': 'CHL',
  'PE': 'PER', 'CO': 'COL', 'VE': 'VEN', 'EC': 'ECU', 'BO': 'BOL',
  'PY': 'PRY', 'UY': 'URY', 'SR': 'SUR', 'GY': 'GUY', 'FK': 'FLK',
  'ZA': 'ZAF', 'EG': 'EGY', 'NG': 'NGA', 'KE': 'KEN', 'GH': 'GHA',
  'TZ': 'TZA', 'UG': 'UGA', 'ZW': 'ZWE', 'ZM': 'ZMB', 'MW': 'MWI',
  'MZ': 'MOZ', 'MG': 'MDG', 'MU': 'MUS', 'SC': 'SYC', 'RE': 'REU',
  'TR': 'TUR', 'IR': 'IRN', 'IQ': 'IRQ', 'SA': 'SAU', 'AE': 'ARE',
  'KW': 'KWT', 'QA': 'QAT', 'BH': 'BHR', 'OM': 'OMN', 'YE': 'YEM',
  'JO': 'JOR', 'LB': 'LBN', 'SY': 'SYR', 'IL': 'ISR', 'PS': 'PSE',
  'KR': 'KOR', 'KP': 'PRK', 'TH': 'THA', 'VN': 'VNM', 'MY': 'MYS',
  'SG': 'SGP', 'ID': 'IDN', 'PH': 'PHL', 'LA': 'LAO', 'KH': 'KHM',
  'MM': 'MMR', 'BD': 'BGD', 'LK': 'LKA', 'NP': 'NPL', 'BT': 'BTN',
  'MV': 'MDV', 'AF': 'AFG', 'PK': 'PAK', 'MN': 'MNG'
};

export function convertCountryCode(code2: string): string | null {
  const code = code2?.toUpperCase();
  return COUNTRY_CODE_MAP[code] || null;
}

export function convertCountryCodeWithFallback(code2: string, fallback: string = 'USA'): string {
  return convertCountryCode(code2) || fallback;
}
