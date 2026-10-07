const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const MAIN_GUILD_ID = '1419088865313951898';
const MAIN_VERIFIED_ROLE = '1557121092806770759';
const MAIN_UNVERIFIED_ROLE = '1557121149509570621';

const COUNTRIES = {
  turkiye: {
    label: 'Türkiye', emoji: '🇹🇷', groupId: '86780102',
    guildId: '1557114176655327322', commandChannel: '1557117182649962506',
    verifiedRole: '1557118814213378109', unverifiedRole: '1557118849474633859', personnelRole: '1557118481756061796',
    processChannel: '1557128510059847700', logChannel: '1557128581895823552',
    ranks: {
      'Acemi Asker': '1557118408816861264', 'Piyade': '1557118326637858828', 'Onbaşı': '1557118242869354536',
      'Çavuş': '1557118174150004756', 'Teğmen': '1557118093367447614', 'Yüzbaşı': '1557118047221972992',
      'Albay': '1557117988597927945', 'Maresal': '1557117864102723655'
    }
  },
  almanya: {
    label: 'Almanya', emoji: '🇩🇪', groupId: '864459755',
    guildId: '1557104978940661830', commandChannel: '1557109374629974110',
    verifiedRole: '1557107474421522503', unverifiedRole: '1557107431870562407', personnelRole: '1557106979497844777',
    processChannel: '1557128470901952604', logChannel: '1557128718437056652',
    ranks: {
      'Er': '1557106892940116078', 'Gefreiter': '1557107548044271747', 'Obergefreiter': '1557107609427779765',
      'Feldwebel': '1557107667850494095', 'Leutnant': '1557107741728837663', 'Hauptmann': '1557107800113545327',
      'Oberst': '1557107885690064958', 'General': '1557107951238381638', 'Maresal': '1557108030821113959'
    }
  },
  fransa: {
    label: 'Fransa', emoji: '🇫🇷', groupId: '520932950',
    guildId: '1557106587141677087', commandChannel: '1557113517293699073',
    verifiedRole: '1557112445854683167', unverifiedRole: '1557112478465265746', personnelRole: '1557112320633606224',
    processChannel: '1557128442309255230', logChannel: '1557128615538335774',
    ranks: {
      'Soldat': '1557112260332228628', 'Caporal': '1557112200357748776', 'Sergent': '1557112131390804190',
      'Adjudant': '1557112081097035987', 'Lieutenant': '1557112049408942110', 'Capitaline': '1557111978936377414',
      'Colonel': '1557111921008975932', 'Général': '1557111864457044039', 'Maresal': '1557111791362900138'
    }
  },
  ispanya: {
    label: 'İspanya', emoji: '🇪🇸', groupId: '712820551',
    guildId: '1557106841551511624', commandChannel: '1557114910549348433',
    verifiedRole: '1557116423157973012', unverifiedRole: '1557116461636517889', personnelRole: '1557116090025250919',
    processChannel: '1557128540955218040', logChannel: '1557128667375730800',
    ranks: {
      'Soldado': '1557116035734183987', 'Cabo': '1557115982357471352', 'Sargento': '1557115908022083605',
      'Suboficial': '1557115836291096626', 'Teniente': '1557115786085142588', 'Capitán': '1557115736110145657',
      'Coronel': '1557115648784465960', 'General': '1557115599975616572', 'Maresal': '1557115529536213192'
    }
  }
};

const MOD_LOG_CHANNEL = '1557128386110029824';
const PROCESS_NAMES = { turkiye: 'türk-islem', almanya: 'almanya-islem', fransa: 'fransa-islem', ispanya: 'ispanya-islem' };
const EXCLUDED_ROLES = new Set(['üye','misafir','bot','++','.','guest']);
const GLOBAL_ROLE_NAMES = ['Creator','Bot','Admin'];
const COUNTRY_AUTH = {
  turkiye: ['Türkiye mareşal','Türkiye mareşal'.toLowerCase(),'Türkiye Dışişleri Bakanlığı'.toLowerCase()],
  almanya: ['DE maresal'.toLowerCase(),'Almanya Dışişleri Bakanlığı'.toLowerCase()],
  fransa: ['Franse mareşal'.toLowerCase(),'Fransa Dışişleri Bakanlığı'.toLowerCase(),'Franse mareșal'.toLowerCase()],
  ispanya: ['Ispanya mareşal'.toLowerCase(),'İspanya mareşal'.toLowerCase(),'İspanya Dışişleri Bakanlığı'.toLowerCase()]
};

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const files = {
  links: path.join(dataDir,'links.json'), tokens: path.join(dataDir,'verify_tokens.json'), stats: path.join(dataDir,'stats.json'), tickets: path.join(dataDir,'tickets.json')
};
for (const f of Object.values(files)) if (!fs.existsSync(f)) fs.writeFileSync(f, '{}');
function readJson(file){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {};}}
function writeJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2));}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });

function norm(v){ return String(v||'').toLocaleLowerCase('tr-TR').trim(); }
function countryFrom(v){ return COUNTRIES[v] ? v : null; }
function isMain(interaction){ return interaction.guildId === MAIN_GUILD_ID; }
function cfg(country){ return COUNTRIES[country]; }
function colorEmbed(color,title,description){ return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp(); }
const okEmbed=(t,d)=>colorEmbed(0x2ecc71,`✅ ${t}`,d);
const infoEmbed=(t,d)=>colorEmbed(0x3498db,`ℹ️ ${t}`,d);
const errEmbed=(t,d)=>colorEmbed(0xe74c3c,`❌ ${t}`,d);
const modEmbed=(t,d)=>colorEmbed(0xf39c12,`🛡️ ${t}`,d);

