require("dotenv").config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const commands = [

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Bir kullanıcıyı susturur.")
        .addUserOption(o =>
            o.setName("kullanici")
                .setDescription("Susturulacak kullanıcı")
                .setRequired(true))
        .addIntegerOption(o =>
            o.setName("dakika")
                .setDescription("Mute süresi")
                .setMinValue(1)
                .setRequired(true))
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("Mute sebebi")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Bir kullanıcının susturmasını kaldırır.")
        .addUserOption(o =>
            o.setName("kullanici")
                .setDescription("Susturması kaldırılacak kullanıcı")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("İşlem sebebi")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Bir kullanıcıyı sunucudan atar.")
        .addUserOption(o =>
            o.setName("kullanici")
                .setDescription("Atılacak kullanıcı")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("Kick sebebi")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Bir kullanıcıyı yasaklar.")
        .addUserOption(o =>
            o.setName("kullanici")
                .setDescription("Yasaklanacak kullanıcı")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("Ban sebebi")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("update")
        .setDescription("Roblox rütbeni Discord ile senkronize eder."),

    new SlashCommandBuilder()
        .setName("rütbe-sorgu")
        .setDescription("Bir Roblox kullanıcısının rütbesini sorgular.")
        .addStringOption(o =>
            o.setName("kullanici")
                .setDescription("Roblox kullanıcı adı")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("grup-listele")
        .setDescription("Roblox grup rollerini listeler.")
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("İşlem sebebi")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("rütbe-terfi")
        .setDescription("Bir Roblox kullanıcısını seçilen ülke ve rütbeye terfi ettirir.")
        .addStringOption(o =>
            o.setName("kullanici")
                .setDescription("Roblox kullanıcı adı")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("ulke")
                .setDescription("Roblox grubu")
                .setRequired(true)
                .addChoices(
                    { name: "🇹🇷 Türkiye", value: "turkiye" },
                    { name: "🇩🇪 Almanya", value: "almanya" },
                    { name: "🇫🇷 Fransa", value: "fransa" },
                    { name: "🇪🇸 İspanya", value: "ispanya" }
                ))
        .addStringOption(o =>
            o.setName("rutbe")
                .setDescription("Verilecek Roblox rütbesi")
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("Terfi sebebi")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("rütbe-degistir")
        .setDescription("Bir Roblox kullanıcısının rütbesini değiştirir.")
        .addStringOption(o =>
            o.setName("kullanici")
                .setDescription("Roblox kullanıcı adı")
                .setRequired(true))
        .addStringOption(o =>
            o.setName("ulke")
                .setDescription("Roblox grubu")
                .setRequired(true)
                .addChoices(
                    { name: "🇹🇷 Türkiye", value: "turkiye" },
                    { name: "🇩🇪 Almanya", value: "almanya" },
                    { name: "🇫🇷 Fransa", value: "fransa" },
                    { name: "🇪🇸 İspanya", value: "ispanya" }
                ))
        .addStringOption(o =>
            o.setName("rutbe")
                .setDescription("Roblox grubundaki rütbe")
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("Rütbe değiştirme sebebi")
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName("duyuru")
        .setDescription("Profesyonel bir duyuru oluşturur."),

    new SlashCommandBuilder()
        .setName("ticket-panel")
        .setDescription("Ticket panelini oluşturur.")
        .addStringOption(o =>
            o.setName("sebep")
                .setDescription("Panel oluşturma sebebi")
                .setRequired(true))
];

const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log("Slash komutları yükleniyor...");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_CLIENT_ID,
                process.env.DISCORD_GUILD_ID
            ),
            {
                body: commands.map(command => command.toJSON())
            }
        );

        console.log(`✅ ${commands.length} slash komut başarıyla yüklendi.`);
    } catch (error) {
        console.error("❌ Slash komutları yüklenirken hata oluştu:");
        console.error(error);
        process.exitCode = 1;
    }
})();
