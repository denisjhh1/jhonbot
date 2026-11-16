const { EmbedBuilder, MessageFlags } = require('discord.js');
const crc = require('crc');
const fs = require('fs');
const chalk = require('chalk');

const log = (string, style) => {
    const styles = {
        info: { prefix: chalk.blue('[INFO]'), logFunction: console.log },
        err: { prefix: chalk.red('[ERROR]'), logFunction: console.error },
        warn: { prefix: chalk.yellow('[WARNING]'), logFunction: console.warn },
        done: { prefix: chalk.green('[SUCCESS]'), logFunction: console.log },
    };

    const selectedStyle = styles[style] || { logFunction: console.log };
    selectedStyle.logFunction(`${selectedStyle.prefix || ''} ${string}`);
};

const time = (time, style) => {
    return `<t:${Math.floor(time / 1000)}${style ? `:${style}` : ''}>`;
};

const isSnowflake = (id) => {
    return /^\d+$/.test(id);
};

const IntSucces = async (interaction, args) => {
    const msgEmbed = new EmbedBuilder().setDescription(args).setColor('Green');
    return interaction.reply({ embeds: [msgEmbed], flags: MessageFlags.Ephemeral });
};

const IntError = async (interaction, args) => {
    const msgEmbed = new EmbedBuilder().setDescription(args).setColor('Red');
    return interaction.reply({ embeds: [msgEmbed], flags: MessageFlags.Ephemeral });
};

const IntUsage = async (interaction, args) => {
    const msgEmbed = new EmbedBuilder().setDescription(args).setColor('Yellow');
    return interaction.reply({ embeds: [msgEmbed], flags: MessageFlags.Ephemeral });
};

module.exports = {
    log,
    time,
    isSnowflake,

    IntSucces,
    IntError,
    IntUsage,
};
