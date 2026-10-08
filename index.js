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
// DATA KLASÃ–RÃœ
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
            "Roblox kullanÄ±cÄ± aramasÄ± baÅŸarÄ±sÄ±z."
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
// GRUP ROLLERÄ°
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
// GRUP ÃœYELÄ°ÄžÄ°
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
// RÃœTBE BUL
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
// RÃœTBE DEÄžÄ°ÅžTÄ°R
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
            "KullanÄ±cÄ± Roblox grubunda bulunmuyor."
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
            "Log gÃ¶nderilemedi:",
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
        .setTitle(`âœ… ${title}`)
        .setDescription(description)
        .setTimestamp();
}


function errorEmbed(
    title,
    description
) {

    return new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`âŒ ${title}`)
        .setDescription(description)
        .setTimestamp();
}


function infoEmbed(
    title,
    description
) {

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`â„¹ï¸ ${title}`)
        .setDescription(description)
        .setTimestamp();
}


// ======================================================
// RÃœTBE LÄ°STELERÄ°
// ======================================================

const COUNTRY_ROLES = {

    turkiye: [
        {
            name: "TÃ¼rk Askeri",
            roleName: "TÃ¼rk Askeri"
        },
        {
            name: "TÃ¼rkiye Elcisi",
            roleName: "TÃ¼rkiye Elcisi"
        },
        {
            name: "TÃ¼rkiye DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±",
            roleName: "TÃ¼rkiye  DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±"
        },
        {
            name: "TÃ¼rkiye mareÅŸal",
            roleName: "TÃ¼rkiye mareÅŸal"
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
            name: "Almanya DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±",
            roleName: "Almanya DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±"
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
            name: "Fransa DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±",
            roleName: "Fransa DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±"
        },
        {
            name: "Franse mareÈ™al",
            roleName: "Franse mareÈ™al"
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
            name: "Ispanya DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±",
            roleName: "Ispanya DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ±"
        },
        {
            name: "Ispanya mareÈ™al",
            roleName: "Ispanya mareÈ™al"
        }
    ]
};


// ======================================================
// YETKÄ° KONTROLÃœ
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
                "Ã–nce Roblox hesabÄ±nÄ±zÄ± doÄŸrulamanÄ±z gerekiyor."
        };
    }

    const groupId =
        GROUPS[linked.country];

    if (!groupId) {

        return {
            ok: false,
            reason:
                "Bu Ã¼lkenin Roblox grup ID'si henÃ¼z ayarlanmamÄ±ÅŸ."
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
                "Roblox grubunda Ã¼yeliÄŸiniz bulunamadÄ±."
        };
    }

    // DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ± = 60
    if (Number(rank.rank) < 60) {

        return {
            ok: false,
            reason:
                "Bu iÅŸlemi kullanabilmek iÃ§in DÄ±ÅŸiÅŸleri BakanlÄ±ÄŸÄ± veya Ã¼zeri rÃ¼tbede olmanÄ±z gerekiyor."
        };
    }

    return {
        ok: true,
        rank,
        linked
    };
}


// ======================================================
// VERIFY SÄ°STEMÄ°
// ======================================================

