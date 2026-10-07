const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionsBitField
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const MAIN_GUILD = '1419088865313951898';
const VERIFY_GUILD = process.env.VERIFY_GUILD_ID || MAIN_GUILD;
const VERIFY_WEB_URL = process.env.VERIFY_WEB_URL || 'http://localhost:3000';
const GROUPS = {
  turkiye: '86780102', almanya: '864459755', fransa: '520932950', ispanya: '712820551'
};
const COUNTRIES = {
  turkiye: {name:'Türkiye', guild:'1557114176655327322', command:'1557117182649962506', verified:'1557118814213378109', unverified:'1557118849474633859', personnel:'1557118481756061796', process:'1557128510059847700', log:'1557128581895823552', ranks:{'Acemi Asker':'1557118408816861264','Piyade':'1557118326637858828','Onbaşı':'1557118242869354536','Çavuş':'1557118174150004756','Teğmen':'1557118093367447614','Yüzbaşı':'1557118047221972992','Albay':'1557117988597927945','Maresal':'1557117864102723655'}},
  almanya: {name:'Almanya', guild:'1557104978940661830', command:'1557109374629974110', verified:'1557107474421522503', unverified:'1557107431870562407', personnel:'1557106979497844777', process:'1557128470901952604', log:'1557128718437056652', ranks:{'Er':'1557106892940116078','Gefreiter':'1557107548044271747','Obergefreiter':'1557107609427779765','Feldwebel':'1557107667850494095','Leutnant':'1557107741728837663','Hauptmann':'1557107800113545327','Oberst':'1557107885690064958','General':'1557107951238381638','Maresal':'1557108030821113959'}},
  fransa: {name:'Fransa', guild:'1557106587141677087', command:'1557113517293699073', verified:'1557112445854683167', unverified:'1557112478465265746', personnel:'1557112320633606224', process:'1557128442309255230', log:'1557128615538335774', ranks:{'Soldat':'1557112260332228628','Caporal':'1557112200357748776','Sergent':'1557112131390804190','Adjudant':'1557112081097035987','Lieutenant':'1557112049408942110','Capitaline':'1557111978936377414','Colonel':'1557111921008975932','Général':'1557111864457044039','Maresal':'1557111791362900138'}},
  ispanya: {name:'İspanya', guild:'1557106841551511624', command:'1557114910549348433', verified:'1557116423157973012', unverified:'1557116461636517889', personnel:'1557116090025250919', process:'1557128540955218040', log:'1557128667375730800', ranks:{'Soldado':'1557116035734183987','Cabo':'1557115982357471352','Sargento':'1557115908022083605','Suboficial':'1557115836291096626','Teniente':'1557115786085142588','Capitán':'1557115736110145657','Coronel':'1557115648784465960','General':'1557115599975616572','Maresal':'1557115529536213192'}}
};
const MOD_LOG = '1557128386110029824';
const EXCLUDED_ROLES = new Set(['üye','misafir','bot','++','.','guest']);
const dataDir = path.join(__dirname,'data'); fs.mkdirSync(dataDir,{recursive:true});
const linksFile = path.join(dataDir,'links.json'); if(!fs.existsSync(linksFile)) fs.writeFileSync(linksFile,'{}');
function loadLinks(){try{return JSON.parse(fs.readFileSync(linksFile,'utf8'));}catch{return {};}}
function saveLinks(x){fs.writeFileSync(linksFile,JSON.stringify(x,null,2));}

const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildModeration,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates]});

function embed(color,title,description,fields=[]){const e=new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp(); if(fields.length)e.addFields(fields); return e;}
const ok=(t,d,f=[])=>embed(0x2ecc71,`✅ ${t}`,d,f); const bad=(t,d)=>embed(0xe74c3c,`❌ ${t}`,d); const info=(t,d)=>embed(0x3498db,`ℹ️ ${t}`,d); const mod=(t,d,f=[])=>embed(0xe67e22,`🛡️ ${t}`,d,f);
function isMain(i){return i.guildId===MAIN_GUILD;}
function countryByGuild(guildId){return Object.entries(COUNTRIES).find(([,c])=>c.guild===guildId)?.[0]||null;}
function countryConfig(k){return COUNTRIES[k]||null;}
function excluded(name){return EXCLUDED_ROLES.has(String(name||'').trim().toLowerCase());}

