const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

// Acha a proxima linha vazia na coluna de players (coluna C = index 2)
async function getNextEmptyRow(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!C4:C100'
  });
  const rows = res.data.values || [];
  return 4 + rows.length; // começa na linha 4
}

// Adiciona confirmacao de presenca na planilha (lado esquerdo)
async function addConfirmation(sheetName, number, playerName, weapon1, weapon2) {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const row      = 3 + number;
  const statsUrl = 'https://kozieldota2-art.github.io/Zeveze/?player=' + playerName;

  // C=Players, D=Arma1, E=Arma2, F=USAGES (link)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!C' + row + ':F' + row,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[ playerName, weapon1, weapon2, '=HIPERLINK("' + statsUrl + '";"Ver Stats")' ]]
    }
  });
}

// Remove confirmacao da planilha
async function removeConfirmation(sheetName, number) {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const row = 3 + number;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!C' + row + ':F' + row,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['', '', '', '']]
    }
  });
}

// Atribui player a uma arma no lado direito da planilha
async function assignPlayerToWeapon(sheetName, weaponName, playerName) {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Le coluna M (ARMA) para achar a linha
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!M4:M60'
  });

  const rows = res.data.values || [];
  let targetRow = null;

  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i][0] || '').toLowerCase().trim();
    if (cell === weaponName.toLowerCase().trim()) {
      targetRow = 4 + i;
      break;
    }
  }

  if (!targetRow) {
    console.log('Arma nao encontrada na planilha: ' + weaponName);
    return false;
  }

  // Coluna N = player
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!N' + targetRow,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[playerName]]
    }
  });

  return true;
}

// Limpa confirmacoes da planilha (ao fechar evento)
async function clearConfirmations(sheetName, total) {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = [];
  for (let i = 0; i < total; i++) {
    rows.push(['', '', '', '']);
  }

  if (rows.length === 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!C4:F' + (3 + total),
    valueInputOption: 'RAW',
    requestBody: { values: rows }
  });
}

// Adiciona confirmacao simples (taaanque) - so nome na coluna C
async function addConfirmationSimples(sheetName, number, playerName) {
  const auth     = getAuth();
  const sheets   = google.sheets({ version: 'v4', auth });
  const row      = 3 + number;
  const statsUrl = 'https://kozieldota2-art.github.io/Zeveze/?player=' + playerName;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName + '!C' + row + ':F' + row,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[playerName, '', '', '=HIPERLINK("' + statsUrl + '";"Ver Stats")']] }
  });
}

module.exports = {
  addConfirmation,
  addConfirmationSimples,
  removeConfirmation,
  assignPlayerToWeapon,
  clearConfirmations
};
