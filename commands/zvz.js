const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const db     = require('../database');
const sheets = require('../sheets');

const ROLE_LABEL = {
  'Tank Ofensivo':  '[Tank Of]',
  'Tank Defensivo': '[Tank Def]',
  'Healer':         '[Healer]',
  'DPS Melee':      '[DPS Melee]',
  'DPS Range':      '[DPS Range]',
  'Support':        '[Support]',
  'Battlemount':    '[Mount]',
};

function isCaller(interaction) {
  const roleId = process.env.CALLER_ROLE_ID;
  if (!roleId) {
    const officerRoleId = process.env.OFFICER_ROLE_ID;
    if (!officerRoleId) return true;
    return interaction.member.roles.cache.has(officerRoleId);
  }
  return interaction.member.roles.cache.has(roleId);
}

function buildEventEmbed(comp, event, confirmations, weapons) {
  const byRole = {};
  for (const w of weapons) {
    if (!byRole[w.role]) byRole[w.role] = [];
    byRole[w.role].push(w);
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle('ZVZ CALL -- ' + comp.name.toUpperCase())
    .setDescription(event.description || 'Confirme sua presenca clicando no botao abaixo.')
    .addFields(
      { name: 'Horario', value: event.scheduled_time, inline: true },
      { name: 'Caller',  value: '<@' + event.caller_id + '>', inline: true },
      { name: 'Status',  value: event.status === 'open' ? 'Aberto' : 'Fechado', inline: true }
    );

  for (const role of Object.keys(ROLE_LABEL)) {
    if (!byRole[role] || !byRole[role].length) continue;
    embed.addFields({
      name: ROLE_LABEL[role] + ' ' + role,
      value: byRole[role].map(w => '- ' + w.name + (w.build_url ? ' -- [Build](' + w.build_url + ')' : '')).join('\n'),
      inline: true
    });
  }

  const total    = confirmations.length;
  const assigned = confirmations.filter(c => c.assigned_weapon_name).length;

  if (total > 0) {
    const lines = confirmations.map(c => {
      if (c.assigned_weapon_name) return 'OK <@' + c.user_id + '> --> ' + c.assigned_weapon_name;
      return '? <@' + c.user_id + '> -- ' + c.weapon1_name + ' / ' + c.weapon2_name;
    }).join('\n');
    embed.addFields({ name: 'Confirmados: ' + total + ' | Atribuidos: ' + assigned, value: lines, inline: false });
  } else {
    embed.addFields({ name: 'Confirmados: 0', value: 'Ninguem confirmou presenca ainda.', inline: false });
  }

  embed.setFooter({ text: 'ID do Evento: ' + event.id });
  return embed;
}

function buildEventButtons(eventId, isClosed) {
  if (isClosed === undefined) isClosed = false;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('zvz_confirmar:' + eventId).setLabel('Confirmar Presenca').setStyle(ButtonStyle.Success).setDisabled(isClosed),
    new ButtonBuilder().setCustomId('zvz_cancelar:'  + eventId).setLabel('Cancelar Presenca').setStyle(ButtonStyle.Secondary).setDisabled(isClosed),
    new ButtonBuilder().setCustomId('zvz_atribuir:'  + eventId).setLabel('Atribuir (Caller)').setStyle(ButtonStyle.Primary).setDisabled(isClosed),
    new ButtonBuilder().setCustomId('zvz_fechar:'    + eventId).setLabel('Fechar Evento').setStyle(ButtonStyle.Danger).setDisabled(isClosed)
  );
}

async function refreshEmbed(client, event) {
  try {
    const comp          = db.getCompById(event.comp_id);
    const confirmations = db.getConfirmationsByEvent(event.id);
    const weapons       = db.getWeaponsByComp(event.comp_id);
    const embed         = buildEventEmbed(comp, event, confirmations, weapons);
    const buttons       = buildEventButtons(event.id, event.status === 'closed');
    const channel       = await client.channels.fetch(event.channel_id);
    const message       = await channel.messages.fetch(event.message_id);
    await message.edit({ embeds: [embed], components: [buttons] });
  } catch (err) {
    console.error('Erro ao atualizar embed:', err.message);
  }
}