async function robloxRequest(url,options={}){
  const res=await fetch(url,{...options,headers:{'Content-Type':'application/json','x-api-key':process.env.ROBLOX_API_KEY,...(options.headers||{})}});
  const text=await res.text(); let data={}; try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  if(!res.ok) throw new Error(`Roblox API ${res.status}: ${text}`); return data;
}
async function findRobloxUser(username){const r=await fetch('https://users.roblox.com/v1/usernames/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernames:[username],excludeBannedUsers:false})});const d=await r.json();if(!r.ok)throw new Error('Roblox kullanıcı araması başarısız.');return d.data?.[0]||null;}
async function getGroupRoles(groupId){let out=[],token='';do{let u=`https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100${token?`&pageToken=${encodeURIComponent(token)}`:''}`;const d=await robloxRequest(u);for(const r of d.groupRoles||[]){if(!excluded(r.displayName))out.push({id:r.id,name:r.displayName,rank:Number(r.rank)||0});}token=d.nextPageToken||'';}while(token);return out.sort((a,b)=>a.rank-b.rank);}
async function getMembership(groupId,userId){const filter=encodeURIComponent(`user == 'users/${userId}'`);const d=await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=${filter}&maxPageSize=10`);return d.groupMemberships?.[0]||null;}
async function getUserRank(groupId,userId){const m=await getMembership(groupId,userId);if(!m?.role)return null;const id=m.role.split('/').pop();return (await getGroupRoles(groupId)).find(r=>String(r.id)===String(id))||null;}
async function changeRank(groupId,userId,roleId){const m=await getMembership(groupId,userId);if(!m)throw new Error('Kullanıcı Roblox grubunda bulunmuyor.');const membershipId=m.path.split('/').pop();await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}:assignRole`,{method:'POST',body:JSON.stringify({role:`groups/${groupId}/roles/${roleId}`})});}
async function getJoinRequest(groupId,userId){const filter=encodeURIComponent(`user == 'users/${userId}'`);const d=await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests?maxPageSize=100&filter=${filter}`);return d.groupJoinRequests?.[0]||d.joinRequests?.[0]||null;}
async function acceptJoinRequest(groupId,requestId){return robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests/${requestId}:accept`,{method:'POST',body:'{}'});}
async function removeFromGroup(groupId,userId){const m=await getMembership(groupId,userId);if(!m)throw new Error('Kullanıcı bu grupta değil.');const id=m.path.split('/').pop();await robloxRequest(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${id}:delete`,{method:'DELETE'});}

function rankRoleId(country,rankName){return COUNTRIES[country]?.ranks?.[rankName]||null;}
async function syncCountryRoles(discordUserId,country,rankName,reason='Update'){
  const c=countryConfig(country); if(!c) return;
  const guild=await client.guilds.fetch(c.guild).catch(()=>null); if(!guild)return;
  const member=await guild.members.fetch(discordUserId).catch(()=>null); if(!member)return;
  const add=[c.verified,c.personnel,rankRoleId(country,rankName)].filter(Boolean);
  const remove=[c.unverified,...Object.values(c.ranks).filter(id=>id!==rankRoleId(country,rankName))];
  if(remove.length) await member.roles.remove(remove,reason).catch(()=>{}); if(add.length) await member.roles.add(add,reason).catch(()=>{});
}
async function logChannel(channelId,e){const ch=await client.channels.fetch(channelId).catch(()=>null);if(ch?.isTextBased())await ch.send({embeds:[e]}).catch(()=>{});}
async function processLog(country,e){const c=countryConfig(country);if(c){await logChannel(c.process,e);await logChannel(c.log,e);}}

async function updateLinkedMember(discordId,countryOverride=null){
  const links=loadLinks(); const linked=links[discordId]; if(!linked?.robloxId)throw new Error('Önce /verify ile Roblox hesabınızı bağlayın.');
  let country=countryOverride||linked.country||null;
  if(!country){for(const k of Object.keys(GROUPS)){if(await getMembership(GROUPS[k],linked.robloxId)){country=k;break;}}}
  if(!country)throw new Error('Bağlı Roblox hesabı 4 ülke grubundan hiçbirinde bulunmuyor.');
  const rank=await getUserRank(GROUPS[country],linked.robloxId); if(!rank)throw new Error('Roblox rütbesi okunamadı.');
  linked.country=country; linked.verified=true; links[discordId]=linked; saveLinks(links); await syncCountryRoles(discordId,country,rank.name,'/update'); return {country,rank};
}

async function handleUpdate(i){
  await i.deferReply({ephemeral:true}); try{const r=await updateLinkedMember(i.user.id,countryByGuild(i.guildId)); await i.editReply({embeds:[ok('Güncelleme Başarılı',`Roblox hesabınız **${r.rank.name}** rütbesinde.\nÜlke: **${COUNTRIES[r.country].name}**\nDiscord rolleriniz senkronize edildi.`)]}); await processLog(r.country,ok('Update Başarılı',`**${i.user.tag}** → ${r.rank.name}`));}catch(e){await i.editReply({embeds:[bad('Güncelleme Başarısız',e.message)]});}}

client.once('ready',async()=>{console.log(`BOT HAZIR: ${client.user.tag}`);});
client.on('interactionCreate',async i=>{
  try{
    if(i.isButton() && i.customId==='verify_start'){
      const links=loadLinks(); const token=crypto.randomBytes(32).toString('hex'); const file=path.join(dataDir,'verify_tokens.json'); let t={};try{t=JSON.parse(fs.readFileSync(file,'utf8'));}catch{} t[token]={discordId:i.user.id,expiresAt:Date.now()+600000,used:false};fs.writeFileSync(file,JSON.stringify(t,null,2));
      return i.reply({embeds:[info('Roblox Hesap Doğrulama',`Aşağıdaki butona basarak Roblox hesabınızı bağlayın.`)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Roblox Hesabını Bağla ↗').setStyle(ButtonStyle.Link).setURL(`${VERIFY_WEB_URL}/oauth/start?token=${token}`))],ephemeral:true});
    }
    if(!i.isChatInputCommand())return;
    const cmd=i.commandName;
    if(cmd==='verify'){
      const token=crypto.randomBytes(32).toString('hex'); const file=path.join(dataDir,'verify_tokens.json'); let t={};try{t=JSON.parse(fs.readFileSync(file,'utf8'));}catch{} t[token]={discordId:i.user.id,expiresAt:Date.now()+600000,used:false};fs.writeFileSync(file,JSON.stringify(t,null,2));
      return i.reply({embeds:[info('Roblox Doğrulama','Roblox hesabınızı Discord hesabınıza bağlamak için aşağıdaki butona tıklayın.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Roblox Hesabını Bağla ↗').setStyle(ButtonStyle.Link).setURL(`${VERIFY_WEB_URL}/oauth/start?token=${token}`))]});
    }
    if(cmd==='update'){if(![MAIN_GUILD,...Object.values(COUNTRIES).map(c=>c.guild)].includes(i.guildId))return i.reply({embeds:[bad('Sunucu Hatası','Bu komut bu sunucuda kullanılamaz.')],ephemeral:true});return handleUpdate(i);}
    const mainOnly=['grup-istek','grup-at','rütbe-sorgu','grup-listele','rütbe-terfi','rütbe-degistir','profil','duyuru','ticket-panel','mute','unmute','kick','ban'];
    if(mainOnly.includes(cmd)&&!isMain(i))return i.reply({embeds:[bad('Komut Kullanılamaz','Bu yönetim komutu yalnızca ana sunucuda kullanılabilir.')],ephemeral:true});

    if(cmd==='rütbe-sorgu'){
      const u=await findRobloxUser(i.options.getString('kullanici'));if(!u)return i.reply({embeds:[bad('Kullanıcı Bulunamadı','Roblox kullanıcısı bulunamadı.')],ephemeral:true});
      const fields=[];for(const [k,g] of Object.entries(GROUPS)){const r=await getUserRank(g,u.id).catch(()=>null);if(r)fields.push({name:COUNTRIES[k].name,value:`**${r.name}** (Rank ${r.rank})`,inline:true});}
      return i.reply({embeds:[info('Rütbe Sorgusu',`Roblox: **${u.name}**\nUser ID: **${u.id}**`,fields)]});
    }
    if(cmd==='grup-listele'){
      const u=await findRobloxUser(i.options.getString('kullanici')); if(!u)return i.reply({embeds:[bad('Kullanıcı Bulunamadı','Roblox kullanıcısı bulunamadı.')],ephemeral:true});
      const rows=[];for(const [k,g] of Object.entries(GROUPS)){const r=await getUserRank(g,u.id).catch(()=>null);if(r)rows.push(`• **${COUNTRIES[k].name}** — ${r.name} (Rank ${r.rank})`);}return i.reply({embeds:[info('Grup Listesi',rows.length?rows.join('\n'):'4 ülke grubundan hiçbirinde bulunmuyor.')]});
    }
    if(cmd==='grup-istek'){
      const country=i.options.getString('ulke'), username=i.options.getString('kullanici'), reason=i.options.getString('sebep'); const u=await findRobloxUser(username);if(!u)return i.reply({embeds:[bad('Kullanıcı Bulunamadı','Roblox kullanıcı adı bulunamadı.')],ephemeral:true});const c=countryConfig(country);const req=await getJoinRequest(GROUPS[country],u.id);if(!req)return i.reply({embeds:[bad('İstek Bulunamadı',`**${u.name}** için ${c.name} grubunda bekleyen katılım isteği yok.`)]});await acceptJoinRequest(GROUPS[country],req.path?.split('/').pop()||req.id);let roles=await getGroupRoles(GROUPS[country]);roles=roles.filter(r=>r.rank>0).sort((a,b)=>a.rank-b.rank);const first=roles[0];if(first)await changeRank(GROUPS[country],u.id,first.id);await processLog(country,mod('Grup İsteği Kabul Edildi',`Roblox: **${u.name}**\nİşlem yapan: **${i.user.tag}**\nRütbe: **${first?.name||'Belirlenemedi'}**\nSebep: ${reason}`));return i.reply({embeds:[ok('Grup İsteği Kabul Edildi',`**${u.name}** ${c.name} grubuna alındı.\nİlk uygun rütbe: **${first?.name||'Belirlenemedi'}**`)]});
    }
    if(cmd==='rütbe-terfi'){
      const country=i.options.getString('ulke'), username=i.options.getString('kullanici'), reason=i.options.getString('sebep');const u=await findRobloxUser(username);if(!u)return i.reply({embeds:[bad('Kullanıcı Bulunamadı','Roblox kullanıcı adı bulunamadı.')],ephemeral:true});const before=await getUserRank(GROUPS[country],u.id);if(!before)return i.reply({embeds:[bad('Üyelik Bulunamadı',`${u.name} ${COUNTRIES[country].name} grubunda değil.`)]});const roles=(await getGroupRoles(GROUPS[country])).filter(r=>r.rank>before.rank);const next=roles.sort((a,b)=>a.rank-b.rank)[0];if(!next)return i.reply({embeds:[bad('Terfi Mümkün Değil','Kullanıcının çıkarılabileceği daha yüksek bir rütbe bulunamadı.')]});await changeRank(GROUPS[country],u.id,next.id);await processLog(country,ok('Terfi Başarılı',`**${u.name}**\n${before.name} → **${next.name}**\nİşlem yapan: **${i.user.tag}**\nSebep: ${reason}`));return i.reply({embeds:[ok('Terfi Başarılı',`**${u.name}** → **${next.name}**`)]});
    }
    if(cmd==='rütbe-degistir'){
      const target=i.options.getUser('kullanici'), linked=loadLinks()[target.id];if(!linked?.robloxId)return i.reply({embeds:[bad('Doğrulama Yok','Bu Discord kullanıcısının doğrulanmış Roblox bağlantısı yok.')],ephemeral:true});const country=linked.country||null;if(!country)return i.reply({embeds:[bad('Ülke Bulunamadı','Kullanıcının doğrulanmış ülkesi bulunamadı.')],ephemeral:true});const raw=i.options.getString('rutbe');const role=raw?.includes('::')?raw.split('::')[1]:raw;const roles=await getGroupRoles(GROUPS[country]);const found=roles.find(r=>r.name===role);if(!found)return i.reply({embeds:[bad('Rütbe Bulunamadı','Seçilen gerçek Roblox rütbesi bulunamadı.')],ephemeral:true});const before=await getUserRank(GROUPS[country],linked.robloxId);await changeRank(GROUPS[country],linked.robloxId,found.id);await processLog(country,mod('Rütbe Değiştirildi',`**${target.tag}**\n${before?.name||'?'} → **${found.name}**\nİşlem yapan: **${i.user.tag}**`));return i.reply({embeds:[ok('Rütbe Değiştirildi',`**${target.tag}** → **${found.name}**`)]});
    }
    if(cmd==='grup-at'){
      const country=i.options.getString('ulke'), username=i.options.getString('kullanici'), reason=i.options.getString('sebep');const u=await findRobloxUser(username);if(!u)return i.reply({embeds:[bad('Kullanıcı Bulunamadı','Roblox kullanıcı adı bulunamadı.')],ephemeral:true});await removeFromGroup(GROUPS[country],u.id);await processLog(country,mod('Gruptan Çıkarıldı',`**${u.name}**\nİşlem yapan: **${i.user.tag}**\nSebep: ${reason}`));return i.reply({embeds:[ok('Gruptan Çıkarıldı',`**${u.name}** ${COUNTRIES[country].name} grubundan çıkarıldı.`)]});
    }
    if(cmd==='moderation-placeholder')return;
    if(['mute','unmute','kick','ban'].includes(cmd))return i.reply({embeds:[mod('Moderasyon','Moderasyon altyapısı sonraki aşamada bağlanacak.')]});
    return i.reply({embeds:[info('Hazır','Bu komut için altyapı hazırlanıyor.')],ephemeral:true});
  }catch(e){console.error(e);if(i.deferred)await i.editReply({embeds:[bad('İşlem Hatası',e.message)]}).catch(()=>{});else if(i.replied)await i.followUp({embeds:[bad('İşlem Hatası',e.message)],ephemeral:true}).catch(()=>{});else await i.reply({embeds:[bad('İşlem Hatası',e.message)],ephemeral:true}).catch(()=>{});}
});

client.login(process.env.DISCORD_TOKEN);
