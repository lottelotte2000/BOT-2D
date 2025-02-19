// index.js
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

const prefix = "!";
const queue = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('!help | Music Bot', { type: 'PLAYING' });
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch(command) {
        case 'help':
            const helpEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Bot Commands')
                .setDescription('List of available commands:')
                .addFields(
                    { name: '!play [URL]', value: 'Play a song from YouTube' },
                    { name: '!skip', value: 'Skip current song' },
                    { name: '!stop', value: 'Stop playing and clear queue' },
                    { name: '!queue', value: 'Show current queue' },
                    { name: '!ping', value: 'Show bot latency' }
                );
            message.channel.send({ embeds: [helpEmbed] });
            break;

        case 'play':
            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) {
                return message.reply('You need to be in a voice channel!');
            }

            if (!args[0]) {
                return message.reply('Please provide a YouTube URL!');
            }

            try {
                const songInfo = await ytdl.getInfo(args[0]);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: songInfo.videoDetails.video_url,
                };

                let serverQueue = queue.get(message.guild.id);

                if (!serverQueue) {
                    const queueConstruct = {
                        textChannel: message.channel,
                        voiceChannel: voiceChannel,
                        connection: null,
                        songs: [],
                        volume: 5,
                        playing: true
                    };

                    queue.set(message.guild.id, queueConstruct);
                    queueConstruct.songs.push(song);

                    try {
                        const connection = joinVoiceChannel({
                            channelId: voiceChannel.id,
                            guildId: message.guild.id,
                            adapterCreator: message.guild.voiceAdapterCreator,
                        });
                        queueConstruct.connection = connection;
                        play(message.guild, queueConstruct.songs[0]);
                    } catch (err) {
                        console.error(err);
                        queue.delete(message.guild.id);
                        return message.channel.send('Error joining voice channel!');
                    }
                } else {
                    serverQueue.songs.push(song);
                    return message.channel.send(`✅ **${song.title}** has been added to the queue!`);
                }
            } catch (error) {
                console.error(error);
                return message.reply('Error playing song!');
            }
            break;

        case 'skip':
            const serverQueue = queue.get(message.guild.id);
            if (!serverQueue) return message.reply('No songs playing!');
            if (!message.member.voice.channel) return message.reply('You need to be in a voice channel!');
            serverQueue.songs.shift();
            play(message.guild, serverQueue.songs[0]);
            message.channel.send('⏭️ Skipped!');
            break;

        case 'stop':
            const queue_stop = queue.get(message.guild.id);
            if (!queue_stop) return message.reply('No songs playing!');
            if (!message.member.voice.channel) return message.reply('You need to be in a voice channel!');
            queue_stop.songs = [];
            queue_stop.connection.destroy();
            queue.delete(message.guild.id);
            message.channel.send('🛑 Stopped playing!');
            break;

        case 'queue':
            const queue_list = queue.get(message.guild.id);
            if (!queue_list) return message.reply('No songs in queue!');
            
            const queueEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Song Queue')
                .setDescription(queue_list.songs.map((song, index) => 
                    `${index + 1}. ${song.title}`).join('\n'));
            
            message.channel.send({ embeds: [queueEmbed] });
            break;

        case 'ping':
            const ping = Date.now() - message.createdTimestamp;
            message.reply(`🏓 Pong! Latency is ${ping}ms`);
            break;
    }
});

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    const player = createAudioPlayer();
    const resource = createAudioResource(ytdl(song.url, { 
        filter: 'audioonly', 
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }));
    
    player.play(resource);
    serverQueue.connection.subscribe(player);

    player.on('stateChange', (oldState, newState) => {
        if (newState.status === 'idle') {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        }
    });

    serverQueue.textChannel.send(`🎵 Now playing: **${song.title}**`);
}

// ใส่ Token ของคุณตรงนี้
const TOKEN = 'MTM0MTY3NzM2Mzg2MzIyNDM2Mg.GQrqgd.00eLN4syabcPomXG-O4NuGiCSva1RltZUktfoM';
client.login(TOKEN);