// Pega o nome da aba da planilha baseado no nome da comp
function getSheetName(compName) {
  const map = {
    'kite':         'COMP KITE',
    'brawl':        'COMP BRAWL',
    'magrin push':  'COMP MAGRIN PUSH',
    'yami':         'COMP YAMI',
    'no lock':      'COMP NO LOCK',
    'magr1n':       'COMP MAGR1N',
  };
  return map[compName.toLowerCase()] || compName;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('zvz')
    .setDescription('Comandos de ZvZ')
    .addSubcommand(sub => sub
      .setName('ping')
      .setDescription('Pingar um evento ZvZ para a guilda')
      .addStringOption(opt => opt.setName('comp').setDescription('Composicao da ZvZ').setRequired(true).setAutocomplete(true))
      .addStringOption(opt => opt.setName('horario').setDescription('Horario do evento (ex: 20:00 BRT)').setRequired(true))
      .addStringOption(opt => opt.setName('descricao').setDescription('Detalhes do evento').setRequired(false))
      .addRoleOption(opt => opt.setName('cargo').setDescription('Cargo a mencionar').setRequired(false))
    ),

  async execute(interaction) {
    if (!isCaller(interaction)) {
      return interaction.reply({ content: 'Voce nao tem permissao para pingar ZvZ.', ephemeral: true });
    }

    const compName = interaction.options.getString('comp');
    const comp     = db.getCompByName(compName);
    if (!comp) return interaction.reply({ content: 'Composicao ' + compName + ' nao encontrada.', ephemeral: true });

    const weapons = db.getWeaponsByComp(comp.id);
    if (weapons.length < 2) return interaction.reply({ content: 'A composicao precisa ter pelo menos 2 armas. Use /arma adicionar.', ephemeral: true });

    const horario   = interaction.options.getString('horario');
    const descricao = interaction.options.getString('descricao') || '';
    const cargo     = interaction.options.getRole('cargo');

    const result  = db.createEvent(comp.id, interaction.channelId, interaction.user.id, horario, descricao);
    const eventId = result.lastInsertRowid;
    const event   = db.getEventById(eventId);
    const embed   = buildEventEmbed(comp, event, [], weapons);
    const buttons = buildEventButtons(eventId);
    const mention = cargo ? cargo.toString() + ' ' : '';

    const msg = await interaction.reply({
      content: 'ZVZ CALL! ' + mention,
      embeds: [embed],
      components: [buttons],
      fetchReply: true
    });

    db.setEventMessageId(eventId, msg.id);
  },

  async autocomplete(interaction) {
    const value = interaction.options.getFocused().toLowerCase();
    const comps = db.getAllComps()
      .filter(c => c.name.toLowerCase().includes(value))
      .slice(0, 25)
      .map(c => ({ name: c.name, value: c.name }));
    await interaction.respond(comps);
  },

  async handleInteraction(interaction, prefix) {
    if (!prefix.startsWith('zvz_')) return;

    const parts   = interaction.customId.split(':');
    const action  = parts[0];
    const eventId = parseInt(parts[1]);
    const extra   = parts[2];
    const event   = db.getEventById(eventId);
    if (!event) return;

    const comp = db.getCompById(event.comp_id);
    const sheetName = getSheetName(comp.name);

    if (action === 'zvz_confirmar') {
      if (event.status === 'closed') return interaction.reply({ content: 'Este evento ja foi fechado.', ephemeral: true });
      const weapons = db.getWeaponsByComp(event.comp_id);
      if (weapons.length < 2) return interaction.reply({ content: 'Nao ha armas suficientes nesta comp.', ephemeral: true });

      const select = new StringSelectMenuBuilder()
        .setCustomId('zvz_selecionar:' + eventId)
        .setPlaceholder('Escolha 2 armas que voce consegue jogar')
        .setMinValues(2)
        .setMaxValues(Math.min(2, weapons.length))
        .addOptions(weapons.map(w => ({ label: w.name.substring(0, 100), description: w.role, value: String(w.id) })));

      return interaction.reply({
        content: 'Selecione 2 armas que voce consegue jogar:',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    if (action === 'zvz_selecionar') {
      const w1Id = parseInt(interaction.values[0]);
      const w2Id = parseInt(interaction.values[1]);
      const w1   = db.getWeaponById(w1Id);
      const w2   = db.getWeaponById(w2Id);

      db.upsertConfirmation(eventId, interaction.user.id, interaction.user.username, w1Id, w2Id);

      // Pega numero de confirmacao
      const confirmations = db.getConfirmationsByEvent(eventId);
      const number = confirmations.findIndex(c => c.user_id === interaction.user.id) + 1;

      // Atualiza planilha
      sheets.addConfirmation(sheetName, number, interaction.user.username, w1.name, w2.name).catch(console.error);

      await interaction.reply({
        content: 'Presenca confirmada! Preferencias: ' + w1.name + ' / ' + w2.name + '. Aguarde o caller te atribuir uma arma.',
        ephemeral: true
      });
      await refreshEmbed(interaction.client, db.getEventById(eventId));
    }

    if (action === 'zvz_cancelar') {
      const existing = db.getConfirmation(eventId, interaction.user.id);
      if (!existing) return interaction.reply({ content: 'Voce nao esta confirmado neste evento.', ephemeral: true });

      const confirmations = db.getConfirmationsByEvent(eventId);
      const number = confirmations.findIndex(c => c.user_id === interaction.user.id) + 1;

      db.removeConfirmation(eventId, interaction.user.id);

      // Remove da planilha
      sheets.removeConfirmation(sheetName, number).catch(console.error);

      await interaction.reply({ content: 'Sua presenca foi cancelada.', ephemeral: true });
      await refreshEmbed(interaction.client, db.getEventById(eventId));
    }

    if (action === 'zvz_atribuir') {
      if (interaction.user.id !== event.caller_id) {
        const officerRoleId = process.env.OFFICER_ROLE_ID;
        const isOfficer = officerRoleId && interaction.member.roles.cache.has(officerRoleId);
        if (!isOfficer) return interaction.reply({ content: 'Apenas o caller ou um officer pode atribuir armas.', ephemeral: true });
      }

      const confirmations = db.getConfirmationsByEvent(eventId);
      if (!confirmations.length) return interaction.reply({ content: 'Nenhum player confirmou presenca ainda.', ephemeral: true });

      const playerSelect = new StringSelectMenuBuilder()
        .setCustomId('zvz_escolher_player:' + eventId)
        .setPlaceholder('Selecione o player para atribuir arma')
        .addOptions(confirmations.slice(0, 25).map(c => ({
          label: c.user_name.substring(0, 100),
          description: (c.weapon1_name + ' / ' + c.weapon2_name + (c.assigned_weapon_name ? ' --> ' + c.assigned_weapon_name : '')).substring(0, 100),
          value: c.user_id
        })));

      return interaction.reply({
        content: 'Selecione o player:',
        components: [new ActionRowBuilder().addComponents(playerSelect)],
        ephemeral: true
      });
    }

    if (action === 'zvz_escolher_player') {
      const targetUserId = interaction.values[0];
      const confirmation = db.getConfirmation(eventId, targetUserId);
      if (!confirmation) return interaction.reply({ content: 'Player nao encontrado.', ephemeral: true });

      const allWeapons = db.getWeaponsByComp(event.comp_id);
      const pw1 = db.getWeaponById(confirmation.weapon1_id);
      const pw2 = db.getWeaponById(confirmation.weapon2_id);

      const weaponSelect = new StringSelectMenuBuilder()
        .setCustomId('zvz_atribuir_arma:' + eventId + ':' + targetUserId)
        .setPlaceholder('Selecione a arma para este player')
        .addOptions(allWeapons.slice(0, 25).map(w => {
          const isPref = w.id === confirmation.weapon1_id || w.id === confirmation.weapon2_id;
          return {
            label: (isPref ? '[PREF] ' : '') + w.name.substring(0, 90),
            description: (w.role + (isPref ? ' -- Preferencia do player' : '')).substring(0, 100),
            value: String(w.id)
          };
        }));

      return interaction.reply({
        content: 'Atribuindo arma para ' + confirmation.user_name + '. Preferencias: ' + pw1.name + ' / ' + pw2.name,
        components: [new ActionRowBuilder().addComponents(weaponSelect)],
        ephemeral: true
      });
    }

    if (action === 'zvz_atribuir_arma') {
      const assignUserId = extra;
      const weaponId     = parseInt(interaction.values[0]);
      const weapon       = db.getWeaponById(weaponId);
      const conf         = db.getConfirmation(eventId, assignUserId);

      db.assignWeapon(eventId, assignUserId, weaponId);

      // Atualiza planilha com o player atribuido
      sheets.assignPlayerToWeapon(sheetName, weapon.name, conf.user_name).catch(console.error);

      await interaction.reply({
        content: conf.user_name + ' foi atribuido para ' + weapon.name + '.',
        ephemeral: true
      });
      await refreshEmbed(interaction.client, db.getEventById(eventId));
    }

    if (action === 'zvz_fechar') {
      if (interaction.user.id !== event.caller_id) {
        const froleId    = process.env.OFFICER_ROLE_ID;
        const fIsOfficer = froleId && interaction.member.roles.cache.has(froleId);
        if (!fIsOfficer) return interaction.reply({ content: 'Apenas o caller ou um officer pode fechar o evento.', ephemeral: true });
      }

      const confirmations = db.getConfirmationsByEvent(eventId);
      db.closeEvent(eventId);

      // Limpa lado esquerdo da planilha
      sheets.clearConfirmations(sheetName, confirmations.length).catch(console.error);

      await interaction.reply({ content: 'Evento fechado! Confirmacoes encerradas.', ephemeral: true });
      await refreshEmbed(interaction.client, db.getEventById(eventId));
    }
  }
};
