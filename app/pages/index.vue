<script setup lang="ts">
import confettiLib from "canvas-confetti";
definePageMeta({ middleware: "auth" });

// ── Composables ────────────────────────────────────────────────────────────
const {
  contacts,
  fetchContacts,
  createContact,
  updateContact,
  hibernate,
  wake,
  logActivity,
  markResponded,
  lastActivity,
  daysSince,
  followUpStatus,
} = useContacts();

const { state: xp, toast, curLevel, nextLevel, xpPct, earn, loadXp } = useXp();
const { logout } = useAuth();
const { scanning, error: scanError, openCamera, scanFile } = useCardScan();

// ── Screen state ───────────────────────────────────────────────────────────
type Screen =
  | "vibe"
  | "session"
  | "cold"
  | "home"
  | "contacts"
  | "detail"
  | "add";
const screen = ref<Screen>("vibe");
const selectedId = ref<string | null>(null);
const editing = ref(false);
const openCold = ref<Set<string>>(new Set());
const moodIdx = ref(0);
const toughIdx = ref(0);
const hypeIdx = ref(0);
const sessionMode = ref<"tough" | "hype" | null>(null);

// ── Contact form ───────────────────────────────────────────────────────────
const addForm = ref({
  firstName: "",
  lastName: "",
  title: "",
  company: "",
  email: "",
  phone: "",
  industry: "",
  metAt: "",
  rating: "",
  notes: "",
});
const editForm = ref<Record<string, any>>({});

// ── Activity form ──────────────────────────────────────────────────────────
const actType = ref("email");
const actNote = ref("");
const actDate = ref(todayStr());

// ── Search/filter ──────────────────────────────────────────────────────────
const cSearch = ref("");
const cFilter = ref("");
const cSort = ref("recent");

// ── Static data ────────────────────────────────────────────────────────────
const RATINGS = [
  { key: "hot", label: "Hot", emoji: "🔥", color: "#ff6b35" },
  { key: "warm", label: "Warm", emoji: "👍", color: "#ffe033" },
  { key: "nurture", label: "Nurture", emoji: "🌱", color: "#00c268" },
  { key: "cold", label: "Cold", emoji: "❄️", color: "#4da6ff" },
];
const ACT_TYPES = [
  { key: "email", label: "Email", icon: "📧" },
  { key: "text", label: "Text", icon: "📱" },
  { key: "call", label: "Call", icon: "📞" },
  { key: "meeting", label: "Meeting", icon: "🤝" },
  { key: "linkedin", label: "LinkedIn", icon: "🔗" },
  { key: "other", label: "Other", icon: "💬" },
];
const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Real Estate",
  "Legal",
  "Marketing",
  "Venture Capital",
  "Other",
];
const EMOJIS = [
  "🐯",
  "🦁",
  "🦊",
  "🐺",
  "🦋",
  "🐬",
  "🦉",
  "🦝",
  "🐠",
  "🦌",
  "🦅",
  "🌊",
];
const MISSIONS = [
  {
    key: "scan",
    icon: "📷",
    label: "Scan a Business Card",
    hype: "Done. Like a machine.",
    xp: 50,
  },
  {
    key: "followup",
    icon: "✉️",
    label: "Log a Follow-up",
    hype: "They'll remember you.",
    xp: 25,
  },
  {
    key: "hot",
    icon: "🔥",
    label: "Follow Up a Hot Lead",
    hype: "Don't leave them hanging.",
    xp: 50,
  },
  {
    key: "response",
    icon: "✅",
    label: "Log a Response",
    hype: "They came back. Of course they did.",
    xp: 100,
  },
];
const BADGES = [
  { key: "card_shark", emoji: "🃏", label: "Card Shark", desc: "Scan 5 cards" },
  { key: "hot_streak", emoji: "🔥", label: "Hot Streak", desc: "7-day streak" },
  {
    key: "speed_dialer",
    emoji: "⚡",
    label: "Speed Dialer",
    desc: "Follow up within 24h",
  },
  {
    key: "networker",
    emoji: "🌐",
    label: "Networker",
    desc: "Add 10 contacts",
  },
  {
    key: "dealmaker",
    emoji: "💎",
    label: "Dealmaker",
    desc: "Response from Hot lead",
  },
  { key: "connector", emoji: "🌉", label: "Connector", desc: "Make 3 intros" },
  { key: "legend", emoji: "👑", label: "Legend", desc: "Reach Level 9" },
];
const VIBE_MOODS = [
  {
    e: "😶‍🌫️",
    title: "Feeling antisocial?",
    color: "blue",
    body: "One message. You don't have to be 'on' — just human.",
  },
  {
    e: "🔥",
    title: "You are killing it.",
    color: "green",
    body: "Contacts growing, streak alive. This is real momentum.",
  },
  {
    e: "😴",
    title: "A little tired today?",
    color: "blue",
    body: "A 2-second reaction keeps the connection warm.",
  },
  {
    e: "🏆",
    title: "You are brilliant at this.",
    color: "green",
    body: "You show up and follow through. That's rare.",
  },
  {
    e: "🛋️",
    title: "Introverted this week?",
    color: "purple",
    body: "3 hot leads. One message each. Done in 5 minutes.",
  },
];
const TOUGH_CARDS = [
  {
    q: "Your hot leads are going cold right now.",
    b: "These conversations could change things. <em>One text.</em> Not five. <strong>One.</strong>",
  },
  {
    q: "The follow-up window does not stay open forever.",
    b: "It's still open <em>right now.</em> You'll feel better the second you hit send.",
  },
  {
    q: "Your streak is worth protecting tonight.",
    b: "You've been showing up. Don't break it. One touchpoint. Just <em>real.</em>",
  },
];
const HYPE_CARDS = [
  {
    q: "Your response rate is well above average.",
    b: "People reply because <strong>you're worth their time.</strong> Go remind someone you exist.",
  },
  {
    q: "You are in the top tier of networkers.",
    b: "You show up, follow through, make people feel seen. <strong>Own it.</strong>",
  },
  {
    q: "Every great connection started with one message.",
    b: "Not a pitch deck. Not a post. <em>One message.</em> <strong>Do it again.</strong>",
  },
];
const COLD_WARMERS = [
  "Maybe they just need time to thaw out. You met for a reason.",
  "Slow burns lead to the best leads. Your patience is a competitive advantage.",
  "Maybe they're just busy — remind them how you can help.",
];

// ── Computed ───────────────────────────────────────────────────────────────
const selContact = computed(
  () => contacts.value.find((c) => c.id === selectedId.value) ?? null,
);
const coldCs = computed(() =>
  contacts.value.filter((c) => c.rating === "cold" && !c.hibernated),
);
const hibCs = computed(() => contacts.value.filter((c) => c.hibernated));
const alertCs = computed(() =>
  contacts.value.filter(
    (c) => !c.hibernated && followUpStatus(c) === "overdue",
  ),
);
const hotCount = computed(
  () => contacts.value.filter((c) => c.rating === "hot").length,
);
const curMood = computed(() => VIBE_MOODS[moodIdx.value % VIBE_MOODS.length]);
const curTough = computed(
  () => TOUGH_CARDS[toughIdx.value % TOUGH_CARDS.length],
);
const curHype = computed(() => HYPE_CARDS[hypeIdx.value % HYPE_CARDS.length]);
const addName = computed(() =>
  [addForm.value.firstName, addForm.value.lastName].filter(Boolean).join(" "),
);

const RORD: Record<string, number> = { hot: 0, warm: 1, nurture: 2, cold: 3 };
const filteredCs = computed(() => {
  const q = cSearch.value.toLowerCase();
  let list = contacts.value.filter(
    (c) =>
      !c.hibernated &&
      (c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q)) &&
      (!cFilter.value || c.rating === cFilter.value),
  );
  if (cSort.value === "hot")
    list = [...list].sort(
      (a, b) => (RORD[a.rating ?? ""] ?? 4) - (RORD[b.rating ?? ""] ?? 4),
    );
  if (cSort.value === "name")
    list = [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  return list;
});

