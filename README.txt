# Roblox Discord Bot - Sıfırdan

## Kurulum

1. Bu klasörde CMD aç:
   `cd "C:\Users\bozdo\Desktop\Roblox Bot"`

2. `npm install`

3. `.env.example` dosyasını `.env` olarak kopyala ve kendi gizli bilgilerini gir.
   Token/API key'i kimseye gönderme.

4. Discord Developer Portal'da:
   - Server Members Intent
   - Message Content Intent
   aç.

5. Botun sunucuda gerekli yetkilere sahip olduğundan emin ol:
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Manage Channels
   - Manage Messages
   - Moderate Members
   - Kick Members
   - Ban Members

6. Komutları kaydet:
   `node register.js`

7. Botu çalıştır:
   `node index.js`

## Komutlar

/mute
/kick
/ban
/roblox-bagla
/rütbe-sorgu
/grup-listele
/rütbe-terfi
/rütbe-degistir
/duyuru
/ticket-panel

## Rütbe sistemi

Rütbe yönetimi için Discord hesabı önce `/roblox-bagla` ile Roblox hesabına bağlanır.

Bağlı Roblox hesabının grup rank'ı 60 veya üstü olmalıdır.

Rank 60 = Dışişleri Bakanlığı seviyesi.

Vatandas role ID:
878879091

Terfi zincirleri:
Türkiye:
Vatandas -> Türk Askeri -> Türkiye Elcisi -> Türkiye  Dışişleri Bakanlığı -> Türkiye mareşal

İspanya:
Vatandas -> Ispanyol Askeri -> Ispanya Elcisi -> Ispanya Dışişleri Bakanlığı -> Ispanya mareșal

Fransa:
Vatandas -> Fransa Askeri -> Fransa Elcisi -> Fransa Dışişleri Bakanlığı -> Franse mareșal

Almanya:
Vatandas -> Alman Askeri -> Almanya Elcisi -> Almanya Dışişleri Bakanlığı -> DE maresal

Creator, Bot, Admin, Dünya Baris Örgütü, Dünya Saglik Örgütü, Guest ve "." hedef rütbe olarak kullanılmaz.
