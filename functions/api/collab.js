const json = (data, status) =>
  new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function newId() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

function creatorPublic(r) {
  return { id: r.id, name: r.name, channel_url: r.channel_url, credits: r.credits, created_at: r.created_at };
}

async function getCreator(db, token) {
  if (!token) return null;
  return db.prepare("SELECT * FROM creators WHERE id = ?").bind(token).first();
}

const OPS = {
  async join({ db, env, body }) {
    const name = String(body.name || "").trim();
    const channel = String(body.channel || "").trim();
    const invite = String(body.invite || "").trim();
    if (!name || !channel) return { error: "Name and channel URL are required" };
    if (!/youtube\.com\/|youtu\.be\//i.test(channel)) return { error: "Enter a valid YouTube channel URL" };
    const need = env.INVITE_CODE || "DIME2026";
    if (invite !== need) return { error: "Invalid invite code" };
    const id = newId();
    await db.prepare("INSERT INTO creators (id, name, channel_url, credits) VALUES (?, ?, ?, 2)")
      .bind(id, name, channel).run();
    const row = await db.prepare("SELECT * FROM creators WHERE id = ?").bind(id).first();
    return { token: id, creator: creatorPublic(row) };
  },

  async me({ db, token }) {
    const me = await getCreator(db, token);
    if (!me) return { error: "Not signed in" };
    const myVideos = await db.prepare(
      "SELECT id, url, title, slots_total, slots_done, active, created_at FROM videos WHERE creator_id = ? ORDER BY created_at DESC"
    ).bind(token).all();
    const done = await db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE worker_id = ?").bind(token).first();
    const totalCreators = await db.prepare("SELECT COUNT(*) AS c FROM creators").first();
    const activeVideos = await db.prepare("SELECT COUNT(*) AS c FROM videos WHERE active = 1").first();
    return {
      creator: creatorPublic(me),
      videos: myVideos.results || [],
      tasksDone: done.c,
      community: { creators: totalCreators.c, pool: activeVideos.c },
    };
  },

  async pool({ db, token }) {
    const me = await getCreator(db, token);
    if (!me) return { error: "Not signed in" };
    const rows = await db.prepare(
      `SELECT v.id, v.url, v.title, v.slots_total, v.slots_done, c.name AS creator_name, c.channel_url
       FROM videos v JOIN creators c ON c.id = v.creator_id
       WHERE v.active = 1 AND v.creator_id != ?
         AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.video_id = v.id AND t.worker_id = ?)
       ORDER BY v.created_at ASC LIMIT 30`
    ).bind(token, token).all();
    return { items: rows.results || [] };
  },

  async complete({ db, token, body }) {
    const me = await getCreator(db, token);
    if (!me) return { error: "Not signed in" };
    const taskId = String(body.taskId || "");
    const video = await db.prepare("SELECT * FROM videos WHERE id = ?").bind(taskId).first();
    if (!video) return { error: "Video not found" };
    if (video.creator_id === token) return { error: "You cannot complete a task on your own video" };
    if (!video.active) return { error: "This boost is already full" };
    try {
      await db.prepare("INSERT INTO tasks (id, video_id, worker_id) VALUES (?, ?, ?)")
        .bind(newId(), taskId, token).run();
    } catch (e) {
      return { error: "You already completed this task" };
    }
    const done = video.slots_done + 1;
    const active = done >= video.slots_total ? 0 : 1;
    await db.prepare("UPDATE videos SET slots_done = ?, active = ? WHERE id = ?")
      .bind(done, active, taskId).run();
    await db.prepare("UPDATE creators SET credits = credits + 1 WHERE id = ?").bind(token).run();
    const fresh = await getCreator(db, token);
    return { ok: true, earned: 1, credits: fresh.credits, slotsLeft: video.slots_total - done };
  },

  async boost({ db, token, body }) {
    const me = await getCreator(db, token);
    if (!me) return { error: "Not signed in" };
    const url = String(body.url || "").trim();
    const title = String(body.title || "").trim().slice(0, 120);
    if (!/youtube\.com\/watch|youtu\.be\//i.test(url)) return { error: "Enter a valid YouTube video URL" };
    if (me.credits < 1) return { error: "Not enough credits — complete tasks in the pool first" };
    const id = newId();
    await db.prepare("INSERT INTO videos (id, creator_id, url, title, slots_total, slots_done, active) VALUES (?, ?, ?, ?, 5, 0, 1)")
      .bind(id, token, url, title).run();
    await db.prepare("UPDATE creators SET credits = credits - 1 WHERE id = ?").bind(token).run();
    const fresh = await getCreator(db, token);
    return { ok: true, videoId: id, credits: fresh.credits, message: "Boosted — 5 creators will now watch/like/subscribe" };
  },

  async leave({ db, token }) {
    const me = await getCreator(db, token);
    if (!me) return { error: "Not signed in" };
    return { ok: true };
  },
};

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.COLLAB_DB) return json({ error: "Server missing D1 binding COLLAB_DB" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const op = OPS[String(body.op || "")];
  if (!op) return json({ error: "Unknown op" }, 400);
  try {
    const result = await op({ db: env.COLLAB_DB, env, body, token: String(body.token || "") });
    if (result.error) return json(result, 400);
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ error: e.message || "Server error" }, 500);
  }
}
