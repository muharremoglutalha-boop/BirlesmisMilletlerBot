const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  SlashCommandBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();
require("./website/server.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const DATA = path.join(__dirname, "data");
fs.mkdirSync(DATA, { recursive: true });

const LINKS_FILE = path.join(DATA, "links.json");
const TOKENS_FILE = path.join(DATA, "verify_tokens.json");
for (const file of [LINKS_FILE, TOKENS_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
}

const readJson = file => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {}; }
};
const writeJson = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2));

const MAIN_GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const VERIFY_GUILD_ID = process.env.VERIFY_GUILD_ID || MAIN_GUILD_ID;
const VERIFY_WEB_URL =
  (process.env.VERIFY_WEB_URL || "https://birlesmismilletlerbot.onrender.com")
    .replace(/\/+$/, "");

const GUILDS = {
  main: MAIN_GUILD_ID,
  turkiye: "1557114176655327322",
  ispanya: "1557106841551511624",
  fransa: "1557106587141677087",
  almanya: "1557104978940661830"
};

const GROUPS = {
  turkiye: process.env.ROBLOX_TURKEY_GROUP_ID || process.env.ROBLOX_GROUP_ID,
  ispanya: process.env.ROBLOX_SPAIN_GROUP_ID,
  fransa: process.env.ROBLOX_FRANCE_GROUP_ID,
  almanya: process.env.ROBLOX_GERMANY_GROUP_ID
};

const MAIN_ROLES = {
  dogrulanmamis: "1557121149509570621",
  dogrulandi: "1557121092806770759",
  turkiye: "1557116799730843809",
  ispanya: "1557114466112512081",
  fransa: "1557113195343126548",
  almanya: "1557109207839281283"
};

const COUNTRY = {
  turkiye: {
    name: "Türkiye",
    guild: GUILDS.turkiye,
    verified: "1557118814213378109",
    unverified: "1557118849474633859",
    personnel: "1557118481756061796",
    ranks: {
      "Acemi Asker": "1557118408816861264",
      "Piyade": "1557118326637858828",
      "Onbaşı": "1557118242869354536",
      "Çavuş": "1557118174150004756",
      "Teğmen": "1557118093367447614",
      "Yüzbaşı": "1557118047221972992",
      "Albay": "1557117988597927945",
      "Maresal": "1557117864102723655"
    }
  },
  ispanya: {
    name: "İspanya",
    guild: GUILDS.ispanya,
    verified: "1557116423157973012",
    unverified: "1557116461636517889",
    personnel: "1557116090025250919",
    ranks: {
      "Soldado": "1557116035734183987",
      "Cabo": "1557115982357471352",
      "Sargento": "1557115908022083605",
      "Suboficial": "1557115836291096626",
      "Teniente": "1557115786085142588",
      "Capitán": "1557115736110145657",
      "Coronel": "1557115648784465960",
      "General": "1557115599975616572",
      "Maresal": "1557115529536213192"
    }
  },
  fransa: {
    name: "Fransa",
    guild: GUILDS.fransa,
    verified: "1557112445854683167",
    unverified: "1557112478465265746",
    personnel: "1557112320633606224",
    ranks: {
      "Soldat": "1557112260332228628",
      "Caporal": "1557112200357748776",
      "Sergent": "1557112131390804190",
      "Adjudant": "1557112081097035987",
      "Lieutenant": "1557112049408942110",
      "Capitaline": "1557111978936377414",
      "Colonel": "1557111921008975932",
      "Général": "1557111864457044039",
      "Maresal": "1557111791362900138"
    }
  },
  almanya: {
    name: "Almanya",
    guild: GUILDS.almanya,
    verified: "1557107474421522503",
    unverified: "1557107431870562407",
    personnel: "1557106979497844777",
    ranks: {
      "Er": "1557106892940116078",
      "Gefreiter": "1557107548044271747",
      "Obergefreiter": "1557107609427779765",
      "Feldwebel": "1557107667850494095",
      "Leutnant": "1557107741728837663",
      "Hauptmann": "1557107800113545327",
      "Oberst": "1557107885690064958",
      "General": "1557107951238381638",
      "Maresal": "1557108030821113959"
    }
  }
};

