const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');

const ALBION_API = 'https://gameinfo.albiononline.com/api/gameinfo';

// Carrega traducao com fallback embutido
let translation = {};
try {
  translation = require(path.join(__dirname, '..', 'weapons_translation.json'));
} catch(e) {
  try {
    translation = require('../weapons_translation.json');
  } catch(e2) {
    console.log('[Stats] weapons_translation.json nao encontrado, usando fallback embutido');
    translation = {"Hallowfall":"Queda Santa","Blight Staff":"Pustulento","Holy Staff":"Cajado Sagrado","Dagger Pair":"Par de Adagas","Rampant Staff":"Rampante","Mace":"Maça 1H","Redemption Staff":"Redenção","Incubus Mace":"Íncubo","Hand of Justice":"Mão da Justiça","Nature Staff":"Cajado da Natureza","Hammer":"Martelo 1H","Longbow":"Arco Longo","Druidic Staff":"Cajado Druídico","Polehammer":"Martelo de Batalha","Occult Staff":"Oculto","Staff of Balance":"Cajado do Equilíbrio","Bedrock Mace":"Maça Pétrea","Great Arcane Staff":"Arcano Elevado","Bloodletter":"Dessangradora","Exalted Staff":"Exaltado","Oathkeepers":"Jurador","Dreadstorm Monarch":"Monarca Tempestuoso","Astral Staff":"Astral","Lifecurse Staff":"Execrado","Grovekeeper":"Guarda Bosque","Dagger":"Adaga","Witchwork Staff":"Feiticeiro","Malevolent Locus":"Locus","Arcane Staff":"Arcano Silence","Great Holy Staff":"Sagrado Elevado","Divine Staff":"Cajado Divino","Permafrost Prism":"Prisma","Frost Staff":"Cajado de Gelo","Deathgivers":"Mortíficos","Claws":"Garras","Black Monk Stave":"Monge Negro","Realmbreaker":"Quebra reino","Dawnsong":"Canção da Alvorada","Shadowcaller":"Chama-sombra","Bear Paws":"Patas de Urso","Spirithunter":"Caça espíritos","Carrioncaller":"Chama corpos","Tombhammer":"Martelo Tumular","Mistpiercer":"Furabruma","Bow of Badon":"Badon","Siegebow":"Arco de Cerco","Weeping Repeater":"Repetidor Lamentoso","Boltcasters":"Lançadores de Dardos","Galatines":"Galatinas","Kingmaker":"Cria-reis","Vendetta's Wrath":"Cajado de Fogo Virulento","Infernal Scythe":"Segadeira","Ghostfang":"Presa Demoníaca","Hellion Hands":"Mãos Pretas","Broadsword":"Espada Larga","Claymore":"Montante","Dual Swords":"Espadas Duplas","Carving Sword":"Espada Entalhada","Battle Axe":"Machado de Guerra","Great Axe":"Machadão","Halberd":"Alabarda","Spear":"Lança","Pike":"Pique","Glaive":"Archa","Crystal Reaper":"Archa Fraturada","Heron Spear":"Garceira","Trinity Spear":"Lança Trina","Warhammer":"Martelo de Guerra","Great Hammer":"Martelo Pesado","Forge Hammers":"Martelos de Forja","Crossbow":"Besta","Heavy Crossbow":"Besta Pesada","Light Crossbow":"Besta Leve","Bow":"Arco","Warbow":"Arco de Guerra","Wailing Bow":"Plangente","Whispering Bow":"Arco Sussurrante","Shortsword":"Espada Curta","Sword":"Espada","Rapier":"Rapieira","Cursed Staff":"Cajado Amaldiçoado","Great Cursed Staff":"Cajado Amaldiçoado Elevado","Fire Staff":"Cajado de Fogo","Great Fire Staff":"Cajado de Fogo Elevado","Blazing Staff":"Cajado Fulgurante","Wildfire Staff":"Cajado do Fogo Selvagem","Brimstone Staff":"Cajado Sulfuroso","Great Frost Staff":"Cajado de Gelo Elevado","Glacial Staff":"Cajado Glacial","Hoarfrost Staff":"Cajado Gélido","Great Nature Staff":"Cajado da Natureza Elevado","Ironroot Staff":"Cajado Férreo","Enigmatic Staff":"Cajado Enigmático","Demonic Staff":"Cajado Demoníaco","Reaper":"Segadeira","Double Bladed Staff":"Cajado de Dupla Lâmina","Primal Staff":"Cajado Primordial","Mistcaller":"Chamador de Névoa","Spiked Gauntlets":"Manoplas Cravadas","Brawlers":"Braçadeiras","Morning Star":"Estrela da Manhã","Scimitar":"Lâmina Aclarada","Katar":"Fúria Contida","Sickle Pair":"Gêmeas Aniquiladoras"};
  }
}

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
