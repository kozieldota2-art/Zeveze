
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

const ROLES = ['Tank Ofensivo', 'Tank Defensivo', 'Healer', 'DPS Melee', 'DPS Range', 'Support', 'Battlemount'];

const ROLE_EMOJI = {
  'Tank Ofensivo':  '🛡️',
  'Tank Defensivo': '🔰',
  'Healer':         '💚',
  'DPS Melee':      '⚔️',
  'DPS Range':      '🏹',
  'Support':        '✨',
  'Battlemount':    '🐉',
};

function isOfficer(interaction) {
  const roleId = process.env.OFFICER_ROLE_ID;
  if (!roleId) return true;
  return interaction.member.roles.cache.has(roleId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('arma')
    .setDescription('⚔️ Gerenciar armas de uma composição')
    .addSubcommand(sub => sub
      .setName('adicionar')
      .setDescription('Adicionar uma arma a uma composição')
      .addStringOption(opt => opt.setName('comp').setDescription('Nome da composição').setRequired(true).setAutocomplete(true))
      .addStringOption(opt => opt.setName('nome').setDescription('Nome da arma').setRequired(true).setMaxLength(60))
      .addStringOption(opt => opt.setName('role').setDescription('Papel desta arma na comp').setRequired(true).addChoices(...ROLES.map(r => ({ name: r, value: r }))))
      .addStringOption(opt => opt.setName('build').setDescription('Link da build').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('listar')
      .setDescription('Listar armas de uma composição')
      .addStringOption(opt => opt.setName('comp').setDescription('Nome da composição').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub => sub
      .setName('remover')
      .setDescription('Remover uma arma de uma composição')
      .addStringOption(opt => opt.setName('comp').setDescription('Nome da composição').setRequired(true).setAutocomplete(true))
      .addStringOption(opt => opt.setName('nome').setDescription('Nome da arma').setRequired(true).setAutocomplete(true))
    ),

  async execute(interaction) {
    if (!isOfficer(interaction)) {
      return interaction.reply({ content: '❌ Você precisa ser **Officer** para usar este comando.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'adicionar') {
      const compName = interaction.options.getString('comp');
      const comp = db.getCompByName(compName);
      if (!comp) return interaction.reply({ content: `❌ Composição **${compName}** não encontrada.`, ephemeral: true });

      const name = interaction.options.getString('nome').trim();
      const role = interaction.options.getString('role');
      const buildUrl = interaction.options.getString('build')?.trim() || '';

      db.addWeapon(comp.id, name, role, buildUrl);

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('✅ Arma adicionada!')
        .addFields(
          { name: '📋 Composição', value: comp.name, inline: true },
          { name: `${ROLE_EMOJI[role]} Role`, value: role, inline: true },
          { name: '🗡️ Arma', value: name, inline: true },
          { name: '🔗 Build', value: buildUrl ? `[Ver Build](${buildUrl})` : '—', inline: false }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'listar') {
      const compName = interaction.options.getString('comp');
      const comp = db.getCompByName(compName);
      if (!comp) return interaction.reply({ content: `❌ Composição **${compName}** não encontrada.`, ephemeral: true });

      const weapons = db.getWeaponsByComp(comp.id);
      if (!weapons.length) return interaction.reply({ content: `📋 Nenhuma arma cadastrada em **${comp.name}**.`, ephemeral: true });

      const byRole = {};
      for (const w of weapons) {
        if (!byRole[w.role]) byRole[w.role] = [];
        byRole[w.role].push(w);
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`⚔️ Armas — ${comp.name}`)
        .setDescription(comp.description || '')
        .addFields(
          Object.entries(byRole).map(([role, ws]) => ({
            name: `${ROLE_EMOJI[role] || '🔹'} ${role}`,
            value: ws.map(w => `• **${w.name}**${w.build_url ? ` — [Build](${w.build_url})` : ''}`).join('\n'),
            inline: true
          }))
        )
        .setFooter({ text: `Total: ${weapons.length} arma(s)` });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'remover') {
      const compName = interaction.options.getString('comp');
      const weaponName = interaction.options.getString('nome');
      const comp = db.getCompByName(compName);
      if (!comp) return interaction.reply({ content: `❌ Composição **${compName}** não encontrada.`, ephemeral: true });

      const weapons = db.getWeaponsByComp(comp.id);
      const weapon = weapons.find(w => w.name.toLowerCase() === weaponName.toLowerCase());
      if (!weapon) return interaction.reply({ content: `❌ Arma **${weaponName}** não encontrada em **${comp.name}**.`, ephemeral: true });

      db.removeWeapon(weapon.id);
      return interaction.reply({ content: `✅ Arma **${weapon.name}** removida de **${comp.name}**.`, ephemeral: true });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const value = focused.value.toLowerCase();

    if (focused.name === 'comp') {
      const comps = db.getAllComps().filter(c => c.name.toLowerCase().includes(value)).slice(0, 25).map(c => ({ name: c.name, value: c.name }));
      return interaction.respond(comps);
    }

    if (focused.name === 'nome') {
      const compName = interaction.options.getString('comp');
      if (!compName) return interaction.respond([]);
      const comp = db.getCompByName(compName);
      if (!comp) return interaction.respond([]);
      const weapons = db.getWeaponsByComp(comp.id).filter(w => w.name.toLowerCase().includes(value)).slice(0, 25).map(w => ({ name: `${ROLE_EMOJI[w.role] || ''} ${w.name}`, value: w.name }));
      return interaction.respond(weapons);
    }
  }
};
