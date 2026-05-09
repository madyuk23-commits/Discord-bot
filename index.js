const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const ms = require('ms');
const { GiveawaysManager } = require('discord-giveaways');
const roblox = require('roblox-api-discord');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Бот работает!'));
app.listen(PORT, () => console.log(`✅ Веб-сервер на порту ${PORT}`));

// ===== НАСТРОЙКИ =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
// =====================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// ========== СИСТЕМА РОЗЫГРЫШЕЙ ==========
const GiveawayManager = new GiveawaysManager(client, {
    storage: './giveaways.json',
    default: {
        botsCanWin: false,
        embedColor: 0x00AE86,
        embedColorEnd: 0xFF0000,
        reaction: '🎉'
    }
});

client.giveawaysManager = GiveawayManager;

GiveawayManager.on('giveawayReactionAdded', (giveaway, member, reaction) => {
    console.log(`${member.user.tag} участвует в розыгрыше "${giveaway.prize}"`);
});

GiveawayManager.on('giveawayReactionRemoved', (giveaway, member, reaction) => {
    console.log(`${member.user.tag} вышел из розыгрыша "${giveaway.prize}"`);
});

GiveawayManager.on('giveawayEnded', (giveaway, winners) => {
    const winnersList = winners.map(member => member.user.tag).join(', ');
    console.log(`Розыгрыш "${giveaway.prize}" завершён! Победители: ${winnersList}`);
});

GiveawayManager.on('giveawayRerolled', (giveaway, winners) => {
    console.log(`Розыгрыш "${giveaway.prize}" перевыбран! Новые победители: ${winners.map(m => m.user.tag).join(', ')}`);
});
// ========================================

// Хранилище предупреждений
const warnings = new Map();

