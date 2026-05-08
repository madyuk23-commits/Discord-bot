const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const { Player } = require('discord-music-player');
const express = require('express');

// ===== ID ДЛЯ НАСТРОЙКИ (ЗАМЕНИТЕ ЭТИ ДВА ЗНАЧЕНИЯ!) =====
const CLIENT_ID = '1502358354851397793';           // ID приложения из Discord Developer Portal
const TARGET_CHANNEL_ID = '1412488974806552720';     // ID канала для команды /news (цифры)
// ============================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Простой веб-сервер для Render (обязательное требование)
app.get('/', (req, res) => {
    res.send('Бот работает!');
});
app.listen(PORT, () => {
    console.log(`✅ Веб-сервер запущен на порту ${PORT}`);
});

// Создание Discord клиента
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

// Инициализация музыкального плеера
const player = new Player(client, {
    leaveOnEmpty: false,
    leaveOnEnd: true,
    leaveOnStop: true,
    volume: 100
});
client.player = player;

// Регистрация слеш-команд
const commands = [
    { name: 'play', description: 'Включить музыку по ссылке или названию', options: [{ name: 'query', description: 'Ссылка или название', type: 3, required: true }] },
    { name: 'skip', description: 'Пропустить текущий трек' },
    { name: 'stop', description: 'Остановить музыку' },
    { name: 'pause', description: 'Пауза' },
    { name: 'resume', description: 'Продолжить' },
    { name: 'queue', description: 'Показать очередь' },
    { name: 'volume', description: 'Громкость (0-200)', options: [{ name: 'level', type: 4, required: true }] },
    { name: 'news', description: 'Отправить новость с пингом', options: [
        { name: 'text', type: 3, required: true, description: 'Текст новости' },
        { name: 'ping', type: 3, required: true, description: 'ID роли или @роль' },
        { name: 'from_whom', type: 3, required: true, description: 'От кого новость' }
    ]}
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 Регистрация слеш-команд...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Слеш-команды зарегистрированы!');
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
    }
})();

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, member, guild, options } = interaction;

    // МУЗЫКА
    if (commandName === 'play') {
        await interaction.deferReply();
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) return interaction.editReply('❌ Вы не в голосовом канале!');
        const query = options.getString('query');
        try {
            let queue = player.getQueue(guild.id);
            if (!queue) {
                queue = player.createQueue(guild.id);
                await queue.join(voiceChannel);
            }
            const song = await queue.play(query).catch(e => null);
            if (!song) return interaction.editReply('❌ Ошибка воспроизведения');
            interaction.editReply(`🎵 Добавлено: **${song.name}**`);
        } catch { interaction.editReply('❌ Ошибка'); }
    }
    if (commandName === 'skip') {
        const queue = player.getQueue(guild.id);
        if (!queue?.isPlaying) return interaction.reply('❌ Ничего нет');
        queue.skip();
        interaction.reply('⏭️ Пропущено');
    }
    if (commandName === 'stop') {
        const queue = player.getQueue(guild.id);
        if (!queue) return interaction.reply('❌ Не в голосовом');
        queue.stop();
        interaction.reply('🛑 Остановлено');
    }
    if (commandName === 'pause') {
        const queue = player.getQueue(guild.id);
        if (!queue?.isPlaying) return interaction.reply('❌ Ничего нет');
        queue.setPaused(true);
        interaction.reply('⏸️ Пауза');
    }
    if (commandName === 'resume') {
        const queue = player.getQueue(guild.id);
        if (!queue?.isPlaying) return interaction.reply('❌ Ничего нет');
        queue.setPaused(false);
        interaction.reply('▶️ Продолжаем');
    }
    if (commandName === 'queue') {
        const queue = player.getQueue(guild.id);
        if (!queue?.songs.length) return interaction.reply('📭 Очередь пуста');
        const list = queue.songs.slice(0, 10).map((s, i) => `${i+1}. **${s.name}**`).join('\n');
        interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎵 Очередь').setDescription(list)] });
    }
    if (commandName === 'volume') {
        const queue = player.getQueue(guild.id);
        if (!queue) return interaction.reply('❌ Не в голосовом');
        const level = options.getInteger('level');
        if (level < 0 || level > 200) return interaction.reply('❌ От 0 до 200');
        queue.setVolume(level);
        interaction.reply(`🔊 Громкость: ${level}%`);
    }

    // НОВОСТИ
    if (commandName === 'news') {
        const text = options.getString('text');
        const ping = options.getString('ping');
        const fromWhom = options.getString('from_whom');
        const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
        if (!targetChannel) return interaction.reply({ content: '❌ Канал не найден', ephemeral: true });
        const roleMention = /^\d+$/.test(ping) ? `<@&${ping}>` : ping;
        const embed = new EmbedBuilder()
            .setTitle('📢 Новость')
            .setDescription(text)
            .setColor(0x5865F2)
            .addFields({ name: 'От', value: fromWhom, inline: true });
        await targetChannel.send({ content: roleMention, embeds: [embed] });
        interaction.reply({ content: `✅ Отправлено в ${targetChannel.toString()}`, ephemeral: true });
    }
});

client.login(process.env.TOKEN);