const ALL_RANK_ROLE_IDS = Object.values(COUNTRY)
  .flatMap(c => Object.values(c.ranks));

function robloxHeaders(extra = {}) {
  return {
    "x-api-key": process.env.ROBLOX_API_KEY || "",
    ...extra
  };
}

async function robloxRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: robloxHeaders(options.headers || {})
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    throw new Error(`Roblox API ${response.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function findRobloxUser(username) {
  const r = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false
    })
  });
  const data = await r.json();
  if (!r.ok || !data.data?.length) return null;
  return data.data[0];
}

async function getGroupRoles(groupId) {
  if (!groupId) return [];
  const roles = [];
  let token = "";
  do {
    let url =
      `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
    if (token) url += `&pageToken=${encodeURIComponent(token)}`;
    const data = await robloxRequest(url);
    for (const role of data.groupRoles || []) {
      roles.push({
        id: String(role.id).split("/").pop(),
        name: role.displayName,
        rank: Number(role.rank)
      });
    }
    token = data.nextPageToken || "";
  } while (token);
  return roles;
}

async function getMembership(groupId, userId) {
  if (!groupId) return null;
  const filter = encodeURIComponent(`user == 'users/${userId}'`);
  const data = await robloxRequest(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=${filter}&maxPageSize=10`
  );
  return data.groupMemberships?.[0] || null;
}

async function getUserRank(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  if (!membership?.role) return null;
  const roleId = String(membership.role).split("/").pop();
  const roles = await getGroupRoles(groupId);
  return roles.find(r => String(r.id) === roleId) || null;
}

async function changeRank(groupId, userId, roleId) {
  const membership = await getMembership(groupId, userId);
  if (!membership?.path) throw new Error("Kullanıcı grupta değil.");
  const membershipId = membership.path.split("/").pop();
  await robloxRequest(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}:assignRole`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: `groups/${groupId}/roles/${roleId}` })
    }
  );
}

async function listJoinRequests(groupId, userId) {
  const filter = encodeURIComponent(`user == 'users/${userId}'`);
  const data = await robloxRequest(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests?filter=${filter}&maxPageSize=10`
  );
  return data.groupJoinRequests || [];
}

async function acceptJoinRequest(groupId, requestId) {
  await robloxRequest(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests/${requestId}:accept`,
    { method: "POST" }
  );
}

