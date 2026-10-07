const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField
} = require("discord.js");

const fs = require("fs");
const path = require("path");

require("dotenv").config();


// ======================================================
// CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});


// ======================================================
// AYARLAR
// ======================================================

const LOG_CHANNEL_ID =
    process.env.LOG_CHANNEL_ID;

const UPDATE_CHANNEL_ID =
    process.env.UPDATE_CHANNEL_ID;

const GROUPS = {
    turkiye: process.env.ROBLOX_TURKEY_GROUP_ID || process.env.ROBLOX_GROUP_ID,
    almanya: process.env.ROBLOX_GERMANY_GROUP_ID,
    fransa: process.env.ROBLOX_FRANCE_GROUP_ID,
    ispanya: process.env.ROBLOX_SPAIN_GROUP_ID
};

const COUNTRY_NAMES = {
    turkiye: "Türkiye",
    almanya: "Almanya",
    fransa: "Fransa",
    ispanya: "İspanya"
};


// ======================================================
// DATA KLASÖRÜ
// ======================================================

const dataFolder =
    path.join(__dirname, "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, {
        recursive: true
    });
}

const linksFile =
    path.join(dataFolder, "links.json");

if (!fs.existsSync(linksFile)) {
    fs.writeFileSync(
        linksFile,
        JSON.stringify({}, null, 4)
    );
}


// ======================================================
// LINKLER
// ======================================================

function loadLinks() {

    try {

        return JSON.parse(
            fs.readFileSync(
                linksFile,
                "utf8"
            )
        );

    } catch {

        return {};
    }
}


function saveLinks(data) {

    fs.writeFileSync(
        linksFile,
        JSON.stringify(data, null, 4)
    );
}


// ======================================================
// ROBLOX API
// ======================================================

async function robloxRequest(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                ...options,

                headers: {
                    "x-api-key":
                        process.env.ROBLOX_API_KEY,

                    ...(options.headers || {})
                }
            }
        );

    const text =
        await response.text();

    let data = {};

    try {

        data =
            text
                ? JSON.parse(text)
                : {};

    } catch {

        data = {
            raw: text
        };
    }


    if (!response.ok) {

        throw new Error(
            `Roblox API ${response.status}: ${text}`
        );
    }

    return data;
}


// ======================================================
// ROBLOX KULLANICI BUL
// ======================================================

async function findRobloxUser(
    username
) {

    const response =
        await fetch(
            "https://users.roblox.com/v1/usernames/users",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    usernames: [username],
                    excludeBannedUsers: false
                })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {

        throw new Error(
            "Roblox kullanıcı araması başarısız."
        );
    }

    if (
        !data.data ||
        data.data.length === 0
    ) {

        return null;
    }

    return data.data[0];
}


// ======================================================
// GRUP ROLLERİ
// ======================================================