const sortedActs = computed(() => {
  if (!selContact.value?.activities?.length) return [];
  return [...(selContact.value.activities as any[])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
});

const sDots = computed(() => {
  const dots = [];
  for (let i = 0; i < 7; i++) {
    const ago = 6 - i;
    if (ago === 0) dots.push(xp.value.streak > 0 ? "today" : "empty");
    else dots.push(xp.value.streak > ago ? "done" : "empty");
  }
  return dots;
});

// ── Helpers ────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function fmtShort(d?: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
function fmtFull(d?: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function cEmoji(c: any) {
  const id = c.id ?? "";
  return EMOJIS[
    Math.abs((id.charCodeAt(0) || 0) + (id.charCodeAt(1) || 0)) % EMOJIS.length
  ];
}
function getRating(k: string) {
  return RATINGS.find((r) => r.key === k) ?? null;
}
function getAct(k: string) {
  return ACT_TYPES.find((a) => a.key === k) ?? ACT_TYPES[5];
}
function coldWarmer(c: any) {
  return COLD_WARMERS[
    Math.abs((c.id ?? "").charCodeAt(0) || 0) % COLD_WARMERS.length
  ];
}
function fuInfo(c: any) {
  const s = followUpStatus(c);
  const la = lastActivity(c) as any;
  const d = daysSince(c);
  return {
    overdue: {
      ico: "⚡",
      cls: "overdue",
      title: `${d} days overdue`,
      sub: `Last: ${la?.label ?? "Contact"} on ${fmtFull(la?.date)}`,
    },
    due: {
      ico: "⏰",
      cls: "due",
      title: `${d} days — right on the line`,
      sub: "A quick touch now resets the clock.",
    },
    ok: {
      ico: "✓",
      cls: "ok",
      title: "You're on top of this one",
      sub: `Last: ${la?.label ?? "Contact"} on ${fmtFull(la?.date)}`,
    },
    new: {
      ico: "👋",
      cls: "new",
      title: "No activity yet",
      sub: "Log your first touchpoint below.",
    },
  }[s];
}
function fireConfetti() {
  confettiLib({
    particleCount: 60,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#00ff87", "#ffd700", "#ff6b35", "#4da6ff", "#b87dff"],
  });
}

// ── Navigation ─────────────────────────────────────────────────────────────
function nav(s: Screen) {
  screen.value = s;
}
function goDetail(id: string) {
  selectedId.value = id;
  editing.value = false;
  nav("detail");
}
function toggleCold(id: string) {
  openCold.value.has(id) ? openCold.value.delete(id) : openCold.value.add(id);
}

// ── Actions ────────────────────────────────────────────────────────────────
async function doHibernate(id: string) {
  await hibernate(id);
  openCold.value.delete(id);
}
async function doWake(id: string) {
  await wake(id);
  earn(10, "🌅", "Welcome back.");
}
async function doLogAct(isResp: boolean) {
  if (!selContact.value) return;
  const c = selContact.value as any;
  await logActivity({
    contact: c.id,
    type: actType.value,
    label: getAct(actType.value).label,
    date: actDate.value || todayStr(),
    note: actNote.value,
    is_response: isResp,
  });
  actNote.value = "";
  actDate.value = todayStr();
  if (isResp) {
    const extras =
      c.rating === "hot"
        ? { hot_responses: (xp.value.hot_responses ?? 0) + 1 }
        : {};
    earn(100, "🎉", "They came back. Of course they did.", extras);
    fireConfetti();
  } else {
    c.rating === "hot"
      ? earn(50, "⚡", "Don't leave them hanging.")
      : earn(25, "✉️", "They'll remember you.");
  }
}
async function doMarkResponded(actId: string) {
  if (!selContact.value) return;
  const c = selContact.value as any;
  await markResponded(c.id, actId);
  earn(100, "🎉", "They replied!", {
    hot_responses: (xp.value.hot_responses ?? 0) + 1,
  });
  fireConfetti();
}
async function doSaveContact() {
  if (!addName.value) return;
  const contact = await createContact({
    name: addName.value,
    first_name: addForm.value.firstName || undefined,
    last_name: addForm.value.lastName || undefined,
    title: addForm.value.title || undefined,
    company: addForm.value.company || undefined,
    email: addForm.value.email || undefined,
    phone: addForm.value.phone || undefined,
    industry: addForm.value.industry || undefined,
    met_at: addForm.value.metAt || undefined,
    rating: (addForm.value.rating as any) || undefined,
    notes: addForm.value.notes || undefined,
  });
  earn(25, "💾", "They're in your network.", {
    total_contacts: contacts.value.length,
  });
  addForm.value = {
    firstName: "",
    lastName: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    industry: "",
    metAt: "",
    rating: "",
    notes: "",
  };
  goDetail(contact.id);
}
async function doSaveEdit() {
  if (!selContact.value) return;
  const c = selContact.value as any;
  await updateContact(c.id, editForm.value);
  editing.value = false;
}
function startEdit() {
  const c = selContact.value as any;
  if (!c) return;
  editForm.value = {
    name: c.name,
    title: c.title,
    company: c.company,
    email: c.email,
    phone: c.phone,
    industry: c.industry,
    met_at: c.met_at,
    rating: c.rating,
    notes: c.notes,
  };
  editing.value = true;
}
function doMission(key: string) {
  if (xp.value.completed_missions.includes(key)) return;
  xp.value.completed_missions.push(key);
  earn(50, "🎯", "Mission complete.");
}

// ── Card scan ──────────────────────────────────────────────────────────────
const scanResult = ref<any>(null);
const showScanForm = ref(false);

async function doScan() {
  try {
    const result = await openCamera();
    scanResult.value = result;
    // Pre-fill the add form
    addForm.value = {
      firstName: result.first_name ?? "",
      lastName: result.last_name ?? "",
      title: result.title ?? "",
      company: result.company ?? "",
      email: result.email ?? "",
      phone: result.phone ?? "",
      industry: result.industry ?? "",
      metAt: addForm.value.metAt,
      rating: "",
      notes: [result.website, result.linkedin, result.address]
        .filter(Boolean)
        .join("\n"),
    };
    earn(50, "📷", "Card scanned!", {
      total_scans: (xp.value.total_scans ?? 0) + 1,
    });
    fireConfetti();
    nav("add");
  } catch (err: any) {
    if (err?.message !== "Cancelled") {
      console.error("[scan]", err);
    }
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([fetchContacts(), loadXp()]);
});
</script>
<template>
  <div class="cd-root">
    <!-- ══ PHONE ══════════════════════════════════════════════════════════════ -->
    <div class="cd-phone-col">
      <div class="cd-phone">
        <div class="cd-notch"></div>
        <div class="cd-inner">
          <div class="cd-sbar">
            <span>{{
              new Date().toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            }}</span>
            <span style="font-family: monospace"
              >Card<span style="color: #00ff87">Desk</span></span
            >
          </div>

          <!-- ■ VIBE ■ -->
          <div class="cd-screen" :class="{ on: screen === 'vibe' }">
            <div class="cd-shdr"><div class="cd-stitle">Your Vibe ⚡</div></div>
            <div class="cd-scrl cd-pad">
              <div class="cd-sess-entry" @click="nav('session')">
                <div class="cd-se-top">
                  <span style="font-size: 26px">🎙</span>
                  <div>
                    <div class="cd-se-ttl">Need a session?</div>
                    <div class="cd-se-sub">30 seconds. Promise.</div>
                  </div>
                </div>
                <div class="cd-se-modes">
                  <button
                    class="cd-semp tg"
                    @click.stop="
                      sessionMode = 'tough';
                      nav('session');
                    "
                  >
                    💪 Talking to
                  </button>
                  <button
                    class="cd-semp pk"
                    @click.stop="
                      sessionMode = 'hype';
                      nav('session');
                    "
                  >
                    🏆 Picker upper
                  </button>
                </div>
              </div>

              <div
                class="cd-vc hype"
                @click="earn(20, '🏆', 'Network hype claimed.')"
              >
                <div class="cd-vct">
                  <span class="cd-vci">🏆</span>
                  <div>
                    <div class="cd-vch" style="color: #00ff87">
                      Nobody crushes it like you.
                    </div>
                    <div class="cd-vcb">
                      {{ contacts.length }} contacts · {{ xp.streak }}-day
                      streak. <strong>You're building something real.</strong>
                    </div>
                  </div>
                  <span class="cd-xpb">+20 XP</span>
                </div>
              </div>

              <div
                v-if="coldCs.length"
                class="cd-vc cold-vc"
                @click="nav('cold')"
              >
                <div class="cd-vct">
                  <span class="cd-vci">❄️</span>
                  <div>
                    <div class="cd-vch" style="color: #a8d8ea">
                      {{ coldCs[0].name }} has gone quiet.
                    </div>
                    <div class="cd-vcb">
                      One check-in could be all it takes.
                    </div>
                  </div>
                </div>
                <button class="cd-abtn ice" @click.stop="nav('cold')">
                  🌡 See cold contacts
                </button>
              </div>

              <div
                v-if="alertCs.length"
                class="cd-vc warn"
                @click="goDetail(alertCs[0].id)"
              >
                <div class="cd-vct">
                  <span class="cd-vci">⚡</span>
                  <div>
                    <div class="cd-vch" style="color: #ff6b35">
                      {{ alertCs[0].name }} is slipping away.
                    </div>
                    <div class="cd-vcb">
                      {{ daysSince(alertCs[0]) }} days without a follow-up.
                    </div>
                  </div>
                </div>
                <button class="cd-abtn o" @click.stop="goDetail(alertCs[0].id)">
                  ⚡ Follow up now
                </button>
              </div>

              <div class="cd-mood" @click="moodIdx++">
                <div style="font-size: 24px; margin-bottom: 5px">
                  {{ curMood.e }}
                </div>
                <div class="cd-mc-t" :class="curMood.color">
                  {{ curMood.title }}
                </div>
                <div class="cd-mc-b">{{ curMood.body }}</div>
                <div style="font-size: 10px; color: #3e4f68; margin-top: 6px">
                  tap to rotate
                </div>
              </div>
            </div>
            <nav class="cd-bnav">
              <button class="cd-bn on">
                <span class="cd-bni">⚡</span>Vibe
              </button>
              <button class="cd-bn" @click="nav('session')">
                <span class="cd-bni">🎙</span>Session
              </button>
              <button class="cd-bn" @click="nav('cold')">
                <span class="cd-bni">❄️</span>Cold
              </button>
              <button class="cd-bn" @click="nav('home')">
                <span class="cd-bni">🏠</span>Home
              </button>
              <button
                class="cd-bn"
                @click="nav('contacts')"
                style="position: relative"
              >
                <span v-if="alertCs.length" class="cd-nav-dot"></span>
                <span class="cd-bni">👥</span>Network
              </button>
            </nav>
          </div>

          <!-- ■ SESSION ■ -->
          <div class="cd-screen" :class="{ on: screen === 'session' }">
            <div class="cd-scrl cd-pad">
              <div style="text-align: center; padding: 14px 0 16px">
                <div
                  style="
                    font-family: &quot;Bebas Neue&quot;, sans-serif;
                    font-size: 44px;
                    line-height: 1;
                  "
                >
                  Need a session?
                </div>
                <div style="font-size: 12px; color: #8898b0; margin-top: 4px">
                  Pick your vibe.
                </div>
              </div>
              <div
                style="
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 8px;
                  margin-bottom: 14px;
                "
              >
                <div
                  class="cd-mcard tg"
                  :class="{ sel: sessionMode === 'tough' }"
                  @click="sessionMode = 'tough'"
                >
                  <div style="font-size: 28px; margin-bottom: 6px">💪</div>
                  <div class="cd-mc-lbl">Need a talking to</div>
                  <div class="cd-mc-sub">Real talk. Time to move.</div>
                </div>
                <div
                  class="cd-mcard pk"
                  :class="{ sel: sessionMode === 'hype' }"
                  @click="sessionMode = 'hype'"
                >
                  <div style="font-size: 28px; margin-bottom: 6px">🏆</div>
                  <div class="cd-mc-lbl">Picker upper</div>
                  <div class="cd-mc-sub">Pure hype.</div>
                </div>
              </div>
              <Transition name="cd-pop">
                <div v-if="sessionMode === 'tough'" class="cd-scard tc">
                  <div class="cd-sc-eye orange">
                    Round {{ (toughIdx % 3) + 1 }} of 3
                  </div>
                  <div class="cd-sc-q">"{{ curTough.q }}"</div>
                  <div class="cd-sc-b" v-html="curTough.b"></div>
                  <button
                    class="cd-abtn o"
                    @click="
                      earn(25, '✉️', 'Sent.');
                      toughIdx++;
                    "
                  >
                    ✉ Send one text +25 XP
                  </button>
                  <div class="cd-nxt" @click="toughIdx++">Another one →</div>
                </div>
              </Transition>
              <Transition name="cd-pop">
                <div v-if="sessionMode === 'hype'" class="cd-scard hc">
                  <div class="cd-sc-eye green">
                    Round {{ (hypeIdx % 3) + 1 }} of 3
                  </div>
                  <div class="cd-sc-q">"{{ curHype.q }}"</div>
                  <div class="cd-sc-b" v-html="curHype.b"></div>
                  <button
                    class="cd-abtn g"
                    @click="
                      earn(25, '🚀', 'Logged.');
                      hypeIdx++;
                    "
                  >
                    🚀 Log a touchpoint +25 XP
                  </button>
                  <div class="cd-nxt" @click="hypeIdx++">Another one →</div>
                </div>
              </Transition>
              <div v-if="sessionMode" class="cd-lucky">
                <div style="font-size: 18px; margin-bottom: 4px">✨</div>
                <div
                  style="
                    font-size: 15px;
                    font-weight: 800;
                    color: #00ff87;
                    margin-bottom: 3px;
                  "
                >
                  Remember
                </div>
                <div style="font-size: 12px; color: #8898b0; line-height: 1.6">
                  <em style="color: #f0f4ff"
                    >They are the lucky ones to hear from you.</em
                  ><br />
                  You reaching out is a gift. Own it.
                </div>
              </div>
            </div>
            <nav class="cd-bnav">
              <button class="cd-bn" @click="nav('vibe')">
                <span class="cd-bni">⚡</span>Vibe
              </button>
              <button class="cd-bn on">
                <span class="cd-bni">🎙</span>Session
              </button>
              <button class="cd-bn" @click="nav('cold')">
                <span class="cd-bni">❄️</span>Cold
              </button>
              <button class="cd-bn" @click="nav('home')">
                <span class="cd-bni">🏠</span>Home
              </button>
              <button class="cd-bn" @click="nav('contacts')">
                <span class="cd-bni">👥</span>Network
              </button>
            </nav>
          </div>

          <!-- ■ COLD ■ -->
          <div class="cd-screen" :class="{ on: screen === 'cold' }">
            <div class="cd-shdr">
              <div class="cd-stitle">❄️ Cold Contacts</div>
            </div>
            <div class="cd-scrl cd-pad">
              <div v-if="!coldCs.length && !hibCs.length" class="cd-empty">
                <div style="font-size: 40px; margin-bottom: 10px">❄️</div>
                <div
                  style="font-size: 18px; font-weight: 800; margin-bottom: 6px"
                >
                  No cold contacts
                </div>
                <div style="font-size: 12px; color: #8898b0">
                  Rate a contact ❄️ Cold and they'll appear here.
                </div>
              </div>
              <template v-if="coldCs.length">
                <div class="cd-sec-lbl">❄️ Cold</div>
                <div v-for="c in coldCs" :key="c.id" class="cd-cold-card">
                  <div class="cd-cc-top" @click="toggleCold(c.id)">
                    <div class="cd-cc-av">{{ cEmoji(c) }}</div>
                    <div style="flex: 1; min-width: 0">
                      <div class="cd-cc-nm">{{ c.name }}</div>
                      <div class="cd-cc-sb">
                        {{ [c.title, c.company].filter(Boolean).join(" · ") }}
                      </div>
                    </div>
                    <span class="cd-cpill">❄️ Cold</span>
                  </div>
                  <Transition name="cd-expand">
                    <div v-if="openCold.has(c.id)" class="cd-cw">
                      <div class="cd-cw-q">"{{ coldWarmer(c) }}"</div>
                      <div style="display: flex; gap: 6px">
                        <button
                          class="cd-cwb reach"
                          @click="
                            earn(25, '📧', 'Reached out.');
                            toggleCold(c.id);
                          "
                        >
                          📧 Reach out +25 XP
                        </button>
                        <button class="cd-cwb hib" @click="doHibernate(c.id)">
                          Hibernate 😴
                        </button>
                      </div>
                    </div>
                  </Transition>
                </div>
              </template>
              <template v-if="hibCs.length">
                <div class="cd-sec-lbl" style="margin-top: 16px">
                  😴 Hibernating
                </div>
                <div
                  v-for="c in hibCs"
                  :key="c.id"
                  class="cd-cold-card"
                  style="opacity: 0.6"
                >
                  <div class="cd-cc-top" @click="toggleCold(c.id + '_h')">
                    <div class="cd-cc-av">{{ cEmoji(c) }}</div>
                    <div style="flex: 1; min-width: 0">
                      <div class="cd-cc-nm">{{ c.name }}</div>
                      <div class="cd-cc-sb">
                        {{ [c.title, c.company].filter(Boolean).join(" · ") }}
                      </div>
                    </div>
                    <span class="cd-hpill">😴</span>
                  </div>
                  <Transition name="cd-expand">
                    <div v-if="openCold.has(c.id + '_h')" class="cd-cw">
                      <div class="cd-cw-q" style="color: #3e4f68">
                        Smart networkers pause, not delete.
                      </div>
                      <button
                        class="cd-cwb wake"
                        @click="
                          doWake(c.id);
                          openCold.delete(c.id + '_h');
                        "
                      >
                        Wake up 🌅
                      </button>
                    </div>
                  </Transition>
                </div>
              </template>
            </div>
            <nav class="cd-bnav">
              <button class="cd-bn" @click="nav('vibe')">
                <span class="cd-bni">⚡</span>Vibe
              </button>
              <button class="cd-bn" @click="nav('session')">
                <span class="cd-bni">🎙</span>Session
              </button>
              <button class="cd-bn on">
                <span class="cd-bni">❄️</span>Cold
              </button>
              <button class="cd-bn" @click="nav('home')">
                <span class="cd-bni">🏠</span>Home
              </button>
              <button class="cd-bn" @click="nav('contacts')">
                <span class="cd-bni">👥</span>Network
              </button>
            </nav>
          </div>

          <!-- ■ HOME ■ -->
          <div class="cd-screen" :class="{ on: screen === 'home' }">
            <div class="cd-scrl cd-pad">
              <div class="cd-hero">
                <div
                  style="
                    font-family: &quot;Bebas Neue&quot;, sans-serif;
                    font-size: 11px;
                    letter-spacing: 2px;
                    color: #00ff87;
                    margin-bottom: 2px;
                  "
                >
                  🏆 Rockstar Networker
                </div>
                <div
                  style="
                    font-family: &quot;Bebas Neue&quot;, sans-serif;
                    font-size: 40px;
                    line-height: 1;
                  "
                >
                  {{ curLevel.title }}
                </div>
                <div
                  style="
                    font-size: 11px;
                    color: #8898b0;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                  "
                >
                  Level {{ xp.level }} · {{ xp.total_xp }} XP
                </div>
                <div class="cd-xp-track">
                  <div class="cd-xp-fill" :style="'width:' + xpPct + '%'"></div>
                </div>
                <div style="display: flex; gap: 7px; margin-top: 10px">
                  <span
                    style="
                      background: rgba(0, 255, 135, 0.1);
                      border: 1px solid rgba(0, 255, 135, 0.25);
                      border-radius: 8px;
                      padding: 4px 11px;
                      font-size: 13px;
                      font-weight: 800;
                      color: #00ff87;
                    "
                    >LVL {{ xp.level }}</span
                  >
                  <span
                    v-if="nextLevel"
                    style="
                      background: rgba(255, 215, 0, 0.08);
                      border: 1px solid rgba(255, 215, 0, 0.25);
                      border-radius: 8px;
                      padding: 4px 11px;
                      font-size: 13px;
                      font-weight: 800;
                      color: #ffd700;
                    "
                    >{{ nextLevel.xp - xp.total_xp }} XP to
                    {{ nextLevel.title }}</span
                  >
                </div>
              </div>

              <div
                style="
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 8px;
                  margin-bottom: 11px;
                "
              >
                <div class="cd-stat">
                  <div class="cd-stat-n" style="color: #00ff87">
                    {{ contacts.length }}
                  </div>
                  <div class="cd-stat-l">Contacts</div>
                </div>
                <div class="cd-stat">
                  <div class="cd-stat-n" style="color: #ff6b35">
                    🔥{{ hotCount }}
                  </div>
                  <div class="cd-stat-l">Hot</div>
                </div>
                <div class="cd-stat">
                  <div class="cd-stat-n" style="color: #ffe033">
                    {{ alertCs.length }}
                  </div>
                  <div class="cd-stat-l">Overdue</div>
                </div>
              </div>

              <div class="cd-streak">
                <div
                  style="
                    font-size: 34px;
                    animation: cd-wig 1.8s ease-in-out infinite;
                    flex-shrink: 0;
                  "
                >
                  🔥
                </div>
                <div style="flex: 1">
                  <div
                    style="
                      font-family: &quot;Bebas Neue&quot;, sans-serif;
                      font-size: 40px;
                      color: #ff4500;
                      line-height: 1;
                    "
                  >
                    {{ xp.streak }}
                  </div>
                  <div
                    style="
                      font-size: 11px;
                      font-weight: 700;
                      color: #8898b0;
                      text-transform: uppercase;
                    "
                  >
                    Day Streak
                  </div>
                </div>
                <div style="display: flex; gap: 4px">
                  <div
                    v-for="(d, i) in sDots"
                    :key="i"
                    class="cd-sdot"
                    :class="d"
                  ></div>
                </div>
              </div>

              <div
                v-for="m in MISSIONS"
                :key="m.key"
                class="cd-mission"
                :class="{ done: xp.completed_missions.includes(m.key) }"
                @click="doMission(m.key)"
              >
                <div
                  class="cd-msn-glow"
                  :class="xp.completed_missions.includes(m.key) ? 'g' : 'o'"
                ></div>
                <span
                  style="
                    font-size: 20px;
                    width: 30px;
                    text-align: center;
                    flex-shrink: 0;
                  "
                  >{{ m.icon }}</span
                >
                <div style="flex: 1">
                  <div style="font-size: 13px; font-weight: 700">
                    {{ m.label }}
                  </div>
                  <div
                    style="font-size: 10px; color: #3e4f68; font-style: italic"
                  >
                    {{ m.hype }}
                  </div>
                </div>
                <span
                  v-if="!xp.completed_missions.includes(m.key)"
                  class="cd-xpb"
                  >+{{ m.xp }} XP</span
                >
                <span v-else>✅</span>
              </div>

              <div
                style="
                  display: flex;
                  gap: 7px;
                  overflow-x: auto;
                  padding: 4px 0 8px;
                  margin-top: 8px;
                "
              >
                <div
                  v-for="b in BADGES"
                  :key="b.key"
                  class="cd-badge"
                  :class="{ ul: xp.unlocked_badges.includes(b.key) }"
                >
                  <div
                    style="font-size: 22px; margin-bottom: 3px"
                    :style="
                      xp.unlocked_badges.includes(b.key)
                        ? ''
                        : 'filter:grayscale(1);opacity:0.2'
                    "
                  >
                    {{ b.emoji }}
                  </div>
                  <div
                    style="
                      font-size: 9px;
                      text-transform: uppercase;
                      font-weight: 700;
                    "
                    :style="
                      xp.unlocked_badges.includes(b.key)
                        ? 'color:#ffd700'
                        : 'color:#3e4f68'
                    "
                  >
                    {{ b.label }}
                  </div>
                </div>
              </div>

              <button
                class="cd-abtn"
                style="
                  background: transparent;
                  color: #3e4f68;
                  border-color: #1c2330;
                  font-size: 12px;
                  padding: 9px;
                  margin-top: 8px;
                "
                @click="logout"
              >
                Sign Out
              </button>
            </div>
            <nav class="cd-bnav">
              <button class="cd-bn" @click="nav('vibe')">
                <span class="cd-bni">⚡</span>Vibe
              </button>
              <button class="cd-bn" @click="nav('session')">
                <span class="cd-bni">🎙</span>Session
              </button>
              <button class="cd-bn" @click="nav('cold')">
                <span class="cd-bni">❄️</span>Cold
              </button>
              <button class="cd-bn on">
                <span class="cd-bni">🏠</span>Home
              </button>
              <button class="cd-bn" @click="nav('contacts')">
                <span class="cd-bni">👥</span>Network
              </button>
            </nav>
          </div>

          <!-- ■ CONTACTS ■ -->
          <div class="cd-screen" :class="{ on: screen === 'contacts' }">
            <div class="cd-shdr" style="padding-bottom: 8px">
              <div
                style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 6px;
                "
              >
                <div class="cd-stitle">My Network</div>
                <button
                  class="cd-abtn g"
                  style="width: auto; padding: 7px 12px; font-size: 12px"
                  @click="nav('add')"
                >
                  + Add
                </button>
              </div>
              <input
                v-model="cSearch"
                class="cd-inp"
                placeholder="Search..."
                style="margin-bottom: 8px"
              />
              <div
                style="
                  display: flex;
                  gap: 5px;
                  overflow-x: auto;
                  padding-bottom: 2px;
                "
              >
                <button
                  class="cd-pill"
                  :class="{ on: cFilter === '' }"
                  @click="cFilter = ''"
                >
                  All
                </button>
                <button
                  v-for="r in RATINGS"
                  :key="r.key"
                  class="cd-pill"
                  :class="[{ on: cFilter === r.key }, r.key]"
                  @click="cFilter = cFilter === r.key ? '' : r.key"
                >
                  {{ r.emoji }} {{ r.label }}
                </button>
              </div>
            </div>
            <div class="cd-scrl" style="padding: 4px 14px 8px">
              <div v-if="!contacts.length" class="cd-empty">
                <div style="font-size: 40px; margin-bottom: 10px">🃏</div>
                <div
                  style="font-size: 18px; font-weight: 800; margin-bottom: 12px"
                >
                  No contacts yet
                </div>
                <button class="cd-abtn g" @click="doScan">
                  📷 Scan First Card
                </button>
              </div>
              <div
                v-for="c in filteredCs"
                :key="c.id"
                class="cd-crd"
                @click="goDetail(c.id)"
              >
                <div class="cd-cbar" :class="c.rating || 'none'"></div>
                <div class="cd-cav">{{ cEmoji(c) }}</div>
                <div style="flex: 1; min-width: 0">
                  <div class="cd-cnm">{{ c.name }}</div>
                  <div class="cd-csb">
                    {{ [c.title, c.company].filter(Boolean).join(" · ") }}
                  </div>
                </div>
                <div
                  style="
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                    flex-shrink: 0;
                  "
                >
                  <span v-if="c.rating" class="cd-rpill" :class="c.rating"
                    >{{ getRating(c.rating)?.emoji }}
                    {{ getRating(c.rating)?.label }}</span
                  >
                  <span
                    v-if="followUpStatus(c) === 'overdue'"
                    style="font-size: 9px; color: #ff6b35; font-weight: 700"
                    >⚡ overdue</span
                  >
                </div>
              </div>
            </div>
            <nav class="cd-bnav">
              <button class="cd-bn" @click="nav('vibe')">
                <span class="cd-bni">⚡</span>Vibe
              </button>
              <button class="cd-bn" @click="nav('session')">
                <span class="cd-bni">🎙</span>Session
              </button>
              <button class="cd-bn" @click="nav('cold')">
                <span class="cd-bni">❄️</span>Cold
              </button>
              <button class="cd-bn" @click="nav('home')">
                <span class="cd-bni">🏠</span>Home
              </button>
              <button class="cd-bn on">
                <span class="cd-bni">👥</span>Network
              </button>
            </nav>
          </div>

          <!-- ■ DETAIL ■ -->
          <div class="cd-screen" :class="{ on: screen === 'detail' }">
            <template v-if="selContact">
              <template v-if="editing">
                <div class="cd-scrl cd-pad">
                  <button class="cd-back" @click="editing = false">
                    ← Cancel
                  </button>
                  <div
                    style="
                      font-size: 18px;
                      font-weight: 800;
                      margin-bottom: 12px;
                    "
                  >
                    Edit Contact
                  </div>
                  <label class="cd-lbl">Name</label
                  ><input v-model="editForm.name" class="cd-inp" />
                  <div
                    style="
                      display: grid;
                      grid-template-columns: 1fr 1fr;
                      gap: 8px;
                    "
                  >
                    <div>
                      <label class="cd-lbl">Title</label
                      ><input v-model="editForm.title" class="cd-inp" />
                    </div>
                    <div>
                      <label class="cd-lbl">Company</label
                      ><input v-model="editForm.company" class="cd-inp" />
                    </div>
                  </div>
                  <label class="cd-lbl">Email</label
                  ><input
                    v-model="editForm.email"
                    class="cd-inp"
                    type="email"
                  />
                  <label class="cd-lbl">Phone</label
                  ><input v-model="editForm.phone" class="cd-inp" />
                  <label class="cd-lbl">Rating</label>
                  <div
                    style="
                      display: flex;
                      gap: 6px;
                      flex-wrap: wrap;
                      margin-bottom: 10px;
                    "
                  >
                    <button
                      v-for="r in RATINGS"
                      :key="r.key"
                      class="cd-rpick"
                      :style="
                        editForm.rating === r.key
                          ? 'background:' +
                            r.color +
                            '22;border-color:' +
                            r.color +
                            ';color:' +
                            r.color
                          : ''
                      "
                      @click="
                        editForm.rating = editForm.rating === r.key ? '' : r.key
                      "
                    >
                      {{ r.emoji }} {{ r.label }}
                    </button>
                  </div>
                  <label class="cd-lbl">Notes</label
                  ><textarea
                    v-model="editForm.notes"
                    class="cd-inp"
                    style="min-height: 60px; resize: vertical"
                  ></textarea>
                  <button
                    class="cd-abtn g"
                    style="margin-top: 4px"
                    @click="doSaveEdit"
                  >
                    Save Changes
                  </button>
                </div>
              </template>
              <template v-else>
                <div class="cd-scrl cd-pad">
                  <button class="cd-back" @click="nav('contacts')">
                    ← Back
                  </button>
                  <div class="cd-det-hero">
                    <div
                      style="
                        display: flex;
                        align-items: center;
                        gap: 11px;
                        margin-bottom: 10px;
                      "
                    >
                      <div class="cd-det-av">{{ cEmoji(selContact) }}</div>
                      <div>
                        <div
                          style="
                            font-family: &quot;Bebas Neue&quot;, sans-serif;
                            font-size: 26px;
                            line-height: 1;
                            margin-bottom: 3px;
                          "
                        >
                          {{ selContact.name }}
                        </div>
                        <div style="font-size: 12px; color: #8898b0">
                          {{
                            [
                              (selContact as any).title,
                              (selContact as any).company,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          }}
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap">
                      <span
                        v-if="selContact.rating"
                        class="cd-rpill"
                        :class="selContact.rating"
                        >{{ getRating(selContact.rating)?.emoji }}
                        {{ getRating(selContact.rating)?.label }}</span
                      >
                      <span
                        v-if="(selContact as any).industry"
                        class="cd-tag-ind"
                        >{{ (selContact as any).industry }}</span
                      >
                      <span v-if="(selContact as any).met_at" class="cd-tag-ind"
                        >@ {{ (selContact as any).met_at }}</span
                      >
                    </div>
                  </div>

                  <div class="cd-fu-banner" :class="followUpStatus(selContact)">
                    <span style="font-size: 20px; flex-shrink: 0">{{
                      fuInfo(selContact)?.ico
                    }}</span>
                    <div>
                      <div class="cd-fu-t">{{ fuInfo(selContact)?.title }}</div>
                      <div class="cd-fu-s">{{ fuInfo(selContact)?.sub }}</div>
                    </div>
                  </div>

                  <div
                    v-if="
                      (selContact as any).email || (selContact as any).phone
                    "
                    class="cd-info-grid"
                  >
                    <div v-if="(selContact as any).email" class="cd-info-row">
                      <span class="cd-info-k">📧</span>
                      <a
                        :href="'mailto:' + (selContact as any).email"
                        class="cd-info-v"
                        style="color: #4da6ff"
                        >{{ (selContact as any).email }}</a
                      >
                    </div>
                    <div v-if="(selContact as any).phone" class="cd-info-row">
                      <span class="cd-info-k">📞</span>
                      <a
                        :href="'tel:' + (selContact as any).phone"
                        class="cd-info-v"
                        style="color: #4da6ff"
                        >{{ (selContact as any).phone }}</a
                      >
                    </div>
                  </div>

                  <div class="cd-log-sec">
                    <div
                      style="
                        font-size: 12px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        color: #3e4f68;
                        margin-bottom: 8px;
                      "
                    >
                      Log a touchpoint
                    </div>
                    <div
                      style="
                        display: flex;
                        gap: 4px;
                        flex-wrap: wrap;
                        margin-bottom: 8px;
                      "
                    >
                      <button
                        v-for="t in ACT_TYPES"
                        :key="t.key"
                        class="cd-act-type"
                        :class="{ sel: actType === t.key }"
                        @click="actType = t.key"
                      >
                        <span
                          style="
                            font-size: 14px;
                            display: block;
                            margin-bottom: 2px;
                          "
                          >{{ t.icon }}</span
                        >{{ t.label }}
                      </button>
                    </div>
                    <input
                      v-model="actNote"
                      class="cd-inp"
                      placeholder="Quick note..."
                      style="margin-bottom: 7px"
                    />
                    <div style="display: flex; gap: 6px">
                      <input
                        v-model="actDate"
                        type="date"
                        class="cd-inp"
                        style="flex: 0 0 130px; margin-bottom: 0"
                      />
                      <button
                        class="cd-abtn g"
                        style="flex: 1; font-size: 12px; padding: 9px 6px"
                        @click="doLogAct(false)"
                      >
                        ✅ Log +25 XP
                      </button>
                      <button
                        class="cd-abtn b"
                        style="flex: 1; font-size: 12px; padding: 9px 6px"
                        @click="doLogAct(true)"
                      >
                        🎉 Replied! +100
                      </button>
                    </div>
                  </div>

                  <div
                    v-for="(act, i) in sortedActs"
                    :key="act.id"
                    style="
                      display: flex;
                      gap: 9px;
                      margin-bottom: 13px;
                      position: relative;
                    "
                  >
                    <div
                      v-if="i < sortedActs.length - 1"
                      style="
                        position: absolute;
                        left: 17px;
                        top: 36px;
                        width: 2px;
                        bottom: -13px;
                        background: #1c2330;
                      "
                    ></div>
                    <div class="cd-tl-dot" :class="act.type">
                      {{ getAct(act.type).icon }}
                    </div>
                    <div
                      style="
                        flex: 1;
                        background: #0d1018;
                        border: 1px solid #1c2330;
                        border-radius: 12px;
                        padding: 10px 12px;
                      "
                    >
                      <div
                        style="
                          display: flex;
                          justify-content: space-between;
                          margin-bottom: 4px;
                        "
                      >
                        <div style="font-size: 14px; font-weight: 800">
                          {{ act.label }}
                        </div>
                        <div
                          style="
                            font-size: 10px;
                            color: #3e4f68;
                            font-family: monospace;
                          "
                        >
                          {{ fmtFull(act.date) }}
                        </div>
                      </div>
                      <div
                        v-if="act.note"
                        style="
                          font-size: 12px;
                          color: #8898b0;
                          line-height: 1.5;
                          margin-bottom: 7px;
                        "
                      >
                        {{ act.note }}
                      </div>
                      <div
                        class="cd-tl-resp"
                        :class="act.is_response ? 'yes' : 'no'"
                        @click="!act.is_response && doMarkResponded(act.id)"
                      >
                        {{
                          act.is_response
                            ? "✓ " + (act.response_note || "Responded")
                            : "○ No reply — tap to mark"
                        }}
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; gap: 7px; margin: 8px 0 20px">
                    <button
                      class="cd-abtn"
                      style="
                        flex: 1;
                        background: transparent;
                        color: #8898b0;
                        border-color: #1c2330;
                        font-size: 12px;
                        padding: 9px;
                      "
                      @click="startEdit"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      class="cd-abtn"
                      style="
                        flex: 1;
                        background: transparent;
                        color: #3e4f68;
                        border-color: #1c2330;
                        font-size: 12px;
                        padding: 9px;
                      "
                      @click="
                        doHibernate(selContact.id);
                        nav('contacts');
                      "
                    >
                      😴 Hibernate
                    </button>
                  </div>
                </div>
              </template>
            </template>
            <nav class="cd-bnav">
              <button class="cd-bn" @click="nav('vibe')">
                <span class="cd-bni">⚡</span>Vibe
              </button>
              <button class="cd-bn" @click="nav('session')">
                <span class="cd-bni">🎙</span>Session
              </button>
              <button class="cd-bn" @click="nav('cold')">
                <span class="cd-bni">❄️</span>Cold
              </button>
              <button class="cd-bn" @click="nav('home')">
                <span class="cd-bni">🏠</span>Home
              </button>
              <button class="cd-bn on" @click="nav('contacts')">
                <span class="cd-bni">👥</span>Network
              </button>
            </nav>
          </div>

          <!-- ■ ADD ■ -->
          <div class="cd-screen" :class="{ on: screen === 'add' }">
            <div class="cd-shdr">
              <button class="cd-back" @click="nav('contacts')">← Back</button>
              <div class="cd-stitle">Add Contact</div>
            </div>
            <div class="cd-scrl cd-pad">
              <div class="cd-scan-zone" @click="doScan">
                <div
                  v-if="scanning"
                  style="font-size: 44px; animation: cd-wig 0.6s infinite"
                >
                  ⏳
                </div>
                <div v-else style="font-size: 44px; margin-bottom: 8px">📷</div>
                <div
                  style="
                    font-family: &quot;Bebas Neue&quot;, sans-serif;
                    font-size: 20px;
                    letter-spacing: 1px;
                    color: #00ff87;
                    margin-bottom: 4px;
                  "
                >
                  {{ scanning ? "Reading card..." : "Scan Business Card" }}
                </div>
                <div style="font-size: 11px; color: #3e4f68">
                  {{
                    scanning
                      ? "Claude AI is extracting the details"
                      : "AI reads name, email, phone, company instantly"
                  }}
                </div>
                <span
                  class="cd-xpb"
                  style="margin-top: 9px; display: inline-block"
                  >+50 XP</span
                >
              </div>
              <div
                v-if="scanError"
                style="
                  background: rgba(255, 107, 53, 0.1);
                  border: 1px solid rgba(255, 107, 53, 0.3);
                  border-radius: 10px;
                  padding: 10px 13px;
                  margin-bottom: 10px;
                  font-size: 12px;
                  color: #ff6b35;
                "
              >
                {{ scanError }}
              </div>
              <div
                style="
                  display: flex;
                  align-items: center;
                  gap: 10px;
                  color: #3e4f68;
                  font-size: 10px;
                  margin: 12px 0;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  font-weight: 700;
                "
              >
                <div style="flex: 1; height: 1px; background: #1c2330"></div>
                or enter manually
                <div style="flex: 1; height: 1px; background: #1c2330"></div>
              </div>
              <div
                style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px"
              >
                <div>
                  <label class="cd-lbl">First Name</label
                  ><input
                    v-model="addForm.firstName"
                    class="cd-inp"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label class="cd-lbl">Last Name</label
                  ><input
                    v-model="addForm.lastName"
                    class="cd-inp"
                    placeholder="Smith"
                  />
                </div>
              </div>
              <label class="cd-lbl">Title</label
              ><input
                v-model="addForm.title"
                class="cd-inp"
                placeholder="VP Product"
              />
              <label class="cd-lbl">Company</label
              ><input
                v-model="addForm.company"
                class="cd-inp"
                placeholder="Acme Corp"
              />
              <label class="cd-lbl">Email</label
              ><input
                v-model="addForm.email"
                class="cd-inp"
                type="email"
                placeholder="jane@acme.com"
              />
              <label class="cd-lbl">Phone</label
              ><input
                v-model="addForm.phone"
                class="cd-inp"
                type="tel"
                placeholder="+1 555 000 0000"
              />
              <label class="cd-lbl">Where We Met</label
              ><input
                v-model="addForm.metAt"
                class="cd-inp"
                placeholder="SaaS Summit NYC"
              />
              <label class="cd-lbl">Industry</label>
              <select
                v-model="addForm.industry"
                class="cd-inp"
                style="cursor: pointer"
              >
                <option value="">Select...</option>
                <option v-for="ind in INDUSTRIES" :key="ind" :value="ind">
                  {{ ind }}
                </option>
              </select>
              <label class="cd-lbl">Rating</label>
              <div
                style="
                  display: flex;
                  gap: 6px;
                  flex-wrap: wrap;
                  margin-bottom: 10px;
                "
              >
                <button
                  v-for="r in RATINGS"
                  :key="r.key"
                  class="cd-rpick"
                  :style="
                    addForm.rating === r.key
                      ? 'background:' +
                        r.color +
                        '22;border-color:' +
                        r.color +
                        ';color:' +
                        r.color
                      : ''
                  "
                  @click="
                    addForm.rating = addForm.rating === r.key ? '' : r.key
                  "
                >
                  {{ r.emoji }} {{ r.label }}
                </button>
              </div>
              <label class="cd-lbl">Notes</label>
              <textarea
                v-model="addForm.notes"
                class="cd-inp"
                style="min-height: 60px; resize: vertical"
                placeholder="Anything useful..."
              ></textarea>
              <button
                class="cd-abtn g"
                style="font-size: 16px; padding: 13px; margin-top: 4px"
                :disabled="!addName"
                @click="doSaveContact"
              >
                SAVE + EARN 25 XP →
              </button>
            </div>
            <nav class="cd-bnav">
              <button class="cd-bn" @click="nav('vibe')">
                <span class="cd-bni">⚡</span>Vibe
              </button>
              <button class="cd-bn" @click="nav('session')">
                <span class="cd-bni">🎙</span>Session
              </button>
              <button class="cd-bn" @click="nav('cold')">
                <span class="cd-bni">❄️</span>Cold
              </button>
              <button class="cd-bn" @click="nav('home')">
                <span class="cd-bni">🏠</span>Home
              </button>
              <button class="cd-bn on">
                <span class="cd-bni">📷</span>Add
              </button>
            </nav>
          </div>

          <!-- XP Toast -->
          <Transition name="cd-toast">
            <div v-if="toast" class="cd-toast">
              <span style="font-size: 18px">{{ toast.icon }}</span>
              <span
                style="
                  font-family: &quot;Bebas Neue&quot;, sans-serif;
                  font-size: 20px;
                  color: #00ff87;
                  letter-spacing: 1px;
                "
                >{{ toast.xp }}</span
              >
              <span style="font-size: 11px; color: #8898b0; font-weight: 600">{{
                toast.msg
              }}</span>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-root {
  --cd-bg: #060810;
  --cd-bg2: #0d1018;
  --cd-bdr: #1c2330;
  --cd-text: #f0f4ff;
  --cd-muted: #8898b0;
  --cd-dim: #3e4f68;
  --cd-accent: #00ff87;
  --cd-blue: #4da6ff;
  --cd-orange: #ff6b35;
  --cd-purple: #b87dff;
  --cd-ice: #a8d8ea;
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: "Barlow", sans-serif;
  align-items: center;
  justify-content: center;
}
.cd-phone-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.cd-phone {
  width: 354px;
  height: 742px;
  background: var(--cd-bg);
  border-radius: 44px;
  overflow: hidden;
  position: relative;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 32px 80px rgba(0, 0, 0, 0.95);
}
.cd-notch {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 88px;
  height: 26px;
  background: #000;
  border-radius: 20px;
  z-index: 100;
}
.cd-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.cd-sbar {
  padding: 44px 20px 0;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--cd-muted);
}
.cd-screen {
  display: none;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.cd-screen.on {
  display: flex;
}
.cd-scrl {
  flex: 1;
  overflow-y: auto;
}
.cd-scrl::-webkit-scrollbar {
  display: none;
}
.cd-pad {
  padding: 10px 14px;
}
.cd-shdr {
  padding: 12px 14px 8px;
  flex-shrink: 0;
}
.cd-stitle {
  font-family: "Bebas Neue", sans-serif;
  font-size: 28px;
  letter-spacing: 1px;
}
.cd-bnav {
  display: flex;
  background: rgba(6, 8, 16, 0.97);
  border-top: 1px solid var(--cd-bdr);
  padding: 7px 0 18px;
  flex-shrink: 0;
}
.cd-bn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 9px;
  font-family: sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--cd-dim);
  transition: color 0.15s;
  font-weight: 700;
  position: relative;
}
.cd-bn.on,
.cd-bn:hover {
  color: var(--cd-accent);
}
.cd-bni {
  font-size: 18px;
  line-height: 1.1;
}
.cd-nav-dot {
  position: absolute;
  top: 0;
  right: calc(50% - 16px);
  width: 7px;
  height: 7px;
  background: #ff6b35;
  border-radius: 50%;
  border: 2px solid var(--cd-bg);
  animation: cd-blink 2s infinite;
}
@keyframes cd-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.cd-abtn {
  width: 100%;
  padding: 10px;
  border-radius: 11px;
  border: 1px solid;
  font-family: sans-serif;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  text-transform: uppercase;
}
.cd-abtn.g {
  background: var(--cd-accent);
  color: #060810;
  border-color: var(--cd-accent);
}
.cd-abtn.g:hover {
  background: #1affa0;
}
.cd-abtn.b {
  background: rgba(77, 166, 255, 0.1);
  color: var(--cd-blue);
  border-color: rgba(77, 166, 255, 0.3);
}
.cd-abtn.o {
  background: rgba(255, 107, 53, 0.1);
  color: var(--cd-orange);
  border-color: rgba(255, 107, 53, 0.3);
}
.cd-abtn.ice {
  background: rgba(168, 216, 234, 0.08);
  color: var(--cd-ice);
  border-color: rgba(168, 216, 234, 0.3);
}
.cd-abtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cd-xpb {
  background: rgba(0, 255, 135, 0.1);
  border: 1px solid rgba(0, 255, 135, 0.2);
  border-radius: 6px;
  padding: 3px 8px;
  font-family: monospace;
  font-size: 11px;
  color: var(--cd-accent);
  font-weight: 700;
  flex-shrink: 0;
}
.cd-inp {
  width: 100%;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 10px;
  color: var(--cd-text);
  font-family: sans-serif;
  font-size: 13px;
  padding: 9px 12px;
  outline: none;
  transition: border-color 0.15s;
  margin-bottom: 8px;
  box-sizing: border-box;
}
.cd-inp:focus {
  border-color: #283245;
}
.cd-inp::placeholder {
  color: var(--cd-dim);
}
.cd-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--cd-dim);
  display: block;
  margin-bottom: 3px;
  font-weight: 700;
}
.cd-back {
  background: none;
  border: none;
  color: var(--cd-dim);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  margin-bottom: 12px;
}
.cd-rpick {
  flex: 1;
  padding: 7px 6px;
  border-radius: 9px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg2);
  color: var(--cd-dim);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.cd-empty {
  text-align: center;
  padding: 36px 16px;
  color: var(--cd-dim);
}
.cd-vc {
  border-radius: 15px;
  padding: 13px;
  margin-bottom: 9px;
  cursor: pointer;
  transition: all 0.15s;
}
.cd-vc:hover {
  transform: scale(1.01);
}
.cd-vc.hype {
  background: linear-gradient(135deg, #091808, #050d06);
  border: 1.5px solid rgba(0, 255, 135, 0.2);
}
.cd-vc.cold-vc {
  background: linear-gradient(135deg, #060c14, #050810);
  border: 1px solid rgba(168, 216, 234, 0.15);
}
.cd-vc.warn {
  background: linear-gradient(135deg, #190800, #0d0400);
  border: 1px solid rgba(255, 107, 53, 0.2);
}
.cd-vct {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 7px;
}
.cd-vci {
  font-size: 23px;
  flex-shrink: 0;
  width: 30px;
  text-align: center;
}
.cd-vch {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 3px;
}
.cd-vcb {
  font-size: 11px;
  color: var(--cd-muted);
  line-height: 1.6;
}
.cd-vcb strong {
  color: var(--cd-text);
}
.cd-sess-entry {
  background: linear-gradient(135deg, #0a1a0d, #080d0a);
  border: 1.5px solid rgba(0, 255, 135, 0.2);
  border-radius: 16px;
  padding: 13px;
  margin-bottom: 9px;
  cursor: pointer;
}
.cd-se-top {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 9px;
}
.cd-se-ttl {
  font-size: 18px;
  font-weight: 800;
  color: var(--cd-accent);
}
.cd-se-sub {
  font-size: 11px;
  color: var(--cd-muted);
}
.cd-se-modes {
  display: flex;
  gap: 6px;
}
.cd-semp {
  flex: 1;
  padding: 7px 6px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid;
}
.cd-semp.tg {
  background: rgba(255, 107, 53, 0.1);
  color: var(--cd-orange);
  border-color: rgba(255, 107, 53, 0.3);
}
.cd-semp.pk {
  background: rgba(0, 255, 135, 0.1);
  color: var(--cd-accent);
  border-color: rgba(0, 255, 135, 0.3);
}
.cd-mood {
  background: linear-gradient(135deg, #06091a, #050710);
  border: 1px solid rgba(77, 166, 255, 0.18);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 9px;
  cursor: pointer;
}
.cd-mc-t {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 4px;
}
.cd-mc-t.blue {
  color: var(--cd-blue);
}
.cd-mc-t.green {
  color: var(--cd-accent);
}
.cd-mc-t.purple {
  color: var(--cd-purple);
}
.cd-mc-b {
  font-size: 11px;
  color: var(--cd-muted);
  line-height: 1.6;
}
.cd-mcard {
  border-radius: 14px;
  padding: 13px 11px;
  border: 1.5px solid var(--cd-bdr);
  background: var(--cd-bg2);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.cd-mcard.tg.sel,
.cd-mcard.tg:hover {
  border-color: rgba(255, 107, 53, 0.5);
  background: rgba(255, 107, 53, 0.05);
}
.cd-mcard.pk.sel,
.cd-mcard.pk:hover {
  border-color: rgba(0, 255, 135, 0.4);
  background: rgba(0, 255, 135, 0.04);
}
.cd-mc-lbl {
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 3px;
}
.cd-mcard.tg.sel .cd-mc-lbl {
  color: var(--cd-orange);
}
.cd-mcard.pk.sel .cd-mc-lbl {
  color: var(--cd-accent);
}
.cd-mc-sub {
  font-size: 11px;
  color: var(--cd-dim);
}
.cd-scard {
  border-radius: 17px;
  padding: 15px;
  margin-bottom: 10px;
}
.cd-scard.tc {
  background: linear-gradient(135deg, #190800, #0e0500);
  border: 1.5px solid rgba(255, 107, 53, 0.3);
}
.cd-scard.hc {
  background: linear-gradient(135deg, #041208, #050e06);
  border: 1.5px solid rgba(0, 255, 135, 0.2);
}
.cd-sc-eye {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 8px;
}
.cd-sc-eye.orange {
  color: var(--cd-orange);
}
.cd-sc-eye.green {
  color: var(--cd-accent);
}
.cd-sc-q {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 9px;
}
.cd-sc-b {
  font-size: 12px;
  color: var(--cd-muted);
  line-height: 1.7;
  margin-bottom: 12px;
}
.cd-sc-b :deep(em) {
  font-style: normal;
  color: var(--cd-orange);
}
.cd-scard.hc .cd-sc-b :deep(em) {
  color: var(--cd-accent);
}
.cd-sc-b :deep(strong) {
  color: var(--cd-text);
}
.cd-nxt {
  text-align: center;
  padding: 7px;
  color: var(--cd-dim);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.cd-lucky {
  background: rgba(0, 255, 135, 0.04);
  border: 1px solid rgba(0, 255, 135, 0.12);
  border-radius: 12px;
  padding: 12px 13px;
  text-align: center;
}
.cd-cold-card {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 13px;
  margin-bottom: 8px;
  overflow: hidden;
}
.cd-cc-top {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}
.cd-cc-av {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: rgba(168, 216, 234, 0.08);
  border: 1px solid rgba(168, 216, 234, 0.15);
  flex-shrink: 0;
}
.cd-cc-nm {
  font-size: 15px;
  font-weight: 800;
}
.cd-cc-sb {
  font-size: 11px;
  color: var(--cd-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cd-cpill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid rgba(168, 216, 234, 0.3);
  background: rgba(168, 216, 234, 0.08);
  color: var(--cd-ice);
  text-transform: uppercase;
}
.cd-hpill {
  font-size: 14px;
}
.cd-cw {
  padding: 9px 12px 11px;
  border-top: 1px solid var(--cd-bdr);
  background: rgba(0, 0, 0, 0.1);
}
.cd-cw-q {
  font-size: 11px;
  color: var(--cd-muted);
  line-height: 1.6;
  font-style: italic;
  margin-bottom: 7px;
}
.cd-cwb {
  flex: 1;
  padding: 7px 8px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid;
}
.cd-cwb.reach {
  background: rgba(168, 216, 234, 0.08);
  color: var(--cd-ice);
  border-color: rgba(168, 216, 234, 0.3);
}
.cd-cwb.hib {
  background: transparent;
  color: var(--cd-dim);
  border-color: var(--cd-bdr);
}
.cd-cwb.wake {
  background: rgba(0, 255, 135, 0.1);
  color: var(--cd-accent);
  border-color: rgba(0, 255, 135, 0.3);
}
.cd-sec-lbl {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--cd-dim);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cd-sec-lbl::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--cd-bdr);
}
.cd-hero {
  background: linear-gradient(135deg, #0b1f12, #090f1e, #0e091e);
  border: 1px solid rgba(0, 255, 135, 0.14);
  border-radius: 17px;
  padding: 15px;
  margin-bottom: 10px;
}
.cd-xp-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 99px;
  overflow: hidden;
}
.cd-xp-fill {
  height: 100%;
  background: linear-gradient(90deg, #00c268, #00ff87);
  border-radius: 99px;
  transition: width 1.2s cubic-bezier(0.34, 1.2, 0.64, 1);
}
.cd-stat {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  padding: 10px 7px;
  text-align: center;
  cursor: pointer;
}
.cd-stat-n {
  font-family: "Bebas Neue", sans-serif;
  font-size: 32px;
  line-height: 1;
}
.cd-stat-l {
  font-size: 9px;
  color: var(--cd-dim);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  font-weight: 700;
}
.cd-streak {
  background: linear-gradient(135deg, #190800, #0e0500);
  border: 1px solid rgba(255, 69, 0, 0.25);
  border-radius: 13px;
  padding: 11px 13px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
@keyframes cd-wig {
  0%,
  100% {
    transform: rotate(-4deg) scale(1);
  }
  50% {
    transform: rotate(4deg) scale(1.1);
  }
}
.cd-sdot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.cd-sdot.done {
  background: #ff4500;
  box-shadow: 0 0 6px #ff4500;
}
.cd-sdot.today {
  background: #ff4500;
  animation: cd-pf 1s infinite;
}
.cd-sdot.empty {
  background: #131820;
}
@keyframes cd-pf {
  0%,
  100% {
    box-shadow: 0 0 6px #ff4500;
  }
  50% {
    box-shadow: 0 0 16px #ff4500;
  }
}
.cd-mission {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.cd-mission.done {
  opacity: 0.45;
}
.cd-msn-glow {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
}
.cd-msn-glow.g {
  background: var(--cd-accent);
  box-shadow: 2px 0 10px rgba(0, 255, 135, 0.5);
}
.cd-msn-glow.o {
  background: var(--cd-orange);
  box-shadow: 2px 0 10px rgba(255, 107, 53, 0.5);
}
.cd-badge {
  flex-shrink: 0;
  width: 66px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  padding: 10px 5px;
  text-align: center;
}
.cd-badge.ul {
  border-color: rgba(255, 208, 0, 0.3);
  background: linear-gradient(
    135deg,
    rgba(255, 208, 0, 0.06),
    rgba(255, 208, 0, 0.02)
  );
}
.cd-pill {
  flex-shrink: 0;
  padding: 5px 11px;
  border-radius: 99px;
  border: 1px solid var(--cd-bdr);
  background: transparent;
  color: var(--cd-dim);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.cd-pill.on {
  background: var(--cd-bg2);
  color: var(--cd-text);
  border-color: #283245;
}
.cd-crd {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
}
.cd-crd:hover {
  border-color: #283245;
}
.cd-cbar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
}
.cd-cbar.hot {
  background: #ff6b35;
}
.cd-cbar.warm {
  background: #ffe033;
}
.cd-cbar.nurture {
  background: #00ff87;
}
.cd-cbar.cold {
  background: #4da6ff;
}
.cd-cav {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  background: var(--cd-bg);
  border: 1px solid var(--cd-bdr);
  flex-shrink: 0;
}
.cd-cnm {
  font-size: 15px;
  font-weight: 800;
}
.cd-csb {
  font-size: 11px;
  color: var(--cd-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cd-rpill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cd-rpill.hot {
  color: #ff6b35;
  border-color: rgba(255, 107, 53, 0.4);
  background: rgba(255, 107, 53, 0.1);
}
.cd-rpill.warm {
  color: #ffe033;
  border-color: rgba(255, 224, 51, 0.4);
  background: rgba(255, 224, 51, 0.08);
}
.cd-rpill.nurture {
  color: #00ff87;
  border-color: rgba(0, 255, 135, 0.3);
  background: rgba(0, 255, 135, 0.08);
}
.cd-rpill.cold {
  color: #4da6ff;
  border-color: rgba(77, 166, 255, 0.3);
  background: rgba(77, 166, 255, 0.08);
}
.cd-det-hero {
  background: linear-gradient(180deg, var(--cd-bg2) 0%, var(--cd-bg) 100%);
  border: 1px solid var(--cd-bdr);
  border-radius: 15px;
  padding: 14px;
  margin-bottom: 11px;
}
.cd-det-av {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: #131820;
  border: 1px solid #283245;
  flex-shrink: 0;
}
.cd-tag-ind {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 99px;
  border: 1px solid var(--cd-bdr);
  color: var(--cd-dim);
}
.cd-fu-banner {
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 11px;
}
.cd-fu-banner.overdue {
  background: rgba(255, 107, 53, 0.08);
  border: 1px solid rgba(255, 107, 53, 0.3);
}
.cd-fu-banner.due {
  background: rgba(255, 224, 51, 0.06);
  border: 1px solid rgba(255, 224, 51, 0.25);
}
.cd-fu-banner.ok {
  background: rgba(0, 255, 135, 0.04);
  border: 1px solid rgba(0, 255, 135, 0.15);
}
.cd-fu-banner.new {
  background: rgba(77, 166, 255, 0.04);
  border: 1px solid rgba(77, 166, 255, 0.15);
}
.cd-fu-t {
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 2px;
}
.cd-fu-banner.overdue .cd-fu-t {
  color: #ff6b35;
}
.cd-fu-banner.due .cd-fu-t {
  color: #ffe033;
}
.cd-fu-banner.ok .cd-fu-t {
  color: #00ff87;
}
.cd-fu-banner.new .cd-fu-t {
  color: #4da6ff;
}
.cd-fu-s {
  font-size: 11px;
  color: var(--cd-dim);
  line-height: 1.4;
}
.cd-info-grid {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 10px;
}
.cd-info-row {
  display: flex;
  gap: 10px;
  padding: 9px 13px;
  border-bottom: 1px solid var(--cd-bdr);
}
.cd-info-row:last-child {
  border-bottom: none;
}
.cd-info-k {
  font-size: 11px;
  font-weight: 700;
  color: var(--cd-dim);
  width: 24px;
  flex-shrink: 0;
}
.cd-info-v {
  font-size: 12px;
  color: var(--cd-text);
  text-decoration: none;
}
.cd-log-sec {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 13px;
  padding: 13px;
  margin-bottom: 13px;
}
.cd-act-type {
  flex: 1;
  min-width: 46px;
  padding: 6px 3px;
  border-radius: 9px;
  background: #131820;
  border: 1px solid var(--cd-bdr);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--cd-dim);
  cursor: pointer;
  text-align: center;
}
.cd-act-type.sel {
  background: rgba(0, 255, 135, 0.08);
  color: var(--cd-accent);
  border-color: rgba(0, 255, 135, 0.3);
}
.cd-tl-dot {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  border: 1px solid;
  flex-shrink: 0;
}
.cd-tl-dot.email {
  background: rgba(77, 166, 255, 0.1);
  border-color: rgba(77, 166, 255, 0.3);
}
.cd-tl-dot.call {
  background: rgba(0, 255, 135, 0.08);
  border-color: rgba(0, 255, 135, 0.25);
}
.cd-tl-dot.text {
  background: rgba(184, 125, 255, 0.1);
  border-color: rgba(184, 125, 255, 0.3);
}
.cd-tl-dot.meeting {
  background: rgba(255, 215, 0, 0.08);
  border-color: rgba(255, 215, 0, 0.25);
}
.cd-tl-dot.linkedin,
.cd-tl-dot.other {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--cd-bdr);
}
.cd-tl-resp {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 99px;
  border: 1px solid;
  cursor: pointer;
}
.cd-tl-resp.yes {
  color: #00ff87;
  border-color: rgba(0, 255, 135, 0.3);
  background: rgba(0, 255, 135, 0.08);
  cursor: default;
}
.cd-tl-resp.no {
  color: var(--cd-dim);
  border-color: var(--cd-bdr);
}
.cd-scan-zone {
  background: linear-gradient(135deg, #04130d, #050e0a);
  border: 2px dashed rgba(0, 255, 135, 0.25);
  border-radius: 17px;
  padding: 24px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.cd-scan-zone:hover {
  border-color: rgba(0, 255, 135, 0.6);
}
.cd-toast {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-accent);
  border-radius: 99px;
  padding: 9px 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 999;
  white-space: nowrap;
  box-shadow: 0 0 30px rgba(0, 255, 135, 0.2);
}
.cd-toast-enter-active {
  animation: cd-tin 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.cd-toast-leave-active {
  transition: opacity 0.2s;
}
.cd-toast-leave-to {
  opacity: 0;
}
@keyframes cd-tin {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
.cd-pop-enter-active {
  animation: cd-cin 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.cd-pop-leave-active {
  transition: opacity 0.15s;
}
.cd-pop-leave-to {
  opacity: 0;
}
@keyframes cd-cin {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.cd-expand-enter-active,
.cd-expand-leave-active {
  transition: all 0.2s ease;
}
.cd-expand-enter-from,
.cd-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
