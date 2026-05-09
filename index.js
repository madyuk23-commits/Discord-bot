const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, PermissionsBitField } = require('discord.js');
const ms = require('ms');
const { GiveawaysManager } = require('discord-giveaways');
const noblox = require('noblox.js');
const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei');

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

// ========== МУЗЫКАЛЬНАЯ СИСТЕМА ==========
const player = new Player(client, {
    leaveOnEmpty: true,
    leaveOnEnd: true,
    leaveOnStop: true,
    volume: 50
});

client.player = player;

// Регистрируем YouTube экстрактор
(async () => {
    try {
        await player.extractors.register(YoutubeiExtractor, {});
        console.log('✅ YouTube экстрактор загружен!');
    } catch (error) {
        console.error('❌ Ошибка загрузки экстрактора:', error);
    }
})();

// События плеера
player.events.on('playerStart', (queue, track) => {
    if (queue.metadata?.channel) {
        queue.metadata.channel.send(`🎵 Начинаю играть: **${track.title}**`);
    }
});

player.events.on('playerError', (queue, error) => {
    console.error(`❌ Ошибка: ${error.message}`);
    if (queue.metadata?.channel) {
        queue.metadata.channel.send(`❌ Ошибка: ${error.message}`);
    }
});
// ========================================

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
// ========================================

// Хранилище предупреждений
const warnings = new Map();