function tokenFor(discordId){
  const tokens=readJson(files.tokens), now=Date.now();
  for(const [k,v] of Object.entries(tokens)) if(!v || v.expiresAt<now || v.used) delete tokens[k];
  const token=crypto.randomBytes(32).toString('hex');
  tokens[token]={discordId:String(discordId),createdAt:now,expiresAt:now+10*60*1000,used:false}; writeJson(files.tokens,tokens); return token;
}

async function robloxRequest(url, options={}){
  if(!process.env.ROBLOX_API_KEY) throw new Error('ROBLOX_API_KEY ayarlanmamış.');
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','x-api-key':process.env.ROBLOX_API_KEY,...(options.headers||{})}});
  const text=await response.text(); let data={}; try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  if(!response.ok) throw new Error(`Roblox API ${response.status}: ${text}`);
  return data;
}
async function findRobloxUser(username){
  const r=await fetch('https://users.roblox.com/v1/usernames/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernames:[username],excludeBannedUsers:false})});
  const d=await r.json(); if(!r.ok) throw new Error('Roblox kullanıcı araması başarısız.'); return d.data?.[0]||null;
}
async function getGroupRoles(groupId){
  const out=[]; let token='';
  do { let u=`https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`; if(token) u+=`&pageToken=${encodeURIComponent(token)}`; const d=await robloxRequest(u); for(const r of d.groupRoles||[]) out.push({id:r.id,name:r.displayName,rank:Number(r.rank)}); token=d.nextPageToken||''; } while(token); return out;
}
function usableRoles(roles){return roles.filter(r=>r.name && !EXCLUDED_ROLES.has(norm(r.name)) && Number(r.rank)>0).sort((a,b)=>a.rank-b.rank);}
async function getMembership(groupId,userId){
  const filter=encodeURIComponent(`user == 'users/${userId}'`); const d=await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=${filter}&maxPageSize=10`); return d.groupMemberships?.[0]||null;
}
async function getUserRank(groupId,userId){const m=await getMembership(groupId,userId); if(!m?.role)return null; const roleId=m.role.split('/').pop(); return (await getGroupRoles(groupId)).find(r=>String(r.id)===String(roleId))||null;}
async function changeRank(groupId,userId,roleId){
  const m=await getMembership(groupId,userId); if(!m) throw new Error('Kullanıcı Roblox grubunda bulunmuyor.'); const id=m.path.split('/').pop();
  await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${id}:assignRole`,{method:'POST',body:JSON.stringify({role:`groups/${groupId}/roles/${roleId}`})});
}
async function removeFromGroup(groupId,userId){
  const m=await getMembership(groupId,userId); if(!m) return false; const id=m.path.split('/').pop();
  await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${id}`,{method:'DELETE'}); return true;
}
async function getJoinRequest(groupId,userId){
  const filter=encodeURIComponent(`user == 'users/${userId}'`); const d=await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests?filter=${filter}&maxPageSize=100`); return d.groupJoinRequests?.[0]||d.groupJoinRequests?.[0]||null;
}
async function acceptJoinRequest(groupId,requestId){await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests/${requestId}:accept`,{method:'POST',body:'{}'});}

function linked(discordId){return readJson(files.links)[discordId]||null;}
async function resolveCountry(discordId){
  const links=readJson(files.links), l=links[discordId]; if(!l?.robloxId)return null;
  if(l.country && COUNTRIES[l.country]) return l.country;
  for(const [country,c] of Object.entries(COUNTRIES)){ try{if(await getUserRank(c.groupId,l.robloxId)){l.country=country;l.verified=true;links[discordId]=l;writeJson(files.links,links);return country;}}catch{} }
  return null;
}
function roleByIdOrName(guild,id,name){return (id&&guild.roles.cache.get(id))||guild.roles.cache.find(r=>norm(r.name)===norm(name));}
async function syncCountryDiscord(userId,country,rankName,reason='Roblox senkronizasyonu'){
  const c=cfg(country); const guild=await client.guilds.fetch(c.guildId).catch(()=>null); if(!guild)return;
  const member=await guild.members.fetch(userId).catch(()=>null); if(!member)return;
  const keepNames=new Set([...GLOBAL_ROLE_NAMES.map(norm),'ticket yetkilisi']);
  const target=roleByIdOrName(guild,c.ranks[rankName],rankName);
  const rankIds=new Set(Object.values(c.ranks));
  for(const role of [...member.roles.cache.values()]){
    if(role.id===guild.id || keepNames.has(norm(role.name))) continue;
    if(rankIds.has(role.id) && (!target || role.id!==target.id)) await member.roles.remove(role,reason).catch(()=>{});
  }
  if(target) await member.roles.add(target,reason).catch(()=>{});
  const verified=guild.roles.cache.get(c.verifiedRole); const unverified=guild.roles.cache.get(c.unverifiedRole); const personnel=guild.roles.cache.get(c.personnelRole);
  if(unverified) await member.roles.remove(unverified,reason).catch(()=>{}); if(verified) await member.roles.add(verified,reason).catch(()=>{}); if(personnel) await member.roles.add(personnel,reason).catch(()=>{});
}
async function syncMainDiscord(userId,country,rankName,reason='Roblox senkronizasyonu'){
  const guild=await client.guilds.fetch(MAIN_GUILD_ID).catch(()=>null); if(!guild)return;
  const member=await guild.members.fetch(userId).catch(()=>null); if(!member)return;
  const c=cfg(country); const target=roleByIdOrName(guild,c.ranks[rankName],rankName); const rankIds=new Set(Object.values(c.ranks));
  for(const role of [...member.roles.cache.values()]) if(role.id!==guild.id && rankIds.has(role.id) && (!target||role.id!==target.id)) await member.roles.remove(role,reason).catch(()=>{});
  if(target) await member.roles.add(target,reason).catch(()=>{});
  const verified=guild.roles.cache.get(MAIN_VERIFIED_ROLE); const unverified=guild.roles.cache.get(MAIN_UNVERIFIED_ROLE); const personnelName={turkiye:'Türk Personelleri',almanya:'Alman Personelleri',fransa:'Fransa Personelleri',ispanya:'İspanya Personelleri'}[country];
  if(unverified) await member.roles.remove(unverified,reason).catch(()=>{}); if(verified) await member.roles.add(verified,reason).catch(()=>{});
  const personnel=guild.roles.cache.find(r=>norm(r.name)===norm(personnelName)); if(personnel) await member.roles.add(personnel,reason).catch(()=>{});
}
async function syncUser(userId,country,rankName,reason){await syncMainDiscord(userId,country,rankName,reason); await syncCountryDiscord(userId,country,rankName,reason);}

function hasNamedRole(member,names){const set=new Set(names.map(norm));return member.roles.cache.some(r=>set.has(norm(r.name)));}
function canManageCountry(member,country){return hasNamedRole(member,GLOBAL_ROLE_NAMES)||hasNamedRole(member,COUNTRY_AUTH[country]||[]);}
function requireMain(interaction){return isMain(interaction);}
async function deny(interaction,text='Bu komut yalnızca ana sunucuda kullanılabilir.'){if(interaction.replied||interaction.deferred) return interaction.editReply({embeds:[errEmbed('Yetkisiz Sunucu',text)]}); return interaction.reply({embeds:[errEmbed('Yetkisiz Sunucu',text)],ephemeral:true});}
async function processChannel(country){const ch=await client.channels.fetch(cfg(country).processChannel).catch(()=>null);return ch;}
async function logChannel(country){const ch=await client.channels.fetch(cfg(country).logChannel).catch(()=>null);return ch;}
async function sendProcess(country,embed){const ch=await processChannel(country);if(ch) await ch.send({embeds:[embed]}).catch(()=>{});}
async function sendCountryLog(country,embed){const ch=await logChannel(country);if(ch) await ch.send({embeds:[embed]}).catch(()=>{});}
async function sendModLog(embed){const ch=await client.channels.fetch(MOD_LOG_CHANNEL).catch(()=>null);if(ch) await ch.send({embeds:[embed]}).catch(()=>{});}

function userStats(id){const s=readJson(files.stats);s[id] ||= {messages:0,voiceSeconds:0,voiceStartedAt:null};return s;}
function saveStats(s){writeJson(files.stats,s);}

async function sendVerifyPanel(interaction){
  const token=tokenFor(interaction.user.id); const url=`${process.env.VERIFY_WEB_URL||'http://localhost:3000'}/verify?token=${encodeURIComponent(token)}`;
  const embed=new EmbedBuilder().setColor(0x3498db).setTitle('Roblox Hesap Doğrulama').setDescription('Roblox hesabınızı Discord hesabınıza bağlamak için aşağıdaki butona tıklayın.\n\n**Nasıl çalışır?**\n1. Butona tıklayın.\n2. Roblox hesabınızla giriş yapın.\n3. Doğrulama tamamlandığında Discord’a geri dönün.').setFooter({text:'Birleşmiş Milletler • Hesap Doğrulama'}).setTimestamp();
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Roblox Hesabını Bağla ↗').setStyle(ButtonStyle.Link).setURL(url));
  await interaction.reply({embeds:[embed],components:[row]});
}

function updateEmbed(before,after,country,username,added,removed){return new EmbedBuilder().setColor(0x2ecc71).setTitle('Profil Güncellendi').setDescription('Roblox hesabınız ve Discord rolleriniz başarıyla senkronize edildi.').addFields({name:'Kullanıcı',value:username||'Bilinmiyor',inline:true},{name:'Ülke',value:`${cfg(country).emoji} ${cfg(country).label}`,inline:true},{name:'Roblox Rütbesi',value:after?.name||'Bulunamadı',inline:true},{name:'Eklenen Roller',value:added.length?added.map(x=>`• ${x}`).join('\n'):'Yok',inline:false},{name:'Kaldırılan Roller',value:removed.length?removed.map(x=>`• ${x}`).join('\n'):'Yok',inline:false}).setFooter({text:'Birleşmiş Milletler • Update'}).setTimestamp();}

async function doUpdate(interaction){
  const l=linked(interaction.user.id); if(!l?.robloxId) return interaction.reply({embeds:[errEmbed('Roblox Hesabı Bağlı Değil','Önce `/verify` ile hesabınızı bağlayın.')],ephemeral:true});
  await interaction.deferReply(); const country=await resolveCountry(interaction.user.id); if(!country)return interaction.editReply({embeds:[errEmbed('Ülke Bulunamadı','Bağlı hesabınız dört ülke grubundan hiçbirinde bulunmuyor.')]});
  const c=cfg(country), rank=await getUserRank(c.groupId,l.robloxId); if(!rank)return interaction.editReply({embeds:[errEmbed('Rütbe Bulunamadı','Roblox grubundaki üyelik bulunamadı.')]});
  const guild=interaction.guild, member=await guild.members.fetch(interaction.user.id); const added=[],removed=[]; const rankIds=new Set(Object.values(c.ranks)); const target=roleByIdOrName(guild,c.ranks[rank.name],rank.name);
  for(const r of [...member.roles.cache.values()]) if(r.id!==guild.id && rankIds.has(r.id) && (!target||r.id!==target.id)){await member.roles.remove(r,'Update eski rütbe').catch(()=>{});removed.push(r.name);}
  if(target&&!member.roles.cache.has(target.id)){await member.roles.add(target,'Update Roblox rütbesi');added.push(target.name);}
  const verified= isMain(interaction)?guild.roles.cache.get(MAIN_VERIFIED_ROLE):guild.roles.cache.get(c.verifiedRole); const unverified=isMain(interaction)?guild.roles.cache.get(MAIN_UNVERIFIED_ROLE):guild.roles.cache.get(c.unverifiedRole);
  if(unverified&&member.roles.cache.has(unverified.id)){await member.roles.remove(unverified,'Update doğrulama');removed.push(unverified.name);} if(verified&&!member.roles.cache.has(verified.id)){await member.roles.add(verified,'Update doğrulandı');added.push(verified.name);}
  const personnelName={turkiye:'Türk Personelleri',almanya:'Alman Personelleri',fransa:'Fransa Personelleri',ispanya:'İspanya Personelleri'}[country]; const personnel=guild.roles.cache.find(r=>norm(r.name)===norm(personnelName)); if(personnel&&!member.roles.cache.has(personnel.id)){await member.roles.add(personnel,'Update personel rolü');added.push(personnel.name);}
  await syncCountryDiscord(interaction.user.id,country,rank.name,'Update ülke sunucusu'); await sendProcess(country,infoEmbed('Update İşlemi',`**Kullanıcı:** ${interaction.user}\n**Roblox:** ${l.robloxUsername||'Bilinmiyor'}\n**Rütbe:** ${rank.name}\n**İşlemi yapan:** ${interaction.user}`)); await sendCountryLog(country,okEmbed('Update Log',`**Kullanıcı:** ${interaction.user}\n**Roblox:** ${l.robloxUsername||'Bilinmiyor'}\n**Rütbe:** ${rank.name}\n**Eklenen:** ${added.join(', ')||'Yok'}\n**Kaldırılan:** ${removed.join(', ')||'Yok'}`));
  return interaction.editReply({embeds:[updateEmbed(null,rank,country,l.robloxUsername,added,removed)]});
}

function commandBuilders(){
 return [
  new SlashCommandBuilder().setName('verify').setDescription('Roblox hesabınızı Discord hesabınıza bağlar.'),
  new SlashCommandBuilder().setName('update').setDescription('Roblox rütbenizi Discord ile senkronize eder.'),
  new SlashCommandBuilder().setName('grup-istek').setDescription('Bekleyen Roblox grup isteğini kabul eder.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(o=>o.setName('ulke').setDescription('Ülke').setRequired(true).addChoices(...Object.entries(COUNTRIES).map(([v,c])=>({name:`${c.emoji} ${c.label}`,value:v})))).addStringOption(o=>o.setName('sebep').setDescription('İşlem sebebi').setRequired(true)),
  new SlashCommandBuilder().setName('grup-at').setDescription('Roblox kullanıcısını ülkedeki gruptan çıkarır.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(o=>o.setName('ulke').setDescription('Ülke').setRequired(true).addChoices(...Object.entries(COUNTRIES).map(([v,c])=>({name:`${c.emoji} ${c.label}`,value:v})))).addStringOption(o=>o.setName('sebep').setDescription('İşlem sebebi').setRequired(true)),
  new SlashCommandBuilder().setName('rütbe-sorgu').setDescription('Roblox kullanıcısının ülke rütbesini sorgular.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(o=>o.setName('ulke').setDescription('Ülke').setRequired(true).addChoices(...Object.entries(COUNTRIES).map(([v,c])=>({name:`${c.emoji} ${c.label}`,value:v})))),
  new SlashCommandBuilder().setName('grup-listele').setDescription('Roblox kullanıcısının tüm gruplarını listeler.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)),
  new SlashCommandBuilder().setName('rütbe-terfi').setDescription('Bir sonraki gerçek Roblox rütbesine terfi ettirir.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(o=>o.setName('ulke').setDescription('Ülke').setRequired(true).addChoices(...Object.entries(COUNTRIES).map(([v,c])=>({name:`${c.emoji} ${c.label}`,value:v})))).addStringOption(o=>o.setName('sebep').setDescription('Terfi sebebi').setRequired(true)),
  new SlashCommandBuilder().setName('rütbe-degistir').setDescription('Doğrulanmış ülkeye göre Roblox rütbesini değiştirir.').addStringOption(o=>o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)).addStringOption(o=>o.setName('rutbe').setDescription('Roblox rütbesi').setRequired(true).setAutocomplete(true)).addStringOption(o=>o.setName('sebep').setDescription('Değişiklik sebebi').setRequired(true)),
  new SlashCommandBuilder().setName('profil').setDescription('Discord ve Roblox profil bilgilerini gösterir.').addUserOption(o=>o.setName('kullanici').setDescription('Profiline bakılacak Discord kullanıcısı')),
  new SlashCommandBuilder().setName('duyuru').setDescription('Ülke personeline duyuru gönderir.').addStringOption(o=>o.setName('ulke').setDescription('Hedef ülke').setRequired(true).addChoices(...Object.entries(COUNTRIES).map(([v,c])=>({name:`${c.emoji} ${c.label}`,value:v})))),
  new SlashCommandBuilder().setName('ticket-panel').setDescription('Ticket panelini oluşturur.'),
  new SlashCommandBuilder().setName('mute').setDescription('Kullanıcıyı susturur.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addIntegerOption(o=>o.setName('dakika').setDescription('Dakika').setMinValue(1).setMaxValue(40320).setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
  new SlashCommandBuilder().setName('unmute').setDescription('Susturmayı kaldırır.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
  new SlashCommandBuilder().setName('kick').setDescription('Kullanıcıyı sunucudan atar.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('Kullanıcıyı yasaklar.').addUserOption(o=>o.setName('kullanici').setDescription('Kullanıcı').setRequired(true)).addStringOption(o=>o.setName('sebep').setDescription('Sebep').setRequired(true)),
 ].map(x=>x.toJSON());
}

async function registerVerifyAndUpdateOnCountryGuilds(){
  const commands=commandBuilders(); const mainOnly=new Set(['verify','grup-istek','grup-at','rütbe-sorgu','grup-listele','rütbe-terfi','rütbe-degistir','profil','duyuru','ticket-panel','mute','unmute','kick','ban']);
  const update=commands.filter(c=>c.name==='update');
  const main=commands;
  const mg=await client.guilds.fetch(MAIN_GUILD_ID); if(mg) await mg.commands.set(main);
  for(const c of Object.values(COUNTRIES)){const g=await client.guilds.fetch(c.guildId).catch(()=>null);if(g) await g.commands.set(update);}
  console.log('Slash komutları hazır.');
}

async function handleTicketButton(interaction){
  const modal=new ModalBuilder().setCustomId('ticket_modal').setTitle('Destek Talebi');
  const title=new TextInputBuilder().setCustomId('ticket_title').setLabel('Başlık').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true);
  const problem=new TextInputBuilder().setCustomId('ticket_problem').setLabel('Sorun').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(title),new ActionRowBuilder().addComponents(problem)); await interaction.showModal(modal);
}
async function createTicket(interaction){
  const title=interaction.fields.getTextInputValue('ticket_title'); const problem=interaction.fields.getTextInputValue('ticket_problem'); const guild=interaction.guild; const tickets=readJson(files.tickets); const existing=Object.values(tickets).find(t=>t.guildId===guild.id&&t.userId===interaction.user.id&&t.open); if(existing)return interaction.reply({embeds:[errEmbed('Açık Ticket Var',`Zaten açık ticketınız bulunuyor: <#${existing.channelId}>`)],ephemeral:true});
  const role=guild.roles.cache.find(r=>norm(r.name)==='ticket yetkilisi'); const overwrites=[{id:guild.roles.everyone.id,deny:[PermissionsBitField.Flags.ViewChannel]},{id:interaction.user.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]}]; if(role)overwrites.push({id:role.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]});
  const parent=process.env.TICKET_CATEGORY_ID||undefined; const channel=await guild.channels.create({name:`ticket-${interaction.user.username}`.slice(0,90),type:ChannelType.GuildText,parent,permissionOverwrites:overwrites});
  tickets[channel.id]={guildId:guild.id,userId:interaction.user.id,title,problem,claimedBy:null,open:true,createdAt:Date.now()};writeJson(files.tickets,tickets);
  const mention=role?role.toString():'**Ticket Yetkilisi**'; const embed=new EmbedBuilder().setColor(0x3498db).setTitle('🎫 Destek Talebi').setDescription(`${mention}\n\n**Başlık**\n${title}\n\n**Sorun**\n${problem}\n\n**Devralan:** Henüz devralınmadı`).setFooter({text:'İlk Ticket Yetkilisi mesajı ticketı otomatik devralır.'}).setTimestamp();
  await channel.send({content:`${interaction.user}`,embeds:[embed]}); await interaction.reply({embeds:[okEmbed('Ticket Oluşturuldu',`Ticketınız oluşturuldu: ${channel}`)],ephemeral:true});
}