// ========== ВСЕ КОМАНДЫ ==========
const commands = [
    // Новости
    {
        name: 'news',
        description: 'Отправить новость с пингом в указанный канал',
        options: [
            { name: 'text', type: 3, required: true, description: 'Текст новости' },
            { name: 'ping', type: 3, required: true, description: 'ID роли или @роль' },
            { name: 'from_whom', type: 3, required: true, description: 'От кого новость' }
        ]
    },
    // Баны
    {
        name: 'ban',
        description: 'Забанить пользователя',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
    {
        name: 'unban',
        description: 'Разбанить пользователя по ID',
        options: [
            { name: 'user_id', type: 3, required: true, description: 'ID пользователя' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
    // Мьюты
    {
        name: 'mute',
        description: 'Выдать мут пользователю',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'duration', type: 3, required: true, description: 'Длительность (10m, 1h, 1d)' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
    {
        name: 'unmute',
        description: 'Снять мут с пользователя',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
    // Кики
    {
        name: 'kick',
        description: 'Кикнуть пользователя',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
    // Предупреждения
    {
        name: 'warn',
        description: 'Выдать предупреждение',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'reason', type: 3, required: true, description: 'Причина' }
        ]
    },
    {
        name: 'warnings',
        description: 'Показать предупреждения пользователя',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' }
        ]
    },
    {
        name: 'clearwarnings',
        description: 'Очистить предупреждения пользователя',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' }
        ]
    },
    // Очистка чата
    {
        name: 'clear',
        description: 'Очистить сообщения в канале',
        options: [
            { name: 'amount', type: 4, required: true, description: 'Количество сообщений (1-100)' }
        ]
    },
    // Тайм-аут
    {
        name: 'timeout',
        description: 'Выдать тайм-аут пользователю',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'duration', type: 3, required: true, description: 'Длительность (1m, 1h, 1d, 1w)' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
    // Розыгрыши
    {
        name: 'giveaway',
        description: 'Создать розыгрыш',
        options: [
            { name: 'channel', type: 7, required: true, description: 'Канал для розыгрыша' },
            { name: 'duration', type: 3, required: true, description: 'Длительность (1h, 1d, 1w)' },
            { name: 'winners', type: 4, required: true, description: 'Количество победителей' },
            { name: 'prize', type: 3, required: true, description: 'Приз' },
            { name: 'description', type: 3, required: false, description: 'Дополнительное описание' }
        ]
    },
    {
        name: 'reroll',
        description: 'Перевыбрать победителя розыгрыша',
        options: [
            { name: 'message_id', type: 3, required: true, description: 'ID сообщения с розыгрышем' }
        ]
    },
    {
        name: 'endgiveaway',
        description: 'Завершить розыгрыш досрочно',
        options: [
            { name: 'message_id', type: 3, required: true, description: 'ID сообщения с розыгрышем' }
        ]
    },
    {
        name: 'listgiveaways',
        description: 'Показать активные розыгрыши на сервере'
    },
    // Бегемот
    {
        name: 'begemot',
        description: 'Отправить сообщение от Бегемота в указанный канал с пингом @everyone',
        options: [
            { name: 'channel_id', type: 3, required: true, description: 'ID канала, куда отправить сообщение' }
        ]
    },
    // Roblox
    {
        name: 'roblox',
        description: 'Получить информацию о пользователе Roblox',
        options: [
            { name: 'username', type: 3, required: true, description: 'Имя пользователя Roblox' }
        ]
    }
];

// Регистрация команд
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Регистрация команд...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Команды зарегистрированы!');
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
    }
})();

// ========== ФУНКЦИИ ЛОГОВ ==========
async function sendLog(guild, action, target, moderator, reason, duration = null) {
    const logChannelId = LOG_CHANNEL_ID;
    
    if (!logChannelId) return;
    
    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    
    const embed = new EmbedBuilder()
        .setTitle(getActionTitle(action))
        .setColor(getActionColor(action))
        .addFields(
            { name: '👤 Пользователь', value: `${target.user?.tag || target.tag || target} (${target.id || target})`, inline: true },
            { name: '🛡️ Модератор', value: `${moderator.user?.tag || moderator.tag}`, inline: true },
            { name: '📝 Причина', value: reason || 'Не указана', inline: false }
        )
        .setTimestamp();
    
    if (duration) {
        embed.addFields({ name: '⏱️ Длительность', value: duration, inline: true });
    }
    
    try {
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error(`❌ Ошибка отправки лога: ${error.message}`);
    }
}

function getActionTitle(action) {
    const titles = {
        'Бан': '🔨 БАН',
        'Разбан': '🔓 РАЗБАН',
        'Кик': '👢 КИК',
        'Мут': '🔇 МУТ',
        'Размут': '🔊 СНЯТИЕ МУТА',
        'Предупреждение': '⚠️ ПРЕДУПРЕЖДЕНИЕ',
        'Тайм-аут': '⏰ ТАЙМ-АУТ',
        'Очистка чата': '🧹 ОЧИСТКА ЧАТА',
        'Очистка предупреждений': '🗑️ ОЧИСТКА ПРЕДУПРЕЖДЕНИЙ'
    };
    return titles[action] || `🔨 ${action}`;
}

function getActionColor(action) {
    const colors = {
        'Бан': 0xFF0000,
        'Разбан': 0x00FF00,
        'Мут': 0xFFA500,
        'Размут': 0x00FF00,
        'Кик': 0xFF0000,
        'Предупреждение': 0xFFA500,
        'Тайм-аут': 0xFFA500,
        'Очистка чата': 0x00AAFF
    };
    return colors[action] || 0x5865F2;
}

function hasModPermissions(member) {
    return member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
           member.permissions.has(PermissionsBitField.Flags.Administrator);
}

// ========== ЗАПУСК БОТА ==========
client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`📢 Канал новостей: ${TARGET_CHANNEL_ID}`);
    console.log(`📋 Канал логов: ${LOG_CHANNEL_ID || 'не задан'}`);
    console.log(`🎮 Roblox команда /roblox загружена!`);
});

