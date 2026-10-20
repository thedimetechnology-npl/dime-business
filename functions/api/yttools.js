const YT_API = "https://www.googleapis.com/youtube/v3";
const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get("Origin") || request.headers.get("Referer") || "";
  if (!origin) return true;
  return /thedimetechnology\.com\.np|localhost|127\.0\.0\.1|pages\.dev|cfargotunnel\.com/.test(origin);
}

async function ytGet(path, params, key) {
  const u = new URL(YT_API + path);
  u.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString());
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (body.error && body.error.message) || "YouTube API error (" + r.status + ")";
    throw new Error(msg);
  }
  return body;
}

async function handleSuggest(url) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ ok: false, error: "Missing q" }, 400);
  const u = SUGGEST_URL + "?client=firefox&q=" + encodeURIComponent(q);
  const r = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!r.ok) return json({ ok: false, error: "Autocomplete failed (" + r.status + ")" }, 502);
  const raw = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Autocomplete returned invalid data" }, 502);
  }
  const terms = Array.isArray(parsed) && Array.isArray(parsed[1]) ? parsed[1].filter((s) => typeof s === "string") : [];
  return json({ ok: true, terms });
}

async function handleOutliers(url, key) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ ok: false, error: "Missing q" }, 400);
  const max = Math.min(parseInt(url.searchParams.get("max") || "25", 10) || 25, 50);
  const minScore = parseFloat(url.searchParams.get("min") || "3") || 3;

  const search = await ytGet("/search", {
    part: "snippet", type: "video", q, order: "viewCount",
    maxResults: String(max), relevanceLanguage: "en",
  }, key);

  const videos = (search.items || [])
    .filter((i) => i.id && i.id.videoId)
    .map((i) => ({
      video_id: i.id.videoId,
      title: i.snippet.title,
      channel_id: i.snippet.channelId,
      channel: i.snippet.channelTitle,
      published: (i.snippet.publishedAt || "").slice(0, 10),
    }));
  if (!videos.length) return json({ ok: true, items: [] });

  const ids = videos.map((v) => v.video_id).join(",");
  const channelIds = [...new Set(videos.map((v) => v.channel_id))].join(",");

  const [vids, chans] = await Promise.all([
    ytGet("/videos", { part: "statistics", id: ids }, key),
    ytGet("/channels", { part: "statistics", id: channelIds }, key),
  ]);

  const vstats = {};
  for (const i of vids.items || []) {
    const s = i.statistics || {};
    vstats[i.id] = {
      views: Number(s.viewCount || 0),
      likes: Number(s.likeCount || 0),
      comments: Number(s.commentCount || 0),
    };
  }
  const cstats = {};
  for (const i of chans.items || []) {
    const s = i.statistics || {};
    const videoCount = Number(s.videoCount || 0);
    const totalViews = Number(s.viewCount || 0);
    cstats[i.id] = {
      subs: Number(s.subscriberCount || 0),
      video_count: videoCount,
      total_views: totalViews,
      avg_views: videoCount ? totalViews / videoCount : 0,
    };
  }

  const items = videos
    .map((v) => {
      const vs = vstats[v.video_id];
      const cs = cstats[v.channel_id];
      if (!vs || !cs || !cs.avg_views) return null;
      return { ...v, ...vs, ...cs, score: vs.views / cs.avg_views };
    })
    .filter((r) => r && r.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return json({ ok: true, items });
}

