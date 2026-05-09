const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');

function isOfficer(interaction) {
  const roleId = process.env.OFFICER_ROLE_ID;
  if (!roleId) return true;
  return interaction.member.roles.cache.has(roleId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('comp')
    .setDescription('⚔️ Gerenciar composições ZvZ')
    .addSubcommand(sub => sub
      .setName('criar')
      .setDescription('Criar uma nova composição')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome da comp (ex: Brawl, Clap, Press...)').setRequired(true).setMaxLength(50))
      .addStringOption(opt => opt.setName('descricao').setDescription('Descrição curta da composição').setRequired(false).setMaxLength(150))
    )
    .addSubcommand(sub => sub
      .setName('listar')
      .setDescription('Listar todas as composições cadastradas')
    )
    .addSubcommand(sub => sub
      .setName('deletar')
      .setDescription('Deletar uma composição e suas armas')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome da comp').setRequired(true).setAutocomplete(true))
    ),

  async execute(interaction) {
    if (!isOfficer(interaction)) {
      return interaction.reply({ content: '❌ Você precisa ser **Officer** para usar este comando.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      const name = interaction.options.getString('nome').trim();
      const desc = interaction.options.getString('descricao')?.trim() || '';
      try {
        db.createComp(name, desc);
        const embed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('✅ Composição criada!')
          .addFields(
            { name: '📋 Nome', value: name, inline: true },
            { name: '📝 Descrição', value: desc || '—', inline: true }
          )
          .setFooter({ text: 'Use /arma adicionar para cadastrar armas nesta comp' });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: `❌ Já existe uma composição com o nome **${name}**.`, ephemeral: true });
      }
    }

    if (sub === 'listar') {
      const comps = db.getAllComps();
      if (!comps.length) {
        return interaction.reply({ content: '📋 Nenhuma composição cadastrada ainda.\nUse `/comp criar` para começar.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚔️ Composições ZvZ Cadastradas')
        .setDescription(comps.map((c, i) => `**${i + 1}.** **${c.name}**${c.description ? ` — ${c.description}` : ''}`).join('\n'))
        .setFooter({ text: `Total: ${comps.length} composição(ões)` });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'deletar') {
      const name = interaction.options.getString('nome');
      const comp = db.getCompByName(name);
      if (!comp) return interaction.reply({ content: `❌ Composição **${name}** não encontrada.`, ephemeral: true });
      db.deleteComp(comp.id);
      return interaction.reply({ content: `✅ Composição **${comp.name}** e todas as suas armas foram deletadas.`, ephemeral: true });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const comps = db.getAllComps();
    const matches = comps.filter(c => c.name.toLowerCase().includes(focused)).slice(0, 25).map(c => ({ name: c.name, value: c.name }));
    await interaction.respond(matches);
  }
};
