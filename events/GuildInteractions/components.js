const { MessageFlags } = require('discord.js');
const def = require('../../defines');
const { log } = require('../../functions');
const ExtendedClient = require('../../class/Client');

module.exports = {
    event: 'interactionCreate',

    run: async (client, interaction) => {
        const componentPermission = async (component) => {
            if (
                component.options?.public === false &&
                interaction.user.id !== interaction.message.interaction.user.id
            ) {
                await interaction.reply({
                    content:
                        def.messageSettings.notHasPermissionComponent !== undefined &&
                        def.messageSettings.notHasPermissionComponent !== null &&
                        def.messageSettings.notHasPermissionComponent !== ''
                            ? def.messageSettings.notHasPermissionComponent
                            : 'You do not have permission to use this component',
                    flags: MessageFlags.Ephemeral,
                });
                return false;
            }

            return true;
        };

        const find = (collection) =>
            collection.get(interaction.customId) ?? collection.get(interaction.customId.split(':')[0]);

        if (interaction.isButton()) {
            const component = find(client.collection.components.buttons);

            if (!component) return;

            if (!(await componentPermission(component))) return;

            try {
                component.run(client, interaction);
            } catch (error) {
                log(error, 'error');
            }

            return;
        }

        if (interaction.isAnySelectMenu()) {
            const component = find(client.collection.components.selects);

            if (!component) return;

            if (!(await componentPermission(component))) return;

            try {
                component.run(client, interaction);
            } catch (error) {
                log(error, 'error');
            }

            return;
        }

        if (interaction.isModalSubmit()) {
            const component = find(client.collection.components.modals);

            if (!component) return;

            try {
                component.run(client, interaction);
            } catch (error) {
                log(error, 'error');
            }

            return;
        }

        if (interaction.isAutocomplete()) {
            const component = client.collection.components.autocomplete.get(interaction.commandName);

            if (!component) return;

            try {
                component.run(client, interaction);
            } catch (error) {
                log(error, 'error');
            }

            return;
        }
    },
};