async function removeFromGroup(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  if (!membership?.path) throw new Error("Kullanıcı grupta değil.");
  const membershipId = membership.path.split("/").pop();
  await robloxRequest(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}:unassignRole`,
    { method: "POST" }
  );
}

function embed(color, title, description) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function ok(title, description) {
  return embed(0x57f287, `✅ ${title}`, description);
}
function fail(title, description) {
  return embed(0xed4245, `❌ ${title}`, description);
}

async function sendLog(guild, title, description) {
  try {
    const id =
      guild.id === GUILDS.turkiye ? "1557128581895823552" :
      guild.id === GUILDS.almanya ? "1557128718437056652" :
      guild.id === GUILDS.fransa ? "1557128615538335774" :
      guild.id === GUILDS.ispanya ? "1557128667375730800" :
      process.env.LOG_CHANNEL_ID;
    if (!id) return;
    const channel = await client.channels.fetch(id);
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [embed(0x5865f2, title, description)] });
    }
  } catch {}
}

function formatList(values) {
  return values.length ? values.join("\n") : "None";
}

function updateEmbed(member, added, removed) {
  const now = new Date();
  const stamp = now.toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("Update")
    .addFields(
      { name: "Nickname", value: member.displayName || member.user.username, inline: false },
      { name: "Added Roles", value: formatList(added), inline: false },
      { name: "Removed Roles", value: formatList(removed), inline: false }
    )
    .setFooter({ text: `RoWii - ${stamp}` });
}

async function updateMember(member, linked) {
  const country = COUNTRY[linked.country];
  if (!country) throw new Error("Hesabın ülke bağlantısı bulunamadı.");

  const rank = await getUserRank(GROUPS[linked.country], linked.robloxId);
  if (!rank) throw new Error("Roblox grubunda üyelik bulunamadı.");

  const added = [];
  const removed = [];

  const removeIds = new Set([
    ...ALL_RANK_ROLE_IDS,
    ...Object.values(COUNTRY).flatMap(c => [c.verified, c.unverified, c.personnel])
  ]);

  const preserve = new Set([
    MAIN_ROLES.dogrulanmamis,
    MAIN_ROLES.dogrulandi
  ]);

  const rankNames = new Set(
    Object.values(COUNTRY).flatMap(c => Object.keys(c.ranks))
  );
  const toRemove = member.roles.cache.filter(r =>
    ((removeIds.has(r.id) || (member.guild.id === MAIN_GUILD_ID && rankNames.has(r.name)))
      && !preserve.has(r.id))
  );

  if (member.guild.id === MAIN_GUILD_ID) {
    if (member.roles.cache.has(MAIN_ROLES.dogrulanmamis)) {
      await member.roles.remove(MAIN_ROLES.dogrulanmamis);
      removed.push("Doğrulanmamış");
    }
    if (!member.roles.cache.has(MAIN_ROLES.dogrulandi)) {
      await member.roles.add(MAIN_ROLES.dogrulandi);
      added.push("Doğrulandı");
    }

    const countryRole = MAIN_ROLES[linked.country];
    if (countryRole && !member.roles.cache.has(countryRole)) {
      await member.roles.add(countryRole);
      added.push(country.name);
    }
  }

  if (country.guild === member.guild.id) {
    if (member.roles.cache.has(country.unverified)) {
      await member.roles.remove(country.unverified);
      removed.push("Doğrulanmamış");
    }
    if (!member.roles.cache.has(country.verified)) {
      await member.roles.add(country.verified);
      added.push("Doğrulandı");
    }
    if (country.personnel && !member.roles.cache.has(country.personnel)) {
      await member.roles.add(country.personnel);
      added.push("Personel");
    }
  }

  if (member.guild.id === country.guild) {
    const targetRoleId = country.ranks[rank.name];
    if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
      await member.roles.add(targetRoleId);
      added.push(rank.name);
    }
  } else if (member.guild.id === MAIN_GUILD_ID) {
    const targetRole = member.guild.roles.cache.find(r => r.name === rank.name);
    if (targetRole && !member.roles.cache.has(targetRole.id)) {
      await member.roles.add(targetRole);
      added.push(targetRole.name);
    }
  }

  for (const role of toRemove.values()) {
    try {
      await member.roles.remove(role);
      removed.push(role.name);
    } catch {}
  }

  linked.verified = true;
  linked.country = linked.country;
  linked.robloxUsername = linked.robloxUsername || linked.username;
  linked.lastUpdateAt = Date.now();

  const links = readJson(LINKS_FILE);
  links[member.id] = linked;
  writeJson(LINKS_FILE, links);

  return { rank, added, removed };
}

function createCommands() {
  return [
    new SlashCommandBuilder().setName("verify")
      .setDescription("Roblox hesabını Discord hesabına bağlar."),

    new SlashCommandBuilder().setName("update")
      .setDescription("Roblox rütbeni Discord rollerine senkronize eder."),

    new SlashCommandBuilder().setName("grup-istek")
      .setDescription("Roblox grup katılım isteğini kabul eder.")
      .addStringOption(o => o.setName("kullanici").setDescription("Roblox kullanıcı adı").setRequired(true))
      .addStringOption(o => o.setName("ulke").setDescription("Ülke").setRequired(true)
        .addChoices(
          { name: "Türkiye", value: "turkiye" },
          { name: "İspanya", value: "ispanya" },
          { name: "Fransa", value: "fransa" },
          { name: "Almanya", value: "almanya" }
        ))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("grup-at")
      .setDescription("Roblox grup üyeliğini kaldırır.")
      .addStringOption(o => o.setName("kullanici").setDescription("Roblox kullanıcı adı").setRequired(true))
      .addStringOption(o => o.setName("ulke").setDescription("Ülke").setRequired(true)
        .addChoices(
          { name: "Türkiye", value: "turkiye" },
          { name: "İspanya", value: "ispanya" },
          { name: "Fransa", value: "fransa" },
          { name: "Almanya", value: "almanya" }
        ))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("grup-listele")
      .setDescription("Roblox kullanıcısının bulunduğu grupları listeler.")
      .addStringOption(o => o.setName("kullanici").setDescription("Roblox kullanıcı adı").setRequired(true))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("rütbe-sorgu")
      .setDescription("Roblox ve Discord profil bilgilerini gösterir.")
      .addStringOption(o => o.setName("kullanici").setDescription("Roblox kullanıcı adı").setRequired(true)),

    new SlashCommandBuilder().setName("rütbe-terfi")
      .setDescription("Kullanıcıyı bir sonraki gerçek Roblox rütbesine terfi ettirir.")
      .addStringOption(o => o.setName("kullanici").setDescription("Roblox kullanıcı adı").setRequired(true))
      .addStringOption(o => o.setName("ulke").setDescription("Ülke").setRequired(true)
        .addChoices(
          { name: "Türkiye", value: "turkiye" },
          { name: "İspanya", value: "ispanya" },
          { name: "Fransa", value: "fransa" },
          { name: "Almanya", value: "almanya" }
        ))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("rütbe-degistir")
      .setDescription("Doğrulanmış kullanıcının Roblox rütbesini değiştirir.")
      .addStringOption(o => o.setName("kullanici").setDescription("Roblox kullanıcı adı").setRequired(true))
      .addStringOption(o => o.setName("rutbe").setDescription("Yeni gerçek Roblox rütbesi").setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("mute")
      .setDescription("Discord kullanıcısını susturur.")
      .addUserOption(o => o.setName("kullanici").setDescription("Kullanıcı").setRequired(true))
      .addIntegerOption(o => o.setName("dakika").setDescription("Dakika").setRequired(true).setMinValue(1).setMaxValue(10080))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("unmute")
      .setDescription("Susturmayı kaldırır.")
      .addUserOption(o => o.setName("kullanici").setDescription("Kullanıcı").setRequired(true))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("kick")
      .setDescription("Kullanıcıyı sunucudan atar.")
      .addUserOption(o => o.setName("kullanici").setDescription("Kullanıcı").setRequired(true))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("ban")
      .setDescription("Kullanıcıyı sunucudan yasaklar.")
      .addUserOption(o => o.setName("kullanici").setDescription("Kullanıcı").setRequired(true))
      .addStringOption(o => o.setName("sebep").setDescription("Sebep").setRequired(true)),

    new SlashCommandBuilder().setName("duyuru")
      .setDescription("Duyuru gönderir.")
      .addStringOption(o => o.setName("baslik").setDescription("Başlık").setRequired(true))
      .addStringOption(o => o.setName("icerik").setDescription("İçerik").setRequired(true)),

    new SlashCommandBuilder().setName("ticket-panel")
      .setDescription("Ticket paneli oluşturur.")
  ].map(c => c.toJSON());
}

async function registerCommands() {
  const commands = createCommands();
  const guildIds = Object.values(GUILDS).filter(Boolean);
  for (const guildId of guildIds) {
    try {
      const guild = await client.guilds.fetch(guildId);
      await guild.commands.set(commands);
      console.log(`Komutlar hazır: ${guild.name}`);
    } catch (e) {
      console.error(`Komut kayıt hatası ${guildId}:`, e.message);
    }
  }
}

function findLinkedByRobloxUsername(username) {
  const links = readJson(LINKS_FILE);
  const needle = String(username).toLowerCase();
  return Object.values(links).find(x =>
    x?.verified && String(x.robloxUsername || "").toLowerCase() === needle
  ) || null;
}

async function permission(interaction) {
  if (!interaction.guild) return false;
  if (interaction.guild.id !== MAIN_GUILD_ID) {
    await interaction.reply({ embeds: [fail("Yetki", "Bu komut ana yönetim sunucusunda kullanılabilir.")], ephemeral: true });
    return false;
  }
  return true;
}

client.once("clientReady", async () => {
  console.log(`BOT HAZIR: ${client.user.tag}`);
  await registerCommands();
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName !== "rütbe-degistir") return;
      const username = interaction.options.getString("kullanici") || "";
      const linked = findLinkedByRobloxUsername(username);
      const choices = [];

      if (linked?.country && GROUPS[linked.country]) {
        const roles = await getGroupRoles(GROUPS[linked.country]);
        for (const role of roles) {
          if (!role.name || role.name === "." || role.name.toLowerCase() === "guest") continue;
          choices.push({ name: `${role.name} • Rank ${role.rank}`.slice(0, 100), value: `${linked.country}::${role.id}`.slice(0, 100) });
        }
      }

      await interaction.respond(choices.slice(0, 25));
      return;
    }

    if (interaction.isButton() && interaction.customId === "verify_roblox") {
      const token = crypto.randomBytes(32).toString("hex");
      const tokens = readJson(TOKENS_FILE);
      tokens[token] = {
        discordId: interaction.user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
        used: false
      };
      writeJson(TOKENS_FILE, tokens);

      const url = `${VERIFY_WEB_URL}/auth/roblox?token=${encodeURIComponent(token)}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Link Roblox Account ↗").setStyle(ButtonStyle.Link).setURL(url)
      );
      await interaction.reply({
        embeds: [embed(0x5865f2, "Verification", "Roblox hesabını bu Discord hesabına bağlamak için aşağıdaki butona tıkla.")],
        components: [row],
        ephemeral: true
      });
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const command = interaction.commandName;

    if (command === "verify") {
      await interaction.deferReply({ flags: 64 });
      const links = readJson(LINKS_FILE);
      const linked = links[interaction.user.id];
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_roblox")
          .setLabel(linked?.verified ? "Hesap Doğrulandı" : "Link Roblox Account ↗")
          .setStyle(linked?.verified ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(Boolean(linked?.verified))
      );
      await interaction.editReply({
        embeds: [embed(0x5865f2, "Verification", linked?.verified
          ? `Bağlı Roblox hesabı: **${linked.robloxUsername || "Bilinmiyor"}**`
          : "Roblox hesabını bağlamak için aşağıdaki butona tıkla.")],
        components: [row]
      });
      return;
    }

    if (command === "update") {
      const links = readJson(LINKS_FILE);
      const linked = links[interaction.user.id];
      if (!linked?.robloxId) {
        await interaction.reply({ embeds: [fail("Update", "Önce Roblox hesabını bağlamalısın.")], ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const result = await updateMember(await interaction.guild.members.fetch(interaction.user.id), linked);
      await interaction.editReply({ embeds: [updateEmbed(await interaction.guild.members.fetch(interaction.user.id), result.added, result.removed)] });
      await sendLog(interaction.guild, "Update", `**${interaction.user}** • ${linked.robloxUsername || linked.robloxId}`);
      return;
    }

    if (["grup-istek", "grup-at", "grup-listele", "rütbe-sorgu", "rütbe-terfi", "rütbe-degistir"].includes(command)) {
      if (!(await permission(interaction))) return;
    }

    if (command === "grup-istek") {
      await interaction.deferReply();
      const username = interaction.options.getString("kullanici");
      const country = interaction.options.getString("ulke");
      const reason = interaction.options.getString("sebep");
      const user = await findRobloxUser(username);
      if (!user) return interaction.editReply({ embeds: [fail("Grup İsteği", "Roblox kullanıcısı bulunamadı.")] });
      const requests = await listJoinRequests(GROUPS[country], user.id);
      const request = requests[0];
      if (!request) return interaction.editReply({ embeds: [fail("Grup İsteği", "Bekleyen grup isteği bulunamadı.")] });
      const requestId = String(request.path || request.id || "").split("/").pop();
      await acceptJoinRequest(GROUPS[country], requestId);
      const roles = await getGroupRoles(GROUPS[country]);
      const first = roles.filter(r => r.rank > 0).sort((a,b) => a.rank-b.rank)[0];
      if (first) await changeRank(GROUPS[country], user.id, first.id);
      await interaction.editReply({ embeds: [ok("Grup İsteği Kabul Edildi", `**${user.name}**\n**Ülke:** ${COUNTRY[country].name}\n**İlk Rütbe:** ${first?.name || "Varsayılan"}\n**Sebep:** ${reason}`)] });
      return;
    }

    if (command === "grup-at") {
      await interaction.deferReply();
      const username = interaction.options.getString("kullanici");
      const country = interaction.options.getString("ulke");
      const reason = interaction.options.getString("sebep");
      const user = await findRobloxUser(username);
      if (!user) return interaction.editReply({ embeds: [fail("Grup At", "Roblox kullanıcısı bulunamadı.")] });
      await removeFromGroup(GROUPS[country], user.id);
      await interaction.editReply({ embeds: [ok("Gruptan Çıkarıldı", `**${user.name}** • ${COUNTRY[country].name}\n**Sebep:** ${reason}`)] });
      return;
    }

    if (command === "rütbe-terfi") {
      await interaction.deferReply();
      const username = interaction.options.getString("kullanici");
      const country = interaction.options.getString("ulke");
      const reason = interaction.options.getString("sebep");
      const user = await findRobloxUser(username);
      if (!user) return interaction.editReply({ embeds: [fail("Terfi", "Roblox kullanıcısı bulunamadı.")] });
      const current = await getUserRank(GROUPS[country], user.id);
      if (!current) return interaction.editReply({ embeds: [fail("Terfi", "Kullanıcı grupta değil.")] });
      const roles = await getGroupRoles(GROUPS[country]);
      const next = roles.filter(r => r.rank > current.rank).sort((a,b) => a.rank-b.rank)[0];
      if (!next) return interaction.editReply({ embeds: [fail("Terfi", "Daha yüksek bir rütbe bulunamadı.")] });
      await changeRank(GROUPS[country], user.id, next.id);
      await interaction.editReply({ embeds: [ok("Rütbe Terfi", `**${user.name}**\n${current.name} → **${next.name}**\n**Sebep:** ${reason}`)] });
      return;
    }

    if (command === "rütbe-degistir") {
      await interaction.deferReply();
      const username = interaction.options.getString("kullanici");
      const choice = interaction.options.getString("rutbe");
      const reason = interaction.options.getString("sebep");
      const linked = findLinkedByRobloxUsername(username);
      if (!linked?.country) return interaction.editReply({ embeds: [fail("Rütbe Değiştir", "Kullanıcı doğrulanmış değil veya ülke bulunamadı.")] });
      const [country, roleId] = String(choice || "").split("::");
      if (country !== linked.country || !roleId) return interaction.editReply({ embeds: [fail("Rütbe Değiştir", "Seçilen rütbe kullanıcının doğrulanmış ülkesine ait değil.")] });
      const roles = await getGroupRoles(GROUPS[country]);
      const role = roles.find(r => String(r.id) === String(roleId));
      if (!role || role.name === "." || role.name.toLowerCase() === "guest") return interaction.editReply({ embeds: [fail("Rütbe Değiştir", "Geçersiz rütbe.")] });
      const user = await findRobloxUser(username);
      if (!user) return interaction.editReply({ embeds: [fail("Rütbe Değiştir", "Roblox kullanıcısı bulunamadı.")] });
      await changeRank(GROUPS[country], user.id, role.id);
      await interaction.editReply({ embeds: [ok("Rütbe Değiştirildi", `**${user.name}** → **${role.name}**\n**Sebep:** ${reason}`)] });
      return;
    }

    if (command === "rütbe-sorgu") {
      await interaction.deferReply();
      const username = interaction.options.getString("kullanici");
      const user = await findRobloxUser(username);
      if (!user) return interaction.editReply({ embeds: [fail("Rütbe Sorgu", "Roblox kullanıcısı bulunamadı.")] });
      const links = readJson(LINKS_FILE);
      const linked = Object.values(links).find(x => String(x?.robloxId) === String(user.id));
      const lines = [
        `**Kullanıcı:** ${user.name}`,
        `**Display Name:** ${user.displayName || user.name}`,
        `**User ID:** ${user.id}`,
        `**Doğrulama:** ${linked?.verified ? "Doğrulandı" : "Doğrulanmadı"}`,
        `**Bağlı Ülke:** ${linked?.country ? COUNTRY[linked.country].name : "Yok"}`
      ];
      if (linked?.country) {
        const rank = await getUserRank(GROUPS[linked.country], user.id);
        lines.push(`**Rütbe:** ${rank?.name || "Üyelik yok"}${rank ? ` (Rank ${rank.rank})` : ""}`);
      }
      await interaction.editReply({ embeds: [embed(0x5865f2, "Rütbe Sorgu", lines.join("\n"))] });
      return;
    }

    if (command === "grup-listele") {
      await interaction.deferReply();
      const username = interaction.options.getString("kullanici");
      const user = await findRobloxUser(username);
      if (!user) return interaction.editReply({ embeds: [fail("Grup Listele", "Roblox kullanıcısı bulunamadı.")] });
      const lines = [];
      for (const [country, groupId] of Object.entries(GROUPS)) {
        if (!groupId) continue;
        const rank = await getUserRank(groupId, user.id);
        if (rank) lines.push(`**${COUNTRY[country].name}** — ${rank.name} (Rank ${rank.rank})`);
      }
      await interaction.editReply({ embeds: [embed(0x5865f2, "Roblox Grupları", lines.length ? lines.join("\n") : "Aktif ülke gruplarında üyelik bulunamadı.")] });
      return;
    }

    if (command === "mute") {
      const user = interaction.options.getUser("kullanici");
      const minutes = interaction.options.getInteger("dakika");
      const reason = interaction.options.getString("sebep");
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(minutes * 60 * 1000, reason);
      await interaction.reply({ embeds: [ok("Mute", `**${user.tag}** • ${minutes} dakika\n**Sebep:** ${reason}`)] });
      return;
    }

    if (command === "unmute") {
      const user = interaction.options.getUser("kullanici");
      const reason = interaction.options.getString("sebep");
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(null, reason);
      await interaction.reply({ embeds: [ok("Unmute", `**${user.tag}**\n**Sebep:** ${reason}`)] });
      return;
    }

    if (command === "kick" || command === "ban") {
      const user = interaction.options.getUser("kullanici");
      const reason = interaction.options.getString("sebep");
      if (command === "kick") await interaction.guild.members.kick(user.id, reason);
      else await interaction.guild.members.ban(user.id, { reason });
      await interaction.reply({ embeds: [ok(command === "kick" ? "Kick" : "Ban", `**${user.tag}**\n**Sebep:** ${reason}`)] });
      return;
    }

    if (command === "duyuru") {
      const title = interaction.options.getString("baslik");
      const content = interaction.options.getString("icerik");
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription(content).setTimestamp()] });
      return;
    }

    if (command === "ticket-panel") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_open").setLabel("Ticket Aç").setStyle(ButtonStyle.Primary)
      );
      await interaction.reply({ embeds: [embed(0x5865f2, "Birleşmiş Milletler Destek Merkezi", "Destek almak için aşağıdaki butona tıklayın.")], components: [row] });
      return;
    }

  } catch (error) {
    console.error("INTERACTION:", error);
    const e = fail("İşlem Başarısız", error.message || "Bilinmeyen hata.");
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [e] });
      else await interaction.reply({ embeds: [e], ephemeral: true });
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
