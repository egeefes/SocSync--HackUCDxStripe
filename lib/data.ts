import type { EventItem, Society } from "./types";

// All societies, committee members, social handles and events below are fictional demo content.
export const INTERESTS = ["Social", "Technology", "Sports", "Creative", "Careers", "Sustainability", "Culture"];

export const CATEGORY_COLOR: Record<string, string> = {
  Social: "coral", Technology: "lavender", Sports: "green", Creative: "yellow",
  Careers: "blue", Sustainability: "green", Culture: "pink",
};

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
const ig = (h: string) => ({ kind: "instagram" as const, url: `https://instagram.com/${h}` });
const web = (h: string) => ({ kind: "website" as const, url: `https://${h}.example.org` });
const mail = (h: string) => ({ kind: "email" as const, url: `mailto:${h}@example.org` });
const discord = (h: string) => ({ kind: "discord" as const, url: `https://discord.gg/${h}` });

export const societies: Society[] = [
  {
    id: "computer-science", name: "NetSoc", short: "NetSoc", category: "Technology",
    initials: "NS", color: "soc-purple", baseMembers: 1800, image: img("photo-1519389950473-47ba0277781c"),
    tagline: "Build things, meet your people, and explore what's next in tech.",
    bio: "We run build nights, hackathon prep, industry talks and a lot of pizza. Whether you've shipped a startup or never opened a terminal, there's a seat for you. Every term we pair first-years with older students for project buddy sessions.",
    committee: [
      { name: "Aoife Brennan", role: "Auditor", bio: "3rd year CS. Runs the weekly build nights and cannot be stopped from talking about Rust." },
      { name: "Conor Walsh", role: "Treasurer", bio: "Keeps the pizza budget honest. Also likes databases, which is concerning." },
      { name: "Priya Nair", role: "Events Officer", bio: "Organises speaker nights and the annual society hackathon." },
    ],
    socials: [ig("campusloop_demo_css"), discord("campusloop-demo-css"), mail("css-demo")],
  },
  {
    id: "international", name: "International Society", short: "Intl", category: "Culture",
    initials: "IS", color: "soc-coral", baseMembers: 2100, image: img("photo-1528605248644-14dd04022da1"),
    tagline: "A home away from home, bringing people and cultures together.",
    bio: "Students from more than 100 countries make up our community. We host welcome socials, food nights, language swaps and day trips so that nobody has to find their feet alone.",
    committee: [
      { name: "Mateus Oliveira", role: "Auditor", bio: "Postgraduate from Porto. Believes every problem can be solved with a food night." },
      { name: "Sana Rahman", role: "Welcome Officer", bio: "Runs the buddy system for new arrivals." },
      { name: "Niamh Gallagher", role: "Treasurer", bio: "Local guide, Dublin slang translator." },
    ],
    socials: [ig("campusloop_demo_intl"), web("intl-demo"), mail("intl-demo")],
  },
  {
    id: "environmental", name: "Environmental Society", short: "Enviro", category: "Sustainability",
    initials: "🌱", color: "soc-green", baseMembers: 640, image: img("photo-1523381210434-271e8be1f52b"),
    tagline: "Small actions, shared planet. Make campus a little greener.",
    bio: "Clothes swaps, campus clean-ups, repair cafés and sustainability campaigns. We work with the campus estates team to make greener choices the easy ones.",
    committee: [
      { name: "Oisín Doyle", role: "Auditor", bio: "Geography student, bicycle evangelist." },
      { name: "Hannah Weiss", role: "Campaigns Officer", bio: "Leads the campus swap shop and repair café." },
    ],
    socials: [ig("campusloop_demo_enviro"), mail("enviro-demo")],
  },
  {
    id: "arts", name: "Arts Society", short: "Arts", category: "Creative",
    initials: "✳︎", color: "soc-yellow", baseMembers: 720, image: img("photo-1565193298595-6e1c9f9b7f2a"),
    tagline: "Make, create, experiment. No experience needed.",
    bio: "Weekly workshops in ceramics, printmaking, life drawing and zine-making. All materials are provided, and nobody is judged on talent.",
    committee: [
      { name: "Clara Moreau", role: "Auditor", bio: "Fine art minor, major clay enthusiast." },
      { name: "Tadhg Murphy", role: "Workshops Officer", bio: "Books the studios and hoards the good paint." },
    ],
    socials: [ig("campusloop_demo_arts"), mail("arts-demo")],
  },
  {
    id: "athletics", name: "Athletics Union", short: "AU", category: "Sports",
    initials: "AU", color: "soc-green", baseMembers: 1500, image: img("photo-1552674605-db6ffd4facb5"),
    tagline: "Run, jump, throw, or just show up for the social.",
    bio: "From casual run clubs to competitive track squads, the Athletics Union helps students of every pace find a group. Our all-pace Sunset Run is the easiest way to start.",
    committee: [
      { name: "Ruairí Keane", role: "Captain", bio: "Middle-distance runner who is always 'five minutes away'." },
      { name: "Leila Haddad", role: "Social Officer", bio: "Plans post-run coffee, the most important part." },
    ],
    socials: [ig("campusloop_demo_au"), mail("au-demo")],
  },
  {
    id: "commerce", name: "Commerce & Economics Society", short: "Commerce", category: "Careers",
    initials: "CE", color: "soc-purple", baseMembers: 980, image: img("photo-1517245386807-bb43f82c33c4"),
    tagline: "Careers advice without the cringe.",
    bio: "Panels with recent graduates, CV clinics, mock interviews and a yearly case competition. We keep it practical and honest about what the first job is really like.",
    committee: [
      { name: "Emmanuel Okafor", role: "Auditor", bio: "Finance final-year; will review your CV if you bring coffee." },
      { name: "Sophie Lindqvist", role: "Careers Officer", bio: "Connects members with alumni mentors." },
    ],
    socials: [ig("campusloop_demo_commerce"), web("commerce-demo"), mail("commerce-demo")],
  },
  {
    id: "law", name: "Law Society", short: "Law", category: "Social",
    initials: "LS", color: "soc-coral", baseMembers: 1200, image: img("photo-1511795409834-ef04bbd61622"),
    tagline: "Debates, moots, and the best ball of the year.",
    bio: "Mooting practice, debates, guest barristers and an annual society ball. Open to every faculty, not just law students.",
    committee: [
      { name: "Fionn Maguire", role: "Auditor", bio: "Loves a good objection." },
      { name: "Amara Eze", role: "Ball Coordinator", bio: "In charge of the Midnight Garden ball and its many spreadsheets." },
    ],
    socials: [ig("campusloop_demo_law"), mail("law-demo")],
  },
  {
    id: "games", name: "Games Society", short: "Games", category: "Social",
    initials: "GS", color: "soc-yellow", baseMembers: 460, image: img("photo-1610890716171-6b1bb98ffd09"),
    tagline: "Low-key games, new faces, snacks.",
    bio: "Board games, card games, tabletop RPGs and the occasional video game tournament. We always find you a table, even if you arrive alone.",
    committee: [
      { name: "Jamie Tran", role: "Auditor", bio: "Owns an unreasonable number of board games." },
      { name: "Eabha Burke", role: "Events Officer", bio: "Dungeon master by night, chemistry student by day." },
    ],
    socials: [ig("campusloop_demo_games"), discord("campusloop-demo-games")],
  },
];

