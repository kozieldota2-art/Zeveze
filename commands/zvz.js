
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const db = require('../database');

const ROLE_EMOJI = {
  'Tank Ofensivo':  '🛡️',
  'Tank Defensivo': '🔰',
  'Healer':         '💚',
  'DPS Melee':      '⚔️',
  'DPS Range':      '🏹',
  'Support':        '✨',
  'Battlemount':    '🐉',
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
    .setTitle(`⚔️ ZVZ CALL — ${comp.name.toUpperCase()}`)
    .setDescription(event.description || '')
    .addFields(
      { name: '⏰ Horário',  value: event.scheduled_time, inline: true },
      { name: '📢 Caller',   value: `<@${event.caller_id}>`, inline: true },
      { name: '📋 Status',   value: event.status === 'open' ? '🟢 Aberto' : '🔴 Fechado', inline: true }
    );

  for (const role of Object.keys(ROLE_EMOJI)) {
    if (!byRole[role]?.length) continue;
    embed.addFields({
      name: `${ROLE_EMOJI[role]} ${role}`,
      value: byRole[role].map(w => `• **${w.name}**${w.build_url ? ` — [Build](${w.build_url})` : ''}`).join('\n'),
      inline: true
    });
  }

  const total = confirmations.length;
  const assigned = confirmations.filter(c => c.assigned_weapon_name).length;

  if (total > 0) {
    const lines = confirmations.map(c => {
      if (c.assigned_weapon_name) return `✅ <@${c.user_id}> → **${c.assigned_weapon_name}**`;
      return `❓ <@${c.user_id}> — ${c.weapon1_name} / ${c.weapon2_name}`;
    }).join('\n');
    embed.addFields({ name: `\n👥 Confirmados: ${total} | Atribuídos: ${assigned}`, value: lines, inline: false });
  } else {
    embed.addFields({ name: '\n👥 Confirmados: 0', value: 'Ninguém confirmou presença ainda.', inline: false });
  }

  embed.setFooter({ text: `ID do Evento: ${event.id}` });
  return embed;
}

function buildEventButtons(eventId, isClosed = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`zvz_confirmar:${eventId}`).setLabel('✅ Confirmar Presença').setStyle(ButtonS
