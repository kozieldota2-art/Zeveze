const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');

const ALBION_API = 'https://gameinfo.albiononline.com/api/gameinfo';
const TIMEOUT_MS = 10000;
const KILL_LIMIT = 300;

// Traducao embutida
const translation = {"Hallowfall":"Queda Santa","Blight Staff":"Pustulento","Holy Staff":"Cajado Sagrado","Dagger Pair":"Par de Adagas","Rampant Staff":"Rampante","Mace":"Maça 1H","Redemption Staff":"Redenção","Incubus Mace":"Íncubo","Hand of Justice":"Mão da Justiça","Nature Staff":"Cajado da Natureza","Hammer":"Martelo 1H","Longbow":"Arco Longo","Druidic Staff":"Cajado Druídico","Polehammer":"Martelo de Batalha","Occult Staff":"Oculto","Staff of Balance":"Cajado do Equilíbrio","Bedrock Mace":"Maça Pétrea","Great Arcane Staff":"Arcano Elevado","Bloodletter":"Dessangradora","Exalted Staff":"Exaltado","Oathkeepers":"Jurador","Dreadstorm Monarch":"Monarca Tempestuoso","Astral Staff":"Astral","Lifecurse Staff":"Execrado","Grovekeeper":"Guarda Bosque","Dagger":"Adaga","Witchwork Staff":"Feiticeiro","Malevolent Locus":"Locus","Arcane Staff":"Arcano Silence","Great Holy Staff":"Sagrado Elevado","Divine Staff":"Cajado Divino","Permafrost Prism":"Prisma","Frost Staff":"Cajado de Gelo","Deathgivers":"Mortíficos","Claws":"Garras","Black Monk Stave":"Monge Negro","Realmbreaker":"Quebra reino","Dawnsong":"Canção da Alvorada","Shadowcaller":"Chama-sombra","Bear Paws":"Patas de Urso","Spirithunter":"Caça espíritos","Carrioncaller":"Chama corpos","Tombhammer":"Martelo Tumular","Mistpiercer":"Furabruma","Bow of Badon":"Badon","Siegebow":"Arco de Cerco","Weeping Repeater":"Repetidor Lamentoso","Boltcasters":"Lançadores de Dardos","Galatines":"Galatinas","Kingmaker":"Cria-reis","Vendetta's Wrath":"Cajado de Fogo Virulento","Infernal Scythe":"Segadeira","Ghostfang":"Presa Demoníaca","Hellion Hands":"Mãos Pretas","Broadsword":"Espada Larga","Claymore":"Montante","Dual Swords":"Espadas Duplas","Carving Sword":"Espada Entalhada","Battle Axe":"Machado de Guerra","Great Axe":"Machadão","Halberd":"Alabarda","Spear":"Lança","Pike":"Pique","Glaive":"Archa","Crystal Reaper":"Archa Fraturada","Heron Spear":"Garceira","Trinity Spear":"Lança Trina","Warhammer":"Martelo de Guerra","Great Hammer":"Martelo Pesado","Forge Hammers":"Martelos de Forja","Crossbow":"Besta","Heavy Crossbow":"Besta Pesada","Light Crossbow":"Besta Leve","Bow":"Arco","Warbow":"Arco de Guerra","Wailing Bow":"Plangente","Whispering Bow":"Arco Sussurrante","Shortsword":"Espada Curta","Sword":"Espada","Rapier":"Rapieira","Cursed Staff":"Cajado Amaldiçoado","Great Cursed Staff":"Cajado Amaldiçoado Elevado","Fire Staff":"Cajado de Fogo","Great Fire Staff":"Cajado de Fogo Elevado","Blazing Staff":"Cajado Fulgurante","Wildfire Staff":"Cajado do Fogo Selvagem","Brimstone Staff":"Cajado Sulfuroso","Great Frost Staff":"Cajado de Gelo Elevado","Glacial Staff":"Cajado Glacial","Hoarfrost Staff":"Cajado Gélido","Great Nature Staff":"Cajado da Natureza Elevado","Ironroot Staff":"Cajado Férreo","Enigmatic Staff":"Cajado Enigmático","Demonic Staff":"Cajado Demoníaco","Reaper":"Segadeira","Double Bladed Staff":"Cajado de Dupla Lâmina","Primal Staff":"Cajado Primordial","Mistcaller":"Chamador de Névoa","Spiked Gauntlets":"Manoplas Cravadas","Brawlers":"Braçadeiras","Morning Star":"Estrela da Manhã","Scimitar":"Lâmina Aclarada","Katar":"Fúria Contida","Sickle Pair":"Gêmeas Aniquiladoras"};

