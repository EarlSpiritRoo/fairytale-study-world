/* ============================================================
   study.js — the heart of Fablenook.

   SOLO SESSION     a private countdown; you earn 1 minute per
                    minute, even with the tab in the background.

   STUDY CIRCLE     one shared timer per zone. A session is just
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
  const LS = { stats: 'fablenook.stats', ledger: 'fablenook.ledger', solo: 'fablenook.solo' };

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
    onEvent() {},             // ('soloDone' | 'break' | 'breakOver' | 'circleStart', zoneId)
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
    if (!FN.ZONES[zoneId] || !valid(st)) return;
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

  // ---------- solo ----------
  S.startSolo = (minutes, subject) => {
    const now = Date.now(), len = FN.clamp(Math.round(minutes) || 25, 1, 240);
    S.solo = { subject: String(subject || '').slice(0, 24), startedAt: now, endsAt: now + len * 60000, last: now };
    S.myCircle = null; save(LS.solo, S.solo); S.onChange();
  };
  S.stopSolo = () => { S.solo = null; save(LS.solo, null); S.onChange(); };
  const restored = load(LS.solo, null);                 // survive a page reload mid-session
  if (restored && isFinite(restored.endsAt) && isFinite(restored.last)) S.solo = restored;

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
      if (!FN.ZONES[z] || typeof u !== 'string' || u === S.me) return;
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

    // solo: credit wall-clock time since the last tick, up to the end of the session
    if (S.solo) {
      const upTo = Math.min(now, S.solo.endsAt);
      soloAcc += Math.max(0, upTo - S.solo.last); S.solo.last = upTo;
      const mins = Math.floor(soloAcc / 60000);
      if (mins) { soloAcc -= mins * 60000; earn(mins, null); save(LS.solo, S.solo); }
      if (now >= S.solo.endsAt) {
        if (soloAcc >= 30000) earn(1, null);            // round the last partial minute
        soloAcc = 0; S.stopSolo(); S.onEvent('soloDone');
      }
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
  S.inFocus = () => !!S.solo || (!!S.myCircle && S.phase(S.myCircle).name === 'focus');
})(window.FN);
