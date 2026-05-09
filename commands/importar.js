const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const db = require('../database');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const SHEET_MAP = {
  'kite':        'COMP KITE',
  'brawl':       'COMP BRAWL',
  'magrin push': 'COMP MAGRIN PUSH',
  'yami':        'COMP YAMI',
  'no lock':     'COMP NO LOCK',
  'magr1n':      'COMP MAGR1N',
};

// Converte o role da planilha pro role do bot
function mapRole(roleStr) {
  if (!roleStr) return 'DPS Melee';
  const r = roleStr.toUpperCase().trim();
  if (r === 'TANK')    return 'Tank Ofensivo';
  if (r === 'SUPORTE') return 'Support';
  if (r === 'DPS')     return 'DPS Melee';
  if (r === 'HEALER')  return 'Healer';
  if (r === 'BM')      return 'Battlemount';
  return 'DPS Melee';
}

function isOfficer(interaction) {
  const roleId = process.env.OFFICER_ROLE_ID;
  if (!roleId) return true;
  return interaction.member.roles.cache.has(roleId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('importar')
    .setDescription('Importa armas de uma comp diretamente da planilha')
    .addStringOption(opt => opt
      .setName('comp')
      .setDescription('Nome da comp no bot')
      .setRequired(true)
      .setAutocomplete(true)
    ),

  async execute(interaction) {
    if (!isOfficer(interaction)) {
      return interaction.reply({ content: 'Voce precisa ser Officer para usar este comando.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const compName = interaction.options.getString('comp');
    const comp     = db.getCompByName(compName);
    if (!comp) return interaction.editReply({ content: 'Composicao "' + compName + '" nao encontrada. Crie com /comp criar primeiro.' });

    const sheetName = SHEET_MAP[compName.toLowerCase()];
    if (!sheetName) return interaction.editReply({ content: 'Aba da planilha nao mapeada para a comp "' + compName + '".' });

    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth });

      // Le colunas I (ROLE) e J (ARMA) a partir da linha 4
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName + '!I4:J60'
      });

      const rows = res.data.values || [];
      if (!rows.length) return interaction.editReply({ content: 'Nao encontrei dados na aba ' + sheetName + '.' });

      let importadas = 0;
      let ignoradas  = 0;
      const importadasList = [];

      for (const row of rows) {
        const roleStr = (row[0] || '').trim();
        const arma    = (row[1] || '').trim();

        if (!arma) { ignoradas++; continue; }

        const role = mapRole(roleStr);

        try {
          db.addWeapon(comp.id, arma, role, '');
          importadasList.push(role + ': ' + arma);
          importadas++;
        } catch (e) {
          ignoradas++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('Importacao concluida!')
        .addFields(
          { name: 'Composicao', value: comp.name,         inline: true },
          { name: 'Aba',        value: sheetName,          inline: true },
          { name: 'Importadas', value: String(importadas), inline: true },
          { name: 'Ignoradas',  value: String(ignoradas),  inline: true },
          {
            name: 'Armas importadas',
            value: importadasList.slice(0, 20).join('\n') || 'Nenhuma',
            inline: false
          }
        )
        .setFooter({ text: 'Use /arma listar para conferir todas as armas.' });

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Erro ao importar da planilha:', err.message);
      return interaction.editReply({ content: 'Erro ao acessar a planilha: ' + err.message });
    }
  },

  async autocomplete(interaction) {
    const value = interaction.options.getFocused().toLowerCase();
    const comps = db.getAllComps()
      .filter(c => c.name.toLowerCase().includes(value))
      .slice(0, 25)
      .map(c => ({ name: c.name, value: c.name }));
    await interaction.respond(comps);
  }
};
