require('dotenv').config()
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

client.on('ready', () => {
    console.log(`Logged as: ${client.user.tag}!`);
});

client.on('message', msg => {

    console.log('msg: ' + msg);

    let cleanMessage = msg.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    if(msg.author.bot) return;

    if ( (cleanMessage.search("aws") != -1) ) {
      console.log('cleanMessage: ' + cleanMessage)
    }
});

client.login(process.env.DISCORD_TOKEN);