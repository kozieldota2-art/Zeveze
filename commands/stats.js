const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const STATS_SITE = 'https://kozieldota2-art.github.io/Zeveze/?player=';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Busca historico de armas do player no Murder Ledger')
    .addStringOption(opt => opt
      .setName('player')
      .setDescription('Nome do player no Albion')
      .setRequired(true)
    ),

  async execute(interaction) {
    const playerName = interaction.options.getString('player');
    const link = STATS_SITE + encodeURIComponent(playerName);

    const embed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle('Stats — ' + playerName)
      .setDescription('Clique no link abaixo para ver o historico completo de armas do player no Murder Ledger.')
      .addFields({
        name: 'Historico de armas',
        value: '[Ver stats de ' + playerName + '](' + link + ')',
        inline: false
      })
      .setFooter({ text: 'Fonte: Murder Ledger | Kills, assists, win rate e mais' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
