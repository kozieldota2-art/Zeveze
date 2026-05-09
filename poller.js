const { google } = require('googleapis');
const db = require('./database');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const POLL_INTERVAL  = 30000; // 30 segundos

const SHEET_MAP = {
  'kite':        'COMP KITE',
  'brawl':       'COMP BRAWL',
  'magrin push': 'COMP MAGRIN PUSH',
  'yami':        'COMP YAMI',
  'no lock':     'COMP NO LOCK',
  'magr1n':      'COMP MAGR1N',
};

function getSheetName(compName) {
  return SHEET_MAP[compName.toLowerCase()] || compName;
}

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

// Mapa de eventId -> intervalId para controlar os pollers ativos
const activePollers = {};

async function pollEvent(client, eventId) {
  const event = db.getEventById(eventId);

  // Para se evento foi fechado ou nao existe mais
  if (!event || event.status === 'closed') {
    stopPolling(eventId);
    return;
  }

  const comp      = db.getCompById(event.comp_id);
  const sheetName = getSheetName(comp.name);
  const weapons   = db.getWeaponsByComp(event.comp_id);

  try {
    const auth   = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Le colunas J (ARMA) e L (PLAYER) da aba
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName + '!J4:L60'
    });

    const rows = res.data.values || [];
    let updated = false;

    for (const row of rows) {
      const armaName   = (row[0] || '').trim();  // coluna J
      // coluna K = vazia (offhand ou similar)
      const playerName = (row[2] || '').trim();  // coluna L

      if (!armaName || !playerName) continue;

      // Acha a arma no banco pelo nome
      const weapon = weapons.find(w => w.name.toLowerCase() === armaName.toLowerCase());
      if (!weapon) continue;

      // Acha o player nas confirmacoes pelo displayName
      const confirmations = db.getConfirmationsByEvent(eventId);
      const conf = confirmations.find(c =>
        c.user_name.toLowerCase() === playerName.toLowerCase() &&
        c.assigned_weapon_id !== weapon.id
      );

      if (!conf) continue;

      // Atribui a arma no banco
      db.assignWeapon(eventId, conf.user_id, weapon.id);
      updated = true;
      console.log('[Poller] ' + playerName + ' atribuido a ' + armaName + ' via planilha (evento ' + eventId + ')');
    }

    // Se houve mudanca, atualiza o embed
    if (updated) {
      await refreshEmbed(client, db.getEventById(eventId));
    }

  } catch (err) {
    console.error('[Poller] Erro ao verificar planilha (evento ' + eventId + '):', err.message);
  }
}

async function refreshEmbed(client, event) {
  try {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const comp          = db.getCompById(event.comp_id);
    const confirmations = db.getConfirmationsByEvent(event.id);
    const weapons       = db.getWeaponsByComp(event.comp_id);

    const ROLE_LABEL = {
      'Tank Ofensivo':  '[Tank Of]',
      'Tank Defensivo': '[Tank Def]',
      'Healer':         '[Healer]',
      'DPS Melee':      '[DPS Melee]',
      'DPS Range':      '[DPS Range]',
      'Support':        '[Support]',
      'Battlemount':    '[Mount]',
    };

    const byRole = {};
    for (const w of weapons) {
      if (!byRole[w.role]) byRole[w.role] = [];
      byRole[w.role].push(w);
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle('ZVZ CALL -- ' + comp.name.toUpperCase())
      .setDescription(event.description || 'Confirme sua presenca clicando no botao abaixo.')
      .addFields(
        { name: 'Horario', value: event.scheduled_time, inline: true },
        { name: 'Caller',  value: '<@' + event.caller_id + '>', inline: true },
        { name: 'Status',  value: event.status === 'open' ? 'Aberto' : 'Fechado', inline: true }
      );

    for (const role of Object.keys(ROLE_LABEL)) {
      if (!byRole[role] || !byRole[role].length) continue;
      embed.addFields({
        name: ROLE_LABEL[role] + ' ' + role,
        value: byRole[role].map(w => '- ' + w.name + (w.build_url ? ' -- [Build](' + w.build_url + ')' : '')).join('\n'),
        inline: true
      });
    }

    const total    = confirmations.length;
    const assigned = confirmations.filter(c => c.assigned_weapon_name).length;

    if (total > 0) {
      const lines = confirmations.map(c => {
        if (c.assigned_weapon_name) return 'OK <@' + c.user_id + '> --> ' + c.assigned_weapon_name;
        return '? <@' + c.user_id + '> -- ' + c.weapon1_name + ' / ' + c.weapon2_name;
      }).join('\n');
      embed.addFields({ name: 'Confirmados: ' + total + ' | Atribuidos: ' + assigned, value: lines, inline: false });
    } else {
      embed.addFields({ name: 'Confirmados: 0', value: 'Ninguem confirmou presenca ainda.', inline: false });
    }

    embed.setFooter({ text: 'ID do Evento: ' + event.id + ' | Atualizado pela planilha' });

    const isClosed = event.status === 'closed';
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('zvz_confirmar:' + event.id).setLabel('Confirmar Presenca').setStyle(ButtonStyle.Success).setDisabled(isClosed),
      new ButtonBuilder().setCustomId('zvz_cancelar:'  + event.id).setLabel('Cancelar Presenca').setStyle(ButtonStyle.Secondary).setDisabled(isClosed),
      new ButtonBuilder().setCustomId('zvz_atribuir:'  + event.id).setLabel('Atribuir (Caller)').setStyle(ButtonStyle.Primary).setDisabled(isClosed),
      new ButtonBuilder().setCustomId('zvz_fechar:'    + event.id).setLabel('Fechar Evento').setStyle(ButtonStyle.Danger).setDisabled(isClosed)
    );

    const channel = await client.channels.fetch(event.channel_id);
    const message = await channel.messages.fetch(event.message_id);
    await message.edit({ embeds: [embed], components: [buttons] });
  } catch (err) {
    console.error('[Poller] Erro ao atualizar embed:', err.message);
  }
}

// Inicia polling de um evento
function startPolling(client, eventId) {
  if (activePollers[eventId]) return; // ja ta rodando

  console.log('[Poller] Iniciando polling do evento ' + eventId);
  const intervalId = setInterval(() => {
    pollEvent(client, eventId);
  }, POLL_INTERVAL);

  activePollers[eventId] = intervalId;
}

// Para polling de um evento
function stopPolling(eventId) {
  if (activePollers[eventId]) {
    clearInterval(activePollers[eventId]);
    delete activePollers[eventId];
    console.log('[Poller] Polling encerrado para evento ' + eventId);
  }
}

module.exports = { startPolling, stopPolling };