async function getGroupRoles(
    groupId
) {

    if (!groupId) {

        return [];
    }

    const result = [];

    let pageToken = "";

    while (true) {

        let url =
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;

        if (pageToken) {

            url +=
                `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const data =
            await robloxRequest(url);

        for (
            const role of data.groupRoles || []
        ) {

            result.push({
                id: role.id,
                name: role.displayName,
                rank: role.rank
            });
        }

        pageToken =
            data.nextPageToken;

        if (!pageToken) {
            break;
        }
    }

    return result;
}


// ======================================================
// GRUP ÜYELİĞİ
// ======================================================

async function getMembership(
    groupId,
    userId
) {

    if (!groupId) {
        return null;
    }

    const filter =
        encodeURIComponent(
            `user == 'users/${userId}'`
        );

    const url =
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=${filter}&maxPageSize=10`;

    const data =
        await robloxRequest(url);

    if (
        !data.groupMemberships ||
        data.groupMemberships.length === 0
    ) {

        return null;
    }

    return data.groupMemberships[0];
}


// ======================================================
// RÜTBE BUL
// ======================================================

async function getUserRank(
    groupId,
    userId
) {

    const membership =
        await getMembership(
            groupId,
            userId
        );

    if (!membership) {
        return null;
    }

    const rolePath =
        membership.role;

    if (!rolePath) {
        return null;
    }

    const roleId =
        rolePath.split("/").pop();

    const roles =
        await getGroupRoles(groupId);

    return (
        roles.find(
            role =>
                String(role.id) ===
                String(roleId)
        ) || null
    );
}


// ======================================================
// RÜTBE DEĞİŞTİR
// ======================================================

async function changeRank(
    groupId,
    userId,
    roleId
) {

    const membership =
        await getMembership(
            groupId,
            userId
        );

    if (!membership) {

        throw new Error(
            "Kullanıcı Roblox grubunda bulunmuyor."
        );
    }

    const membershipId =
        membership.path
            .split("/")
            .pop();

    await robloxRequest(
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}:assignRole`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                role:
                    `groups/${groupId}/roles/${roleId}`
            })
        }
    );
}


// ======================================================
// LOG
// ======================================================

async function sendLog(
    embed
) {

    try {

        if (!LOG_CHANNEL_ID) {
            return;
        }

        const channel =
            await client.channels.fetch(
                LOG_CHANNEL_ID
            );

        if (!channel) {
            return;
        }

        await channel.send({
            embeds: [embed]
        });

    } catch (error) {

        console.error(
            "Log gönderilemedi:",
            error.message
        );
    }
}


// ======================================================
// EMBEDLER
// ======================================================

function successEmbed(
    title,
    description
) {

    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp();
}


function errorEmbed(
    title,
    description
) {

    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp();
}


function infoEmbed(
    title,
    description
) {

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp();
}


// ======================================================
// YARDIMCI
// ======================================================

function safeJsonParse(value) {

    try {

        return JSON.parse(value);

    } catch {

        return null;
    }
}


function makeRoleChoice(
    country,
    role
) {

    return {
        name:
            `${COUNTRY_NAMES[country]} • ${role.name}`.slice(0, 100),

        value:
            JSON.stringify({
                country,
                roleId: String(role.id),
                roleName: role.name
            }).slice(0, 100)
    };
}


// ======================================================
// YETKİ KONTROLÜ
// ======================================================

async function checkRankPermission(
    interaction
) {

    const links =
        loadLinks();

    const linked =
        links[interaction.user.id];

    if (!linked) {

        return {
            ok: false,
            reason:
                "Önce Roblox hesabınızı doğrulamanız gerekiyor."
        };
    }

    const groupId =
        GROUPS[linked.country];

    if (!groupId) {

        return {
            ok: false,
            reason:
                "Bu ülkenin Roblox grup ID'si henüz ayarlanmamış."
        };
    }

    const rank =
        await getUserRank(
            groupId,
            linked.robloxId
        );

    if (!rank) {

        return {
            ok: false,
            reason:
                "Roblox grubunda üyeliğiniz bulunamadı."
        };
    }

    if (Number(rank.rank) < 60) {

        return {
            ok: false,
            reason:
                "Bu işlemi kullanabilmek için Dışişleri Bakanlığı veya üzeri rütbede olmanız gerekiyor."
        };
    }

    return {
        ok: true,
        rank,
        linked
    };
}


// ======================================================
// BOT READY
// ======================================================

client.once(
    "ready",
    () => {

        console.log(
            `BOT HAZIR: ${client.user.tag}`
        );

        console.log(
            "Roblox bağlantısı hazır."
        );

        console.log(
            "Aktif gruplar:"
        );

        for (
            const [country, groupId]
            of Object.entries(GROUPS)
        ) {

            console.log(
                `- ${COUNTRY_NAMES[country]}: ${groupId || "AYARLANMADI"}`
            );
        }
    }
);


// ======================================================
// INTERACTIONS
// ======================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            // ==========================================
// AUTOCOMPLETE
// ==========================================

if (interaction.isAutocomplete()) {

    try {

        if (
            interaction.commandName === "rütbe-degistir" ||
            interaction.commandName === "rütbe-terfi"
        ) {

            const country =
                interaction.options.getString("ulke");

            const search =
                interaction.options.getString("rutbe") || "";

            if (!country || !GROUPS[country]) {
                await interaction.respond([]);
                return;
            }

            const roles =
                await getGroupRoles(
                    GROUPS[country]
                );

            const filtered =
                roles
                    .filter(role =>
                        role.name
                            .toLowerCase()
                            .includes(
                                search.toLowerCase()
                            )
                    )
                    .slice(0, 25);

            await interaction.respond(
                filtered.map(role => ({
                    name:
                        `${role.name} • Rank ${role.rank}`
                            .slice(0, 100),

                    value:
                        String(role.name)
                }))
            );

            return;
        }

        await interaction.respond([]);

    } catch (error) {

        console.error(
            "AUTOCOMPLETE HATASI:",
            error
        );

        try {
            await interaction.respond([]);
        } catch {}
    }

    return;
}
        // ==========================================
        // RÜTBE DEĞİŞTİR
        // TÜM ÜLKELERİN RÜTBELERİ
        // ==========================================

        if (
            command === "rütbe-degistir"
        ) {

            const results = [];

            for (
                const country
                of Object.keys(GROUPS)
            ) {

                const groupId =
                    GROUPS[country];

                if (!groupId) {
                    continue;
                }

                try {

                    const roles =
                        await getGroupRoles(
                            groupId
                        );

                    for (
                        const role
                        of roles
                    ) {

                        const text =
                            `${COUNTRY_NAMES[country]} ${role.name}`
                                .toLowerCase();

                        if (
                            text.includes(
                                search.toLowerCase()
                            )
                        ) {

                            results.push({
                                country,
                                role
                            });
                        }
                    }

                } catch (error) {

                    console.error(
                        `Autocomplete ${country} hatası:`,
                        error.message
                    );
                }
            }

            await interaction.respond(

                results
                    .sort(
                        (a, b) =>
                            b.role.rank -
                            a.role.rank
                    )
                    .slice(0, 25)
                    .map(
                        item => ({

                            name:
                                `${COUNTRY_NAMES[item.country]} • ${item.role.name}`
                                    .slice(0, 100),

                            value:
                                JSON.stringify({
                                    country:
                                        item.country,

                                    roleId:
                                        String(
                                            item.role.id
                                        ),

                                    roleName:
                                        item.role.name
                                }).slice(0, 100)
                        })
                    )

            );

            return;
        }


        // ==========================================
        // RÜTBE TERFİ
        // ==========================================

        if (
            command === "rütbe-terfi"
        ) {

            const country =
                interaction.options.getString(
                    "ulke"
                );

            if (!country) {

                await interaction.respond([]);

                return;
            }

            const groupId =
                GROUPS[country];

            if (!groupId) {

                await interaction.respond([]);

                return;
            }

            const roles =
                await getGroupRoles(
                    groupId
                );

            const filtered =
                roles
                    .filter(
                        role =>
                            role.name
                                .toLowerCase()
                                .includes(
                                    search.toLowerCase()
                                )
                    )
                    .sort(
                        (a, b) =>
                            a.rank - b.rank
                    )
                    .slice(0, 25);

            await interaction.respond(

                filtered.map(
                    role => ({

                        name:
                            `${COUNTRY_NAMES[country]} • ${role.name}`
                                .slice(0, 100),

                        value:
                            JSON.stringify({
                                country,
                                roleId:
                                    String(role.id),
                                roleName:
                                    role.name
                            }).slice(0, 100)
                    })
                )

            );

            return;
        }


        await interaction.respond([]);

    } catch (error) {

        console.error(
            "AUTOCOMPLETE HATASI:",
            error
        );

        try {
            await interaction.respond([]);
        } catch {}
    }

    return;
}

        // ======================================
        // RÜTBE DEĞİŞTİR
        // TÜM ÜLKELER
        // ======================================

        if (
            interaction.commandName ===
            "rütbe-degistir"
        ) {

            const search =
                interaction.options.getString(
                    "rutbe"
                ) || "";

            const results = [];

            const countries =
                Object.keys(GROUPS);

            const responses =
                await Promise.allSettled(

                    countries.map(
                        async country => {

                            const groupId =
                                GROUPS[country];

                            if (!groupId) {
                                return [];
                            }

                            const roles =
                                await getGroupRoles(
                                    groupId
                                );

                            return roles.map(
                                role => ({
                                    country,
                                    id: role.id,
                                    name: role.name,
                                    rank: role.rank
                                })
                            );
                        }
                    )
                );

            for (
                const response
                of responses
            ) {

                if (
                    response.status ===
                    "fulfilled"
                ) {

                    results.push(
                        ...response.value
                    );
                }
            }

            const filtered =
                results
                    .filter(
                        role => {

                            const text =
                                `${COUNTRY_NAMES[role.country]} ${role.name}`
                                    .toLowerCase();

                            return text.includes(
                                search.toLowerCase()
                            );
                        }
                    )
                    .sort(
                        (a, b) =>
                            b.rank - a.rank
                    )
                    .slice(0, 25);

            await interaction.respond(

                filtered.map(
                    role => ({

                        name:
                            `${COUNTRY_NAMES[role.country]} • ${role.name}`
                                .slice(0, 100),

                        value:
                            JSON.stringify({
                                country:
                                    role.country,

                                roleId:
                                    String(role.id),

                                roleName:
                                    role.name
                            }).slice(0, 100)
                    })
                )

            );

            return;
        }


        // ======================================
        // RÜTBE TERFİ
        // ======================================

        if (
            interaction.commandName ===
            "rütbe-terfi"
        ) {

            const country =
                interaction.options.getString(
                    "ulke"
                );

            const search =
                interaction.options.getString(
                    "rutbe"
                ) || "";

            if (!country) {

                await interaction.respond(
                    []
                );

                return;
            }

            const groupId =
                GROUPS[country];

            if (!groupId) {

                await interaction.respond(
                    []
                );

                return;
            }

            const roles =
                await getGroupRoles(
                    groupId
                );

            const filtered =
                roles
                    .filter(
                        role =>
                            role.name
                                .toLowerCase()
                                .includes(
                                    search.toLowerCase()
                                )
                    )
                    .sort(
                        (a, b) =>
                            a.rank - b.rank
                    )
                    .slice(0, 25);

            await interaction.respond(

                filtered.map(
                    role => ({

                        name:
                            `${COUNTRY_NAMES[country]} • ${role.name}`
                                .slice(0, 100),

                        value:
                            JSON.stringify({
                                country,
                                roleId:
                                    String(role.id),
                                roleName:
                                    role.name
                            }).slice(0, 100)
                    })
                )

            );

            return;
        }


        // Başka autocomplete komutuysa boş cevap
        await interaction.respond([]);

    } catch (error) {

        console.error(
            "AUTOCOMPLETE HATASI:",
            error
        );

        // Discord autocomplete isteğine
        // mutlaka cevap ver
        try {

            await interaction.respond([]);

        } catch {}
    }

    return;
}

            // ==========================================
            // BUTTON
            // ==========================================

            if (
                interaction.isButton()
            ) {

                // TICKET KAPAT

                if (
                    interaction.customId ===
                    "ticket_close"
                ) {

                    await interaction.reply({
                        embeds: [
                            infoEmbed(
                                "Ticket Kapatılıyor",
                                "Bu ticket 5 saniye içinde kapatılacak."
                            )
                        ]
                    });

                    setTimeout(
                        async () => {

                            try {

                                await interaction.channel.delete();

                            } catch {}
                        },
                        5000
                    );

                    return;
                }


                // TICKET BİLGİ

                if (
                    interaction.customId ===
                    "ticket_info"
                ) {

                    await interaction.reply({
                        embeds: [
                            infoEmbed(
                                "Ticket Bilgileri",
                                [
                                    "• Sorununuzu açık ve anlaşılır şekilde anlatın.",
                                    "• Gereksiz ticket açmayın.",
                                    "• Sahte/yanlış şikayet oluşturmayın.",
                                    "• Spam yapmayın.",
                                    "• Doğru bilgileri paylaşın.",
                                    "• Ticket kategorisinin dışına çıkmayın."
                                ].join("\n")
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }
            }


            // ==========================================
            // SELECT MENU
            // ==========================================

            if (
                interaction.isStringSelectMenu()
            ) {

                if (
                    interaction.customId ===
                    "ticket_category"
                ) {

                    const category =
                        interaction.values[0];

                    const names = {
                        army:
                            "🪖 Ordu Şikayet",

                        server:
                            "🛠️ Sunucu İçi Sorun",

                        gamepass:
                            "🎟️ Gamepass"
                    };

                    const channelName =
                        `${category}-${interaction.user.username}`
                            .toLowerCase()
                            .replace(
                                /[^a-z0-9-_]/g,
                                "-"
                            )
                            .slice(0, 90);

                    const channel =
                        await interaction.guild.channels.create({
                            name: channelName,

                            type: 0,

                            permissionOverwrites: [
                                {
                                    id:
                                        interaction.guild.id,

                                    deny: [
                                        PermissionsBitField.Flags.ViewChannel
                                    ]
                                },

                                {
                                    id:
                                        interaction.user.id,

                                    allow: [
                                        PermissionsBitField.Flags.ViewChannel,
                                        PermissionsBitField.Flags.SendMessages,
                                        PermissionsBitField.Flags.ReadMessageHistory
                                    ]
                                }
                            ]
                        });

                    const buttons =
                        new ActionRowBuilder()
                            .addComponents(

                                new ButtonBuilder()
                                    .setCustomId(
                                        "ticket_close"
                                    )
                                    .setLabel(
                                        "Ticket Kapat"
                                    )
                                    .setStyle(
                                        ButtonStyle.Danger
                                    ),

                                new ButtonBuilder()
                                    .setCustomId(
                                        "ticket_info"
                                    )
                                    .setLabel(
                                        "Bilgi"
                                    )
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                            );

                    await channel.send({
                        content:
                            `${interaction.user}`,

                        embeds: [
                            new EmbedBuilder()
                                .setColor(
                                    0x2ecc71
                                )
                                .setTitle(
                                    "🎫 Ticket Açıldı"
                                )
                                .setDescription(
                                    `**Kategori:** ${names[category]}\n\n` +
                                    "Yetkili ekip en kısa sürede sizinle ilgilenecektir.\n\n" +
                                    "Lütfen probleminizi ayrıntılı şekilde açıklayın."
                                )
                                .setTimestamp()
                        ],

                        components: [
                            buttons
                        ]
                    });

                    await interaction.reply({
                        embeds: [
                            successEmbed(
                                "Ticket Oluşturuldu",
                                `Ticketınız oluşturuldu: ${channel}`
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }
            }


            // ==========================================
            // MODAL
            // ==========================================

            if (
                interaction.isModalSubmit()
            ) {

                if (
                    interaction.customId ===
                    "announcement_modal"
                ) {

                    const title =
                        interaction.fields.getTextInputValue(
                            "announcement_title"
                        );

                    const content =
                        interaction.fields.getTextInputValue(
                            "announcement_content"
                        );

                    const embed =
                        new EmbedBuilder()
                            .setColor(
                                0x2ecc71
                            )
                            .setTitle(
                                `📢 ${title}`
                            )
                            .setDescription(
                                content
                            )
                            .setFooter({
                                text:
                                    `Duyuru • ${interaction.user.tag}`
                            })
                            .setTimestamp();

                    await interaction.reply({
                        embeds: [
                            successEmbed(
                                "Duyuru Hazırlandı",
                                "Duyuru aşağıdaki şekilde oluşturuldu."
                            ),
                            embed
                        ]
                    });

                    return;
                }
            }


            // ==========================================
            // SLASH COMMAND
            // ==========================================

            if (
                !interaction.isChatInputCommand()
            ) {

                return;
            }

            const command =
                interaction.commandName;


            // ==========================================
            // MUTE
            // ==========================================

            if (
                command === "mute"
            ) {

                const user =
                    interaction.options.getUser(
                        "kullanici"
                    );

                const minutes =
                    interaction.options.getInteger(
                        "dakika"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const member =
                    await interaction.guild.members.fetch(
                        user.id
                    );

                await member.timeout(
                    minutes * 60 * 1000,
                    reason
                );

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            "Kullanıcı Susturuldu",
                            `**${user.tag}** kullanıcısı **${minutes} dakika** susturuldu.\n\n**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Mute Log",
                        `**Kullanıcı:** ${user}\n**Süre:** ${minutes} dakika\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`
                    )
                );

                return;
            }
            // ==========================================
            // UNMUTE
            // ==========================================

            if (
                command === "unmute"
            ) {

                const user =
                    interaction.options.getUser(
                        "kullanici"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const member =
                    await interaction.guild.members.fetch(
                        user.id
                    );

                await member.timeout(
                    null,
                    reason
                );

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            "Mute Kaldırıldı",
                            `**${user.tag}** kullanıcısının susturması kaldırıldı.\n\n**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Unmute Log",
                        `**Kullanıcı:** ${user}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`
                    )
                );

                return;
            }


            // ==========================================
            // KICK
            // ==========================================

            if (
                command === "kick"
            ) {

                const user =
                    interaction.options.getUser(
                        "kullanici"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const member =
                    await interaction.guild.members.fetch(
                        user.id
                    );

                await member.kick(
                    reason
                );

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            "Kullanıcı Atıldı",
                            `**${user.tag}** sunucudan atıldı.\n\n**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Kick Log",
                        `**Kullanıcı:** ${user}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`
                    )
                );

                return;
            }


            // ==========================================
            // BAN
            // ==========================================

            if (
                command === "ban"
            ) {

                const user =
                    interaction.options.getUser(
                        "kullanici"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                await interaction.guild.members.ban(
                    user.id,
                    {
                        reason
                    }
                );

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            "Kullanıcı Yasaklandı",
                            `**${user.tag}** sunucudan yasaklandı.\n\n**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Ban Log",
                        `**Kullanıcı:** ${user}\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`
                    )
                );

                return;
            }


            // ==========================================
            // YETKİLİ ROBLOX KOMUTLARI
            // ==========================================

            if (
                [
                    "rütbe-sorgu",
                    "grup-listele",
                    "rütbe-terfi",
                    "rütbe-degistir"
                ].includes(command)
            ) {

                const auth =
                    await checkRankPermission(
                        interaction
                    );

                if (!auth.ok) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Yetkiniz Bulunmuyor",
                                auth.reason
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }
            }


            // ==========================================
            // RÜTBE SORGU
            // ==========================================

            if (
                command === "rütbe-sorgu"
            ) {

                const username =
                    interaction.options.getString(
                        "kullanici"
                    );

                await interaction.deferReply();

                const user =
                    await findRobloxUser(
                        username
                    );

                if (!user) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Kullanıcı Bulunamadı",
                                `**${username}** isimli Roblox kullanıcısı bulunamadı.`
                            )
                        ]
                    });

                    return;
                }

                let found = null;

                for (
                    const country
                    of Object.keys(GROUPS)
                ) {

                    if (!GROUPS[country]) {
                        continue;
                    }

                    const rank =
                        await getUserRank(
                            GROUPS[country],
                            user.id
                        );

                    if (rank) {

                        found = {
                            country,
                            rank
                        };

                        break;
                    }
                }

                if (!found) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Grup Üyeliği Bulunamadı",
                                `**${username}** hiçbir aktif ülke grubunda bulunamadı.`
                            )
                        ]
                    });

                    return;
                }

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Roblox Rütbe Sorgusu",
                            `**Kullanıcı:** ${user.name}\n` +
                            `**Kullanıcı ID:** ${user.id}\n` +
                            `**Ülke:** ${COUNTRY_NAMES[found.country]}\n` +
                            `**Rütbe:** ${found.rank.name}\n` +
                            `**Rank:** ${found.rank.rank}`
                        )
                    ]
                });

                return;
            }


            // ==========================================
            // GRUP LİSTELE
            // ==========================================

            if (
                command === "grup-listele"
            ) {

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                await interaction.deferReply();

                const descriptions = [];

                for (
                    const country
                    of Object.keys(GROUPS)
                ) {

                    const groupId =
                        GROUPS[country];

                    if (!groupId) {
                        continue;
                    }

                    try {

                        const roles =
                            await getGroupRoles(
                                groupId
                            );

                        descriptions.push(
                            `## ${COUNTRY_NAMES[country]}\n` +
                            `**Grup ID:** ${groupId}\n` +
                            roles
                                .map(
                                    role =>
                                        `• **${role.name}** — Rank ${role.rank}`
                                )
                                .join("\n")
                        );

                    } catch (error) {

                        descriptions.push(
                            `## ${COUNTRY_NAMES[country]}\n` +
                            `❌ Rütbeler alınamadı.`
                        );

                        console.error(
                            `Grup listeleme hatası (${country}):`,
                            error.message
                        );
                    }
                }

                if (
                    descriptions.length === 0
                ) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Grup Bulunamadı",
                                "Hiçbir Roblox grup ID'si ayarlanmamış."
                            )
                        ]
                    });

                    return;
                }

                const fullDescription =
                    descriptions.join("\n\n");

                await interaction.editReply({
                    embeds: [
                        infoEmbed(
                            "Roblox Grup Rütbeleri",
                            fullDescription.slice(
                                0,
                                4096
                            )
                        )
                    ]
                });

                await sendLog(
                    infoEmbed(
                        "Grup Listeleme",
                        `**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`
                    )
                );

                return;
            }


            // ==========================================
            // RÜTBE DEĞİŞTİR
            // ==========================================

            if (
                command === "rütbe-degistir"
            ) {

                const targetUser =
                    interaction.options.getUser(
                        "kullanici"
                    );

                const selectedValue =
                    interaction.options.getString(
                        "rutbe"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const selected =
                    safeJsonParse(
                        selectedValue
                    );

                if (!selected) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Rütbe Seçimi Geçersiz",
                                "Lütfen autocomplete listesinden geçerli bir Roblox rütbesi seçin."
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

                const country =
                    selected.country;

                const groupId =
                    GROUPS[country];

                if (!groupId) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Grup Ayarlanmamış",
                                `${COUNTRY_NAMES[country] || country} için Roblox grup ID'si ayarlanmamış.`
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

                await interaction.deferReply();

                const links =
                    loadLinks();

                const linked =
                    links[targetUser.id];

                if (!linked) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Roblox Hesabı Bağlı Değil",
                                `**${targetUser.tag}** kullanıcısının doğrulanmış Roblox hesabı bulunamadı.`
                            )
                        ]
                    });

                    return;
                }

                const roles =
                    await getGroupRoles(
                        groupId
                    );

                const targetRole =
                    roles.find(
                        role =>
                            String(role.id) ===
                            String(selected.roleId)
                    );

                if (!targetRole) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Rütbe Bulunamadı",
                                "Seçtiğiniz rütbe Roblox grubunda artık bulunmuyor."
                            )
                        ]
                    });

                    return;
                }

                const currentRole =
                    await getUserRank(
                        groupId,
                        linked.robloxId
                    );

                if (!currentRole) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Grup Üyeliği Bulunamadı",
                                `**${targetUser.tag}** kullanıcısının Roblox grubunda üyeliği bulunamadı.`
                            )
                        ]
                    });

                    return;
                }

                await changeRank(
                    groupId,
                    linked.robloxId,
                    targetRole.id
                );

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Rütbe Başarıyla Değiştirildi",
                            `**Kullanıcı:** ${targetUser}\n` +
                            `**Roblox:** ${linked.robloxUsername || linked.robloxId}\n` +
                            `**Ülke:** ${COUNTRY_NAMES[country]}\n` +
                            `**Eski Rütbe:** ${currentRole.name}\n` +
                            `**Yeni Rütbe:** ${targetRole.name}\n` +
                            `**Rank:** ${targetRole.rank}\n` +
                            `**Yetkili:** ${interaction.user}\n` +
                            `**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Roblox Rütbe Değişikliği",
                        `**Kullanıcı:** ${targetUser}\n` +
                        `**Roblox:** ${linked.robloxUsername || linked.robloxId}\n` +
                        `**Ülke:** ${COUNTRY_NAMES[country]}\n` +
                        `**Eski Rütbe:** ${currentRole.name}\n` +
                        `**Yeni Rütbe:** ${targetRole.name}\n` +
                        `**Yetkili:** ${interaction.user}\n` +
                        `**Sebep:** ${reason}`
                    )
                );

                return;
            }


            // ==========================================
            // RÜTBE TERFİ
            // ==========================================

            if (
                command === "rütbe-terfi"
            ) {

                const targetUser =
                    interaction.options.getUser(
                        "kullanici"
                    );

                const country =
                    interaction.options.getString(
                        "ulke"
                    );

                const selectedValue =
                    interaction.options.getString(
                        "rutbe"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const selected =
                    safeJsonParse(
                        selectedValue
                    );

                if (!selected) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Rütbe Seçimi Geçersiz",
                                "Lütfen autocomplete listesinden geçerli bir rütbe seçin."
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

                if (
                    selected.country !==
                    country
                ) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Ülke Uyumsuz",
                                "Seçtiğiniz rütbe, seçtiğiniz ülkeye ait değil."
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

                const groupId =
                    GROUPS[country];

                if (!groupId) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Grup Ayarlanmamış",
                                `${COUNTRY_NAMES[country]} Roblox grup ID'si ayarlanmamış.`
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

                await interaction.deferReply();

                const links =
                    loadLinks();

                const linked =
                    links[targetUser.id];

                if (!linked) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Roblox Hesabı Bağlı Değil",
                                `**${targetUser.tag}** kullanıcısının doğrulanmış Roblox hesabı bulunamadı.`
                            )
                        ]
                    });

                    return;
                }

                const current =
                    await getUserRank(
                        groupId,
                        linked.robloxId
                    );

                if (!current) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Grup Üyeliği Bulunamadı",
                                `**${targetUser.tag}** kullanıcısı ${COUNTRY_NAMES[country]} grubunda bulunmuyor.`
                            )
                        ]
                    });

                    return;
                }

                const roles =
                    await getGroupRoles(
                        groupId
                    );

                const next =
                    roles.find(
                        role =>
                            String(role.id) ===
                            String(selected.roleId)
                    );

                if (!next) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Rütbe Bulunamadı",
                                "Seçtiğiniz rütbe Roblox grubunda bulunamadı."
                            )
                        ]
                    });

                    return;
                }

                if (
                    Number(next.rank) <=
                    Number(current.rank)
                ) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Terfi Yapılamadı",
                                `Seçilen rütbe mevcut rütbeden yüksek olmalıdır.\n\n` +
                                `**Mevcut:** ${current.name} — Rank ${current.rank}\n` +
                                `**Seçilen:** ${next.name} — Rank ${next.rank}`
                            )
                        ]
                    });

                    return;
                }

                await changeRank(
                    groupId,
                    linked.robloxId,
                    next.id
                );

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Rütbe Terfisi Başarılı",
                            `**Kullanıcı:** ${targetUser}\n` +
                            `**Roblox:** ${linked.robloxUsername || linked.robloxId}\n` +
                            `**Ülke:** ${COUNTRY_NAMES[country]}\n` +
                            `**Eski Rütbe:** ${current.name}\n` +
                            `**Yeni Rütbe:** ${next.name}\n` +
                            `**Rank:** ${next.rank}\n` +
                            `**Yetkili:** ${interaction.user}\n` +
                            `**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Roblox Terfi Logu",
                        `**Kullanıcı:** ${targetUser}\n` +
                        `**Roblox:** ${linked.robloxUsername || linked.robloxId}\n` +
                        `**Ülke:** ${COUNTRY_NAMES[country]}\n` +
                        `**Eski:** ${current.name}\n` +
                        `**Yeni:** ${next.name}\n` +
                        `**Yetkili:** ${interaction.user}\n` +
                        `**Sebep:** ${reason}`
                    )
                );

                return;
            }
            // ==========================================
            // UPDATE
            // ==========================================

            if (
                command === "update"
            ) {

                const links =
                    loadLinks();

                const linked =
                    links[interaction.user.id];

                if (!linked) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Roblox Hesabı Bağlı Değil",
                                "Roblox hesabınız henüz doğrulanmamış. Önce doğrulama işlemini tamamlamanız gerekiyor."
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

                await interaction.deferReply();

                const groupId =
                    GROUPS[linked.country];

                if (!groupId) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Grup Ayarlanmamış",
                                `${COUNTRY_NAMES[linked.country] || linked.country} için Roblox grup ID'si ayarlanmamış.`
                            )
                        ]
                    });

                    return;
                }

                const rank =
                    await getUserRank(
                        groupId,
                        linked.robloxId
                    );

                if (!rank) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Rütbe Bulunamadı",
                                "Roblox grubundaki üyeliğiniz bulunamadı."
                            )
                        ]
                    });

                    return;
                }

                const discordMember =
                    await interaction.guild.members.fetch(
                        interaction.user.id
                    );

                const discordRole =
                    interaction.guild.roles.cache.find(
                        role =>
                            role.name ===
                            rank.name
                    );

                if (discordRole) {

                    await discordMember.roles.add(
                        discordRole
                    );
                }

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Profil Güncellendi",
                            `Roblox hesabınız başarıyla kontrol edildi.\n\n` +
                            `**Roblox Kullanıcısı:** ${linked.robloxUsername || linked.robloxId}\n` +
                            `**Ülke:** ${COUNTRY_NAMES[linked.country] || linked.country}\n` +
                            `**Roblox Rütbesi:** ${rank.name}\n` +
                            `**Rank:** ${rank.rank}\n\n` +
                            `${discordRole ? `Discord üzerindeki **${discordRole.name}** rolünüz de güncellendi.` : "Discord sunucusunda bu rütbeye karşılık gelen rol bulunamadı."}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Profil Güncelleme Logu",
                        `**Kullanıcı:** ${interaction.user}\n` +
                        `**Roblox:** ${linked.robloxUsername || linked.robloxId}\n` +
                        `**Ülke:** ${COUNTRY_NAMES[linked.country] || linked.country}\n` +
                        `**Rütbe:** ${rank.name}\n` +
                        `**Rank:** ${rank.rank}`
                    )
                );

                return;
            }


            // ==========================================
            // DUYURU
            // ==========================================

            if (
                command === "duyuru"
            ) {

                const modal =
                    new ModalBuilder()
                        .setCustomId(
                            "announcement_modal"
                        )
                        .setTitle(
                            "📢 Duyuru Oluştur"
                        );

                const title =
                    new TextInputBuilder()
                        .setCustomId(
                            "announcement_title"
                        )
                        .setLabel(
                            "Duyuru Başlığı"
                        )
                        .setPlaceholder(
                            "Örn: Önemli Sunucu Duyurusu"
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(true)
                        .setMaxLength(256);

                const content =
                    new TextInputBuilder()
                        .setCustomId(
                            "announcement_content"
                        )
                        .setLabel(
                            "Duyuru İçeriği"
                        )
                        .setPlaceholder(
                            "Duyuru içeriğini buraya yazın..."
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(true)
                        .setMaxLength(4000);

                modal.addComponents(

                    new ActionRowBuilder()
                        .addComponents(
                            title
                        ),

                    new ActionRowBuilder()
                        .addComponents(
                            content
                        )
                );

                await interaction.showModal(
                    modal
                );

                return;
            }


            // ==========================================
            // TICKET PANEL
            // ==========================================

            if (
                command === "ticket-panel"
            ) {

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const menu =
                    new StringSelectMenuBuilder()
                        .setCustomId(
                            "ticket_category"
                        )
                        .setPlaceholder(
                            "🎫 Ticket kategorisini seçin..."
                        )
                        .addOptions(

                            {
                                label:
                                    "Ordu Şikayet",

                                description:
                                    "Ordu, personel ve askeri konular",

                                value:
                                    "army",

                                emoji:
                                    "🪖"
                            },

                            {
                                label:
                                    "Sunucu İçi Sorun",

                                description:
                                    "Discord, bot, rol, kanal ve sunucu sorunları",

                                value:
                                    "server",

                                emoji:
                                    "🛠️"
                            },

                            {
                                label:
                                    "Gamepass",

                                description:
                                    "Gamepass satın alma ve teslimat sorunları",

                                value:
                                    "gamepass",

                                emoji:
                                    "🎟️"
                            }
                        );

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            menu
                        );

                const info =
                    new EmbedBuilder()
                        .setColor(
                            0x3498db
                        )
                        .setTitle(
                            "🎫 Birleşmiş Milletler Destek Merkezi"
                        )
                        .setDescription(
                            "Destek almak için aşağıdaki kategorilerden size uygun olanı seçin.\n\n" +
                            "Ticket açmadan önce doğru kategoriyi seçtiğinizden emin olun."
                        )
                        .addFields(

                            {
                                name:
                                    "🪖 Ordu Şikayet",

                                value:
                                    "Ordu ve personel hakkındaki şikayetler.\n" +
                                    "Oyun içi askeri konular ve personel sorunları."
                            },

                            {
                                name:
                                    "🛠️ Sunucu İçi Sorun",

                                value:
                                    "Discord sunucusu, roller, kanallar, bot veya üyelerle ilgili sorunlar."
                            },

                            {
                                name:
                                    "🎟️ Gamepass",

                                value:
                                    "Gamepass satın alma, teslim edilmeme veya destek sorunları."
                            },

                            {
                                name:
                                    "⚠️ Ticket Kuralları",

                                value:
                                    "• Gereksiz ticket açmayın.\n" +
                                    "• Saygılı davranın.\n" +
                                    "• Sahte veya yanlış şikayet oluşturmayın.\n" +
                                    "• Spam yapmayın.\n" +
                                    "• Doğru bilgileri paylaşın.\n" +
                                    "• Kategori dışı konular için ticket açmayın."
                            }
                        )
                        .setFooter({
                            text:
                                "Birleşmiş Milletler • Destek Sistemi"
                        })
                        .setTimestamp();

                await interaction.channel.send({
                    embeds: [
                        info
                    ],

                    components: [
                        row
                    ]
                });

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            "Ticket Paneli Oluşturuldu",
                            "Destek paneli başarıyla gönderildi.\n\n" +
                            `**İşlem Sebebi:** ${reason}`
                        )
                    ],
                    ephemeral: true
                });

                return;
            }


            // ==========================================
            // BİLİNMEYEN KOMUT
            // ==========================================

            if (
                ![
                    "mute",
                    "unmute",
                    "kick",
                    "ban",
                    "rütbe-sorgu",
                    "grup-listele",
                    "rütbe-terfi",
                    "rütbe-degistir",
                    "update",
                    "duyuru",
                    "ticket-panel"
                ].includes(command)
            ) {

                await interaction.reply({
                    embeds: [
                        errorEmbed(
                            "Bilinmeyen Komut",
                            "Bu komut bot tarafından tanınmıyor."
                        )
                    ],
                    ephemeral: true
                });

                return;
            }

        } catch (error) {

            console.error(
                "INTERACTION HATASI:",
                error
            );

            const embed =
                errorEmbed(
                    "İşlem Başarısız",
                    `Bir hata oluştu.\n\n\`${error.message}\``
                );

            try {

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.editReply({
                        embeds: [
                            embed
                        ]
                    });

                } else {

                    await interaction.reply({
                        embeds: [
                            embed
                        ],
                        ephemeral: true
                    });
                }

            } catch {}
        }
    }
);


// ======================================================
// BOT LOGIN
// ======================================================

client.login(
    process.env.DISCORD_TOKEN
);