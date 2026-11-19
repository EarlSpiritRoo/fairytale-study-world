/* ============================================================
   study.js — the heart of Fablenook.

   SOLO TIMER       your own countdown ("⏱ Start timer"), three modes:
                      focus     one focus session (you earn 1 minute per minute,
                                even with the tab in the background)
                      break     one timed break (earns nothing)
                      pomodoro  focus / short break cycles, a long break after
                                every N focus rounds; auto-starts the next phase
                                or waits for "Start next"
                    S.solo = { mode, phase, subject, startedAt, endsAt, last,
                               round, len, waiting, pomo:{focus,short,long,every,auto} }
                    Only phase 'focus' (and not waiting) earns minutes.

   STUDY CIRCLE     one shared timer per circle (a realm's first circle
                    uses the realm id, e.g. 'skyfield'; extras are 'skyfield.library'). A session is just
                    { s: startTime, len: minutes, by: starterId },
                    so every client derives the SAME countdown:
                      focus  = s .. s+len
                      break  = focus end .. +BREAK_MINUTES
                      idle   = after that (next round may start)
                    Started via broadcast; late joiners read it
                    from other people's presence.

   EARNING          you only earn circle minutes for time spent
                    standing in the circle during a focus phase.

   DAILY LEDGER     "✨ X minutes focused here today" is the sum
                    of ledger[zone][userId]. Clients gossip it and
                    merge by taking the max per user, so the total
                    survives people leaving — with no database.
   ============================================================ */