async function createAnnouncement(interaction){
  const country=interaction.options.getString('ulke'); const modal=new ModalBuilder().setCustomId(`announce_modal:${country}`).setTitle(`${cfg(country).label} Duyurusu`); const title=new TextInputBuilder().setCustomId('a_title').setLabel('Başlık').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256); const body=new TextInputBuilder().setCustomId('a_body').setLabel('Duyuru').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(3500); modal.addComponents(new ActionRowBuilder().addComponents(title),new ActionRowBuilder().addComponents(body)); await interaction.showModal(modal);
}

client.once('ready',async()=>{console.log(`BOT HAZIR: ${client.user.tag}`);try{await registerVerifyAndUpdateOnCountryGuilds();}catch(e){console.error('Komut kayıt hatası:',e.message);}});
client.on('messageCreate',m=>{if(m.author.bot||!m.guild)return;const s=userStats(m.author.id);s[m.author.id].messages++;saveStats(s);});
client.on('voiceStateUpdate',(oldS,newS)=>{const s=userStats(newS.id); if(!oldS.channelId&&newS.channelId)s[newS.id].voiceStartedAt=Date.now(); if(oldS.channelId&&!newS.channelId&&s[newS.id].voiceStartedAt){s[newS.id].voiceSeconds+=Math.max(0,Math.floor((Date.now()-s[newS.id].voiceStartedAt)/1000));s[newS.id].voiceStartedAt=null;saveStats(s);}});

