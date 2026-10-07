# Birleşmiş Milletler Bot - Tam Paket

## Kurulum
1. `npm install discord.js dotenv express express-session`
2. `.env.example` dosyasını `.env` olarak kopyalayın.
3. Gizli değerleri sadece `.env` içine koyun; token/API key'i kimseyle paylaşmayın.
4. `node register.js`
5. `node index.js`

## Komut kapsamı
Ana sunucu: tüm yönetim/Roblox komutları.
Ülke sunucuları: yalnızca `/update`.

## Eksik opsiyonel ayarlar
Ticket kategori ID'si boş bırakılırsa ticket kanalını kategori olmadan oluşturur. `Ticket Yetkilisi` rolü isimle aranır. Yetkili roller isimleri üzerinden kontrol edilir; ID zorunlu değildir.

## Verify
`website/server.js` mevcut OAuth sitesidir. Public URL kullanıyorsanız Roblox uygulamasındaki redirect URI ile `.env` içindeki `ROBLOX_OAUTH_REDIRECT_URI` aynı olmalıdır.