(function (FN) {
  'use strict';
  const cfg = window.FABLE_CONFIG || {};
  const BREAK_MS = (cfg.BREAK_MINUTES || 5) * 60000;
  const MAX_GAP = 5 * 60000;          // circle only: a gap longer than this = you were away (asleep phone etc.)
  const LS = { stats: 'fablenook.stats', ledger: 'fablenook.ledger', solo: 'fablenook.solo', pomo: 'fablenook.pomo' };
  const POMO_DEFAULT = { focus: 25, short: 5, long: 15, every: 4, auto: true };

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const dayKey = () => new Date(Date.now() + (cfg.DAY_TZ_OFFSET_HOURS || 0) * 3600000).toISOString().slice(0, 10);

  const S = FN.Study = {
    me: null,                 // my user id (set by main.js)
    solo: null,               // { subject, startedAt, endsAt, last }
    circles: {},              // zoneId -> { s, len, by }
    myCircle: null,           // zoneId of the circle I am standing in (null while in a solo session)
    stats: load(LS.stats, { total: 0 }),
    ledger: load(LS.ledger, { day: dayKey(), z: {} }),
    onChange() {},            // something others should see changed (main.js re-tracks presence)
    onEvent() {},             // ('soloDone' | 'pomo' | 'break' | 'breakOver' | 'circleStart', zoneId or info)
    send() {},                // broadcast hook (main.js wires this to FN.Net.send)
  };
  let circleAcc = 0, soloAcc = 0, lastTick = Date.now();
  const lastPhase = {};

  // ---------- circle timeline ----------
  S.phase = (zoneId, now) => {
    const st = S.circles[zoneId]; now = now || Date.now();
    if (!st) return { name: 'idle' };
    const focusEnd = st.s + st.len * 60000;
    if (now < focusEnd) return { name: 'focus', left: focusEnd - now, progress: (now - st.s) / (st.len * 60000), st };
    if (now < focusEnd + BREAK_MS) return { name: 'break', left: focusEnd + BREAK_MS - now, progress: (now - focusEnd) / BREAK_MS, st };
    return { name: 'idle' };
  };
  const valid = (st) => st && isFinite(st.s) && isFinite(st.len) && st.len >= 1 && st.len <= 180 && st.s < Date.now() + 120000;

  // Adopt a session we heard about. If two people start at once, the earlier start wins everywhere.
  S.mergeCircle = (zoneId, st) => {
    if (!FN.CIRCLES[zoneId] || !valid(st)) return;
    st = { s: +st.s, len: +st.len, by: String(st.by || '') };
    if (Date.now() >= st.s + st.len * 60000 + BREAK_MS) return;                 // already over
    const cur = S.circles[zoneId], curLive = cur && S.phase(zoneId).name !== 'idle';
    if (curLive && (cur.s < st.s || (cur.s === st.s && cur.by <= st.by))) return;
    S.circles[zoneId] = st; S.onChange();
  };
  S.startCircle = (zoneId, minutes) => {
    if (S.phase(zoneId).name !== 'idle') return false;                          // one session at a time
    const st = { s: Date.now(), len: FN.clamp(Math.round(minutes) || 25, 1, 180), by: S.me };
    S.circles[zoneId] = st;
    S.send('cs', { z: zoneId, st });
    S.onChange(); S.onEvent('circleStart', zoneId);
    return true;
  };

  // ---------- solo timer: focus, break or pomodoro ----------
  const cleanPomo = (o) => ({ focus: FN.clamp(Math.round(+o.focus) || 25, 1, 180), short: FN.clamp(Math.round(+o.short) || 5, 1, 60),
    long: FN.clamp(Math.round(+o.long) || 15, 1, 90), every: FN.clamp(Math.round(+o.every) || 4, 1, 12), auto: o.auto !== false });
  S.pomoSettings = () => cleanPomo(Object.assign({}, POMO_DEFAULT, load(LS.pomo, {})));
  S.savePomo = (o) => { const c = cleanPomo(Object.assign({}, POMO_DEFAULT, o)); save(LS.pomo, c); return c; };
  function begin(phase, len, at) {                      // (re)start the current solo timer in a phase
    const so = S.solo; so.phase = phase; so.len = len; so.startedAt = at; so.endsAt = at + len * 60000; so.last = at; so.waiting = false;
  }
  S.startSolo = (minutes, subject, mode = 'focus') => {          // mode 'focus' | 'break'
    const now = Date.now(), len = FN.clamp(Math.round(minutes) || (mode === 'break' ? 5 : 25), 1, mode === 'break' ? 60 : 240);
    S.solo = { mode, subject: mode === 'focus' ? String(subject || '').slice(0, 24) : '', round: 0 };
    begin(mode, len, now); soloAcc = 0;
    S.myCircle = null; save(LS.solo, S.solo); S.onChange();
  };
  S.startPomodoro = (settings) => {
    const P = S.savePomo(settings || S.pomoSettings()), now = Date.now();
    S.solo = { mode: 'pomo', subject: '', round: 1, pomo: P };
    begin('focus', P.focus, now); soloAcc = 0;
    S.myCircle = null; save(LS.solo, S.solo); S.onChange();
  };
  // what comes after the phase that just ended
  function nextPomo(so) {
    const P = so.pomo;
    if (so.phase === 'focus') { const long = so.round >= P.every; return { phase: 'break', round: so.round, len: long ? P.long : P.short, long }; }
    return { phase: 'focus', round: so.round >= P.every ? 1 : so.round + 1, len: P.focus, long: false };
  }
  S.startNext = () => {                                 // "Start next" when auto-start is off
    const so = S.solo; if (!so || !so.waiting) return;
    begin(so.phase, so.len, Date.now()); save(LS.solo, so); S.onChange();
  };
  S.stopSolo = () => { S.solo = null; soloAcc = 0; save(LS.solo, null); S.onChange(); };
  S.soloFocusing = () => !!S.solo && S.solo.phase === 'focus' && !S.solo.waiting;
  // the bubble text for a timer (mine or someone else's, from presence): '📖 Focusing · Algorithms · 18:20'
  S.timerText = (t, now) => {
    if (!t) return '';
    now = now || Date.now();
    const left = t.waiting ? null : FN.fmt(Math.max(0, t.endsAt - now));
    if (t.mode === 'pomo') return '🍅 Pomodoro ' + t.round + '/' + t.every + ' · ' + (t.phase === 'focus' ? 'Focus' : 'Break') + ' · ' + (left || 'ready');
    if (t.endsAt <= now) return '';
    if (t.mode === 'break') return '☕ On a break · ' + left;
    return '📖 Focusing · ' + (t.subject ? t.subject + ' · ' : '') + left;
  };
  S.myTimer = () => { const so = S.solo; return so && Object.assign({}, so, { every: so.pomo ? so.pomo.every : 0 }); };
  const restored = load(LS.solo, null);                 // survive a page reload mid-session
  if (restored && isFinite(restored.endsAt) && isFinite(restored.last)) {
    if (!restored.mode) { restored.mode = 'focus'; restored.phase = 'focus'; }              // a session saved by an older version
    if (restored.mode === 'pomo') restored.pomo = cleanPomo(Object.assign({}, POMO_DEFAULT, restored.pomo));
    S.solo = restored;
  }

  // ---------- minutes ----------
  S.total = () => S.stats.total;
  S.zoneTotal = (zoneId) => { let n = 0; const m = S.ledger.z[zoneId] || {}; for (const u in m) n += m[u]; return n; };
  function earn(minutes, zoneId) {
    S.stats.total += minutes; save(LS.stats, S.stats);
    if (zoneId) {
      const m = S.ledger.z[zoneId] = S.ledger.z[zoneId] || {};
      m[S.me] = (m[S.me] || 0) + minutes; save(LS.ledger, S.ledger);
      S.send('lc', { day: S.ledger.day, z: zoneId, u: S.me, m: m[S.me] });
    }
    S.onChange();
  }
  // Merge someone else's ledger (or a single entry): max per user = safe to receive twice.
  S.mergeLedger = (msg) => {
    if (!msg || msg.day !== S.ledger.day) return;
    const put = (z, u, m) => {
      if (!FN.CIRCLES[z] || typeof u !== 'string' || u === S.me) return;
      m = FN.clamp(Math.floor(+m) || 0, 0, 1440);
      const row = S.ledger.z[z] = S.ledger.z[z] || {};
      if (m > (row[u] || 0)) row[u] = m;
    };
    if (msg.z && typeof msg.z === 'object') for (const z in msg.z) for (const u in msg.z[z]) put(z, u, msg.z[z][u]);
    else put(msg.z, msg.u, msg.m);
    save(LS.ledger, S.ledger);
  };
  let shareTimer = null;
  S.shareLedgerSoon = () => {                           // called when a newcomer appears
    if (shareTimer) return;
    shareTimer = setTimeout(() => { shareTimer = null; S.send('lg', { day: S.ledger.day, z: S.ledger.z }); }, 300 + Math.random() * 1500);
  };

  // ---------- the clock: call about once a second (works in background tabs) ----------
  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  S.tick = () => {
    const now = Date.now();
    if (S.ledger.day !== dayKey()) { S.ledger = { day: dayKey(), z: {} }; save(LS.ledger, S.ledger); }

    // solo: credit wall-clock FOCUS time since the last tick, up to the end of the phase.
    // A loop, so a pomodoro catches up correctly after the tab or phone slept through several phases.
    for (let guard = 0; S.solo && !S.solo.waiting && guard < 50; guard++) {
      const so = S.solo, upTo = Math.min(now, so.endsAt);
      if (so.phase === 'focus') {
        soloAcc += Math.max(0, upTo - so.last);
        const mins = Math.floor(soloAcc / 60000);
        if (mins) { soloAcc -= mins * 60000; earn(mins, null); }
      }
      so.last = upTo;
      if (now < so.endsAt) { save(LS.solo, so); break; }
      // the phase is over
      if (so.phase === 'focus' && soloAcc >= 30000) earn(1, null);          // round the last partial minute
      soloAcc = 0;
      if (so.mode !== 'pomo') { const mode = so.mode; S.stopSolo(); S.onEvent('soloDone', { mode }); break; }
      const from = so.phase, nx = nextPomo(so), at = so.endsAt;
      so.round = nx.round;
      if (so.pomo.auto) begin(nx.phase, nx.len, at);                         // starts exactly when the last one ended
      else { so.phase = nx.phase; so.len = nx.len; so.waiting = true; so.endsAt = at; }
      save(LS.solo, so); S.onChange();
      S.onEvent('pomo', { from, to: nx.phase, len: nx.len, long: nx.long, round: so.round, every: so.pomo.every, waiting: !so.pomo.auto, late: now - at > 5000 });
    }

    // circle: credit only the part of [lastTick, now] that overlaps the focus phase
    const from = now - lastTick > MAX_GAP ? now : lastTick;
    if (S.myCircle && S.circles[S.myCircle]) {
      const st = S.circles[S.myCircle];
      circleAcc += overlap(from, now, st.s, st.s + st.len * 60000);
      const mins = Math.floor(circleAcc / 60000);
      if (mins) { circleAcc -= mins * 60000; earn(mins, S.myCircle); }
    }
    lastTick = now;

    // phase changes + cleanup of finished sessions
    for (const z in S.circles) {
      const ph = S.phase(z, now).name;
      if (lastPhase[z] === 'focus' && ph !== 'focus') {
        if (z === S.myCircle) { if (circleAcc >= 30000) earn(1, z); circleAcc = 0; S.onEvent('break', z); }
      }
      if (lastPhase[z] === 'break' && ph === 'idle' && z === S.myCircle) S.onEvent('breakOver', z);
      lastPhase[z] = ph;
      if (ph === 'idle') { delete S.circles[z]; delete lastPhase[z]; S.onChange(); }
    }
  };

  // Am I in focus mode right now? (chat is emote-only while this is true)
  S.inFocus = () => S.soloFocusing() || (!!S.myCircle && S.phase(S.myCircle).name === 'focus');
})(window.FN);
