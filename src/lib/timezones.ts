export interface TzInfo {
  id:      string;
  city:    string;
  country: string;
  region:  string;
}

export const ALL_TIMEZONES: TzInfo[] = [
  { id: "UTC",                  city: "UTC",          country: "",   region: "Global"   },
  { id: "America/New_York",     city: "New York",     country: "US", region: "Americas" },
  { id: "America/Los_Angeles",  city: "Los Angeles",  country: "US", region: "Americas" },
  { id: "America/Chicago",      city: "Chicago",      country: "US", region: "Americas" },
  { id: "America/Denver",       city: "Denver",       country: "US", region: "Americas" },
  { id: "America/Toronto",      city: "Toronto",      country: "CA", region: "Americas" },
  { id: "America/Vancouver",    city: "Vancouver",    country: "CA", region: "Americas" },
  { id: "America/Sao_Paulo",    city: "São Paulo",    country: "BR", region: "Americas" },
  { id: "America/Mexico_City",  city: "Mexico City",  country: "MX", region: "Americas" },
  { id: "America/Buenos_Aires", city: "Buenos Aires", country: "AR", region: "Americas" },
  { id: "Europe/London",        city: "London",       country: "GB", region: "Europe"   },
  { id: "Europe/Paris",         city: "Paris",        country: "FR", region: "Europe"   },
  { id: "Europe/Berlin",        city: "Berlin",       country: "DE", region: "Europe"   },
  { id: "Europe/Amsterdam",     city: "Amsterdam",    country: "NL", region: "Europe"   },
  { id: "Europe/Stockholm",     city: "Stockholm",    country: "SE", region: "Europe"   },
  { id: "Europe/Zurich",        city: "Zurich",       country: "CH", region: "Europe"   },
  { id: "Europe/Madrid",        city: "Madrid",       country: "ES", region: "Europe"   },
  { id: "Europe/Rome",          city: "Rome",         country: "IT", region: "Europe"   },
  { id: "Europe/Warsaw",        city: "Warsaw",       country: "PL", region: "Europe"   },
  { id: "Europe/Istanbul",      city: "Istanbul",     country: "TR", region: "Europe"   },
  { id: "Europe/Moscow",        city: "Moscow",       country: "RU", region: "Europe"   },
  { id: "Asia/Dubai",           city: "Dubai",        country: "AE", region: "Asia"     },
  { id: "Asia/Kolkata",         city: "Mumbai",       country: "IN", region: "Asia"     },
  { id: "Asia/Dhaka",           city: "Dhaka",        country: "BD", region: "Asia"     },
  { id: "Asia/Bangkok",         city: "Bangkok",      country: "TH", region: "Asia"     },
  { id: "Asia/Singapore",       city: "Singapore",    country: "SG", region: "Asia"     },
  { id: "Asia/Hong_Kong",       city: "Hong Kong",    country: "HK", region: "Asia"     },
  { id: "Asia/Shanghai",        city: "Shanghai",     country: "CN", region: "Asia"     },
  { id: "Asia/Seoul",           city: "Seoul",        country: "KR", region: "Asia"     },
  { id: "Asia/Tokyo",           city: "Tokyo",        country: "JP", region: "Asia"     },
  { id: "Asia/Jakarta",         city: "Jakarta",      country: "ID", region: "Asia"     },
  { id: "Australia/Sydney",     city: "Sydney",       country: "AU", region: "Pacific"  },
  { id: "Australia/Melbourne",  city: "Melbourne",    country: "AU", region: "Pacific"  },
  { id: "Pacific/Auckland",     city: "Auckland",     country: "NZ", region: "Pacific"  },
  { id: "Africa/Nairobi",       city: "Nairobi",      country: "KE", region: "Africa"   },
  { id: "Africa/Lagos",         city: "Lagos",        country: "NG", region: "Africa"   },
  { id: "Africa/Cairo",         city: "Cairo",        country: "EG", region: "Africa"   },
];

/** Find a TzInfo by IANA ID, falling back to UTC. */
export function findTimezone(id: string): TzInfo {
  return ALL_TIMEZONES.find((z) => z.id === id) ?? { id, city: id, country: "", region: "" };
}

/** UTC offset string, e.g. "UTC+5:30" */
export function getUtcOffset(tz: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, timeZoneName: "shortOffset",
    }).formatToParts(date);
    return (parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0").replace("GMT", "UTC");
  } catch { return "UTC"; }
}

/** Offset in minutes from UTC (positive = ahead). */
export function getOffsetMinutes(tz: string, date: Date): number {
  try {
    const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
    const utc   = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    return (local.getTime() - utc.getTime()) / 60000;
  } catch { return 0; }
}
