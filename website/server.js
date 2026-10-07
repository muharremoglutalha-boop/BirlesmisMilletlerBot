const express = require("express");
const session = require("express-session");
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
    `http://localhost:${PORT}/oauth/callback`;

const ROOT_DATA =
    path.join(__dirname, "..", "data");

const linksFile =
    path.join(ROOT_DATA, "links.json");

const verifyTokensFile =
    path.join(ROOT_DATA, "verify_tokens.json");

if (!fs.existsSync(ROOT_DATA)) {
    fs.mkdirSync(ROOT_DATA, { recursive: true });
}

if (!fs.existsSync(linksFile)) {
    fs.writeFileSync(
        linksFile,
        JSON.stringify({}, null, 4)
    );
}

if (!fs.existsSync(verifyTokensFile)) {
    fs.writeFileSync(
        verifyTokensFile,
        JSON.stringify({}, null, 4)
    );
}

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            crypto.randomBytes(32).toString("hex"),
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 15 * 60 * 1000
        }
    })
);

function readJson(file) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return {};
    }
}

function writeJson(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 4)
    );
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
body{
 margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
 background:#090b10;color:#f5f7fb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.card{
 width:min(560px,calc(100% - 32px));padding:42px;border:1px solid #202532;
 border-radius:24px;background:linear-gradient(145deg,#11151d,#0c0f15);
 box-shadow:0 25px 80px rgba(0,0,0,.45);text-align:center
}
.logo{
 width:58px;height:58px;margin:0 auto 20px;border-radius:18px;
 display:flex;align-items:center;justify-content:center;background:#5865f2;
 font-size:28px;font-weight:800
}
h1{margin:0 0 12px;font-size:28px}
p{color:#9da5b4;line-height:1.7}
.button{
 display:inline-block;margin-top:18px;padding:14px 22px;border-radius:12px;
 background:#5865f2;color:white;text-decoration:none;font-weight:700
}
.success{color:#57f287}.danger{color:#ed4245}
.info{
 margin-top:24px;padding:16px;border-radius:14px;background:#0a0d13;border:1px solid #202532;
 text-align:left
}
code{color:#c9d1ff}
</style>
</head>
<body><main class="card">${body}</main></body></html>`;
}

app.get("/", (req, res) => {
    res.send(
        page(
            "Roblox Doğrulama",
            `
<div class="logo">✓</div>
<h1>Birleşmiş Milletler</h1>
<p>Discord hesabınızı güvenli şekilde Roblox hesabınızla bağlayın.</p>
<a class="button" href="/auth/roblox">Roblox ile Doğrula</a>
`
        )
    );
});

app.get("/auth/roblox", (req, res) => {

    const token =
        String(req.query.token || "");

    const tokens =
        readJson(verifyTokensFile);

    const record =
        tokens[token];

    if (
        !token ||
        !record ||
        record.used ||
        record.expiresAt < Date.now()
    ) {
        return res.status(400).send(
            page(
                "Geçersiz bağlantı",
                `
<h1>Geçersiz Doğrulama Bağlantısı</h1>
<p>Bu bağlantının süresi dolmuş veya bağlantı artık geçerli değil.</p>
<a class="button" href="/">Ana Sayfa</a>
`
            )
        );
    }

    if (
        !CLIENT_ID ||
        !CLIENT_SECRET ||
        !REDIRECT_URI
    ) {
        return res.status(500).send(
            page(
                "Yapılandırma hatası",
                `<h1>OAuth yapılandırması eksik</h1><p>Website .env ayarlarını kontrol edin.</p>`
            )
        );
    }

    req.session.verifyToken =
        token;

    req.session.discordId =
        String(record.discordId);

    req.session.oauthState =
        crypto.randomBytes(24).toString("hex");

    const params =
        new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: "code",
            scope: "openid profile",
            state: req.session.oauthState
        });

    res.redirect(
        `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`
    );
});

app.get("/oauth/callback", async (req, res) => {

    try {

        const {
            code,
            state
        } = req.query;

        if (
            !code ||
            !state ||
            state !== req.session.oauthState
        ) {
            return res.status(400).send(
                page(
                    "Güvenlik hatası",
                    `<h1>Güvenlik Doğrulaması Başarısız</h1><p>OAuth isteği geçerli değil.</p>`
                )
            );
        }

        const discordId =
            req.session.discordId;

        const tokenKey =
            req.session.verifyToken;

        if (
            !discordId ||
            !tokenKey
        ) {
            return res.status(400).send(
                page(
                    "Oturum hatası",
                    `<h1>Doğrulama oturumu bulunamadı</h1><p>Discord üzerinden yeni bir doğrulama bağlantısı oluşturun.</p>`
                )
            );
        }

        const tokenStore =
            readJson(verifyTokensFile);

        const verifyRecord =
            tokenStore[tokenKey];

        if (
            !verifyRecord ||
            verifyRecord.used ||
            verifyRecord.expiresAt < Date.now() ||
            String(verifyRecord.discordId) !==
                String(discordId)
        ) {
            return res.status(400).send(
                page(
                    "Geçersiz doğrulama",
                    `<h1>Doğrulama bağlantısı geçersiz</h1><p>Discord'dan yeni bir doğrulama bağlantısı oluşturun.</p>`
                )
            );
        }

        const basicAuth =
            Buffer.from(
                `${CLIENT_ID}:${CLIENT_SECRET}`
            ).toString("base64");

        const tokenResponse =
            await fetch(
                "https://apis.roblox.com/oauth/v1/token",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded",
                        Authorization:
                            `Basic ${basicAuth}`
                    },
                    body:
                        new URLSearchParams({
                            grant_type:
                                "authorization_code",
                            code,
                            redirect_uri:
                                REDIRECT_URI
                        })
                }
            );

        const tokenText =
            await tokenResponse.text();

        if (!tokenResponse.ok) {
            throw new Error(
                `Roblox token exchange failed: ${tokenText}`
            );
        }

        const oauth =
            JSON.parse(tokenText);

        const userResponse =
            await fetch(
                "https://apis.roblox.com/oauth/v1/userinfo",
                {
                    headers: {
                        Authorization:
                            `Bearer ${oauth.access_token}`
                    }
                }
            );

        const userText =
            await userResponse.text();

        if (!userResponse.ok) {
            throw new Error(
                `Roblox userinfo failed: ${userText}`
            );
        }

        const robloxUser =
            JSON.parse(userText);

        const robloxId =
            String(
                robloxUser.sub ||
                robloxUser.user_id ||
                robloxUser.id ||
                ""
            );

        const robloxUsername =
            String(
                robloxUser.preferred_username ||
                robloxUser.name ||
                robloxUser.nickname ||
                ""
            );

        if (!robloxId) {
            throw new Error(
                "Roblox kullanıcı ID'si alınamadı."
            );
        }

        const links =
            readJson(linksFile);

        // Aynı Discord hesabının farklı Roblox hesabına bağlanmasını engelle.
        const currentDiscordLink =
            links[discordId];

        if (
            currentDiscordLink &&
            String(currentDiscordLink.robloxId) !==
                robloxId
        ) {
            return res.status(409).send(
                page(
                    "Hesap zaten bağlı",
                    `
<h1>Discord hesabınız zaten bağlı</h1>
<p>Bu Discord hesabı başka bir Roblox hesabıyla eşleştirilmiş.</p>
<p>Güvenlik nedeniyle ikinci bir Roblox hesabı bağlanamaz.</p>
`
                )
            );
        }

        // Aynı Roblox hesabının başka Discord hesabına bağlanmasını engelle.
        const existingDiscordId =
            Object.keys(links).find(
                id =>
                    id !== discordId &&
                    links[id] &&
                    String(links[id].robloxId) ===
                        robloxId
            );

        if (existingDiscordId) {
            return res.status(409).send(
                page(
                    "Roblox hesabı zaten bağlı",
                    `
<h1>Roblox hesabı zaten bağlı</h1>
<p>Bu Roblox hesabı başka bir Discord hesabıyla eşleştirilmiş.</p>
<p>Güvenlik nedeniyle aynı Roblox hesabı iki Discord hesabına bağlanamaz.</p>
`
                )
            );
        }

        links[discordId] = {
            discordId: String(discordId),
            robloxId,
            robloxUsername,
            verified: true,
            verifiedAt:
                new Date().toISOString()
        };

        writeJson(
            linksFile,
            links
        );

        verifyRecord.used = true;
        verifyRecord.usedAt =
            Date.now();

        tokenStore[tokenKey] =
            verifyRecord;

        writeJson(
            verifyTokensFile,
            tokenStore
        );

        delete req.session.oauthState;
        delete req.session.verifyToken;
        delete req.session.discordId;

        const avatarUrl =
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(robloxId)}&size=150x150&format=Png&isCircular=true`;

        res.send(
            page(
                "Doğrulama başarılı",
                `
