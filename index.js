const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const ms = require('ms');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Бот работает!'));
app.listen(PORT, () => console.log(`✅ Веб-сервер на порту ${PORT}`));

// ===== НАСТРОЙКИ =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID; // Канал для новостей
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;       // Канал для логов модерации
// =====================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers  // Нужен для модерации
    ]
});

// Хранилище предупреждений (в реальном проекте используй БД)
const warnings = new Map(); // guildId-userId -> [{reason, moderator, date}]

// Команды модерации
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
    // Тайм-аут (новая функция Discord)
    {
        name: 'timeout',
        description: 'Выдать тайм-аут пользователю',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'duration', type: 3, required: true, description: 'Длительность (1m, 1h, 1d, 1w)' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    }
];

// Регистрация команд
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Регистрация команд...');
        await rest.put(Routes.applicationCommands(CLIENT_ID, '1412466769901129801'), { body: commands });
        console.log('✅ Команды зарегистрированы!');
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
    }
})();

// Функция отправки логов
async function sendLog(guild, action, target, moderator, reason, duration = null) {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(`🔨 ${action}`)
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

    await logChannel.send({ embeds: [embed] });
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

// Проверка прав модератора
function hasModPermissions(member) {
    return member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
           member.permissions.has(PermissionsBitField.Flags.Administrator);
}

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`📢 Канал для новостей: ${TARGET_CHANNEL_ID}`);
    console.log(`📋 Канал для логов: ${LOG_CHANNEL_ID}`);
});

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
            .setTitle('📢 Новость / Объявление')
            .setDescription(text)
            .setColor(0x5865F2)
            .addFields(
                { name: '📌 От', value: fromWhom, inline: true },
                { name: '👤 Автор', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();
        
        await targetChannel.send({ content: roleMention, embeds: [embed] });
        interaction.reply({ content: `✅ Новость отправлена в ${targetChannel.toString()}`, ephemeral: true });
    }

    // ========== МОДЕРАЦИЯ (проверка прав) ==========
    if (['ban', 'unban', 'kick', 'mute', 'unmute', 'warn', 'clearwarnings', 'timeout', 'clear'].includes(commandName)) {
        if (!hasModPermissions(member)) {
            return interaction.reply({ 
                content: '❌ У вас нет прав на использование этой команды (нужны права "Модерировать участников")', 
                ephemeral: true 
            });
        }
    }

    // ========== БАН ==========
    if (commandName === 'ban') {
        const targetUser = options.getUser('user');
        const reason = options.getString('reason') || 'Не указана';
        
        if (!targetUser) return interaction.reply({ content: '❌ Пользователь не найден', ephemeral: true });
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            if (targetMember && !targetMember.bannable) {
                return interaction.reply({ content: '❌ Я не могу забанить этого пользователя', ephemeral: true });
            }
            
            await guild.members.ban(targetUser.id, { reason: `${reason} (Модератор: ${user.tag})` });
            await sendLog(guild, 'Бан', targetUser, user, reason);
            interaction.reply({ content: `✅ ${targetUser.tag} забанен. Причина: ${reason}`, ephemeral: true });
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
            interaction.reply({ content: `✅ Пользователь ${bannedUser.user.tag} разбанен`, ephemeral: true });
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
            
            if (!targetMember.kickable) {
                return interaction.reply({ content: '❌ Я не могу кикнуть этого пользователя', ephemeral: true });
            }
            
            await targetMember.kick(`${reason} (Модератор: ${user.tag})`);
            await sendLog(guild, 'Кик', targetUser, user, reason);
            interaction.reply({ content: `✅ ${targetUser.tag} кикнут. Причина: ${reason}`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== МУТ (через роль) ==========
    if (commandName === 'mute') {
        const targetUser = options.getUser('user');
        const duration = options.getString('duration');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            const msDuration = ms(duration);
            
            if (!msDuration || msDuration < 60000) {
                return interaction.reply({ content: '❌ Минимальная длительность мута - 1 минута', ephemeral: true });
            }
            
            if (msDuration > 28 * 24 * 60 * 60 * 1000) {
                return interaction.reply({ content: '❌ Максимальная длительность мута - 28 дней', ephemeral: true });
            }
            
            await targetMember.timeout(msDuration, `${reason} (Модератор: ${user.tag})`);
            await sendLog(guild, 'Тайм-аут', targetUser, user, reason, duration);
            interaction.reply({ content: `✅ ${targetUser.tag} получил мут на ${duration}. Причина: ${reason}`, ephemeral: true });
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

    // ========== ТАЙМ-АУТ (альтернативный) ==========
    if (commandName === 'timeout') {
        const targetUser = options.getUser('user');
        const duration = options.getString('duration');
        const reason = options.getString('reason') || 'Не указана';
        
        try {
            const targetMember = await guild.members.fetch(targetUser.id);
            const msDuration = ms(duration);
            
            if (!msDuration) {
                return interaction.reply({ content: '❌ Неверный формат длительности (1m, 1h, 1d, 1w)', ephemeral: true });
            }
            
            await targetMember.timeout(msDuration, `${reason} (Модератор: ${user.tag})`);
            await sendLog(guild, 'Тайм-аут', targetUser, user, reason, duration);
            interaction.reply({ content: `✅ ${targetUser.tag} получил тайм-аут на ${duration}`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }

    // ========== ПРЕДУПРЕЖДЕНИЕ ==========
    if (commandName === 'warn') {
        const targetUser = options.getUser('user');
        const reason = options.getString('reason');
        
        const key = `${guild.id}-${targetUser.id}`;
        if (!warnings.has(key)) {
            warnings.set(key, []);
        }
        
        const userWarnings = warnings.get(key);
        userWarnings.push({
            reason: reason,
            moderator: user.tag,
            date: new Date().toISOString()
        });
        warnings.set(key, userWarnings);
        
        await sendLog(guild, 'Предупреждение', targetUser, user, reason);
        
        // Личное сообщение пользователю
        try {
            await targetUser.send(`⚠️ Вы получили предупреждение на сервере **${guild.name}**\nПричина: ${reason}\nВсего предупреждений: ${userWarnings.length}`);
        } catch (e) {}
        
        interaction.reply({ content: `⚠️ Выдано предупреждение ${targetUser.tag}. Причина: ${reason} (Всего: ${userWarnings.length})`, ephemeral: true });
    }

    // ========== ПОКАЗАТЬ ПРЕДУПРЕЖДЕНИЯ ==========
    if (commandName === 'warnings') {
        const targetUser = options.getUser('user');
        const key = `${guild.id}-${targetUser.id}`;
        const userWarnings = warnings.get(key) || [];
        
        if (userWarnings.length === 0) {
            return interaction.reply({ content: `✅ У ${targetUser.tag} нет предупреждений`, ephemeral: true });
        }
        
        const warnList = userWarnings.map((w, i) => 
            `${i + 1}. **${w.reason}** — ${w.moderator} (${new Date(w.date).toLocaleString()})`
        ).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Предупреждения ${targetUser.tag}`)
            .setDescription(warnList)
            .setColor(0xFFA500)
            .setFooter({ text: `Всего: ${userWarnings.length}` });
        
        interaction.reply({ embeds: [embed], ephemeral: true });
   
    // Функция отправки логов (улучшенная)
async function sendLog(guild, action, target, moderator, reason, duration = null) {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    
    if (!logChannelId) {
        console.log('⚠️ LOG_CHANNEL_ID не задан в переменных окружения');
        return;
    }
    
    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) {
        console.log(`⚠️ Канал для логов ${logChannelId} не найден на сервере ${guild.name}`);
        return;
    }
    
    // Проверка прав бота в канале логов
    const botMember = guild.members.me;
    if (!logChannel.permissionsFor(botMember).has(PermissionsBitField.Flags.SendMessages)) {
        console.log(`⚠️ У бота нет прав писать в канал ${logChannel.name}`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(getActionTitle(action))
        .setColor(getActionColor(action))
        .addFields(
            { name: '👤 Пользователь', value: `${target.user?.tag || target.tag || target} (${target.id || target})`, inline: true },
            { name: '🛡️ Модератор', value: `${moderator.user?.tag || moderator.tag}`, inline: true },
            { name: '📝 Причина', value: reason || 'Не указана', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `ID: ${target.id || target}` });
    
    if (duration) {
        embed.addFields({ name: '⏱️ Длительность', value: duration, inline: true });
    }
    
    try {
        await logChannel.send({ embeds: [embed] });
        console.log(`✅ Лог отправлен в канал ${logChannel.name}`);
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
    
    
    
    
    
    
    }

    // ========== ОЧИСТИТЬ ПРЕДУПРЕЖДЕНИЯ ==========
    if (commandName === 'clearwarnings') {
        const targetUser = options.getUser('user');
        const key = `${guild.id}-${targetUser.id}`;
        
        if (!warnings.has(key)) {
            return interaction.reply({ content: `❌ У ${targetUser.tag} нет предупреждений`, ephemeral: true });
        }
        
        warnings.delete(key);
        await sendLog(guild, 'Очистка предупреждений', targetUser, user, 'Все предупреждения удалены');
        interaction.reply({ content: `✅ Очищены все предупреждения для ${targetUser.tag}`, ephemeral: true });
    }

    // ========== ОЧИСТКА ЧАТА ==========
    if (commandName === 'clear') {
        const amount = options.getInteger('amount');
        
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: '❌ Количество сообщений должно быть от 1 до 100', ephemeral: true });
        }
        
        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            await sendLog(guild, 'Очистка чата', `#${interaction.channel.name}`, user, `${deleted.size} сообщений`);
            interaction.reply({ content: `✅ Удалено ${deleted.size} сообщений`, ephemeral: true });
        } catch (error) {
            interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
        }
    }
});

client.login(TOKEN);