function extractVideoId(text) {
  const t = String(text || "").trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function handleTrack(url, key) {
  const target = (url.searchParams.get("t") || "").trim();
  if (!target) return json({ ok: false, error: "Missing t" }, 400);

  const videoId = extractVideoId(target);
  if (videoId) {
    const data = await ytGet("/videos", { part: "statistics,snippet", id: videoId }, key);
    const item = (data.items || [])[0];
    if (!item) return json({ ok: false, error: "Video not found" }, 404);
    const s = item.statistics || {};
    return json({
      ok: true, kind: "video",
      row: {
        id: videoId, title: item.snippet.title,
        views: Number(s.viewCount || 0), likes: Number(s.likeCount || 0),
        comments: Number(s.commentCount || 0),
      },
    });
  }

  let channelId = null;
  let handle = null;
  const cm = target.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (cm) channelId = cm[1];
  else if (/^UC[\w-]{22}$/.test(target)) channelId = target;
  else {
    const hm = target.match(/(?:youtube\.com\/|)(@[\w.\-]+)/);
    if (hm) handle = hm[1].slice(1);
  }

  let data;
  if (channelId) data = await ytGet("/channels", { part: "statistics,snippet", id: channelId }, key);
  else if (handle) data = await ytGet("/channels", { part: "statistics,snippet", forHandle: handle }, key);
  else return json({ ok: false, error: "Could not parse channel or video" }, 400);

  const item = (data.items || [])[0];
  if (!item) return json({ ok: false, error: "Channel not found" }, 404);
  const s = item.statistics || {};
  return json({
    ok: true, kind: "channel",
    row: {
      id: item.id, title: item.snippet.title,
      subs: Number(s.subscriberCount || 0), videos: Number(s.videoCount || 0),
      total_views: Number(s.viewCount || 0),
    },
  });
}

function parseISODuration(iso) {
  const m = String(iso || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

async function handleMyVideos(url, key) {
  const target = (url.searchParams.get("t") || "").trim();
  if (!target) return json({ ok: false, error: "Missing t" }, 400);

  let channelId = null;
  let handle = null;
  const cm = target.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (cm) channelId = cm[1];
  else if (/^UC[\w-]{22}$/.test(target)) channelId = target;
  else {
    const hm = target.match(/(?:youtube\.com\/|)(@[\w.\-]+)/);
    if (hm) handle = hm[1].slice(1);
  }

  let data;
  if (channelId) data = await ytGet("/channels", { part: "statistics,snippet,contentDetails", id: channelId }, key);
  else if (handle) data = await ytGet("/channels", { part: "statistics,snippet,contentDetails", forHandle: handle }, key);
  else return json({ ok: false, error: "Could not parse channel" }, 400);

  const item = (data.items || [])[0];
  if (!item) return json({ ok: false, error: "Channel not found" }, 404);

  const uploads = item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
  if (!uploads) return json({ ok: false, error: "No uploads playlist found" }, 404);

  const pl = await ytGet("/playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: "50" }, key);
  const ids = (pl.items || []).map(i => i.contentDetails && i.contentDetails.videoId).filter(Boolean);
  let videos = [];
  if (ids.length) {
    const vd = await ytGet("/videos", { part: "statistics,snippet,contentDetails", id: ids.join(",") }, key);
    videos = (vd.items || []).map(v => {
      const s = v.statistics || {};
      return {
        id: v.id,
        title: v.snippet.title,
        published: (v.snippet.publishedAt || "").slice(0, 10),
        views: Number(s.viewCount || 0),
        likes: Number(s.likeCount || 0),
        comments: Number(s.commentCount || 0),
        duration: parseISODuration(v.contentDetails && v.contentDetails.duration),
        thumb: (v.snippet.thumbnails && v.snippet.thumbnails.default && v.snippet.thumbnails.default.url) || "",
      };
    });
  }

  const s = item.statistics || {};
  return json({
    ok: true,
    channel: {
      id: item.id, title: item.snippet.title,
      subs: Number(s.subscriberCount || 0), videos: Number(s.videoCount || 0),
      total_views: Number(s.viewCount || 0),
    },
    videos,
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!allowedOrigin(request)) return json({ ok: false, error: "Forbidden" }, 403);

  const url = new URL(request.url);
  const op = url.searchParams.get("op") || "";

  try {
    if (op === "suggest") return await handleSuggest(url);

    const key = env.YOUTUBE_API_KEY;
    if (!key) return json({ ok: false, error: "Server missing YOUTUBE_API_KEY" }, 500);

    if (op === "outliers") return await handleOutliers(url, key);
    if (op === "track") return await handleTrack(url, key);
    if (op === "myvideos") return await handleMyVideos(url, key);
    return json({ ok: false, error: "Unknown op" }, 400);
  } catch (e) {
    return json({ ok: false, error: e.message || "Server error" }, 500);
  }
}
