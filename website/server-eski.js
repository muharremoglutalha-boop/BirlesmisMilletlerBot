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
const crypto = require("crypto");

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

const VERIFY_WEB_URL =
    process.env.VERIFY_WEB_URL || "http://localhost:3000";

const VERIFY_TOKEN_TTL =
    10 * 60 * 1000;

const VERIFIED_ROLE_ID =
    process.env.VERIFIED_ROLE_ID || "";

const VERIFY_GUILD_ID =
    process.env.VERIFY_GUILD_ID || "";



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

const verifyTokensFile =
    path.join(dataFolder, "verify_tokens.json");

if (!fs.existsSync(verifyTokensFile)) {
    fs.writeFileSync(
        verifyTokensFile,
        JSON.stringify({}, null, 4)
    );
}

function loadVerifyTokens() {
    try {
        return JSON.parse(
            fs.readFileSync(
                verifyTokensFile,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function saveVerifyTokens(data) {
    fs.writeFileSync(
        verifyTokensFile,
        JSON.stringify(data, null, 4)
    );
}

function createVerifyToken(discordId) {
    const tokens = loadVerifyTokens();
    const now = Date.now();

    for (const [token, value] of Object.entries(tokens)) {
        if (!value || value.expiresAt <= now || value.used) {
            delete tokens[token];
        }
    }

    const token = crypto.randomBytes(32).toString("hex");

    tokens[token] = {
        discordId: String(discordId),
        createdAt: now,
        expiresAt: now + VERIFY_TOKEN_TTL,
        used: false
    };

    saveVerifyTokens(tokens);

    return token;
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
// RÜTBE LİSTELERİ
// ======================================================

const COUNTRY_ROLES = {

    turkiye: [
        {
            name: "Türk Askeri",
            roleName: "Türk Askeri"
        },
        {
            name: "Türkiye Elcisi",
            roleName: "Türkiye Elcisi"
        },
        {
            name: "Türkiye Dışişleri Bakanlığı",
            roleName: "Türkiye  Dışişleri Bakanlığı"
        },
        {
            name: "Türkiye mareşal",
            roleName: "Türkiye mareşal"
        }
    ],

    almanya: [
        {
            name: "Alman Askeri",
            roleName: "Alman Askeri"
        },
        {
            name: "Almanya Elcisi",
            roleName: "Almanya Elcisi"
        },
        {
            name: "Almanya Dışişleri Bakanlığı",
            roleName: "Almanya Dışişleri Bakanlığı"
        },
        {
            name: "DE maresal",
            roleName: "DE maresal"
        }
    ],

    fransa: [
        {
            name: "Fransa Askeri",
            roleName: "Fransa Askeri"
        },
        {
            name: "Fransa Elcisi",
            roleName: "Fransa Elcisi"
        },
        {
            name: "Fransa Dışişleri Bakanlığı",
            roleName: "Fransa Dışişleri Bakanlığı"
        },
        {
            name: "Franse mareșal",
            roleName: "Franse mareșal"
        }
    ],

    ispanya: [
        {
            name: "Ispanyol Askeri",
            roleName: "Ispanyol Askeri"
        },
        {
            name: "Ispanya Elcisi",
            roleName: "Ispanya Elcisi"
        },
        {
            name: "Ispanya Dışişleri Bakanlığı",
            roleName: "Ispanya Dışişleri Bakanlığı"
        },
        {
            name: "Ispanya mareșal",
            roleName: "Ispanya mareșal"
        }
    ]
};


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

    // Dışişleri Bakanlığı = 60
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
// VERIFY SİSTEMİ
// ======================================================

async function registerVerifyCommand() {

    try {

        const commandData = {
            name: "verify",
            description: "Roblox hesabınızı Discord hesabınıza bağlar."
        };

        if (VERIFY_GUILD_ID) {

            const guild =
                await client.guilds.fetch(
                    VERIFY_GUILD_ID
                );

            if (guild) {

                const commands =
                    await guild.commands.fetch();

                const existing =
                    commands.find(
                        command =>
                            command.name === "verify"
                    );

                if (existing) {

                    await guild.commands.edit(
                        existing.id,
                        commandData
                    );

                } else {

                    await guild.commands.create(
                        commandData
                    );
                }

            }

        } else {

            const commands =
                await client.application.commands.fetch();

            const existing =
                commands.find(
                    command =>
                        command.name === "verify"
                );

            if (existing) {

                await client.application.commands.edit(
                    existing.id,
                    commandData
                );

            } else {

                await client.application.commands.create(
                    commandData
                );
            }
        }

        console.log("VERIFY KOMUTU HAZIR.");

    } catch (error) {

        console.error(
            "VERIFY KOMUTU KAYDEDİLEMEDİ:",
            error.message
        );
    }
}

async function syncVerifiedRole() {

    if (!VERIFIED_ROLE_ID) {
        return;
    }

    const links =
        loadLinks();

    for (const linked of Object.values(links)) {

        if (
            !linked ||
            !linked.discordId ||
            !linked.robloxId ||
            !linked.verified
        ) {
            continue;
        }

        try {

            const guild =
                VERIFY_GUILD_ID
                    ? await client.guilds.fetch(
                        VERIFY_GUILD_ID
                    )
                    : client.guilds.cache.first();

            if (!guild) {
                continue;
            }

            const member =
                await guild.members.fetch(
                    linked.discordId
                );

            const role =
                guild.roles.cache.get(
                    VERIFIED_ROLE_ID
                );

            if (
                role &&
                !member.roles.cache.has(role.id)
            ) {
                await member.roles.add(
                    role,
                    "Roblox hesabı doğrulandı."
                );
            }

        } catch (error) {

            console.error(
                "VERIFIED ROLÜ VERİLEMEDİ:",
                error.message
            );
        }
    }
}

// ======================================================
// BOT READY
// ======================================================

client.once(
    "ready",
    async () => {

        console.log(
            `BOT HAZIR: ${client.user.tag}`
        );

        console.log(
            "Roblox bağlantısı hazır."
        );

        await registerVerifyCommand();

        await syncVerifiedRole();

        setInterval(
            syncVerifiedRole,
            5000
        );
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

            if (
                interaction.isAutocomplete()
            ) {

                if (
                    interaction.commandName !==
                    "rütbe-degistir"
                ) {

                    return;
                }

                const country =
                    interaction.options.getString(
                        "ulke"
                    );

                const search =
                    interaction.options.getString(
                        "rutbe"
                    ) || "";

                const roles =
                    COUNTRY_ROLES[country] || [];

                const filtered =
                    roles.filter(
                        role =>
                            role.name
                                .toLowerCase()
                                .includes(
                                    search.toLowerCase()
                                )
                    );

                await interaction.respond(
                    filtered.map(
                        role => ({
                            name: role.name,
                            value: role.roleName
                        })
                    )
                );

                return;
            }


            // ==========================================
            // BUTTON
            // ==========================================

            if (
                interaction.isButton()
            ) {

                // ROBLOX VERIFY
                if (
                    interaction.customId ===
                    "verify_roblox"
                ) {

                    const links =
                        loadLinks();

                    if (
                        links[interaction.user.id] &&
                        links[interaction.user.id].verified
                    ) {

                        await interaction.reply({
                            embeds: [
                                successEmbed(
                                    "Hesap Zaten Doğrulandı",
                                    "Discord hesabınız zaten bir Roblox hesabına bağlı."
                                )
                            ],
                            ephemeral: true
                        });

                        return;
                    }

                    const token =
                        createVerifyToken(
                            interaction.user.id
                        );

                    const verifyUrl =
                        `${VERIFY_WEB_URL}/auth/roblox?token=${encodeURIComponent(token)}`;

                    const embed =
                        new EmbedBuilder()
                            .setColor(0x5865f2)
                            .setTitle("🔗 Roblox Doğrulama")
                            .setDescription(
                                "Aşağıdaki butona tıklayarak Roblox hesabınızı **bu Discord hesabına** güvenli şekilde bağlayabilirsiniz."
                            )
                            .addFields(
                                {
                                    name: "Discord Hesabı",
                                    value: `${interaction.user}`,
                                    inline: true
                                },
                                {
                                    name: "Bağlantı",
                                    value: "⏱️ 10 dakika geçerli",
                                    inline: true
                                }
                            )
                            .setFooter({
                                text: "Birleşmiş Milletler • Secure Verification"
                            })
                            .setTimestamp();

                    const row =
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel(
                                        "Roblox ile Doğrula"
                                    )
                                    .setStyle(
                                        ButtonStyle.Link
                                    )
                                    .setURL(
                                        verifyUrl
                                    )
                                    .setEmoji("🔗")
                            );

                    await interaction.reply({
                        embeds: [embed],
                        components: [row],
                        ephemeral: true
                    });

                    return;
                }


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

                // TICKET KATEGORİSİ
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

                // DUYURU
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
            // VERIFY
            // ==========================================

            if (
                command === "verify"
            ) {

                const links =
                    loadLinks();

                const linked =
                    links[interaction.user.id];

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            linked
                                ? 0x23a559
                                : 0x5865f2
                        )
                        .setTitle(
                            "🔐 Roblox Hesap Doğrulama"
                        )
                        .setDescription(
                            linked
                                ? "Roblox hesabınız başarıyla bu Discord hesabına bağlanmış."
                                : "Roblox hesabınızı bu Discord hesabına bağlamak için aşağıdaki butona tıklayın."
                        )
                        .addFields(
                            {
                                name: "Durum",
                                value:
                                    linked && linked.verified
                                        ? "🟢 **Doğrulandı**"
                                        : "🔴 **Doğrulanmadı**",
                                inline: true
                            },
                            {
                                name: "Discord",
                                value:
                                    `${interaction.user}`,
                                inline: true
                            }
                        )
                        .setThumbnail(
                            interaction.user.displayAvatarURL({
                                extension: "png",
                                size: 256
                            })
                        )
                        .setFooter({
                            text:
                                "Birleşmiş Milletler • Verification"
                        })
                        .setTimestamp();

                if (linked && linked.robloxId) {

                    embed.addFields(
                        {
                            name: "Roblox",
                            value:
                                `[${linked.robloxUsername || "Bilinmiyor"}](https://www.roblox.com/users/${linked.robloxId}/profile)`,
                            inline: true
                        },
                        {
                            name: "Roblox ID",
                            value:
                                String(linked.robloxId),
                            inline: true
                        }
                    );

                    const avatarUrl =
                        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(linked.robloxId)}&size=150x150&format=Png&isCircular=true`;

                    embed.setThumbnail(
                        avatarUrl
                    );
                }

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    "verify_roblox"
                                )
                                .setLabel(
                                    linked && linked.verified
                                        ? "Hesap Doğrulandı"
                                        : "Roblox ile Doğrula"
                                )
                                .setEmoji(
                                    linked && linked.verified
                                        ? "✅"
                                        : "🔗"
                                )
                                .setStyle(
                                    linked && linked.verified
                                        ? ButtonStyle.Secondary
                                        : ButtonStyle.Primary
                                )
                                .setDisabled(
                                    Boolean(
                                        linked &&
                                        linked.verified
                                    )
                                )
                        );

                await interaction.reply({
                    embeds: [embed],
                    components: [row]
                });

                return;
            }


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

                const links =
                    loadLinks();

                let found = null;

                for (
                    const country of Object.keys(GROUPS)
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
                            `**Ülke:** ${found.country}\n` +
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

                const country =
                    "turkiye";

                const groupId =
                    GROUPS[country];

                await interaction.deferReply();

                if (!groupId) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Grup Bulunamadı",
                                "Türkiye Roblox grup ID'si ayarlanmamış."
                            )
                        ]
                    });

                    return;
                }

                const roles =
                    await getGroupRoles(
                        groupId
                    );

                await interaction.editReply({
                    embeds: [
                        infoEmbed(
                            "Roblox Grup Rütbeleri",
                            `**Grup ID:** ${groupId}\n\n` +
                            roles
                                .map(
                                    role =>
                                        `• **${role.name}** — Rank ${role.rank}`
                                )
                                .join("\n")
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

                const username =
                    interaction.options.getString(
                        "kullanici"
                    );

                const country =
                    interaction.options.getString(
                        "ulke"
                    );

                const roleName =
                    interaction.options.getString(
                        "rutbe"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const groupId =
                    GROUPS[country];

                const countryRoles =
                    COUNTRY_ROLES[country] || [];

                const selected =
                    countryRoles.find(
                        role =>
                            role.roleName ===
                            roleName
                    );

                if (!selected) {

                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Rütbe Geçersiz",
                                "Seçtiğiniz rütbe bu ülkeye ait değil."
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

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
                                `**${username}** Roblox'ta bulunamadı.`
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
                            role.name ===
                            selected.roleName
                    );

                if (!targetRole) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Rütbe Bulunamadı",
                                `Roblox grubunda **${selected.roleName}** isimli rütbe bulunamadı.`
                            )
                        ]
                    });

                    return;
                }

                await changeRank(
                    groupId,
                    user.id,
                    targetRole.id
                );

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Rütbe Değiştirildi",
                            `**${user.name}** kullanıcısının rütbesi değiştirildi.\n\n` +
                            `**Ülke:** ${country}\n` +
                            `**Yeni Rütbe:** ${targetRole.name}\n` +
                            `**Yetkili:** ${interaction.user}\n` +
                            `**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Roblox Rütbe Değişikliği",
                        `**Kullanıcı:** ${user.name}\n` +
                        `**Ülke:** ${country}\n` +
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

                const country =
                    interaction.options.getString(
                        "ulke"
                    );

                const username =
                    interaction.options.getString(
                        "kullanici"
                    );

                const reason =
                    interaction.options.getString(
                        "sebep"
                    );

                const groupId =
                    GROUPS[country];

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
                                `**${username}** Roblox'ta bulunamadı.`
                            )
                        ]
                    });

                    return;
                }

                const current =
                    await getUserRank(
                        groupId,
                        user.id
                    );

                if (!current) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Grup Üyeliği Bulunamadı",
                                "Kullanıcı bu ülkenin Roblox grubunda değil."
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
                    roles
                        .filter(
                            role =>
                                role.rank >
                                current.rank
                        )
                        .sort(
                            (a, b) =>
                                a.rank - b.rank
                        )[0];

                if (!next) {

                    await interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "Terfi Edilemedi",
                                "Bu kullanıcı için daha yüksek bir rütbe bulunamadı."
                            )
                        ]
                    });

                    return;
                }

                await changeRank(
                    groupId,
                    user.id,
                    next.id
                );

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Rütbe Terfi Ettirildi",
                            `**${user.name}** kullanıcısı terfi ettirildi.\n\n` +
                            `**Eski Rütbe:** ${current.name}\n` +
                            `**Yeni Rütbe:** ${next.name}\n` +
                            `**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Roblox Terfi Logu",
                        `**Kullanıcı:** ${user.name}\n` +
                        `**Ülke:** ${country}\n` +
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
                                "Roblox hesabınız henüz doğrulanmamış."
                            )
                        ],
                        ephemeral: true
                    });

                    return;
                }

                await interaction.deferReply();

                const groupId =
                    GROUPS[linked.country];

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
                            `Roblox rütbeniz başarıyla kontrol edildi.\n\n` +
                            `**Ülke:** ${linked.country}\n` +
                            `**Roblox Rütbesi:** ${rank.name}\n` +
                            `**Rank:** ${rank.rank}`
                        )
                    ]
                });

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
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(true)
                        .setMaxLength(4000);

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(title),

                    new ActionRowBuilder()
                        .addComponents(content)
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
                            "Ticket kategorisini seçin..."
                        )
                        .addOptions(
                            {
                                label:
                                    "Ordu Şikayet",
                                description:
                                    "Ordu ve personel hakkında şikayet",
                                value:
                                    "army",
                                emoji:
                                    "🪖"
                            },
                            {
                                label:
                                    "Sunucu İçi Sorun",
                                description:
                                    "Discord sunucusu ve bot sorunları",
                                value:
                                    "server",
                                emoji:
                                    "🛠️"
                            },
                            {
                                label:
                                    "Gamepass",
                                description:
                                    "Gamepass destek ve teslimat sorunları",
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
                            "Destek almak için aşağıdaki kategorilerden uygun olanı seçin."
                        )
                        .addFields(
                            {
                                name:
                                    "🪖 Ordu Şikayet",
                                value:
                                    "Ordu, personel ve oyun içi askeri konular."
                            },
                            {
                                name:
                                    "🛠️ Sunucu İçi Sorun",
                                value:
                                    "Discord, roller, kanallar, bot ve sunucu sorunları."
                            },
                            {
                                name:
                                    "🎟️ Gamepass",
                                value:
                                    "Gamepass satın alma, teslimat ve destek sorunları."
                            },
                            {
                                name:
                                    "⚠️ Ticket Kuralları",
                                value:
                                    "Gereksiz ticket açmayın.\n" +
                                    "Saygılı olun.\n" +
                                    "Sahte şikayet oluşturmayın.\n" +
                                    "Spam yapmayın.\n" +
                                    "Doğru bilgileri paylaşın.\n" +
                                    "Kategori dışı ticket açmayın."
                            }
                        )
                        .setFooter({
                            text:
                                "Destek sistemi"
                        })
                        .setTimestamp();

                await interaction.channel.send({
                    embeds: [info],
                    components: [row]
                });

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            "Ticket Paneli Oluşturuldu",
                            `Panel başarıyla gönderildi.\n\n**Sebep:** ${reason}`
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
                        embeds: [embed]
                    });

                } else {

                    await interaction.reply({
                        embeds: [embed],
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