async function registerCommands() {
    const commands = [
        {
            name: "verify",
            description: "Roblox hesabÄ±nÄ±zÄ± Discord hesabÄ±nÄ±za baÄŸlar."
        },
        {
            name: "register",
            description: "Slash komutlarÄ±nÄ± Discord sunucusuna yeniden kaydeder."
        },
        {
            name: "mute",
            description: "Bir kullanÄ±cÄ±yÄ± geÃ§ici olarak susturur.",
            options: [
                { type: 6, name: "kullanici", description: "Susturulacak kullanÄ±cÄ±", required: true },
                { type: 4, name: "dakika", description: "SÃ¼re (dakika)", required: true, min_value: 1, max_value: 40320 },
                { type: 3, name: "sebep", description: "Susturma sebebi", required: true }
            ]
        },
        {
            name: "unmute",
            description: "Bir kullanÄ±cÄ±nÄ±n susturmasÄ±nÄ± kaldÄ±rÄ±r.",
            options: [
                { type: 6, name: "kullanici", description: "KullanÄ±cÄ±", required: true },
                { type: 3, name: "sebep", description: "Sebep", required: true }
            ]
        },
        {
            name: "kick",
            description: "Bir kullanÄ±cÄ±yÄ± sunucudan atar.",
            options: [
                { type: 6, name: "kullanici", description: "AtÄ±lacak kullanÄ±cÄ±", required: true },
                { type: 3, name: "sebep", description: "Sebep", required: true }
            ]
        },
        {
            name: "ban",
            description: "Bir kullanÄ±cÄ±yÄ± sunucudan yasaklar.",
            options: [
                { type: 6, name: "kullanici", description: "Yasaklanacak kullanÄ±cÄ±", required: true },
                { type: 3, name: "sebep", description: "Sebep", required: true }
            ]
        },
        {
            name: "rÃ¼tbe-sorgu",
            description: "Bir Roblox kullanÄ±cÄ±sÄ±nÄ±n rÃ¼tbesini sorgular.",
            options: [
                { type: 3, name: "kullanici", description: "Roblox kullanÄ±cÄ± adÄ±", required: true }
            ]
        },
        {
            name: "grup-listele",
            description: "Roblox grup rollerini listeler.",
            options: [
                { type: 3, name: "sebep", description: "Listeleme sebebi", required: true }
            ]
        },
        {
            name: "rÃ¼tbe-degistir",
            description: "Bir Roblox kullanÄ±cÄ±sÄ±nÄ±n rÃ¼tbesini deÄŸiÅŸtirir.",
            options: [
                { type: 3, name: "kullanici", description: "Roblox kullanÄ±cÄ± adÄ±", required: true },
                { type: 3, name: "ulke", description: "Ãœlke", required: true, choices: [
                    { name: "TÃ¼rkiye", value: "turkiye" },
                    { name: "Almanya", value: "almanya" },
                    { name: "Fransa", value: "fransa" },
                    { name: "Ä°spanya", value: "ispanya" }
                ]},
                { type: 3, name: "rutbe", description: "Yeni rÃ¼tbe", required: true, autocomplete: true },
                { type: 3, name: "sebep", description: "Sebep", required: true }
            ]
        },
        {
            name: "rÃ¼tbe-terfi",
            description: "Bir Roblox kullanÄ±cÄ±sÄ±nÄ± bir sonraki rÃ¼tbeye yÃ¼kseltir.",
            options: [
                { type: 3, name: "kullanici", description: "Roblox kullanÄ±cÄ± adÄ±", required: true },
                { type: 3, name: "ulke", description: "Ãœlke", required: true, choices: [
                    { name: "TÃ¼rkiye", value: "turkiye" },
                    { name: "Almanya", value: "almanya" },
                    { name: "Fransa", value: "fransa" },
                    { name: "Ä°spanya", value: "ispanya" }
                ]},
                { type: 3, name: "sebep", description: "Sebep", required: true }
            ]
        },
        {
            name: "update",
            description: "Roblox rÃ¼tbenizi ve Discord rollerinizi gÃ¼nceller."
        },
        {
            name: "duyuru",
            description: "Duyuru oluÅŸturur."
        },
        {
            name: "ticket-panel",
            description: "Ticket paneli oluÅŸturur.",
            options: [
                { type: 3, name: "sebep", description: "Panel oluÅŸturma sebebi", required: true }
            ]
        }
    ];

    try {
        if (VERIFY_GUILD_ID) {
            const guild = await client.guilds.fetch(VERIFY_GUILD_ID);
            await guild.commands.set(commands);
            console.log(`SLASH KOMUTLARI YENÄ°LENDÄ°: ${commands.length} komut`);
            console.log(`Guild: ${guild.name} (${guild.id})`);
        } else {
            await client.application.commands.set(commands);
            console.log(`GLOBAL SLASH KOMUTLARI YENÄ°LENDÄ°: ${commands.length} komut`);
        }
    } catch (error) {
        console.error("SLASH KOMUTLARI KAYDEDÄ°LEMEDÄ°:", error);
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
                    "Roblox hesabÄ± doÄŸrulandÄ±."
                );
            }

        } catch (error) {

            console.error(
                "VERIFIED ROLÃœ VERÄ°LEMEDÄ°:",
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
            "Roblox baÄŸlantÄ±sÄ± hazÄ±r."
        );

        await registerCommands();

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
                    "rÃ¼tbe-degistir"
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
                                    "Hesap Zaten DoÄŸrulandÄ±",
                                    "Discord hesabÄ±nÄ±z zaten bir Roblox hesabÄ±na baÄŸlÄ±."
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
                            .setTitle("ðŸ”— Roblox DoÄŸrulama")
                            .setDescription(
                                "AÅŸaÄŸÄ±daki butona tÄ±klayarak Roblox hesabÄ±nÄ±zÄ± **bu Discord hesabÄ±na** gÃ¼venli ÅŸekilde baÄŸlayabilirsiniz."
                            )
                            .addFields(
                                {
                                    name: "Discord HesabÄ±",
                                    value: `${interaction.user}`,
                                    inline: true
                                },
                                {
                                    name: "BaÄŸlantÄ±",
                                    value: "â±ï¸ 10 dakika geÃ§erli",
                                    inline: true
                                }
                            )
                            .setFooter({
                                text: "BirleÅŸmiÅŸ Milletler â€¢ Secure Verification"
                            })
                            .setTimestamp();

                    const row =
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setLabel(
                                        "Roblox ile DoÄŸrula"
                                    )
                                    .setStyle(
                                        ButtonStyle.Link
                                    )
                                    .setURL(
                                        verifyUrl
                                    )
                                    .setEmoji("ðŸ”—")
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
                                "Ticket KapatÄ±lÄ±yor",
                                "Bu ticket 5 saniye iÃ§inde kapatÄ±lacak."
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


                // TICKET BÄ°LGÄ°
                if (
                    interaction.customId ===
                    "ticket_info"
                ) {

                    await interaction.reply({
                        embeds: [
                            infoEmbed(
                                "Ticket Bilgileri",
                                [
                                    "â€¢ Sorununuzu aÃ§Ä±k ve anlaÅŸÄ±lÄ±r ÅŸekilde anlatÄ±n.",
                                    "â€¢ Gereksiz ticket aÃ§mayÄ±n.",
                                    "â€¢ Sahte/yanlÄ±ÅŸ ÅŸikayet oluÅŸturmayÄ±n.",
                                    "â€¢ Spam yapmayÄ±n.",
                                    "â€¢ DoÄŸru bilgileri paylaÅŸÄ±n.",
                                    "â€¢ Ticket kategorisinin dÄ±ÅŸÄ±na Ã§Ä±kmayÄ±n."
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

                // TICKET KATEGORÄ°SÄ°
                if (
                    interaction.customId ===
                    "ticket_category"
                ) {

                    const category =
                        interaction.values[0];

                    const names = {
                        army:
                            "ðŸª– Ordu Åžikayet",
                        server:
                            "ðŸ› ï¸ Sunucu Ä°Ã§i Sorun",
                        gamepass:
                            "ðŸŽŸï¸ Gamepass"
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
                                    "ðŸŽ« Ticket AÃ§Ä±ldÄ±"
                                )
                                .setDescription(
                                    `**Kategori:** ${names[category]}\n\n` +
                                    "Yetkili ekip en kÄ±sa sÃ¼rede sizinle ilgilenecektir.\n\n" +
                                    "LÃ¼tfen probleminizi ayrÄ±ntÄ±lÄ± ÅŸekilde aÃ§Ä±klayÄ±n."
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
                                "Ticket OluÅŸturuldu",
                                `TicketÄ±nÄ±z oluÅŸturuldu: ${channel}`
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
                                `ðŸ“¢ ${title}`
                            )
                            .setDescription(
                                content
                            )
                            .setFooter({
                                text:
                                    `Duyuru â€¢ ${interaction.user.tag}`
                            })
                            .setTimestamp();

                    await interaction.reply({
                        embeds: [
                            successEmbed(
                                "Duyuru HazÄ±rlandÄ±",
                                "Duyuru aÅŸaÄŸÄ±daki ÅŸekilde oluÅŸturuldu."
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
            // REGISTER
            // ==========================================

            if (
                command === "register"
            ) {

                if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({
                        embeds: [
                            errorEmbed(
                                "Yetkiniz Yok",
                                "Bu komutu kullanmak iÃ§in YÃ¶netici yetkisine sahip olmanÄ±z gerekiyor."
                            )
                        ],
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: true });
                await registerCommands();

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Register Yenilendi",
                            "Slash komutlarÄ± Discord'a yeniden kaydedildi."
                        )
                    ]
                });

                return;
            }


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
                            "ðŸ” Roblox Hesap DoÄŸrulama"
                        )
                        .setDescription(
                            linked
                                ? "Roblox hesabÄ±nÄ±z baÅŸarÄ±yla bu Discord hesabÄ±na baÄŸlanmÄ±ÅŸ."
                                : "Roblox hesabÄ±nÄ±zÄ± bu Discord hesabÄ±na baÄŸlamak iÃ§in aÅŸaÄŸÄ±daki butona tÄ±klayÄ±n."
                        )
                        .addFields(
                            {
                                name: "Durum",
                                value:
                                    linked && linked.verified
                                        ? "ðŸŸ¢ **DoÄŸrulandÄ±**"
                                        : "ðŸ”´ **DoÄŸrulanmadÄ±**",
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
                                "BirleÅŸmiÅŸ Milletler â€¢ Verification"
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
                                        ? "Hesap DoÄŸrulandÄ±"
                                        : "Roblox ile DoÄŸrula"
                                )
                                .setEmoji(
                                    linked && linked.verified
                                        ? "âœ…"
                                        : "ðŸ”—"
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
                            "KullanÄ±cÄ± Susturuldu",
                            `**${user.tag}** kullanÄ±cÄ±sÄ± **${minutes} dakika** susturuldu.\n\n**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Mute Log",
                        `**KullanÄ±cÄ±:** ${user}\n**SÃ¼re:** ${minutes} dakika\n**Yetkili:** ${interaction.user}\n**Sebep:** ${reason}`
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
                            "Mute KaldÄ±rÄ±ldÄ±",
                            `**${user.tag}** kullanÄ±cÄ±sÄ±nÄ±n susturmasÄ± kaldÄ±rÄ±ldÄ±.\n\n**Sebep:** ${reason}`
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
                            "KullanÄ±cÄ± AtÄ±ldÄ±",
                            `**${user.tag}** sunucudan atÄ±ldÄ±.\n\n**Sebep:** ${reason}`
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
                            "KullanÄ±cÄ± YasaklandÄ±",
                            `**${user.tag}** sunucudan yasaklandÄ±.\n\n**Sebep:** ${reason}`
                        )
                    ]
                });

                return;
            }


            // ==========================================
            // YETKÄ°LÄ° ROBLOX KOMUTLARI
            // ==========================================

            if (
                [
                    "rÃ¼tbe-sorgu",
                    "grup-listele",
                    "rÃ¼tbe-terfi",
                    "rÃ¼tbe-degistir"
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
            // RÃœTBE SORGU
            // ==========================================

            if (
                command === "rÃ¼tbe-sorgu"
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
                                "KullanÄ±cÄ± BulunamadÄ±",
                                `**${username}** isimli Roblox kullanÄ±cÄ±sÄ± bulunamadÄ±.`
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
                                "Grup ÃœyeliÄŸi BulunamadÄ±",
                                `**${username}** hiÃ§bir aktif Ã¼lke grubunda bulunamadÄ±.`
                            )
                        ]
                    });

                    return;
                }

                await interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Roblox RÃ¼tbe Sorgusu",
                            `**KullanÄ±cÄ±:** ${user.name}\n` +
                            `**KullanÄ±cÄ± ID:** ${user.id}\n` +
                            `**Ãœlke:** ${found.country}\n` +
                            `**RÃ¼tbe:** ${found.rank.name}\n` +
                            `**Rank:** ${found.rank.rank}`
                        )
                    ]
                });

                return;
            }


            // ==========================================
            // GRUP LÄ°STELE
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
                                "Grup BulunamadÄ±",
                                "TÃ¼rkiye Roblox grup ID'si ayarlanmamÄ±ÅŸ."
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
                            "Roblox Grup RÃ¼tbeleri",
                            `**Grup ID:** ${groupId}\n\n` +
                            roles
                                .map(
                                    role =>
                                        `â€¢ **${role.name}** â€” Rank ${role.rank}`
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
            // RÃœTBE DEÄžÄ°ÅžTÄ°R
            // ==========================================

            if (
                command === "rÃ¼tbe-degistir"
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
                                "RÃ¼tbe GeÃ§ersiz",
                                "SeÃ§tiÄŸiniz rÃ¼tbe bu Ã¼lkeye ait deÄŸil."
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
                                "KullanÄ±cÄ± BulunamadÄ±",
                                `**${username}** Roblox'ta bulunamadÄ±.`
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
                                "RÃ¼tbe BulunamadÄ±",
                                `Roblox grubunda **${selected.roleName}** isimli rÃ¼tbe bulunamadÄ±.`
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
                            "RÃ¼tbe DeÄŸiÅŸtirildi",
                            `**${user.name}** kullanÄ±cÄ±sÄ±nÄ±n rÃ¼tbesi deÄŸiÅŸtirildi.\n\n` +
                            `**Ãœlke:** ${country}\n` +
                            `**Yeni RÃ¼tbe:** ${targetRole.name}\n` +
                            `**Yetkili:** ${interaction.user}\n` +
                            `**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Roblox RÃ¼tbe DeÄŸiÅŸikliÄŸi",
                        `**KullanÄ±cÄ±:** ${user.name}\n` +
                        `**Ãœlke:** ${country}\n` +
                        `**Yeni RÃ¼tbe:** ${targetRole.name}\n` +
                        `**Yetkili:** ${interaction.user}\n` +
                        `**Sebep:** ${reason}`
                    )
                );

                return;
            }


            // ==========================================
            // RÃœTBE TERFÄ°
            // ==========================================

            if (
                command === "rÃ¼tbe-terfi"
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
                                "KullanÄ±cÄ± BulunamadÄ±",
                                `**${username}** Roblox'ta bulunamadÄ±.`
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
                                "Grup ÃœyeliÄŸi BulunamadÄ±",
                                "KullanÄ±cÄ± bu Ã¼lkenin Roblox grubunda deÄŸil."
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
                                "Bu kullanÄ±cÄ± iÃ§in daha yÃ¼ksek bir rÃ¼tbe bulunamadÄ±."
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
                            "RÃ¼tbe Terfi Ettirildi",
                            `**${user.name}** kullanÄ±cÄ±sÄ± terfi ettirildi.\n\n` +
                            `**Eski RÃ¼tbe:** ${current.name}\n` +
                            `**Yeni RÃ¼tbe:** ${next.name}\n` +
                            `**Sebep:** ${reason}`
                        )
                    ]
                });

                await sendLog(
                    successEmbed(
                        "Roblox Terfi Logu",
                        `**KullanÄ±cÄ±:** ${user.name}\n` +
                        `**Ãœlke:** ${country}\n` +
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
                                "Roblox HesabÄ± BaÄŸlÄ± DeÄŸil",
                                "Roblox hesabÄ±nÄ±z henÃ¼z doÄŸrulanmamÄ±ÅŸ."
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
                                "RÃ¼tbe BulunamadÄ±",
                                "Roblox grubundaki Ã¼yeliÄŸiniz bulunamadÄ±."
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
                            "Profil GÃ¼ncellendi",
                            `Roblox rÃ¼tbeniz baÅŸarÄ±yla kontrol edildi.\n\n` +
                            `**Ãœlke:** ${linked.country}\n` +
                            `**Roblox RÃ¼tbesi:** ${rank.name}\n` +
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
                            "ðŸ“¢ Duyuru OluÅŸtur"
                        );

                const title =
                    new TextInputBuilder()
                        .setCustomId(
                            "announcement_title"
                        )
                        .setLabel(
                            "Duyuru BaÅŸlÄ±ÄŸÄ±"
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
                            "Duyuru Ä°Ã§eriÄŸi"
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
                            "Ticket kategorisini seÃ§in..."
                        )
                        .addOptions(
                            {
                                label:
                                    "Ordu Åžikayet",
                                description:
                                    "Ordu ve personel hakkÄ±nda ÅŸikayet",
                                value:
                                    "army",
                                emoji:
                                    "ðŸª–"
                            },
                            {
                                label:
                                    "Sunucu Ä°Ã§i Sorun",
                                description:
                                    "Discord sunucusu ve bot sorunlarÄ±",
                                value:
                                    "server",
                                emoji:
                                    "ðŸ› ï¸"
                            },
                            {
                                label:
                                    "Gamepass",
                                description:
                                    "Gamepass destek ve teslimat sorunlarÄ±",
                                value:
                                    "gamepass",
                                emoji:
                                    "ðŸŽŸï¸"
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
                            "ðŸŽ« BirleÅŸmiÅŸ Milletler Destek Merkezi"
                        )
                        .setDescription(
                            "Destek almak iÃ§in aÅŸaÄŸÄ±daki kategorilerden uygun olanÄ± seÃ§in."
                        )
                        .addFields(
                            {
                                name:
                                    "ðŸª– Ordu Åžikayet",
                                value:
                                    "Ordu, personel ve oyun iÃ§i askeri konular."
                            },
                            {
                                name:
                                    "ðŸ› ï¸ Sunucu Ä°Ã§i Sorun",
                                value:
                                    "Discord, roller, kanallar, bot ve sunucu sorunlarÄ±."
                            },
                            {
                                name:
                                    "ðŸŽŸï¸ Gamepass",
                                value:
                                    "Gamepass satÄ±n alma, teslimat ve destek sorunlarÄ±."
                            },
                            {
                                name:
                                    "âš ï¸ Ticket KurallarÄ±",
                                value:
                                    "Gereksiz ticket aÃ§mayÄ±n.\n" +
                                    "SaygÄ±lÄ± olun.\n" +
                                    "Sahte ÅŸikayet oluÅŸturmayÄ±n.\n" +
                                    "Spam yapmayÄ±n.\n" +
                                    "DoÄŸru bilgileri paylaÅŸÄ±n.\n" +
                                    "Kategori dÄ±ÅŸÄ± ticket aÃ§mayÄ±n."
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
                            "Ticket Paneli OluÅŸturuldu",
                            `Panel baÅŸarÄ±yla gÃ¶nderildi.\n\n**Sebep:** ${reason}`
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
                    "Ä°ÅŸlem BaÅŸarÄ±sÄ±z",
                    `Bir hata oluÅŸtu.\n\n\`${error.message}\``
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