client.on('interactionCreate',async interaction=>{
 try{
  if(interaction.isAutocomplete()){
    if(interaction.commandName!=='rütbe-degistir')return interaction.respond([]); const q=norm(interaction.options.getFocused()); const ctry=await resolveCountry(interaction.user.id); if(!ctry)return interaction.respond([]); const roles=usableRoles(await getGroupRoles(cfg(ctry).groupId)); return interaction.respond(roles.filter(r=>norm(r.name).includes(q)).slice(0,25).map(r=>({name:`${r.name} • Rank ${r.rank}`.slice(0,100),value:String(r.id)})));
  }
  if(interaction.isButton()){
    if(interaction.customId==='verify_button')return sendVerifyPanel(interaction);
    if(interaction.customId==='ticket_create')return handleTicketButton(interaction);
  }
  if(interaction.isModalSubmit()){
    if(interaction.customId==='ticket_modal')return createTicket(interaction);
    if(interaction.customId.startsWith('announce_modal:')){const country=interaction.customId.split(':')[1];const title=interaction.fields.getTextInputValue('a_title');const body=interaction.fields.getTextInputValue('a_body');const c=cfg(country);const role=interaction.guild.roles.cache.find(r=>norm(r.name)===norm({turkiye:'Türk Personelleri',almanya:'Alman Personelleri',fransa:'Fransa Personelleri',ispanya:'İspanya Personelleri'}[country]));const embed=new EmbedBuilder().setColor(0x3498db).setTitle(title).setDescription(body).setFooter({text:`${c.emoji} ${c.label} Personel Duyurusu`}).setTimestamp();await interaction.channel.send({content:role?role.toString():'',embeds:[embed],allowedMentions:{roles:role?[role.id]:[]}});return interaction.reply({embeds:[okEmbed('Duyuru Gönderildi',`${c.label} personel duyurusu gönderildi.`)],ephemeral:true});}
  }
  if(!interaction.isChatInputCommand())return;
  const cmd=interaction.commandName;
  if(['grup-istek','grup-at','rütbe-sorgu','grup-listele','rütbe-terfi','rütbe-degistir','profil','duyuru','ticket-panel','mute','unmute','kick','ban'].includes(cmd)&&!requireMain(interaction))return deny(interaction);
  if(cmd==='verify')return sendVerifyPanel(interaction);
  if(cmd==='update')return doUpdate(interaction);
  if(cmd==='grup-istek'){
    const country=interaction.options.getString('ulke'), username=interaction.options.getString('kullanici'), reason=interaction.options.getString('sebep'); if(!canManageCountry(interaction.member,country))return interaction.reply({embeds:[errEmbed('Yetki Yok',`${cfg(country).label} işlemleri için ülke yetkilisi veya global yönetici olmalısınız.`)],ephemeral:true}); await interaction.deferReply(); const u=await findRobloxUser(username); if(!u)return interaction.editReply({embeds:[errEmbed('Kullanıcı Bulunamadı',`Roblox kullanıcısı **${username}** bulunamadı.`)]}); const req=await getJoinRequest(cfg(country).groupId,u.id); if(!req)return interaction.editReply({embeds:[errEmbed('İstek Bulunamadı',`**${u.name}** için ${cfg(country).label} grubunda bekleyen katılım isteği bulunamadı.`)]}); await acceptJoinRequest(cfg(country).groupId,req.path?.split('/').pop()||req.id); const roles=usableRoles(await getGroupRoles(cfg(country).groupId)); const first=roles[0]; if(first)await changeRank(cfg(country).groupId,u.id,first.id); const l=readJson(files.links); const member=await client.guilds.fetch(MAIN_GUILD_ID).then(g=>g.members.fetch(interaction.user.id).catch(()=>null)).catch(()=>null); l[member?.id||''] ||= {}; if(member){l[member.id]={...l[member.id],robloxId:String(u.id),robloxUsername:u.name,country,verified:true};writeJson(files.links,l);} await sendProcess(country,infoEmbed('Grup İsteği',`**Roblox:** ${u.name}\n**Ülke:** ${cfg(country).label}\n**İlk Rütbe:** ${first?.name||'Değişmedi'}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`)); await sendCountryLog(country,okEmbed('Grup İsteği Kabul Edildi',`**Roblox:** ${u.name}\n**Rütbe:** ${first?.name||'Değişmedi'}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`)); return interaction.editReply({embeds:[okEmbed('Grup İsteği Kabul Edildi',`**${u.name}** ${cfg(country).label} grubuna alındı ve **${first?.name||'ilk rütbe'}** rütbesi verildi.`)]});
  }
  if(cmd==='grup-at'){
    const country=interaction.options.getString('ulke'),username=interaction.options.getString('kullanici'),reason=interaction.options.getString('sebep');if(!canManageCountry(interaction.member,country))return interaction.reply({embeds:[errEmbed('Yetki Yok','Bu ülke işlemi için yetkiniz yok.')],ephemeral:true});await interaction.deferReply();const u=await findRobloxUser(username);if(!u)return interaction.editReply({embeds:[errEmbed('Kullanıcı Bulunamadı','Roblox kullanıcısı bulunamadı.') ]});
    const removed=await removeFromGroup(cfg(country).groupId,u.id);if(!removed)return interaction.editReply({embeds:[errEmbed('Üyelik Bulunamadı',`${u.name} bu grupta bulunmuyor.`)]});await sendProcess(country,modEmbed('Grup Atma',`**Roblox:** ${u.name}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`));await sendCountryLog(country,modEmbed('Grup Atma Log',`**Roblox:** ${u.name}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`));return interaction.editReply({embeds:[okEmbed('Gruptan Atıldı',`**${u.name}** ${cfg(country).label} grubundan çıkarıldı.`)]});
  }
  if(cmd==='rütbe-sorgu'){
    const country=interaction.options.getString('ulke'),username=interaction.options.getString('kullanici');await interaction.deferReply();const u=await findRobloxUser(username);if(!u)return interaction.editReply({embeds:[errEmbed('Kullanıcı Bulunamadı','Roblox kullanıcısı bulunamadı.')]});const r=await getUserRank(cfg(country).groupId,u.id);if(!r)return interaction.editReply({embeds:[errEmbed('Üyelik Yok',`${u.name} ${cfg(country).label} grubunda bulunmuyor.`)]});return interaction.editReply({embeds:[infoEmbed('Rütbe Sorgusu',`**Roblox:** ${u.name}\n**Ülke:** ${cfg(country).label}\n**Rütbe:** ${r.name}\n**Rank:** ${r.rank}`)]});
  }
  if(cmd==='grup-listele'){
    const username=interaction.options.getString('kullanici');await interaction.deferReply();const u=await findRobloxUser(username);if(!u)return interaction.editReply({embeds:[errEmbed('Kullanıcı Bulunamadı','Roblox kullanıcısı bulunamadı.')]});const r=await fetch(`https://groups.roblox.com/v2/users/${u.id}/groups/roles`).then(x=>x.json());const groups=r.data||[];const lines=groups.slice(0,50).map(x=>`**${x.group.name}** — ${x.role.name} (Rank ${x.role.rank})`);return interaction.editReply({embeds:[infoEmbed('Roblox Grup Listesi',lines.length?lines.join('\n'):'Hiç grup bulunamadı.')]});
  }
  if(cmd==='rütbe-terfi'){
    const country=interaction.options.getString('ulke'),username=interaction.options.getString('kullanici'),reason=interaction.options.getString('sebep');if(!canManageCountry(interaction.member,country))return interaction.reply({embeds:[errEmbed('Yetki Yok',`${cfg(country).label} terfileri için yetkiniz yok.`)],ephemeral:true});await interaction.deferReply();const u=await findRobloxUser(username);if(!u)return interaction.editReply({embeds:[errEmbed('Kullanıcı Bulunamadı','Roblox kullanıcısı bulunamadı.') ]});const roles=usableRoles(await getGroupRoles(cfg(country).groupId));const current=await getUserRank(cfg(country).groupId,u.id);if(!current)return interaction.editReply({embeds:[errEmbed('Üyelik Yok','Kullanıcı bu Roblox grubunda değil.') ]});const next=roles.find(r=>r.rank>current.rank);if(!next)return interaction.editReply({embeds:[errEmbed('Maksimum Rütbe','Kullanıcı zaten mevcut rütbe listesindeki en yüksek rütbede.') ]});await sendProcess(country,infoEmbed('Terfi İşlemi',`**${u.name}**: ${current.name} → ${next.name}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`));await changeRank(cfg(country).groupId,u.id,next.id);await sendCountryLog(country,okEmbed('Terfi Logu',`**${u.name}**: ${current.name} → ${next.name}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`));return interaction.editReply({embeds:[okEmbed('Rütbe Terfi Edildi',`**${u.name}** kullanıcısı **${current.name}** → **${next.name}** olarak terfi ettirildi.`)]});
  }
  if(cmd==='rütbe-degistir'){
    const username=interaction.options.getString('kullanici'),roleId=interaction.options.getString('rutbe'),reason=interaction.options.getString('sebep');const country=await resolveCountry(interaction.user.id);if(!country)return interaction.reply({embeds:[errEmbed('Ülke Bulunamadı','Önce Roblox hesabınızı doğrulayın ve bir ülke grubuna bağlı olun.')],ephemeral:true});if(!canManageCountry(interaction.member,country))return interaction.reply({embeds:[errEmbed('Yetki Yok','Bu ülke için rütbe değiştirme yetkiniz yok.')],ephemeral:true});await interaction.deferReply();const roles=usableRoles(await getGroupRoles(cfg(country).groupId));const target=roles.find(r=>String(r.id)===String(roleId));if(!target)return interaction.editReply({embeds:[errEmbed('Rütbe Geçersiz','Seçilen rütbe Roblox grubunda bulunamadı.')]});const u=await findRobloxUser(username);if(!u)return interaction.editReply({embeds:[errEmbed('Kullanıcı Bulunamadı','Roblox kullanıcısı bulunamadı.')]});await changeRank(cfg(country).groupId,u.id,target.id);await sendProcess(country,infoEmbed('Rütbe Değişikliği',`**${u.name}** → ${target.name}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`));await sendCountryLog(country,okEmbed('Rütbe Değişikliği Logu',`**${u.name}** → ${target.name}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`));return interaction.editReply({embeds:[okEmbed('Rütbe Değiştirildi',`**${u.name}** kullanıcısının rütbesi **${target.name}** oldu.`)]});
  }
  if(cmd==='profil'){
    const target=interaction.options.getUser('kullanici')||interaction.user;const l=linked(target.id);const s=userStats(target.id)[target.id];const country=l?.country||await resolveCountry(target.id);let rr=null;if(country&&l?.robloxId)rr=await getUserRank(cfg(country).groupId,l.robloxId);const age=Math.floor((Date.now()-target.createdTimestamp)/86400000);const joined=interaction.guild.members.cache.get(target.id)?.joinedTimestamp;const days=joined?Math.floor((Date.now()-joined)/86400000):0;return interaction.reply({embeds:[infoEmbed('Profil',`**Discord:** ${target}\n**Discord hesabı:** ${age} gün\n**Sunucuda:** ${days} gün\n**Mesaj:** ${s.messages}\n**Ses süresi:** ${Math.floor(s.voiceSeconds/3600)} saat\n\n**Roblox:** ${l?.robloxUsername||'Bağlı değil'}\n**Roblox ID:** ${l?.robloxId||'—'}\n**Doğrulama:** ${l?.verified?'Doğrulandı':'Doğrulanmadı'}\n**Ülke:** ${country?cfg(country).label:'—'}\n**Rütbe:** ${rr?.name||'—'}\n**Rank:** ${rr?.rank??'—'}`)]});
  }
  if(cmd==='duyuru')return createAnnouncement(interaction);
  if(cmd==='ticket-panel'){
    const role=interaction.guild.roles.cache.find(r=>norm(r.name)==='ticket yetkilisi');const embed=new EmbedBuilder().setColor(0x3498db).setTitle('🎫 Birleşmiş Milletler Destek Merkezi').setDescription(`Destek almak için aşağıdaki butona tıklayın.\n\n**Ticket Yetkilisi:** ${role?role.toString():'Ticket Yetkilisi'}\n\nTicket oluştururken **Başlık** ve **Sorun** bilgilerini dolduracaksınız.`).setFooter({text:'Destek sistemi'}).setTimestamp();const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_create').setLabel('Ticket Oluştur').setStyle(ButtonStyle.Primary));await interaction.channel.send({embeds:[embed],components:[row]});return interaction.reply({embeds:[okEmbed('Ticket Paneli','Panel oluşturuldu.')],ephemeral:true});
  }
  if(['mute','unmute','kick','ban'].includes(cmd)){
    if(!interaction.memberPermissions?.has(cmd==='mute'||cmd==='unmute'?PermissionsBitField.Flags.ModerateMembers:cmd==='kick'?PermissionsBitField.Flags.KickMembers:PermissionsBitField.Flags.BanMembers))return interaction.reply({embeds:[errEmbed('Yetki Yok','Bu moderasyon komutu için Discord yetkiniz yok.')],ephemeral:true});const user=interaction.options.getUser('kullanici'),reason=interaction.options.getString('sebep');const member=await interaction.guild.members.fetch(user.id).catch(()=>null);if(cmd!=='ban'&&!member)return interaction.reply({embeds:[errEmbed('Kullanıcı Bulunamadı','Sunucuda kullanıcı bulunamadı.')],ephemeral:true});if(cmd==='mute')await member.timeout(interaction.options.getInteger('dakika')*60000,reason);if(cmd==='unmute')await member.timeout(null,reason);if(cmd==='kick')await member.kick(reason);if(cmd==='ban')await interaction.guild.members.ban(user.id,{reason});await sendModLog(modEmbed(`Moderasyon: ${cmd}`,`**Kullanıcı:** ${user}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`));return interaction.reply({embeds:[okEmbed('Moderasyon İşlemi',`**${user.tag}** için işlem tamamlandı.`)]});
  }
 }catch(e){console.error(e);const em=errEmbed('İşlem Başarısız',e.message||'Bilinmeyen hata.');if(interaction.replied||interaction.deferred)await interaction.editReply({embeds:[em]}).catch(()=>{});else await interaction.reply({embeds:[em],ephemeral:true}).catch(()=>{});}
});