export const seedEvents: EventItem[] = [
  { id: 1, title: "The Welcome Social", societyId: "international", category: "Social", startsAt: "2026-10-15T18:30", location: "The Clubhouse", price: 3, baseGoing: 42, capacity: 80, description: "Meet new people, make a few friends, and settle into campus life. Everyone is welcome — especially if you're coming solo.", image: img("photo-1528605248644-14dd04022da1"), color: "coral", tags: ["social", "new friends", "beginner friendly"] },
  { id: 2, title: "Build Night: AI & Ideas", societyId: "computer-science", category: "Technology", startsAt: "2026-10-16T17:00", location: "O'Brien Centre", price: 0, baseGoing: 68, capacity: 100, description: "Bring an idea or just your curiosity. A relaxed evening of building, experimenting and meeting other people who love technology.", image: img("photo-1519389950473-47ba0277781c"), color: "lavender", tags: ["tech", "AI", "workshop"] },
  { id: 3, title: "Sunset Run Club", societyId: "athletics", category: "Sports", startsAt: "2026-10-17T16:30", location: "UCD Sports Centre", price: 0, baseGoing: 24, capacity: 35, description: "A friendly, all-pace group run around campus. No pressure, no timing — just fresh air and good company.", image: img("photo-1552674605-db6ffd4facb5"), color: "green", tags: ["fitness", "outdoors", "beginner friendly"] },
  { id: 4, title: "Clay, Coffee & Chat", societyId: "arts", category: "Creative", startsAt: "2026-10-19T15:00", location: "Student Centre", price: 5, baseGoing: 18, capacity: 24, description: "Try something creative, get your hands messy, and leave with something you made. All materials included.", image: img("photo-1565193298595-6e1c9f9b7f2a"), color: "yellow", tags: ["art", "creative", "workshop"] },
  { id: 5, title: "Careers Without the Cringe", societyId: "commerce", category: "Careers", startsAt: "2026-10-20T18:00", location: "Quinn School", price: 0, baseGoing: 53, capacity: 90, description: "An informal panel with recent grads about internships, first jobs and figuring it out. Bring questions, not a suit.", image: img("photo-1517245386807-bb43f82c33c4"), color: "blue", tags: ["career", "networking", "talk"] },
  { id: 6, title: "Society Ball: Midnight Garden", societyId: "law", category: "Social", startsAt: "2026-10-23T19:30", location: "Dublin City Centre", price: 25, baseGoing: 114, capacity: 180, description: "A dressed-up night out with dinner, music and a dance floor. Ticket includes entry and dinner.", image: img("photo-1511795409834-ef04bbd61622"), color: "pink", tags: ["ball", "formal", "night out"] },
  { id: 7, title: "Green Campus Swap", societyId: "environmental", category: "Sustainability", startsAt: "2026-10-21T12:00", location: "Newman Building", price: 0, baseGoing: 31, capacity: 60, description: "Give pre-loved clothes, books and bits a second life. Bring something to swap or simply come browse.", image: img("photo-1523381210434-271e8be1f52b"), color: "green", tags: ["reuse", "clothing", "eco"] },
  { id: 8, title: "Board Games & Boba", societyId: "games", category: "Social", startsAt: "2026-10-22T17:30", location: "Student Centre", price: 2, baseGoing: 27, capacity: 40, description: "Low-key games, new faces and a drink. Come with friends or come alone — we'll find you a table.", image: img("photo-1610890716171-6b1bb98ffd09"), color: "lavender", tags: ["games", "social", "beginner friendly"] },
];