// ========== ВСЕ КОМАНДЫ ==========
const commands = [
    {
        name: 'news',
        description: 'Отправить новость с пингом в указанный канал',
        options: [
            { name: 'text', type: 3, required: true, description: 'Текст новости' },
            { name: 'ping', type: 3, required: true, description: 'ID роли или @роль' },
            { name: 'from_whom', type: 3, required: true, description: 'От кого новость' }
        ]
    },
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
    {
        name: 'kick',
        description: 'Кикнуть пользователя',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
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
    {
        name: 'clear',
        description: 'Очистить сообщения в канале',
        options: [
            { name: 'amount', type: 4, required: true, description: 'Количество сообщений (1-100)' }
        ]
    },
    {
        name: 'timeout',
        description: 'Выдать тайм-аут пользователю',
        options: [
            { name: 'user', type: 6, required: true, description: 'Пользователь' },
            { name: 'duration', type: 3, required: true, description: 'Длительность (1m, 1h, 1d, 1w)' },
            { name: 'reason', type: 3, required: false, description: 'Причина' }
        ]
    },
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
    {
        name: 'begemot',
        description: 'Отправить сообщение от Бегемота в указанный канал с пингом @everyone',
        options: [
            { name: 'channel_id', type: 3, required: true, description: 'ID канала, куда отправить сообщение' }
        ]
    },
    {
        name: 'roblox',
        description: 'Получить информацию о пользователе Roblox',
        options: [
            { name: 'username', type: 3, required: true, description: 'Имя пользователя Roblox' }
        ]
    },
    {
        name: 'play',
        description: 'Включить музыку по ссылке или названию',
        options: [
            { name: 'query', type: 3, required: true, description: 'Название трека или ссылка YouTube' }
        ]
    },
    { name: 'skip', description: 'Пропустить текущий трек' },
    { name: 'stop', description: 'Остановить музыку и очистить очередь' },
    { name: 'pause', description: 'Поставить музыку на паузу' },
    { name: 'resume', description: 'Возобновить воспроизведение музыки' },
    { name: 'queue', description: 'Показать текущую очередь треков' },
    {
        name: 'volume',
        description: 'Изменить громкость',
        options: [
            { name: 'level', type: 4, required: true, description: 'Громкость от 0 до 100' }
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

// ========== ФУНКЦИЯ ПРОВЕРКИ ПРАВ ==========
function hasModPermissions(member) {
    return member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
           member.permissions.has(PermissionsBitField.Flags.Administrator);
}

// ========== ЗАПУСК БОТА ==========
client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
});

// ========== ОБРАБОТЧИК КОМАНД ==========
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, options, member, guild } = interaction;

    // PLAY
    if (commandName === 'play') {
        if (!member.voice.channel) {
            return interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
        }

        const query = options.getString('query');
        await interaction.deferReply();

        try {
            const { track } = await player.play(member.voice.channel, query, {
                requestedBy: interaction.user,
                nodeOptions: {
                    metadata: { channel: interaction.channel },
                    volume: 50
                }
            });
            return interaction.editReply(`🎵 **${track.title}** добавлен в очередь!`);
        } catch (error) {
            console.error(error);
            return interaction.editReply(`❌ Ошибка: ${error.message}`);
        }
    }

    // SKIP
    if (commandName === 'skip') {
        const queue = player.nodes.get(guild.id);
        if (!queue?.isPlaying()) return interaction.reply({ content: '❌ Сейчас ничего не играет!', ephemeral: true });
        queue.node.skip();
        return interaction.reply('⏭ Трек пропущен!');
    }

    // STOP
    if (commandName === 'stop') {
        const queue = player.nodes.get(guild.id);
        if (!queue) return interaction.reply({ content: '❌ Бот не в голосовом канале!', ephemeral: true });
        queue.delete();
        return interaction.reply('🛑 Остановлено!');
    }

    // PAUSE
    if (commandName === 'pause') {
        const queue = player.nodes.get(guild.id);
        if (!queue?.isPlaying()) return interaction.reply({ content: '❌ Сейчас ничего не играет!', ephemeral: true });
        queue.node.setPaused(true);
        return interaction.reply('⏸ Пауза');
    }

    // RESUME
    if (commandName === 'resume') {
        const queue = player.nodes.get(guild.id);
        if (!queue?.isPlaying()) return interaction.reply({ content: '❌ Сейчас ничего не играет!', ephemeral: true });
        queue.node.setPaused(false);
        return interaction.reply('▶ Возобновлено');
    }

    // QUEUE
    if (commandName === 'queue') {
        const queue = player.nodes.get(guild.id);
        if (!queue?.tracks?.size) return interaction.reply({ content: '📭 Очередь пуста.', ephemeral: true });
        
        const list = queue.tracks.slice(0, 10).map((t, i) => `${i+1}. ${t.title}`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle('🎵 Очередь')
            .setDescription(`**Сейчас:** ${queue.currentTrack?.title}\n\n**Далее:**\n${list}`)
            .setColor(0x00AE86);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // VOLUME
    if (commandName === 'volume') {
        const queue = player.nodes.get(guild.id);
        if (!queue) return interaction.reply({ content: '❌ Бот не в голосовом канале!', ephemeral: true });
        const level = options.getInteger('level');
        if (level < 0 || level > 100) return interaction.reply({ content: '❌ От 0 до 100', ephemeral: true });
        queue.node.setVolume(level);
        return interaction.reply(`🔊 Громкость: ${level}%`);
    }

    // NEWS
    if (commandName === 'news') {
        const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
        if (!targetChannel) return interaction.reply({ content: '❌ Канал не найден', ephemeral: true });
        
        const text = options.getString('text');
        const ping = options.getString('ping');
        const fromWhom = options.getString('from_whom');
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
        return interaction.reply({ content: `✅ Отправлено!`, ephemeral: true });
    }

    // BEGEMOT
    if (commandName === 'begemot') {
        const channelId = options.getString('channel_id');
        const targetChannel = client.channels.cache.get(channelId);
        if (!targetChannel) return interaction.reply({ content: '❌ Канал не найден', ephemeral: true });
        
        const message = `🦛 **БЕГЕМОТ ГОВОРИТ:**\n\nПривет всем! 🦛\nНе забывайте улыбаться! ❤️`;
        await targetChannel.send({ content: `@everyone\n\n${message}`, allowedMentions: { parse: ['everyone'] } });
        return interaction.reply({ content: `✅ Отправлено в ${targetChannel.toString()}`, ephemeral: true });
    }

    // ROBLOX
    if (commandName === 'roblox') {
        const username = options.getString('username');
        await interaction.deferReply();
        try {
            const userId = await noblox.getIdFromUsername(username);
            if (!userId) return interaction.editReply(`❌ Пользователь ${username} не найден`);
            
            const info = await noblox.getPlayerInfo(userId);
            const embed = new EmbedBuilder()
                .setTitle(`🎮 ${info.username}`)
                .setColor(0x00AE86)
                .addFields(
                    { name: '🆔 ID', value: `${userId}`, inline: true },
                    { name: '📅 На платформе с', value: new Date(info.joinDate).toLocaleDateString('ru-RU'), inline: true }
                )
                .setTimestamp();
            if (info.status) embed.addFields({ name: '🕒 Статус', value: info.status, inline: false });
            
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            return interaction.editReply('❌ Ошибка получения данных');
        }
    }

    // BAN
    if (commandName === 'ban' && hasModPermissions(member)) {
        const target = options.getUser('user');
        await guild.members.ban(target.id);
        return interaction.reply(`✅ ${target.tag} забанен`);
    }

    // KICK
    if (commandName === 'kick' && hasModPermissions(member)) {
        const target = options.getUser('user');
        const targetMember = await guild.members.fetch(target.id);
        await targetMember.kick();
        return interaction.reply(`✅ ${target.tag} кикнут`);
    }

    // MUTE
    if (commandName === 'mute' && hasModPermissions(member)) {
        const target = options.getUser('user');
        const duration = options.getString('duration');
        const targetMember = await guild.members.fetch(target.id);
        await targetMember.timeout(ms(duration));
        return interaction.reply(`✅ ${target.tag} замучен на ${duration}`);
    }

    // UNMUTE
    if (commandName === 'unmute' && hasModPermissions(member)) {
        const target = options.getUser('user');
        const targetMember = await guild.members.fetch(target.id);
        await targetMember.timeout(null);
        return interaction.reply(`✅ Мут снят с ${target.tag}`);
    }

    // CLEAR
    if (commandName === 'clear' && hasModPermissions(member)) {
        const amount = options.getInteger('amount');
        await interaction.channel.bulkDelete(amount);
        return interaction.reply(`✅ Удалено ${amount} сообщений`);
    }

    // GIVEAWAY CREATE
    if (commandName === 'giveaway' && hasModPermissions(member)) {
        const channel = options.getChannel('channel');
        const duration = options.getString('duration');
        const winners = options.getInteger('winners');
        const prize = options.getString('prize');
        
        await client.giveawaysManager.start(channel, {
            duration: ms(duration),
            prize: prize,
            winnerCount: winners,
            hostedBy: interaction.user,
            messages: {
                giveaway: '🎉 **РОЗЫГРЫШ** 🎉',
                invitation: 'Реагируй на 🎉!'
            }
        });
        return interaction.reply(`✅ Розыгрыш "${prize}" создан!`);
    }

    // GIVEAWAY REROLL
    if (commandName === 'reroll' && hasModPermissions(member)) {
        await client.giveawaysManager.reroll(options.getString('message_id'));
        return interaction.reply('✅ Победитель перевыбран');
    }

    // GIVEAWAY END
    if (commandName === 'endgiveaway' && hasModPermissions(member)) {
        await client.giveawaysManager.end(options.getString('message_id'));
        return interaction.reply('✅ Розыгрыш завершён');
    }

    // LIST GIVEAWAYS
    if (commandName === 'listgiveaways') {
        const active = client.giveawaysManager.giveaways.filter(g => g.guildId === guild.id && !g.ended);
        if (!active.length) return interaction.reply('📭 Нет активных розыгрышей');
        const list = active.map((g, i) => `${i+1}. **${g.prize}**`).join('\n');
        return interaction.reply(`📋 Активные розыгрыши:\n${list}`);
    }

    // WARN
    if (commandName === 'warn' && hasModPermissions(member)) {
        const target = options.getUser('user');
        const reason = options.getString('reason');
        const key = `${guild.id}-${target.id}`;
        if (!warnings.has(key)) warnings.set(key, []);
        warnings.get(key).push({ reason, moderator: interaction.user.tag, date: new Date() });
        return interaction.reply(`⚠️ Предупреждение ${target.tag}: ${reason}`);
    }

    // WARNINGS
    if (commandName === 'warnings' && hasModPermissions(member)) {
        const target = options.getUser('user');
        const key = `${guild.id}-${target.id}`;
        const list = warnings.get(key) || [];
        if (!list.length) return interaction.reply(`✅ Нет предупреждений у ${target.tag}`);
        const text = list.map((w, i) => `${i+1}. ${w.reason} (${w.moderator})`).join('\n');
        return interaction.reply(`⚠️ Предупреждения ${target.tag}:\n${text}`);
    }

    // CLEARWARNINGS
    if (commandName === 'clearwarnings' && hasModPermissions(member)) {
        const target = options.getUser('user');
        const key = `${guild.id}-${target.id}`;
        warnings.delete(key);
        return interaction.reply(`✅ Очищены предупреждения ${target.tag}`);
    }
});

client.login(TOKEN);
