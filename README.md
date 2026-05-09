# ⚔️ ZVZ Bot — Albion Online

Bot de Discord para gerenciamento de ZvZ da guilda.

---

## 📁 Estrutura do Projeto

```
zvz-bot/
├── index.js          → Arquivo principal (inicia o bot)
├── database.js       → Banco de dados SQLite
├── commands/
│   ├── comp.js       → /comp criar | listar | deletar
│   ├── arma.js       → /arma adicionar | listar | remover
│   └── zvz.js        → /zvz ping
├── .env              → Suas credenciais (NUNCA compartilhe!)
├── .env.example      → Exemplo de configuração
└── package.json
```

---

## 🚀 Instalação

### 1. Instale o Node.js
Baixe em: https://nodejs.org (versão LTS)

### 2. Baixe o projeto
Coloque todos os arquivos numa pasta chamada `zvz-bot`

### 3. Instale as dependências
Abra o terminal dentro da pasta e rode:
```bash
npm install
```

### 4. Configure o .env
Copie o `.env.example` para `.env` e preencha:
```
DISCORD_TOKEN=seu_token_aqui
OFFICER_ROLE_ID=id_do_cargo_officer
CALLER_ROLE_ID=id_do_cargo_caller
```

### 5. Inicie o bot
```bash
npm start
```

---

## 💬 Comandos

### Officers (gerenciar banco)
| Comando | Descrição |
|--------|-----------|
| `/comp criar nome:Brawl descricao:Comp de corpo a corpo` | Cria uma composição |
| `/comp listar` | Lista todas as comps |
| `/comp deletar nome:Brawl` | Deleta uma comp |
| `/arma adicionar comp:Brawl nome:Hallowfall role:Healer build:https://...` | Adiciona arma |
| `/arma listar comp:Brawl` | Lista armas de uma comp |
| `/arma remover comp:Brawl nome:Hallowfall` | Remove arma |

### Caller (pingar ZvZ)
| Comando | Descrição |
|--------|-----------|
| `/zvz ping comp:Brawl horario:20:00 BRT descricao:Castelo Sul cargo:@ZvZ` | Pinga evento |

### Fluxo dos players
1. Veem o embed no canal
2. Clicam em ✅ **Confirmar Presença**
3. Escolhem **2 armas** que conseguem jogar
4. O Caller clica em ⚔️ **Atribuir** e define a arma de cada player
5. O embed é atualizado em tempo real

---

## 🔑 Como pegar IDs no Discord
1. Abra Discord → Configurações → Avançado → ative **Modo Desenvolvedor**
2. Clique com botão direito no cargo/canal → **Copiar ID**
