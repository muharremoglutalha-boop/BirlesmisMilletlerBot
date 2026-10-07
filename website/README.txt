# Birlesmis Milletler - Discord ↔ Roblox Verification

Bu paket mevcut Discord bot kodunu koruyarak güvenli Roblox OAuth hesap bağlama sistemi ekler.

## Dosyalar
- `server.js` — mevcut bot + yeni verification sistemi
- `website/server.js` — Roblox OAuth website
- `.env.example` — bot ayarları
- `website/.env.example` — OAuth ayarları

## Önemli
Website ve bot aynı `data` klasörünü kullanmalıdır:
`server.js` ile aynı klasörde `data/` bulunur; website bu klasörün içindeki `links.json` ve `verify_tokens.json` dosyalarını kullanır.

## Discord ↔ Roblox bağlantısı
- Discord kullanıcısı `/verify` kullanır.
- Bot tek kullanımlık, 10 dakikalık token üretir.
- Roblox OAuth ile giriş yapılır.
- Discord ID + Roblox ID `links.json` içine kaydedilir.
- Aynı Discord hesabına ikinci Roblox hesabı bağlanamaz.
- Aynı Roblox hesabı ikinci Discord hesabına bağlanamaz.
- `VERIFIED_ROLE_ID` ayarlanırsa bot doğrulanmış üyeye rol verir.

## OAuth
Roblox uygulamasındaki redirect URI:
`http://localhost:3000/oauth/callback`

Website `.env` içindeki OAuth bilgilerini doldurun.
