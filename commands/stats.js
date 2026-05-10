const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const STATS_URL = 'https://kozieldota2-art.github.io/Zeveze/?player=';
const TIMEOUT_MS = 15000;

const translation = {"Hallowfall":"Queda Santa","Blight Staff":"Pustulento","Holy Staff":"Cajado Sagrado","Dagger Pair":"Par de Adagas","Rampant Staff":"Rampante","Mace":"Maça 1H","Redemption Staff":"Redenção","Incubus Mace":"Íncubo","Hand of Justice":"Mão da Justiça","Nature Staff":"Cajado da Natureza","Hammer":"Martelo 1H","Longbow":"Arco Longo","Druidic Staff":"Cajado Druídico","Polehammer":"Martelo de Batalha","Occult Staff":"Oculto","Staff of Balance":"Cajado do Equilíbrio","Bedrock Mace":"Maça Pétrea","Great Arcane Staff":"Arcano Elevado","Bloodletter":"Dessangradora","Exalted Staff":"Exaltado","Oathkeepers":"Jurador","Dreadstorm Monarch":"Monarca Tempestuoso","Astral Staff":"Astral","Lifecurse Staff":"Execrado","Grovekeeper":"Guarda Bosque","Dagger":"Adaga","Witchwork Staff":"Feiticeiro","Malevolent Locus":"Locus","Arcane Staff":"Arcano Silence","Great Holy Staff":"Sagrado Elevado","Divine Staff":"Cajado Divino","Permafrost Prism":"Prisma","Frost Staff":"Cajado de Gelo","Deathgivers":"Mortíficos","Claws":"Garras","Black Monk Stave":"Monge Negro","Realmbreaker":"Quebra reino","Dawnsong":"Canção da Alvorada","Shadowcaller":"Chama-sombra","Bear Paws":"Patas de Urso","Spirithunter":"Caça espíritos","Carrioncaller":"Chama corpos","Tombhammer":"Martelo Tumular","Mistpiercer":"Furabruma","Bow of Badon":"Badon","Siegebow":"Arco de Cerco","Weeping Repeater":"Repetidor Lamentoso","Boltcasters":"Lançadores de Dardos","Galatines":"Galatinas","Kingmaker":"Cria-reis","Infernal Scythe":"Segadeira","Ghostfang":"Presa Demoníaca","Hellion Hands":"Mãos Pretas","Broadsword":"Espada Larga","Claymore":"Montante","Dual Swords":"Espadas Duplas","Carving Sword":"Espada Entalhada","Battle Axe":"Machado de Guerra","Great Axe":"Machadão","Halberd":"Alabarda","Spear":"Lança","Pike":"Pique","Glaive":"Archa","Heron Spear":"Garceira","Trinity Spear":"Lança Trina","Warhammer":"Martelo de Guerra","Great Hammer":"Martelo Pesado","Forge Hammers":"Martelos de Forja","Crossbow":"Besta","Heavy Crossbow":"Besta Pesada","Light Crossbow":"Besta Leve","Bow":"Arco","Warbow":"Arco de Guerra","Wailing Bow":"Plangente","Whispering Bow":"Arco Sussurrante","Shortsword":"Espada Curta","Sword":"Espada","Rapier":"Rapieira","Cursed Staff":"Cajado Amaldiçoado","Great Cursed Staff":"Cajado Amaldiçoado Elevado","Fire Staff":"Cajado de Fogo","Great Fire Staff":"Cajado de Fogo Elevado"};

function traduzir(en) { return translation[en] || en; }

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchStats(playerName) {
  const target = 'https://murderledger.com/api/players/' + encodeURIComponent(playerName) + '/stats/weapons?lookback_days=9999';
  const url    = 'https://corsproxy.io/?' + encodeURIComponent(target);
  const res    = await fetchWithTimeout(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.weapons || [];
}

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
    await interaction.deferReply({ ephemeral: true });

    const playerName = interaction.options.getString('player');

    try {
      const weapons = await fetchStats(playerName);
      const valid   = weapons.filter(w => w.weapon_name);

      if (!valid.length) {
        return interaction.editReply({ content: 'Nenhum dado encontrado para **' + playerName + '** no Murder Ledger.' });
      }

      const top5 = valid.slice(0, 5);
      const totalUsos = valid.reduce((s, w) => s + w.usages, 0);

      const embed = new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('Stats — ' + (valid[0] && playerName))
        .setDescription('Top armas de **' + playerName + '** (historico completo)')
        .addFields(
          top5.map((w, i) => {
            const nome = traduzir(w.weapon_name);
            const wr   = w.win_rate != null ? ' | ' + Math.round(w.win_rate * 100) + '% win' : '';
            const role = w.assists > w.kills * 3 ? ' (Healer/Support)' : '';
            return {
              name: (i + 1) + '. ' + nome + role,
              value: 'Usos: `' + w.usages + '` | Kills: `' + w.kills + '` | Assists: `' + w.assists + '`' + wr,
              inline: false
            };
          })
        )
        .addFields({
          name: 'Ver historico completo',
          value: '[Clique aqui](' + STATS_URL + encodeURIComponent(playerName) + ')',
          inline: false
        })
        .setFooter({ text: 'Fonte: Murder Ledger | ' + totalUsos.toLocaleString('pt-BR') + ' participacoes totais' });

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('[Stats] Erro:', err.message);
      const link = STATS_URL + encodeURIComponent(playerName);
      return interaction.editReply({
        content: 'Nao foi possivel carregar os dados agora. Acesse diretamente:\n' + link
      });
    }
  }
};
