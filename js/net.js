/* ============================================================
   net.js — a thin wrapper around Supabase Realtime.

   PRESENCE  = slow-changing facts about each visitor
               (name, avatar, zone, study status, minutes).
   BROADCAST = fast or one-off messages
               (positions ~10/sec, chat, emotes, circle events).

   If config.js is not filled in (or Supabase is unreachable)
   the world still runs in single-player "solo mode".

   Usage:  FN.Net.on('presence', fn)   FN.Net.on('msg:p', fn)
           FN.Net.connect(myId)        FN.Net.track(meta)
           FN.Net.send('p', {...})
   ============================================================ */
(function (FN) {
  'use strict';
  const cfg = window.FABLE_CONFIG || {};
  const handlers = {};
  let channel = null, online = false, pendingMeta = null, lastTrack = 0, trackTimer = null;

  const emit = (evt, a) => (handlers[evt] || []).forEach((fn) => { try { fn(a); } catch (e) { console.error(e); } });
  const configured = () => /^https:\/\/.+/.test(cfg.SUPABASE_URL || '') && !!cfg.SUPABASE_KEY && !/PASTE/.test(cfg.SUPABASE_KEY);

  function flushTrack() {
    trackTimer = null;
    if (!online || !pendingMeta) return;
    lastTrack = Date.now();
    const meta = pendingMeta; pendingMeta = null;
    channel.track(meta).catch(() => { pendingMeta = pendingMeta || meta; });
  }

  FN.Net = {
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    isOnline: () => online,

    connect(myId) {
      if (!configured() || !window.supabase) {
        emit('status', configured() ? 'error' : 'unconfigured');
        return;
      }
      const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
        realtime: { params: { eventsPerSecond: 20 } },
      });
      channel = client.channel(cfg.ROOM || 'fablenook-main', {
        config: { presence: { key: myId }, broadcast: { self: false } },
      });
      channel
        // presence "sync" fires whenever anyone joins, leaves or updates their meta
        .on('presence', { event: 'sync' }, () => {
          const raw = channel.presenceState(), flat = {};
          for (const key in raw) if (raw[key].length) flat[key] = raw[key][raw[key].length - 1];
          emit('presence', flat);
        })
        // every broadcast uses one event name; payload.t says what kind it is
        .on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && typeof payload.t === 'string') emit('msg:' + payload.t, payload); })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') { online = true; emit('status', 'online'); flushTrack(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { online = false; emit('status', 'reconnecting'); }
        });
    },

    // Update my presence meta. Throttled so rapid changes collapse into one call.
    track(meta) {
      pendingMeta = meta;
      if (!online || trackTimer) return;
      trackTimer = setTimeout(flushTrack, Math.max(0, 400 - (Date.now() - lastTrack)));
    },

    send(type, payload) {
      if (!online) return;
      channel.send({ type: 'broadcast', event: 'm', payload: Object.assign({ t: type }, payload) });
    },
  };
})(window.FN);
