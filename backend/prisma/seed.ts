// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type HolidaySeed = {
  name: string;
  slug?: string;
  region?: string | null;
  type?: string | null;
  notes?: string | null;
  dates: string[]; // ISO date strings e.g. "2025-10-25"
};

const holidays: HolidaySeed[] = [
  // National / widely observed
  { name: "New Year", slug: "new-year", region: "ALL", type: "Public", dates: ["2025-01-01"] },
  { name: "Makar Sankranti", slug: "makar-sankranti", region: "ALL", type: "Cultural", dates: ["2025-01-14"] },
  { name: "Pongal", slug: "pongal", region: "Tamil Nadu", type: "Regional", dates: ["2025-01-15"] },
  { name: "Lohri", slug: "lohri", region: "Punjab", type: "Regional", dates: ["2025-01-13"] },
  { name: "Republic Day", slug: "republic-day", region: "ALL", type: "National", dates: ["2025-01-26"] },

  // Spring festivals
  { name: "Maha Shivaratri", slug: "maha-shivaratri", region: "ALL", type: "Religious", dates: ["2025-03-03"] },
  { name: "Holi (Holika Dahan/Holi)", slug: "holi", region: "ALL", type: "Religious", dates: ["2025-03-13","2025-03-14"] },

  // Ramadan/Eid (moon dependent — seeds include expected dates)
  { name: "Eid al-Fitr (Ramzan Eid) – expected", slug: "eid-al-fitr", region: "ALL", type: "Religious", dates: ["2025-03-31"] },
  { name: "Eid al-Adha (Bakrid) – expected", slug: "eid-al-adha", region: "ALL", type: "Religious", dates: ["2025-06-07"] },

  // Monsoon/South India festivals
  { name: "Ganesh Chaturthi", slug: "ganesh-chaturthi", region: "Maharashtra, ALL", type: "Religious", dates: ["2025-09-07"] }, // approximate public calendars
  { name: "Onam (Thiruvonam)", slug: "onam", region: "Kerala", type: "Regional", dates: ["2025-09-05"] },

  // Independence/other national
  { name: "Independence Day", slug: "independence-day", region: "ALL", type: "National", dates: ["2025-08-15"] },

  // Krishna / Janmashtami (date varies)
  { name: "Janmashtami", slug: "janmashtami", region: "ALL", type: "Religious", dates: ["2025-08-16"] },

  // Diwali & associated days (2025 public calendars show Diwali on Oct 25)
  { name: "Dussehra (Vijayadashami)", slug: "dussehra", region: "ALL", type: "Religious", dates: ["2025-10-02"] },
  { name: "Diwali (Deepavali)", slug: "diwali", region: "ALL", type: "Religious", dates: ["2025-10-25"] },
  { name: "Naraka Chaturdasi (Choti Diwali)", slug: "naraka-chaturdasi", region: "ALL", type: "Religious", dates: ["2025-10-24"] },
  { name: "Govardhan Puja", slug: "govardhan-puja", region: "ALL", type: "Religious", dates: ["2025-10-26"] },
  { name: "Bhai Dooj / Bhaiya Dooj", slug: "bhai-dooj", region: "ALL", type: "Religious", dates: ["2025-10-27"] },

  // Chhath Puja (Bihar, UP, Jharkhand, Nepal region)
  { name: "Chhath Puja", slug: "chhath-puja", region: "Bihar,UP,Jharkhand", type: "Regional", dates: ["2025-10-27"] },

  // Other widely-observed days (Good Friday, Easter) - 2025 Easter is Apr 20
  { name: "Good Friday", slug: "good-friday", region: "ALL", type: "Religious", dates: ["2025-04-18"] },
  { name: "Easter Sunday", slug: "easter", region: "ALL", type: "Religious", dates: ["2025-04-20"] },

  // Raksha Bandhan (Shravana Purnima) - 2025
  { name: "Raksha Bandhan", slug: "raksha-bandhan", region: "ALL", type: "Religious", dates: ["2025-08-03"] },

  // More common / regional festivals you may want
  { name: "Guru Nanak Jayanti (Gurpurab)", slug: "guru-nanak-jayanti", region: "ALL", type: "Religious", dates: ["2025-11-01"] },

  // Add other holidays commonly observed / state-specific:
  { name: "Mahatma Gandhi Jayanti", slug: "gandhi-jayanti", region: "ALL", type: "National", dates: ["2025-10-02"] }
];

// -- utility to create days of year 2025
function dateToIso(y:number,m:number,d:number){
  const dt = new Date(Date.UTC(y, m-1, d));
  // set to midnight UTC
  return dt.toISOString();
}

function weekdayName(year:number, month:number, day:number){
  const d = new Date(Date.UTC(year, month-1, day));
  // note: getUTCDay: 0=Sun .. 6=Sat
  const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return names[d.getUTCDay()];
}

async function main(){
  console.log("Seeding CalendarDays for 2025...");

  // Create all valid days for 2025
  const year = 2025;
  const batch: any[] = [];

  for (let month=1; month<=12; month++){
    // compute days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day=1; day<=daysInMonth; day++){
      const iso = dateToIso(year, month, day);
      batch.push({
        year,
        month,
        day,
        isoDate: iso,
        weekday: weekdayName(year, month, day)
      });
    }
  }

  // Clean DB (optional, careful in prod)
  await prisma.holidayOnDay.deleteMany({});
  await prisma.holiday.deleteMany({});
  await prisma.calendarDay.deleteMany({});

  // Bulk create calendar days
  for (const rec of batch) {
    await prisma.calendarDay.create({ data: rec });
  }
  console.log(`Created ${batch.length} CalendarDay records.`);

  // Create Holidays and link to days
  for (const h of holidays) {
    const created = await prisma.holiday.create({
      data: {
        name: h.name,
        slug: h.slug ?? h.name.toLowerCase().replace(/\s+/g, "-"),
        region: h.region,
        type: h.type,
        notes: h.notes
      }
    });

    for (const d of h.dates) {
      // find calendar day by iso date (normalize)
      const iso = new Date(d + "T00:00:00.000Z").toISOString();
      const cal = await prisma.calendarDay.findUnique({ where: { isoDate: iso } });
      if (!cal) {
        console.warn("No CalendarDay found for", iso, " — skipping link for holiday", h.name);
        continue;
      }

      await prisma.holidayOnDay.create({
        data: {
          calendarDayId: cal.id,
          holidayId: created.id
        }
      });
    }
  }

  console.log("Holidays seeded and linked.");
}

main()
  .catch((e)=>{ console.error(e); process.exit(1); })
  .finally(()=> prisma.$disconnect());