// ========== ОБРАБОТЧИК КОМАНД ==========
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, options, member, guild, user } = interaction;

    // ========== НОВОСТИ ==========
    if (commandName === 'news') {
        const text = options.getString('text');
        const ping = options.getString('ping');
        const fromWhom = options.getString('from_whom');
        
        const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
        if (!targetChannel) {
            return interaction.reply({ content: '❌ Канал не найден', ephemeral: true });
        }
        
        const roleMention = /^\d+$/.test(ping) ? `<@&${ping}>` : ping;
        
        const embed = new EmbedBuilder()
            .setTitle('📢 Новость')
            .setDescription(text)
            .setColor(0x5865F2)
            .addFields(
                { name: '📌 От', value: fromWhom, inline: true },
                { name: '👤 Автор', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();
        
        await targetChannel.send({ content: roleMention, embeds: [embed] });
        interaction.reply({ content: `✅ Отправлено в ${targetChannel.toString()}`, ephemeral: true });
    }

    // ========== ПРОВЕРКА ПРАВ ДЛЯ МОДЕРАЦИИ ==========
    if (['ban', 'unban', 'kick', 'mute', 'unmute', 'warn', 'clearwarnings', 'timeout', 'clear'].includes(commandName)) {
        if (!hasModPermissions(member)) {
            return interaction.reply({ content: '❌ Недостаточно прав!', ephemeral: true });
        }
    }

    // ========== БАН ==========
    if (commandName === 'ban') {
        const targetUser = options.getUser('user');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            await guild.members.ban(targetUser.id, { reason: `${reason} (Модератор: ${user.tag})` });
            await sendLog(guild, 'Бан', targetUser, user, reason);
            interaction.reply({ content: `✅ ${targetUser.tag} забанен`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== РАЗБАН ==========
    if (commandName === 'unban') {
        const userId = options.getString('user_id');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            const bans = await guild.bans.fetch();
            const bannedUser = bans.find(ban => ban.user.id === userId);
            
            if (!bannedUser) {
                return interaction.reply({ content: '❌ Пользователь не найден в банах', ephemeral: true });
            }
            
            await guild.members.unban(userId, reason);
            await sendLog(guild, 'Разбан', bannedUser.user, user, reason);
            interaction.reply({ content: `✅ ${bannedUser.user.tag} разбанен`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== КИК ==========
    if (commandName === 'kick') {
        const targetUser = options.getUser('user');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            await targetMember.kick(`${reason} (Модератор: ${user.tag})`);
            await sendLog(guild, 'Кик', targetUser, user, reason);
            interaction.reply({ content: `✅ ${targetUser.tag} кикнут`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== МУТ ==========
    if (commandName === 'mute') {
        const targetUser = options.getUser('user');
        const duration = options.getString('duration');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            const msDuration = ms(duration);
            
            if (!msDuration || msDuration < 60000) {
                return interaction.reply({ content: '❌ Минимум 1 минута', ephemeral: true });
            }
            
            await targetMember.timeout(msDuration, `${reason} (Модератор: ${user.tag})`);
            await sendLog(guild, 'Мут', targetUser, user, reason, duration);
            interaction.reply({ content: `✅ ${targetUser.tag} замучен на ${duration}`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== СНЯТЬ МУТ ==========
    if (commandName === 'unmute') {
        const targetUser = options.getUser('user');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            await targetMember.timeout(null, `${reason} (Модератор: ${user.tag})`);
            await sendLog(guild, 'Размут', targetUser, user, reason);
            interaction.reply({ content: `✅ Мут снят с ${targetUser.tag}`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== ТАЙМ-АУТ ==========
    if (commandName === 'timeout') {
        const targetUser = options.getUser('user');
        const duration = options.getString('duration');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            const msDuration = ms(duration);
            
            if (!msDuration) {
                return interaction.reply({ content: '❌ Неверный формат (1m, 1h, 1d)', ephemeral: true });
            }
            
            await targetMember.timeout(msDuration, `${reason} (Модератор: ${user.tag})`);
            await sendLog(guild, 'Тайм-аут', targetUser, user, reason, duration);
            interaction.reply({ content: `✅ Тайм-аут ${targetUser.tag} на ${duration}`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== ПРЕДУПРЕЖДЕНИЕ ==========
    if (commandName === 'warn') {
        const targetUser = options.getUser('user');
        const reason = options.getString('reason');
        
        const key = `${guild.id}-${targetUser.id}`;
        if (!warnings.has(key)) warnings.set(key, []);
        
        const userWarnings = warnings.get(key);
        userWarnings.push({ reason, moderator: user.tag, date: new Date().toISOString() });
        warnings.set(key, userWarnings);
        
        await sendLog(guild, 'Предупреждение', targetUser, user, reason);
        
        try {
            await targetUser.send(`⚠️ Предупреждение на ${guild.name}\nПричина: ${reason}\nВсего: ${userWarnings.length}`);
        } catch (e) {}
        
        interaction.reply({ content: `⚠️ Предупреждение ${targetUser.tag}. Причина: ${reason} (${userWarnings.length})`, ephemeral: true });
    }

    // ========== ПОКАЗАТЬ ПРЕДУПРЕЖДЕНИЯ ==========
    if (commandName === 'warnings') {
        const targetUser = options.getUser('user');
        const key = `${guild.id}-${targetUser.id}`;
        const userWarnings = warnings.get(key) || [];
        
        if (userWarnings.length === 0) {
            return interaction.reply({ content: `✅ Нет предупреждений у ${targetUser.tag}`, ephemeral: true });
        }
        
        const warnList = userWarnings.map((w, i) => `${i+1}. ${w.reason} — ${w.moderator} (${new Date(w.date).toLocaleString()})`).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Предупреждения ${targetUser.tag}`)
            .setDescription(warnList)
            .setColor(0xFFA500)
            .setFooter({ text: `Всего: ${userWarnings.length}` });
        
        interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ========== ОЧИСТИТЬ ПРЕДУПРЕЖДЕНИЯ ==========
    if (commandName === 'clearwarnings') {
        const targetUser = options.getUser('user');
        const key = `${guild.id}-${targetUser.id}`;
        
        if (!warnings.has(key)) {
            return interaction.reply({ content: `❌ Нет предупреждений у ${targetUser.tag}`, ephemeral: true });
        }
        
        warnings.delete(key);
        await sendLog(guild, 'Очистка предупреждений', targetUser, user, 'Все предупреждения удалены');
        interaction.reply({ content: `✅ Очищены предупреждения ${targetUser.tag}`, ephemeral: true });
    }

    // ========== ОЧИСТКА ЧАТА ==========
    if (commandName === 'clear') {
        const amount = options.getInteger('amount');
        
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: '❌ От 1 до 100 сообщений', ephemeral: true });
        }
        
        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            await sendLog(guild, 'Очистка чата', `#${interaction.channel.name}`, user, `${deleted.size} сообщений`);
            interaction.reply({ content: `✅ Удалено ${deleted.size} сообщений`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== РОЗЫГРЫШИ ==========
    if (commandName === 'giveaway') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator) && 
            !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ Нужны права "Управление сервером"', ephemeral: true });
        }
        
        const channel = options.getChannel('channel');
        const durationRaw = options.getString('duration');
        const winners = options.getInteger('winners');
        const prize = options.getString('prize');
        const description = options.getString('description') || 'Нажми на 🎉!';
        
        if (!channel.isTextBased()) {
            return interaction.reply({ content: '❌ Канал должен быть текстовым', ephemeral: true });
        }
        
        const durationMs = ms(durationRaw);
        if (!durationMs || durationMs < 60000) {
            return interaction.reply({ content: '❌ Минимум 1 минута', ephemeral: true });
        }
        
        if (winners < 1 || winners > 10) {
            return interaction.reply({ content: '❌ Победителей: 1-10', ephemeral: true });
        }
        
        try {
            await client.giveawaysManager.start(channel, {
                duration: durationMs,
                prize: prize,
                winnerCount: winners,
                hostedBy: interaction.user,
                description: description,
                messages: {
                    giveaway: '🎉 **РОЗЫГРЫШ** 🎉',
                    giveawayEnded: '🎉 **РОЗЫГРЫШ ЗАВЕРШЁН** 🎉',
                    invitation: 'Реагируй на 🎉!',
                    drawing: 'Осталось: {timestamp}',
                    embedFooter: `Создал: ${interaction.user.tag}`,
                    noWinner: '❌ Недостаточно участников',
                    winners: '🏆 Победитель(и):',
                    endedAt: 'Завершён'
                }
            });
            
            interaction.reply({ content: `✅ Розыгрыш "${prize}" создан в ${channel}`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    if (commandName === 'reroll') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator) && 
            !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ Недостаточно прав', ephemeral: true });
        }
        
        const messageId = options.getString('message_id');
        
        try {
            await client.giveawaysManager.reroll(messageId);
            interaction.reply({ content: '✅ Победитель перевыбран', ephemeral: true });
        } catch (error) {
            interaction.reply({ content: '❌ Розыгрыш не найден', ephemeral: true });
        }
    }

    if (commandName === 'endgiveaway') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator) && 
            !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ Недостаточно прав', ephemeral: true });
        }
        
        const messageId = options.getString('message_id');
        
        try {
            await client.giveawaysManager.end(messageId);
            interaction.reply({ content: '✅ Розыгрыш завершён', ephemeral: true });
        } catch (error) {
            interaction.reply({ content: '❌ Розыгрыш не найден', ephemeral: true });
        }
    }

    if (commandName === 'listgiveaways') {
        const activeGiveaways = client.giveawaysManager.giveaways.filter(
            g => g.guildId === interaction.guildId && !g.ended
        );
        
        if (activeGiveaways.length === 0) {
            return interaction.reply({ content: '📭 Нет активных розыгрышей', ephemeral: true });
        }
        
        const list = activeGiveaways.map((g, i) => `${i+1}. **${g.prize}** — <#${g.channelId}> (участников: ${g.participantsCount || 0})`).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('🎁 Активные розыгрыши')
            .setDescription(list)
            .setColor(0x00AE86);
        
        interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ========== БЕГЕМОТ ==========
    if (commandName === 'begemot') {
        const targetChannelId = options.getString('channel_id');
        
        if (!targetChannelId || !/^\d+$/.test(targetChannelId)) {
            return interaction.reply({ content: '❌ Укажите ID канала', ephemeral: true });
        }
        
        const targetChannel = client.channels.cache.get(targetChannelId);
        
        if (!targetChannel) {
            return interaction.reply({ content: `❌ Канал ${targetChannelId} не найден`, ephemeral: true });
        }
        
        if (!targetChannel.isTextBased()) {
            return interaction.reply({ content: '❌ Канал должен быть текстовым', ephemeral: true });
        }
        
        const messageText = `**🦛 БЕГЕМОТ ГОВОРИТ:**\n\nПривет всем! Я большой и добрый бегемот! 🦛\nНе забывайте улыбаться и радоваться жизни! ❤️\n\n*С любовью, ваш Бегемот*`;
        
        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has(PermissionsBitField.Flags.MentionEveryone)) {
            return interaction.reply({ content: '❌ У бота нет права @everyone', ephemeral: true });
        }
        
        try {
            await targetChannel.send({
                content: `@everyone\n\n${messageText}`,
                allowedMentions: { parse: ['everyone'] }
            });
            
            interaction.reply({ content: `✅ Отправлено в ${targetChannel.toString()}`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== ROBLOX ИНФОРМАЦИЯ ==========
    if (commandName === 'roblox') {
        const robloxUsername = options.getString('username');
        
        await interaction.deferReply();

        try {
            const userInfo = await roblox.getUser(robloxUsername, 'username');
            
            if (!userInfo || !userInfo.id) {
                return interaction.editReply(`❌ Пользователь с именем **${robloxUsername}** не найден на Roblox.`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎮 Информация о ${userInfo.username}`)
                .setColor(0x00AE86)
                .setThumbnail(userInfo.avatar_url || 'https://www.roblox.com/favicon.ico')
                .addFields(
                    { name: '🆔 ID', value: `${userInfo.id}`, inline: true },
                    { name: '👤 Имя', value: userInfo.username, inline: true },
                    { name: '📅 На платформе с', value: new Date(userInfo.created).toLocaleDateString('ru-RU'), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Запросил: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            if (userInfo.status && userInfo.status !== '') {
                embed.addFields({ name: '🕒 Статус', value: userInfo.status, inline: false });
            }
            
            if (userInfo.description && userInfo.description !== '') {
                embed.addFields({ name: '📝 О себе', value: userInfo.description.substring(0, 500), inline: false });
            }

            if (userInfo.followers && userInfo.followers.count !== undefined) {
                embed.addFields({ name: '👥 Подписчиков', value: `${userInfo.followers.count}`, inline: true });
            }
            
            if (userInfo.following && userInfo.following.count !== undefined) {
                embed.addFields({ name: '📡 Подписок', value: `${userInfo.following.count}`, inline: true });
            }
            
            if (userInfo.friends && userInfo.friends.count !== undefined) {
                embed.addFields({ name: '🤝 Друзей', value: `${userInfo.friends.count}`, inline: true });
            }

            await interaction.editReply({ embeds: [embed] });

            if (LOG_CHANNEL_ID) {
                const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🌐 Roblox Команда')
                        .setColor(0x00AE86)
                        .addFields(
                            { name: '👤 Пользователь', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '🔍 Запрос', value: robloxUsername, inline: true },
                            { name: '📊 Результат', value: `✅ Найден (ID: ${userInfo.id})`, inline: true }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

        } catch (error) {
            console.error(`Ошибка получения данных о Roblox:`, error);
            if (error.message && error.message.includes("does't exist")) {
                return interaction.editReply(`❌ Пользователь с именем **${robloxUsername}** не найден на Roblox.`);
            }
            await interaction.editReply(`❌ Произошла ошибка при получении данных. Пожалуйста, попробуйте позже.`);
        }
    }
});

// ========== ЗАПУСК ==========
client.login(TOKEN);