<div class="logo">✓</div>
<h1 class="success">Doğrulama Başarılı</h1>
<p>Discord hesabınız Roblox hesabıyla başarıyla eşleştirildi.</p>
<div class="info">
<strong>Discord ID</strong><br>
<code>${escapeHtml(discordId)}</code>
<br><br>
<strong>Roblox Kullanıcı</strong><br>
<code>${escapeHtml(robloxUsername)}</code>
<br><br>
<strong>Roblox ID</strong><br>
<code>${escapeHtml(robloxId)}</code>
</div>
<p>Bu pencereyi kapatıp Discord'a dönebilirsiniz.</p>
`
            )
        );

        console.log(
            `[VERIFY] Discord ${discordId} <-> Roblox ${robloxId} (${robloxUsername})`
        );

    } catch (error) {

        console.error(
            "OAUTH CALLBACK ERROR:",
            error
        );

        res.status(500).send(
            page(
                "Doğrulama hatası",
                `
<h1>Doğrulama Tamamlanamadı</h1>
<p>Roblox doğrulaması sırasında bir hata oluştu.</p>
<div class="info"><code>${escapeHtml(error.message)}</code></div>
`
            )
        );
    }
});

app.listen(PORT, () => {
    console.log(
        `VERIFY WEBSITE: http://localhost:${PORT}`
    );
});
