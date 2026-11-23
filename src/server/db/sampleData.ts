import type Database from 'better-sqlite3';
import {
  addCalendarDays,
  parseISODateParts,
  todayLocalISO
} from '../../shared/dates.js';
import { ensureDefaultCircles, setMeta } from './schema.js';

export function seedSampleData(
  db: Database.Database,
  referenceDateStr: string = todayLocalISO()
): void {
  ensureDefaultCircles(db);

  const circles = db
    .prepare('SELECT id, slug FROM circles')
    .all() as Array<{ id: string; slug: string }>;
  const circleIdBySlug = new Map(circles.map((c) => [c.slug, c.id]));
  const fallbackId = circles[0]?.id ?? 'circle-close-15';

  const getCircleId = (slug: string): string =>
    circleIdBySlug.get(slug) ?? fallbackId;

  const sampleIds = [
    'sample-maya-lin',
    'sample-arif-pratama',
    'sample-auntie-elena',
    'sample-samira-patel',
    'sample-jonah-reyes',
    'sample-mom-dad',
    'sample-priya-nair',
    'sample-leo-takahashi',
    'sample-claire-moreau'
  ];

  const upcomingIn6 = parseISODateParts(addCalendarDays(referenceDateStr, 6));
  const upcomingIn11 = parseISODateParts(addCalendarDays(referenceDateStr, 11));
  const upcomingIn18 = parseISODateParts(addCalendarDays(referenceDateStr, 18));
  const upcomingIn25 = parseISODateParts(addCalendarDays(referenceDateStr, 25));

  const tx = db.transaction(() => {
    const deletePerson = db.prepare('DELETE FROM people WHERE id = ?');
    for (const id of sampleIds) {
      deletePerson.run(id);
    }

    const insertPerson = db.prepare(`
      INSERT INTO people (
        id, name, nickname, circle_id, custom_cadence_days, city, neighborhood,
        how_we_met, shared_interests, preferred_vibe, pinned_context,
        snoozed_until, archived, is_sample, created_at, updated_at
      ) VALUES (
        @id, @name, @nickname, @circleId, @customCadenceDays, @city, @neighborhood,
        @howWeMet, @sharedInterests, @preferredVibe, @pinnedContext,
        NULL, 0, 1, @createdAt, @updatedAt
      )
    `);

    const insertLifeDate = db.prepare(`
      INSERT INTO life_dates (
        id, person_id, label, date_month, date_day, date_year, recurring_annual, note
      ) VALUES (
        @id, @personId, @label, @dateMonth, @dateDay, @dateYear, @recurringAnnual, @note
      )
    `);

    const insertInteraction = db.prepare(`
      INSERT INTO interactions (
        id, person_id, occurred_at, kind, location, summary, follow_up, raw_input, created_at
      ) VALUES (
        @id, @personId, @occurredAt, @kind, @location, @summary, @followUp, @rawInput, @createdAt
      )
    `);

    const peopleData = [
      {
        id: 'sample-maya-lin',
        name: 'Maya Lin',
        nickname: 'May',
        circleId: getCircleId('inner-5'),
        customCadenceDays: null,
        city: 'Portland',
        neighborhood: 'Division',
        howWeMet: 'Community ceramics studio in 2021',
        sharedInterests: JSON.stringify(['pottery', 'pour-over coffee', 'ceramics']),
        preferredVibe: 'Morning coffee or open studio drop-by',
        pinnedContext: 'Just opened a shared kiln studio off SE Division; prefers oat cortados.',
        createdAt: addCalendarDays(referenceDateStr, -180),
        updatedAt: addCalendarDays(referenceDateStr, -23)
      },
      {
        id: 'sample-auntie-elena',
        name: 'Auntie Elena',
        nickname: 'Tita Elena',
        circleId: getCircleId('family'),
        customCadenceDays: null,
        city: 'Chicago',
        neighborhood: 'Lincoln Square',
        howWeMet: 'Family — dad’s younger sister',
        sharedInterests: JSON.stringify(['home cooking', 'gardening', 'sunday calls']),
        preferredVibe: 'Unhurried Sunday phone call while walking',
        pinnedContext: 'Always lights up when asked about her tomato seedlings and cousin Mateo.',
        createdAt: addCalendarDays(referenceDateStr, -240),
        updatedAt: addCalendarDays(referenceDateStr, -35)
      },
      {
        id: 'sample-arif-pratama',
        name: 'Arif Pratama',
        nickname: '',
        circleId: getCircleId('close-15'),
        customCadenceDays: null,
        city: 'Brooklyn',
        neighborhood: 'Park Slope',
        howWeMet: 'College architecture studio',
        sharedInterests: JSON.stringify(['vinyl records', 'ramen', 'neighborhood walks']),
        preferredVibe: 'Weeknight noodles or browsing record crates',
        pinnedContext: 'Packing up his studio before moving four blocks south near Prospect Park.',
        createdAt: addCalendarDays(referenceDateStr, -200),
        updatedAt: addCalendarDays(referenceDateStr, -48)
      },
      {
        id: 'sample-samira-patel',
        name: 'Samira Patel',
        nickname: 'Sam',
        circleId: getCircleId('close-15'),
        customCadenceDays: null,
        city: 'Portland',
        neighborhood: 'Alberta Arts',
        howWeMet: 'Sunday sketchbook meetup',
        sharedInterests: JSON.stringify(['watercolor', 'river walks', 'bookstores']),
        preferredVibe: 'Long walk with tea in a thermos',
        pinnedContext: 'Illustrating her first children’s book this winter; loves cardamom buns.',
        createdAt: addCalendarDays(referenceDateStr, -140),
        updatedAt: addCalendarDays(referenceDateStr, -36)
      },
      {
        id: 'sample-jonah-reyes',
        name: 'Jonah Reyes',
        nickname: '',
        circleId: getCircleId('inner-5'),
        customCadenceDays: null,
        city: 'Portland',
        neighborhood: 'Laurelhurst',
        howWeMet: 'Former roommate on 28th Ave',
        sharedInterests: JSON.stringify(['running', 'trail walks', 'espresso']),
        preferredVibe: 'Saturday morning park loop + espresso',
        pinnedContext: 'Training for a spring half-marathon; recently adopted a terrier named Pickle.',
        createdAt: addCalendarDays(referenceDateStr, -300),
        updatedAt: addCalendarDays(referenceDateStr, -4)
      },
      {
        id: 'sample-mom-dad',
        name: 'Mom & Dad',
        nickname: 'Parents',
        circleId: getCircleId('family'),
        customCadenceDays: 14,
        city: 'Seattle',
        neighborhood: 'Ballard',
        howWeMet: 'Family home',
        sharedInterests: JSON.stringify(['sunday dinner', 'family photos', 'ferries']),
        preferredVibe: 'Weekly Sunday call or monthly ferry visit',
        pinnedContext: 'Dad is restoring an old cedar canoe in the garage.',
        createdAt: addCalendarDays(referenceDateStr, -365),
        updatedAt: addCalendarDays(referenceDateStr, -6)
      },
      {
        id: 'sample-priya-nair',
        name: 'Priya Nair',
        nickname: '',
        circleId: getCircleId('close-15'),
        customCadenceDays: null,
        city: 'Portland',
        neighborhood: 'Hawthorne',
        howWeMet: 'Neighborhood book club',
        sharedInterests: JSON.stringify(['fiction', 'matcha', 'indie cinema']),
        preferredVibe: 'Late-afternoon tea and bookstore wander',
        pinnedContext: 'Recommended two translated novels; planning a trip to Kyoto in April.',
        createdAt: addCalendarDays(referenceDateStr, -160),
        updatedAt: addCalendarDays(referenceDateStr, -19)
      },
      {
        id: 'sample-leo-takahashi',
        name: 'Leo Takahashi',
        nickname: '',
        circleId: getCircleId('extended-50'),
        customCadenceDays: null,
        city: 'San Francisco',
        neighborhood: 'Inner Sunset',
        howWeMet: 'Summer internship in 2019',
        sharedInterests: JSON.stringify(['sourdough', 'ramen', 'film photography']),
        preferredVibe: 'Seasonal catch-up lunch when traveling',
        pinnedContext: 'Shoots 35mm street portraits; always knows the best bakery near Golden Gate Park.',
        createdAt: addCalendarDays(referenceDateStr, -290),
        updatedAt: addCalendarDays(referenceDateStr, -34)
      },
      {
        id: 'sample-claire-moreau',
        name: 'Claire Moreau',
        nickname: '',
        circleId: getCircleId('extended-50'),
        customCadenceDays: null,
        city: 'Montreal',
        neighborhood: 'Mile End',
        howWeMet: 'Design conference in Montreal',
        sharedInterests: JSON.stringify(['printmaking', 'cycling', 'cafes']),
        preferredVibe: 'Postcards or an unhurried seasonal catch-up call',
        pinnedContext: 'Runs a tiny risograph press with two friends.',
        createdAt: addCalendarDays(referenceDateStr, -270),
        updatedAt: addCalendarDays(referenceDateStr, -76)
      }
    ];

    for (const p of peopleData) {
      insertPerson.run(p);
    }

    const lifeDatesData = [
      {
        id: 'sample-ld-maya-bday',
        personId: 'sample-maya-lin',
        label: 'Birthday',
        dateMonth: upcomingIn6.month,
        dateDay: upcomingIn6.day,
        dateYear: null,
        recurringAnnual: 1,
        note: 'Loves handmade mugs and citrus olive oil cake'
      },
      {
        id: 'sample-ld-arif-move',
        personId: 'sample-arif-pratama',
        label: 'Apartment Move-in Day',
        dateMonth: upcomingIn11.month,
        dateDay: upcomingIn11.day,
        dateYear: upcomingIn11.year,
        recurringAnnual: 0,
        note: 'Moving near 7th Ave — bring housewarming tea'
      },
      {
        id: 'sample-ld-mom-bday',
        personId: 'sample-mom-dad',
        label: "Mom's Birthday",
        dateMonth: upcomingIn18.month,
        dateDay: upcomingIn18.day,
        dateYear: null,
        recurringAnnual: 1,
        note: 'Mail handwritten card 4 days ahead'
      },
      {
        id: 'sample-ld-samira-book',
        personId: 'sample-samira-patel',
        label: 'Book Illustration Deadline',
        dateMonth: upcomingIn25.month,
        dateDay: upcomingIn25.day,
        dateYear: upcomingIn25.year,
        recurringAnnual: 0,
        note: 'Celebrate with a celebratory pastry walk once she submits!'
      }
    ];

    for (const ld of lifeDatesData) {
      insertLifeDate.run(ld);
    }

    const interactionsData = [
      {
        id: 'sample-int-maya-1',
        personId: 'sample-maya-lin',
        occurredAt: addCalendarDays(referenceDateStr, -23),
        kind: 'coffee',
        location: 'Heart Roasters',
        summary: "Talked about her new pottery studio and dad's knee surgery",
        followUp: "Ask how her dad's physical therapy is going",
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -23)
      },
      {
        id: 'sample-int-maya-2',
        personId: 'sample-maya-lin',
        occurredAt: addCalendarDays(referenceDateStr, -45),
        kind: 'walk',
        location: 'Mt. Tabor',
        summary: 'Evening loop walk — sketched out glaze colors for autumn firing',
        followUp: '',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -45)
      },
      {
        id: 'sample-int-elena-1',
        personId: 'sample-auntie-elena',
        occurredAt: addCalendarDays(referenceDateStr, -35),
        kind: 'call',
        location: '',
        summary: "Shared her braised short rib recipe and talked about cousin Mateo's graduation",
        followUp: 'Send photos after trying her short rib recipe',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -35)
      },
      {
        id: 'sample-int-arif-1',
        personId: 'sample-arif-pratama',
        occurredAt: addCalendarDays(referenceDateStr, -48),
        kind: 'meal',
        location: 'Danbo Ramen',
        summary: "He's moving apartments next month and sorting through his vinyl crate",
        followUp: 'Offer a hand with moving boxes or bring coffee on move-in weekend',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -48)
      },
      {
        id: 'sample-int-samira-1',
        personId: 'sample-samira-patel',
        occurredAt: addCalendarDays(referenceDateStr, -36),
        kind: 'walk',
        location: 'Eastbank Esplanade',
        summary: "Walked the river loop; she just started illustrating a children's book",
        followUp: 'Ask to see her early pencil character sketches',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -36)
      },
      {
        id: 'sample-int-jonah-1',
        personId: 'sample-jonah-reyes',
        occurredAt: addCalendarDays(referenceDateStr, -4),
        kind: 'walk',
        location: 'Laurelhurst Park',
        summary: 'Morning walk with Pickle; compared routes for his half-marathon build',
        followUp: '',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -4)
      },
      {
        id: 'sample-int-parents-1',
        personId: 'sample-mom-dad',
        occurredAt: addCalendarDays(referenceDateStr, -6),
        kind: 'call',
        location: '',
        summary: 'Sunday evening check-in — Mom tried a new sourdough loaf and Dad varnished the canoe gunwales',
        followUp: '',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -6)
      },
      {
        id: 'sample-int-priya-1',
        personId: 'sample-priya-nair',
        occurredAt: addCalendarDays(referenceDateStr, -19),
        kind: 'coffee',
        location: "Powell's & Tea Bar",
        summary: 'Swapped paperback recommendations and talked about Kyoto neighborhoods',
        followUp: 'Share my favorite small coffee shop list in Nakagyo',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -19)
      },
      {
        id: 'sample-int-leo-1',
        personId: 'sample-leo-takahashi',
        occurredAt: addCalendarDays(referenceDateStr, -34),
        kind: 'meal',
        location: 'Arizmendi Bakery',
        summary: 'Caught up over focaccia slices while visiting SF; he just rebuilt a classic Pentax camera',
        followUp: '',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -34)
      },
      {
        id: 'sample-int-claire-1',
        personId: 'sample-claire-moreau',
        occurredAt: addCalendarDays(referenceDateStr, -76),
        kind: 'call',
        location: '',
        summary: 'Caught up on her risograph zine fair and winter bike commuting',
        followUp: '',
        rawInput: '',
        createdAt: addCalendarDays(referenceDateStr, -76)
      }
    ];

    for (const inter of interactionsData) {
      insertInteraction.run(inter);
    }

    setMeta(db, 'sample_data_enabled', 'true');
    setMeta(db, 'initialized', 'true');
  });

  tx();
}

export function clearSampleData(db: Database.Database): void {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM people WHERE is_sample = 1').run();
    setMeta(db, 'sample_data_enabled', 'false');
    setMeta(db, 'initialized', 'true');
  });
  tx();
}