client.on('messageCreate',m=>{if(m.author.bot||!m.guild)return;const s=readJson(files.stats);s[m.author.id] ||= {messages:0,voiceSeconds:0,voiceStartedAt:null};s[m.author.id].messages++;writeJson(files.stats,s);
  const tickets=readJson(files.tickets), t=tickets[m.channel.id]; if(t?.open && !t.claimedBy){const staffRole=m.guild.roles.cache.find(r=>norm(r.name)==='ticket yetkilisi');if(staffRole&&m.member.roles.cache.has(staffRole.id)){t.claimedBy=m.author.id;writeJson(files.tickets,tickets);m.channel.send({embeds:[infoEmbed('Ticket Devralındı',`**Devralan:** ${m.author}`)]}).catch(()=>{});}}
});
client.on('voiceStateUpdate',(oldS,newS)=>{const s=readJson(files.stats);s[newS.id] ||= {messages:0,voiceSeconds:0,voiceStartedAt:null};if(!oldS.channelId&&newS.channelId)s[newS.id].voiceStartedAt=Date.now();if(oldS.channelId&&!newS.channelId&&s[newS.id].voiceStartedAt){s[newS.id].voiceSeconds+=Math.floor((Date.now()-s[newS.id].voiceStartedAt)/1000);s[newS.id].voiceStartedAt=null;}writeJson(files.stats,s);});
client.login(process.env.DISCORD_TOKEN);
