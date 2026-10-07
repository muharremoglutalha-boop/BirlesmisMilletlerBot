const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const CLIENT_ID = process.env.ROBLOX_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.ROBLOX_OAUTH_CLIENT_SECRET;

const REDIRECT_URI =
  process.env.ROBLOX_OAUTH_REDIRECT_URI ||
  "https://birlesmismilletlerbot.onrender.com/oauth/callback";

const ROOT_DATA = path.join(__dirname, "..", "data");
const LINKS_FILE = path.join(ROOT_DATA, "links.json");
const TOKENS_FILE = path.join(ROOT_DATA, "verify_tokens.json");

fs.mkdirSync(ROOT_DATA, { recursive: true });
for (const file of [LINKS_FILE, TOKENS_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
}

const readJson = file => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {}; }
};
const writeJson = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2));

const GROUPS = {
  turkiye: process.env.ROBLOX_TURKEY_GROUP_ID || process.env.ROBLOX_GROUP_ID,
  ispanya: process.env.ROBLOX_SPAIN_GROUP_ID,
  fransa: process.env.ROBLOX_FRANCE_GROUP_ID,
  almanya: process.env.ROBLOX_GERMANY_GROUP_ID
};

async function robloxApi(url) {
  const response = await fetch(url, {
    headers: { "x-api-key": process.env.ROBLOX_API_KEY || "" }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) throw new Error(`Roblox API ${response.status}`);
  return data;
}

async function getMembership(groupId, userId) {
  if (!groupId) return null;
  const filter = encodeURIComponent(`user == 'users/${userId}'`);
  const data = await robloxApi(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=${filter}&maxPageSize=10`
  );
  return data.groupMemberships?.[0] || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function page(title, body) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} • Birleşmiş Milletler</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#090b10;color:#f5f7fb;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.card{width:min(560px,calc(100% - 32px));padding:42px;border:1px solid #202532;border-radius:24px;background:#11151d;box-shadow:0 25px 80px rgba(0,0,0,.45);text-align:center}
.logo{width:58px;height:58px;margin:0 auto 20px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:#5865f2;font-size:28px;font-weight:800}
h1{margin:0 0 12px;font-size:28px}p{color:#9da5b4;line-height:1.7}
.button{display:inline-block;margin-top:18px;padding:14px 22px;border-radius:12px;background:#5865f2;color:white;text-decoration:none;font-weight:700}
.success{color:#57f287}.danger{color:#ed4245}
</style>
</head>
<body><main class="card">${body}</main></body></html>`;
}

app.get("/", (req, res) => {
  res.send(page("Roblox Doğrulama", `
    <div class="logo">✓</div>
    <h1>Birleşmiş Milletler</h1>
    <p>Discord hesabını güvenli şekilde Roblox hesabınla bağla.</p>
    <a class="button" href="/auth/roblox">Roblox ile Doğrula</a>
  `));
});

app.get("/auth/roblox", (req, res) => {
  const token = String(req.query.token || "");
  const tokens = readJson(TOKENS_FILE);
  const record = tokens[token];

  if (!token || !record || record.used || record.expiresAt < Date.now()) {
    return res.status(400).send(page("Geçersiz bağlantı", `
      <h1>Geçersiz Doğrulama Bağlantısı</h1>
      <p>Bu doğrulama bağlantısının süresi dolmuş veya daha önce kullanılmış.</p>
    `));
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send(page("Ayar Hatası", `
      <h1>OAuth ayarı eksik</h1>
      <p>Roblox OAuth ayarları sunucuda tamamlanmamış.</p>
    `));
  }

  const state = crypto.randomBytes(24).toString("hex");
  tokens[token].oauthState = state;
  tokens[token].stateCreatedAt = Date.now();
  writeJson(TOKENS_FILE, tokens);

  const url = new URL("https://apis.roblox.com/oauth/v1/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) {
      return res.status(400).send(page("Hata", `<h1>OAuth bilgisi eksik.</h1>`));
    }

    const tokens = readJson(TOKENS_FILE);
    const entry = Object.entries(tokens).find(([, value]) =>
      value?.oauthState === state &&
      !value.used &&
      value.expiresAt > Date.now()
    );

    if (!entry) {
      return res.status(400).send(page("Hata", `<h1>Geçersiz doğrulama durumu.</h1>`));
    }

    const [verifyToken, record] = entry;

    const form = new URLSearchParams();
    form.set("client_id", CLIENT_ID);
    form.set("client_secret", CLIENT_SECRET);
    form.set("grant_type", "authorization_code");
    form.set("code", code);
    form.set("redirect_uri", REDIRECT_URI);

    const tokenResponse = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form
    });

    const tokenText = await tokenResponse.text();
    let tokenData = {};
    try { tokenData = tokenText ? JSON.parse(tokenText) : {}; } catch {}

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Roblox OAuth token error:", tokenText.slice(0, 500));
      return res.status(400).send(page("Roblox Hatası", `<h1>Roblox hesabı doğrulanamadı.</h1><p>OAuth işlemi başarısız oldu.</p>`));
    }

    const userResponse = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userResponse.json();

    if (!userResponse.ok || !userInfo.sub) {
      return res.status(400).send(page("Roblox Hatası", `<h1>Kullanıcı bilgisi alınamadı.</h1>`));
    }

    const robloxId = String(userInfo.sub);
    const links = readJson(LINKS_FILE);

    let country = null;
    for (const [name, groupId] of Object.entries(GROUPS)) {
      if (!groupId) continue;
      try {
        const membership = await getMembership(groupId, robloxId);
        if (membership) {
          country = name;
          break;
        }
      } catch (error) {
        console.error(`Üyelik kontrolü ${name}:`, error.message);
      }
    }

    links[String(record.discordId)] = {
      discordId: String(record.discordId),
      robloxId,
      robloxUsername: userInfo.preferred_username || userInfo.name || "Bilinmiyor",
      robloxDisplayName: userInfo.name || userInfo.nickname || "Bilinmiyor",
      country,
      verified: true,
      linkedAt: Date.now()
    };

    record.used = true;
    record.usedAt = Date.now();
    tokens[verifyToken] = record;

    writeJson(LINKS_FILE, links);
    writeJson(TOKENS_FILE, tokens);

    res.send(page("Başarılı", `
      <div class="logo">✓</div>
      <h1 class="success">Hesap Bağlandı</h1>
      <p><strong>${escapeHtml(userInfo.preferred_username || userInfo.name || "Roblox")}</strong> hesabı Discord hesabına bağlandı.</p>
      <p>Discord'a dönüp <strong>/update</strong> komutunu kullanabilirsin.</p>
    `));
  } catch (error) {
    console.error("OAuth callback:", error);
    res.status(500).send(page("Hata", `<h1>Doğrulama başarısız.</h1><p>Sunucu tarafında bir hata oluştu.</p>`));
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, "0.0.0.0", () => {
    console.log(`VERIFY WEBSITE: http://0.0.0.0:${PORT}`);
});