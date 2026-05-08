const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Бот работает!'));
app.listen(PORT, () => console.log(`✅ Веб-сервер на порту ${PORT}`));

// ===== НАСТРОЙКИ (НЕ ТРОГАЙ - переменные из Render) =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
// =======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Регистрация команды /news
const commands = [
    {
        name: 'news',
        description: 'Отправить новость с пингом в указанный канал',
        options: [
            { name: 'text', type: 3, required: true, description: 'Текст новости' },
            { name: 'ping', type: 3, required: true, description: 'ID роли или @роль' },
            { name: 'from_whom', type: 3, required: true, description: 'От кого новость' }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🔄 Регистрация команды /news...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Команда /news зарегистрирована!');
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
    }
})();

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`📢 Канал для новостей: ${TARGET_CHANNEL_ID}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'news') {
        const text = interaction.options.getString('text');
        const ping = interaction.options.getString('ping');
        const fromWhom = interaction.options.getString('from_whom');
        
        const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
        if (!targetChannel) {
            return interaction.reply({ 
                content: '❌ Канал не найден. Проверь ID канала в настройках Render.', 
                ephemeral: true 
            });
        }
        
        // Обработка пинга
        const roleMention = /^\d+$/.test(ping) ? `<@&${ping}>` : ping;
        
        // Создаём красивое сообщение
        const embed = new EmbedBuilder()
            .setTitle('📢 Новость / Объявление')
            .setDescription(text)
            .setColor(0x5865F2)
            .addFields(
                { name: '📌 От', value: fromWhom, inline: true },
                { name: '👤 Автор', value: interaction.user.tag, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Discord Bot', iconURL: client.user.displayAvatarURL() });
        
        // Отправляем в канал
        await targetChannel.send({ 
            content: roleMention, 
            embeds: [embed] 
        });
        
        // Подтверждение автору
        interaction.reply({ 
            content: `✅ Новость отправлена в канал ${targetChannel.toString()}`, 
            ephemeral: true 
        });
    }
});

client.login(TOKEN);
