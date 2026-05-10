const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const BASE_URL = 'https://murderledger.albiononline2d.com';

async function fetchWeapons(playerName, lookbackDays = 9999) {
  const url = BASE_URL + '/api/players/' + encodeURIComponent(playerName) + '/weapons?lookback_days=' + lookbackDays;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept':                    'application/json, text/plain, */*',
      'Accept-Language':           'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding':           'gzip, deflate, br',
      'Referer':                   BASE_URL + '/players/' + encodeURIComponent(playerName) + '/weapons?lookback_days=' + lookbackDays,
      'Origin':                    BASE_URL,
      'Host':                      'murderledger.albiononline2d.com',
      'Connection':                'keep-alive',
      'Sec-Fetch-Dest':            'empty',
      'Sec-Fetch-Mode':            'cors',
      'Sec-Fetch-Site':            'same-origin',
      'Sec-Ch-Ua':                 '"Google Chrome";v="120", "Chromium";v="120", "Not-A.Brand";v="24"',
      'Sec-Ch-Ua-Mobile':          '?0',
      'Sec-Ch-Ua-Platform':        '"Windows"',
      'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
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

    try {
      const data = await fetchWeapons(playerName);
      let weapons = data.weapons || [];

      if (!weapons.length) {
        return interaction.editReply({ content: 'Player **' + playerName + '** nao encontrado no Murder Ledger.' });
      }

      // Filtra por arma se especificado
      if (armaFiltro) {
        weapons = weapons.filter(w =>
          (w.weapon_name || '').toLowerCase().includes(armaFiltro) ||
          (w.weapon     || '').toLowerCase().includes(armaFiltro)
        );
      }

      if (!weapons.length) {
        return interaction.editReply({ content: 'Nenhuma arma encontrada com "' + armaFiltro + '" para o player **' + playerName + '**.' });
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('Murder Ledger — ' + playerName)
        .setURL(BASE_URL + '/players/' + encodeURIComponent(playerName) + '/weapons?lookback_days=9999')
        .setFooter({ text: 'Fonte: murderledger.albiononline2d.com | Todos os tempos' });

      const topWeapons = weapons.slice(0, 10);
      const lines = topWeapons.map((w, i) => {
        const nome    = w.weapon_name || w.weapon || 'Desconhecida';
        const usos    = w.usages      || 0;
        const assists = w.assists     || 0;
        const kills   = w.kills       || 0;
        const winRate = w.win_rate != null ? (w.win_rate * 100).toFixed(1) + '%' : '?';
        const ip      = w.average_item_power ? Math.round(w.average_item_power) : '?';

        return (i + 1) + '. **' + nome + '**\n' +
               '   Usos: `' + usos + '` | Assists: `' + assists + '` | Kills: `' + kills + '` | Win: `' + winRate + '` | IP: `' + ip + '`';
      }).join('\n');

      embed.setDescription(lines);

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('[Stats] Erro:', err.message);
      return interaction.editReply({ content: 'Erro ao buscar dados: ' + err.message });
    }
  }
};
