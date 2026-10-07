require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const MAIN_GUILD_ID='1419088865313951898';
const COUNTRY_GUILDS=['1557114176655327322','1557104978940661830','1557106587141677087','1557106841551511624'];
const countries=[{name:'🇹🇷 Türkiye',value:'turkiye'},{name:'🇩🇪 Almanya',value:'almanya'},{name:'🇫🇷 Fransa',value:'fransa'},{name:'🇪🇸 İspanya',value:'ispanya'}];
const countryOption=o=>o.setName('ulke').setDescription('Ülke').setRequired(true).addChoices(...countries);
const commands=[
 new SlashCommandBuilder().setName('verify').setDescription('Roblox hesabınızı Discord hesabınıza bağlar.'),
 new SlashCommandBuilder().setName('update').setDescription('Roblox rütbenizi Discord ile senkronize eder.'),
 new SlashCommandBuilder().setName('grup-istek').setDescription('Bekleyen Roblox grup isteğini kabul eder.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(countryOption).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('grup-at').setDescription('Roblox kullanıcısını gruptan çıkarır.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(countryOption).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('rütbe-sorgu').setDescription('Roblox rütbesini sorgular.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(countryOption),
 new SlashCommandBuilder().setName('grup-listele').setDescription('Roblox kullanıcısının tüm gruplarını listeler.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)),
 new SlashCommandBuilder().setName('rütbe-terfi').setDescription('Bir sonraki gerçek rütbeye terfi ettirir.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(countryOption).addStringOption(o=>o.setName('sebep').setDescription('Terfi sebebi').setRequired(true)),
 new SlashCommandBuilder().setName('rütbe-degistir').setDescription('Doğrulanmış ülkeye göre rütbe değiştirir.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(o=>o.setName('rutbe').setDescription('Rütbe').setRequired(true).setAutocomplete(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('profil').setDescription('Discord ve Roblox profilini gösterir.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı')),
 new SlashCommandBuilder().setName('duyuru').setDescription('Ülke personeline duyuru gönderir.').addStringOption(countryOption),
 new SlashCommandBuilder().setName('ticket-panel').setDescription('Ticket panelini oluşturur.'),
 new SlashCommandBuilder().setName('mute').setDescription('Kullanıcıyı susturur.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addIntegerOption(o=>o.setName('dakika').setDescription('Dakika').setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('unmute').setDescription('Susturmayı kaldırır.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('kick').setDescription('Kullanıcıyı atar.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 new SlashCommandBuilder().setName('ban').setDescription('Kullanıcıyı yasaklar.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true))
];
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
(async()=>{try{const body=commands.map(x=>x.toJSON());await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID,MAIN_GUILD_ID),{body});const update=body.filter(x=>x.name==='update');for(const gid of COUNTRY_GUILDS)await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID,gid),{body:update});console.log('TÜM KOMUTLAR HAZIR.');}catch(e){console.error(e);process.exitCode=1;}})();
