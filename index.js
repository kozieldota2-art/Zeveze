require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
const db   = require('./database');

// ─── CLIENTE ──────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.commands = new Collection();

// ─── CARREGA COMANDOS ─────────────────────────────────────────────────────────

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`📦 Comando carregado: /${command.data.name}`);
  }
}

// ─── READY ────────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`\n✅ Bot online como: ${client.user.tag}`);
  db.initialize();

  // Registra slash commands globalmente
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const commandsJSON = [...client.commands.values()].map(c => c.data.toJSON());

  try {
    console.log('⏳ Registrando slash commands...');
    await rest.put(Routes.applicationGuildCommands(client.user.id, '808072941031129099'), { body: commandsJSON });
    console.log('✅ Slash commands registrados!\n');
  } catch (error) {
    console.error('❌ Erro ao registrar commands:', error);
  }
});

// ─── INTERAÇÕES ───────────────────────────────────────────────────────────────

client.on('interactionCreate', async interaction => {

  // Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Erro no comando /${interaction.commandName}:`, error);
      const payload = { content: '❌ Ocorreu um erro ao executar este comando.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  // Autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      await command.autocomplete(interaction).catch(console.error);
    }
    return;
  }

  // Botões e Select Menus — roteia para o comando correto via prefixo do customId
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const [prefix] = interaction.customId.split(':');

    for (const [, command] of client.commands) {
      if (command.handleInteraction) {
        try {
          await command.handleInteraction(interaction, prefix);
        } catch (error) {
          console.error('Erro em handleInteraction:', error);
          const payload = { content: '❌ Ocorreu um erro.', ephemeral: true };
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(payload).catch(() => {});
          }
        }
      }
    }
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN);