// Tenta carregar JSON externo se existir
try {
  const ext = require(path.join(__dirname, '..', 'weapons_translation.json'));
  Object.assign(translation, ext);
} catch(e) {}

function traduzir(nomeEN) {
  return translation[nomeEN] || nomeEN;
}

// Fetch com timeout
async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

async function getPlayerId(playerName) {
  const res = await fetchWithTimeout(ALBION_API + '/search?q=' + encodeURIComponent(playerName), TIMEOUT_MS);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const players = data.players || [];
  const player = players.find(p => p.Name.toLowerCase() === playerName.toLowerCase()) || players[0];
  if (!player) throw new Error('Player "' + playerName + '" nao encontrado na API do Albion.');
  return { id: player.Id, name: player.Name };
}

async function getWeaponUsage(playerId) {
  // Busca kills E mortes em paralelo
  const [killsRes, deathsRes] = await Promise.all([
    fetchWithTimeout(ALBION_API + '/players/' + playerId + '/kills?limit='  + KILL_LIMIT + '&offset=0', TIMEOUT_MS),
    fetchWithTimeout(ALBION_API + '/players/' + playerId + '/deaths?limit=' + KILL_LIMIT + '&offset=0', TIMEOUT_MS),
  ]);

  const kills  = killsRes.ok  ? await killsRes.json()  : [];
  const deaths = deathsRes.ok ? await deathsRes.json() : [];

  const weaponCount = {};

  // Conta arma usada nas kills (player eh o killer)
  for (const kill of kills) {
    const tipo = kill?.Killer?.Equipment?.MainHand?.Type || '';
    if (!tipo) continue;
    weaponCount[tipo] = (weaponCount[tipo] || 0) + 1;
  }

  // Conta arma usada nas mortes (player eh a vitima — mostra o equipamento dele)
  for (const death of deaths) {
    const tipo = death?.Victim?.Equipment?.MainHand?.Type || '';
    if (!tipo) continue;
    weaponCount[tipo] = (weaponCount[tipo] || 0) + 1;
  }

  return { weaponCount, total: kills.length + deaths.length };
}

