const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const REGIONS = [
  'https://murderledger.albiononline2d.com',
  'https://murderledger-europe.albiononline2d.com',
  'https://murderledger-asia.albiononline2d.com',
];

async function fetchWeapons(playerName, lookbackDays = 9999) {
  for (const base of REGIONS) {
    try {
      const url = base + '/api/players/' + encodeURIComponent(playerName) + '/weapons?lookback_days=' + lookbackDays;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ZVZ-Bot/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        return { data, region: base };
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Busca stats de arma do player no Murder Ledger')
    .addStringOption(opt => opt
      .setName('player')
      .setDescription('Nome do player no Albion')
      .setRequired(true)
    )
    .addStringOption(opt => opt
      .setName('arma')
      .setDescription('Nome da arma para filtrar (opcional)')
      .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const playerName = interaction.options.getString('player');
    const armaFiltro = interaction.options.getString('arma')?.toLowerCase() || null;

    const result = await fetchWeapons(playerName);

    if (!result) {
      return interaction.editReply({
        content: 'Nao consegui acessar o Murder Ledger. Pode ser que o player nao exista ou o site esteja fora.'
      });
    }

    const { data, region } = result;

    // Loga no console pra debugar a estrutura
    console.log('[Stats] Resposta do Murder Ledger para ' + playerName + ':');
    console.log(JSON.stringify(data).substring(0, 500));

    // Tenta montar o embed com os dados
    let weapons = [];

    if (Array.isArray(data)) {
      weapons = data;
    } else if (data.weapons) {
      weapons = data.weapons;
    } else if (data.data) {
      weapons = data.data;
    }

    if (!weapons.length) {
      return interaction.editReply({
        content: 'Player encontrado mas sem dados de arma. Estrutura retornada:\n```json\n' + JSON.stringify(data).substring(0, 500) + '\n```'
      });
    }

    // Filtra por arma se especificado
    if (armaFiltro) {
      weapons = weapons.filter(w => {
        const nome = (w.weapon || w.name || w.weapon_name || '').toLowerCase();
        return nome.includes(armaFiltro);
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Stats de ' + playerName + ' no Murder Ledger')
      .setFooter({ text: 'Fonte: ' + region });

    const topWeapons = weapons.slice(0, 10);

    if (topWeapons.length === 0) {
      embed.setDescription('Nenhuma arma encontrada com esse filtro.');
    } else {
      const lines = topWeapons.map((w, i) => {
        const nome  = w.weapon || w.name || w.weapon_name || JSON.stringify(w).substring(0, 50);
        const usos  = w.total || w.count || w.uses || w.kills || '?';
        const wins  = w.wins || w.kills || '?';
        return (i + 1) + '. **' + nome + '** — ' + usos + ' usos';
      }).join('\n');

      embed.setDescription(lines);
    }

    return interaction.editReply({ embeds: [embed] });
  }
};
