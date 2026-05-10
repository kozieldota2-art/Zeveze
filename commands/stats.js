const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const translation = require('../weapons_translation.json');

const ALBION_API = 'https://gameinfo.albiononline.com/api/gameinfo';

// Traduz nome EN -> PT
function traduzir(nomeEN) {
  return translation[nomeEN] || nomeEN;
}

// Busca ID do player pelo nome
async function getPlayerId(playerName) {
  const res = await fetch(ALBION_API + '/search?q=' + encodeURIComponent(playerName));
  if (!res.ok) throw new Error('Erro ao buscar player: HTTP ' + res.status);
  const data = await res.json();
  const players = data.players || [];
  const player = players.find(p => p.Name.toLowerCase() === playerName.toLowerCase()) || players[0];
  if (!player) throw new Error('Player "' + playerName + '" nao encontrado.');
  return { id: player.Id, name: player.Name };
}

// Busca kills recentes do player e conta uso de armas
async function getWeaponUsage(playerId, limit = 51) {
  const res = await fetch(ALBION_API + '/players/' + playerId + '/kills?limit=' + limit + '&offset=0');
  if (!res.ok) throw new Error('Erro ao buscar kills: HTTP ' + res.status);
  const kills = await res.json();

  const weaponCount = {};
  for (const kill of kills) {
    const equipment = kill?.Killer?.Equipment;
    if (!equipment?.MainHand) continue;
    const itemId = equipment.MainHand.Type || '';
    if (!itemId) continue;
    weaponCount[itemId] = (weaponCount[itemId] || 0) + 1;
  }

  return { weaponCount, total: kills.length };
}

// Converte item ID do Albion para nome legivel
// Ex: MAIN_HOLYSTAFF_AVALON -> busca no translation pelo weapon_name
function itemIdToName(itemId) {
  // Remove tier prefix (T4_, T5_, etc)
  const clean = itemId.replace(/^T\d+_/, '').replace(/@\d+$/, '');
  // Tenta achar no translation pelo código
  for (const [en, pt] of Object.entries(translation)) {
    if (clean.includes(en.toUpperCase().replace(/ /g, '_'))) return pt;
  }
  return clean;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Busca stats de arma do player no Albion')
    .addStringOption(opt => opt
      .setName('player')
      .setDescription('Nome do player no Albion')
      .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const playerName = interaction.options.getString('player');

    try {
      // 1. Busca ID do player
      const player = await getPlayerId(playerName);

      // 2. Busca kills e conta armas
      const { weaponCount, total } = await getWeaponUsage(player.id);

      if (!Object.keys(weaponCount).length) {
        return interaction.editReply({ content: 'Nenhum kill encontrado para **' + player.name + '** na API do Albion.' });
      }

      // 3. Ordena por uso
      const sorted = Object.entries(weaponCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      const embed = new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('Stats de ' + player.name)
        .setDescription('Usos de arma nos últimos **' + total + '** kills registrados')
        .addFields(
          sorted.map(([itemId, count], i) => ({
            name: (i + 1) + '. ' + itemIdToName(itemId),
            value: '`' + count + '` uso(s) — `' + Math.round(count / total * 100) + '%`',
            inline: true
          }))
        )
        .setFooter({ text: 'Fonte: API oficial Albion Online | Limite: ultimos 51 kills' });

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('[Stats] Erro:', err.message);
      return interaction.editReply({ content: 'Erro: ' + err.message });
    }
  }
};