// Mapeia item ID (ex: T8_MAIN_HOLYSTAFF_AVALON) -> nome PT
function itemIdToName(itemId) {
  const clean = itemId.replace(/^T\d+_/, '').replace(/@\d+$/, '');

  // Mapa direto de codigos internos para nomes EN
  const codeMap = {
    'MAIN_HOLYSTAFF_AVALON':      'Hallowfall',
    '2H_NATURESTAFF_HELL':        'Blight Staff',
    'MAIN_HOLYSTAFF':             'Holy Staff',
    '2H_DAGGERPAIR':              'Dagger Pair',
    '2H_NATURESTAFF_KEEPER':      'Rampant Staff',
    'MAIN_MACE':                  'Mace',
    '2H_HOLYSTAFF_UNDEAD':        'Redemption Staff',
    'MAIN_MACE_HELL':             'Incubus Mace',
    '2H_HAMMER_AVALON':           'Hand of Justice',
    'MAIN_NATURESTAFF':           'Nature Staff',
    'MAIN_HAMMER':                'Hammer',
    '2H_LONGBOW':                 'Longbow',
    'MAIN_NATURESTAFF_KEEPER':    'Druidic Staff',
    '2H_POLEHAMMER':              'Polehammer',
    '2H_ARCANESTAFF_HELL':        'Occult Staff',
    '2H_ROCKSTAFF_KEEPER':        'Staff of Balance',
    'MAIN_ROCKMACE_KEEPER':       'Bedrock Mace',
    '2H_ARCANESTAFF':             'Great Arcane Staff',
    'MAIN_RAPIER_MORGANA':        'Bloodletter',
    '2H_HOLYSTAFF_CRYSTAL':       'Exalted Staff',
    '2H_DUALMACE_AVALON':         'Oathkeepers',
    'MAIN_MACE_CRYSTAL':          'Dreadstorm Monarch',
    '2H_ARCANESTAFF_CRYSTAL':     'Astral Staff',
    'MAIN_CURSEDSTAFF_UNDEAD':    'Lifecurse Staff',
    '2H_RAM_KEEPER':              'Grovekeeper',
    'MAIN_DAGGER':                'Dagger',
    'MAIN_ARCANESTAFF_UNDEAD':    'Witchwork Staff',
    '2H_ENIGMATICORB_MORGANA':    'Malevolent Locus',
    'MAIN_ARCANESTAFF':           'Arcane Staff',
    '2H_HOLYSTAFF':               'Great Holy Staff',
    '2H_DIVINESTAFF':             'Divine Staff',
    '2H_ICECRYSTAL_UNDEAD':       'Permafrost Prism',
    'MAIN_FROSTSTAFF':            'Frost Staff',
    '2H_DUALSICKLE_UNDEAD':       'Deathgivers',
    '2H_CLAWPAIR':                'Claws',
    '2H_COMBATSTAFF_MORGANA':     'Black Monk Stave',
    '2H_AXE_AVALON':              'Realmbreaker',
    '2H_FIRE_RINGPAIR_AVALON':    'Dawnsong',
    'MAIN_CURSEDSTAFF_AVALON':    'Shadowcaller',
    '2H_KNUCKLES_KEEPER':         'Bear Paws',
    '2H_SPEAR_UNDEAD':            'Spirithunter',
    '2H_HALBERD_MORGANA':         'Carrioncaller',
    '2H_HAMMER_UNDEAD':           'Tombhammer',
    '2H_CROSSBOW_UNDEAD':         'Mistpiercer',
    '2H_BOW_KEEPER':              'Bow of Badon',
    '2H_CROSSBOWLARGE':           'Siegebow',
    '2H_REPEATINGCROSSBOW_UNDEAD':'Weeping Repeater',
    '2H_CROSSBOW_AVALON':         'Boltcasters',
    '2H_CLAYMORE_AVALON':         'Kingmaker',
    'MAIN_SCIMITAR_MORGANA':      'Scimitar',
    '2H_DAGGER_KATAR_AVALON':     'Katar',
    '2H_DAGGERPAIR_CRYSTAL':      'Sickle Pair',
    '2H_GLAIVE':                  'Glaive',
    '2H_GLAIVE_CRYSTAL':          'Crystal Reaper',
    'MAIN_SPEAR':                 'Spear',
    '2H_SPEAR':                   'Pike',
    'MAIN_SPEAR_CRYSTAL':         'Heron Spear',
    '2H_SPEAR_CRYSTAL':           'Trinity Spear',
    'MAIN_AXE':                   'Battle Axe',
    '2H_AXE':                     'Great Axe',
    '2H_HALBERD':                 'Halberd',
    'MAIN_SWORD':                 'Sword',
    '2H_CLAYMORE':                'Claymore',
    '2H_DUALSWORD':               'Dual Swords',
    'MAIN_SWORD_UNDEAD':          'Carving Sword',
    '2H_CLAYMORE_MORGANA':        'Broadsword',
    'MAIN_HAMMER':                'Hammer',
    '2H_HAMMER':                  'Great Hammer',
    '2H_POLEHAMMER':              'Polehammer',
    'MAIN_MACE':                  'Mace',
    '2H_MACE':                    'Heavy Mace',
    'MAIN_BOW':                   'Bow',
    '2H_BOW':                     'Warbow',
    '2H_BOW_UNDEAD':              'Wailing Bow',
    'MAIN_BOW_KEEPER':            'Whispering Bow',
    'MAIN_CROSSBOW':              'Crossbow',
    '2H_CROSSBOW':                'Heavy Crossbow',
    'MAIN_CROSSBOW_UNDEAD':       'Light Crossbow',
    'MAIN_CURSEDSTAFF':           'Cursed Staff',
    '2H_CURSEDSTAFF':             'Great Cursed Staff',
    'MAIN_DEMONICSTAFF':          'Demonic Staff',
    'MAIN_FIRESTAFF':             'Fire Staff',
    '2H_FIRESTAFF':               'Great Fire Staff',
    '2H_INFERNOSTAFF_MORGANA':    'Blazing Staff',
    '2H_FIRESTAFF_KEEPER':        'Wildfire Staff',
    '2H_FIRESTAFF_UNDEAD':        'Brimstone Staff',
    'MAIN_FROSTSTAFF':            'Frost Staff',
    '2H_FROSTSTAFF':              'Great Frost Staff',
    '2H_FROSTSTAFF_UNDEAD':       'Glacial Staff',
    '2H_FROSTSTAFF_KEEPER':       'Hoarfrost Staff',
    'MAIN_ARCANESTAFF':           'Arcane Staff',
    '2H_ARCANESTAFF':             'Great Arcane Staff',
    '2H_ENIGMATICSTAFF':          'Enigmatic Staff',
    'MAIN_NATURESTAFF':           'Nature Staff',
    '2H_NATURESTAFF':             'Great Nature Staff',
    '2H_IRONROOTSTAFF_KEEPER':    'Ironroot Staff',
    'MAIN_HOLYSTAFF':             'Holy Staff',
    '2H_HOLYSTAFF':               'Great Holy Staff',
    '2H_DIVINESTAFF':             'Divine Staff',
    '2H_PRIMALSTAFF':             'Primal Staff',
  };

  const enName = codeMap[clean];
  if (enName) return traduzir(enName);
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
    )
    .addStringOption(opt => opt
      .setName('arma')
      .setDescription('Filtrar por arma especifica (opcional)')
      .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const playerName = interaction.options.getString('player');
    const armaFiltro = interaction.options.getString('arma')?.toLowerCase() || null;

    try {
      let weapons = [];
      const fonte = 'API Albion Online (ultimos ' + KILL_LIMIT + ' kills)';

      const player = await getPlayerId(playerName);
      const { weaponCount, total: t } = await getWeaponUsage(player.id);

      weapons = Object.entries(weaponCount)
        .sort(([,a],[,b]) => b - a)
        .map(([id, count]) => ({
          weapon_name: itemIdToName(id),
          usages: count,
          win_rate: null
        }));

      if (!weapons.length) {
        return interaction.editReply({ content: 'Nenhum dado encontrado para **' + playerName + '**.' });
      }

      // Filtra por arma se especificado
      if (armaFiltro) {
        weapons = weapons.filter(w =>
          (w.weapon_name || '').toLowerCase().includes(armaFiltro)
        );
        if (!weapons.length) {
          return interaction.editReply({ content: 'Nenhuma arma com "' + armaFiltro + '" encontrada para **' + playerName + '**.' });
        }
      }

      const top = weapons.slice(0, 10);
      const totalUsos = top.reduce((s, w) => s + (w.usages || 0), 0);

      const embed = new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('Stats — ' + playerName)
        .addFields(top.map((w, i) => {
          const nome    = w.weapon_name || '?';
          const usos    = w.usages || 0;
          const assists = w.assists != null ? ' | Assists: `' + w.assists + '`' : '';
          const wr      = w.win_rate != null ? ' | Win: `' + (w.win_rate * 100).toFixed(0) + '%`' : '';
          return {
            name: (i + 1) + '. ' + nome,
            value: 'Usos: `' + usos + '`' + assists + wr,
            inline: true
          };
        }))
        .setFooter({ text: 'Fonte: ' + fonte });

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('[Stats] Erro:', err.message);
      if (err.name === 'AbortError') {
        return interaction.editReply({ content: 'Timeout — tente novamente.' });
      }
      return interaction.editReply({ content: 'Erro: ' + err.message });
    }
  }
};
