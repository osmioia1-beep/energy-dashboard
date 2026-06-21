# Energy Dashboard — Documentação Completa

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Backend — Servidores de Monitorização](#3-backend--servidores-de-monitorização)
   - 3.1 [Servidor Bomba Furo (server.js)](#31-servidor-bomba-furo-serverjs)
   - 3.2 [Servidor Piscina (server-piscina.js)](#32-servidor-piscina-server-piscinajs)
   - 3.3 [Servidor Máq. Lavar Roupa (server-maqlavar.js)](#33-servidor-máq-lavar-roupa-server-maqlavarjs)
   - 3.4 [Servidor Máq. Secar Roupa (server-maqsecar.js)](#34-servidor-máq-secar-roupa-server-maqsecarjs)
   - 3.5 [Servidor V2C Trydan (server-v2c.js)](#35-servidor-v2c-trydan-server-v2cjs)
   - 3.6 [Padrão Comum dos Servidores Shelly](#36-padrão-comum-dos-servidores-shelly)
4. [Base de Dados (Supabase)](#4-base-de-dados-supabase)
   - 4.1 [Tabela `shelly_events`](#41-tabela-shelly_events)
   - 4.2 [Tabela `v2c_charging_sessions`](#42-tabela-v2c_charging_sessions)
   - 4.3 [View `device_list`](#43-view-device_list)
5. [Frontend — Dashboard Web](#5-frontend--dashboard-web)
   - 5.1 [Estrutura de Ficheiros](#51-estrutura-de-ficheiros)
   - 5.2 [Serviço Supabase (supabase.js)](#52-serviço-supabase-supabasejs)
   - 5.3 [Página Dashboard](#53-página-dashboard)
   - 5.4 [Página DeviceDetail](#54-página-devicedetail)
   - 5.5 [Página V2C](#55-página-v2c)
   - 5.6 [Componentes](#56-componentes)
6. [Fluxo de Dados Completo](#6-fluxo-de-dados-completo)
   - 6.1 [Eventos Shelly (Furo, Piscina, Lavar, Secar)](#61-eventos-shelly-furo-piscina-lavar-secar)
   - 6.2 [Sessões V2C](#62-sessões-v2c)
7. [Estatísticas e Informações Entregues](#7-estatísticas-e-informações-entregues)
   - 7.1 [Dashboard Principal](#71-dashboard-principal)
   - 7.2 [Detalhe do Dispositivo](#72-detalhe-do-dispositivo)
   - 7.3 [Página V2C](#73-página-v2c)
8. [Bugs Conhecidos e Incongruências](#8-bugs-conhecidos-e-incongruências)
9. [Configuração e Deploy](#9-configuração-e-deploy)

---

## 1. Visão Geral

O **Energy Dashboard** é um sistema de monitorização de energia doméstica que recolhe dados de 5 dispositivos Shelly e apresenta-os numa interface web. O sistema é composto por:

- **5 servidores Node.js** (backend) — um por dispositivo, a correr no Windows
- **1 base de dados Supabase** — armazena todos os eventos e sessões
- **1 dashboard web React** — frontend estático deployado no Render

### Dispositivos Monitorizados

| Dispositivo | Servidor | Porta | API Shelly | Mecanismo |
|---|---|---|---|---|
| Bomba Furo (EM) | `server.js` | 3210 | Gen 1 `/status` | Webhooks |
| Piscina (Plus Plug S) | `server-piscina.js` | 3211 | Gen 2 `/rpc/Shelly.GetStatus` | Webhooks |
| Máq. Lavar Roupa (PM Mini Gen 3) | `server-maqlavar.js` | 3212 | Gen 3 `/rpc/Shelly.GetStatus` | Webhooks |
| Máq. Secar Roupa (PM Mini Gen 3) | `server-maqsecar.js` | 3213 | Gen 3 `/rpc/Shelly.GetStatus` | Webhooks |
| V2C Trydan (EV charger) | `server-v2c.js` | 3214 | REST `/RealTimeData` | Webhooks + Polling |

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        WINDOWS HOST                         │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ server.js│  │server-   │  │server-   │  │server-   │   │
│  │  :3210   │  │piscina   │  │maqlavar  │  │maqsecar  │   │
│  │          │  │  :3211   │  │  :3212   │  │  :3213   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │         │
│       └──────────────┴──────────────┴──────────────┘         │
│                          │                                   │
│                    ┌─────┴─────┐                             │
│                    │server-v2c │                             │
│                    │   :3214   │                             │
│                    └─────┬─────┘                             │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTP (REST API)
                           ▼
              ┌────────────────────────┐
              │      SUPABASE          │
              │  ┌──────────────────┐  │
              │  │  shelly_events   │  │
              │  ├──────────────────┤  │
              │  │v2c_charging_     │  │
              │  │  sessions        │  │
              │  ├──────────────────┤  │
              │  │  device_list     │  │
              │  │  (view)          │  │
              │  └──────────────────┘  │
              └───────────┬────────────┘
                          │ HTTP (REST API)
                          ▼
              ┌────────────────────────┐
              │   RENDER (Static Site) │
              │   energy-dashboard     │
              │   .onrender.com        │
              │                        │
              │   React + Vite +       │
              │   Tailwind + Recharts  │
              └────────────────────────┘
```

### Fluxo Resumido

1. **Shelly** deteta mudança de estado (ligar/desligar) → envia **webhook HTTP** para o servidor correspondente
2. **Servidor** valida o evento (filtro de falsos positivos), lê dados atuais do Shelly, e **insere na BD Supabase**
3. **Dashboard** (browser) faz polling à BD Supabase a cada 30s e apresenta os dados

---

## 3. Backend — Servidores de Monitorização

### 3.1 Servidor Bomba Furo (server.js)

- **Porta:** 3210
- **Shelly:** EM (Gen 1), IP `192.168.70.73`, Canal 0
- **API:** `GET /status` → `data.emeters[0]`
- **Threshold webhook:** 200W (configurado nas Actions do Shelly)
- **Threshold confirmação:** 10W (filtro de falsos positivos no servidor)
- **Campos lidos:** `power`, `voltage`, `total` (energia acumulada), `react`

**Webhook routes:**
- `GET/POST /webhook/pump/start` — início de bombeamento
- `GET/POST /webhook/pump/stop` — fim de bombeamento

### 3.2 Servidor Piscina (server-piscina.js)

- **Porta:** 3211
- **Shelly:** Plus Plug S (Gen 2), IP `192.168.70.78`
- **API:** `GET /rpc/Shelly.GetStatus` → `data['switch:0']`
- **Threshold confirmação:** 10W + verificação do campo `output` (boolean)
- **Campos lidos:** `apower`, `voltage`, `current`, `aenergy.total`, `output`

**Diferença chave:** Para além da potência, verifica o campo `output` boolean do Shelly. Um `start` só é confirmado se `power >= 10W` **E** `output === true`.

**Webhook routes:**
- `GET/POST /webhook/pump/start`
- `GET/POST /webhook/pump/stop`

### 3.3 Servidor Máq. Lavar Roupa (server-maqlavar.js)

- **Porta:** 3212
- **Shelly:** PM Mini Gen 3, IP `192.168.70.74`
- **API:** `GET /rpc/Shelly.GetStatus` → `data['pm1:0']`
- **Threshold:** 50W (usado tanto para deteção como confirmação)
- **Campos lidos:** `apower`, `voltage`, `current`, `aenergy.total`

**Webhook routes:**
- `GET/POST /webhook/pump/start`
- `GET/POST /webhook/pump/stop`

### 3.4 Servidor Máq. Secar Roupa (server-maqsecar.js)

- **Porta:** 3213
- **Shelly:** PM Mini Gen 3, IP `192.168.70.75`
- **API:** `GET /rpc/Shelly.GetStatus` → `data['pm1:0']`
- **Threshold:** 50W
- **Campos lidos:** `apower`, `voltage`, `current`, `aenergy.total`

**Webhook routes:**
- `GET/POST /webhook/pump/start`
- `GET/POST /webhook/pump/stop`

### 3.5 Servidor V2C Trydan (server-v2c.js)

- **Porta:** 3214
- **Shelly:** Trydan (EV charger), IP `192.168.70.140`
- **API:** `GET /RealTimeData` — retorna JSON com dados em tempo real
- **Mecanismo:** Webhook-triggered polling (Shelly EM envia webhook → servidor valida ChargeState → polling a cada 30s)
- **Telegram:** Polling via `getUpdates` (a cada 3s) — sem webhooks

**Campos lidos do V2C:**
| Campo | Descrição | Unidade |
|---|---|---|
| `ChargeState` | Estado: 0=desconectado, 1=conectado, 2=carregando | — |
| `ChargePower` | Potência de carregamento | W |
| `ChargeEnergy` | Energia acumulada | kWh |
| `VoltageInstallation` | Tensão da instalação | V |
| `HousePower` | Potência da casa | W |
| `FVPower` | Potência solar FV | W |
| `BatteryPower` | Potência da bateria | W |
| `Intensity` | Corrente | A |

**Webhook routes:**
- `GET /webhook/charger/start` — início de carregamento (do Shelly EM)
- `GET /webhook/charger/stop` — fim de carregamento (do Shelly EM)

**Comandos Telegram:**
- `/status` — estado atual
- `/carro <nome>` — define o carro (Mitsubishi/Tesla)
- `/iniciar` — inicia sessão manualmente
- `/parar` — termina sessão
- `/help` — lista de comandos

### 3.6 Padrão Comum dos Servidores Shelly

Todos os 4 servidores de dispositivos Shelly seguem o mesmo padrão:

#### Filtro de Falsos Positivos (`confirmStateChange`)

```
Webhook recebido
    ↓
Espera 2 segundos (estabilização)
    ↓
Lê potência ao vivo do Shelly
    ↓
Se START e potência < threshold → espera 5s e re-verifica
    ↓ Se ainda < threshold → IGNORA (falso positivo)
Se STOP e potência > threshold → espera 5s e re-verifica
    ↓ Se ainda > threshold → IGNORA (falso positivo)
    ↓
Confirma → chama handleWebhook()
```

#### Circuit-Closing Logic (`handleWebhook`)

Para evitar ciclos abertos ou perdidos:

- **Webhook START mas servidor pensa que já está a correr:** Fecha ciclo anterior (insere STOP) e depois inicia novo (insere START)
- **Webhook STOP mas servidor pensa que está parado:** Abre ciclo (insere START) e depois fecha (insere STOP)

#### Inserção na BD (`logEvent`)

Cada evento confirmado é inserido na tabela `shelly_events` com:
```json
{
  "event_type": "start" | "stop",
  "power_watts": <float>,
  "voltage": <float>,
  "duration_seconds": <int | null>,
  "total_energy_wh": <float>,
  "reactive_power": <float | null>,  // apenas Furo
  "shelly_name": <string>,
  "shelly_ip": <string>
}
```

#### Alertas (`checkAlerts`)

- Cooldown: 60 segundos entre alertas
- Query: conta eventos `start` com `power_watts > 10` na última hora
- Se > 5 arranques/hora → envia alerta Telegram

---

## 4. Base de Dados (Supabase)

### 4.1 Tabela `shelly_events`

Armazena todos os eventos dos 4 dispositivos Shelly.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int8 (PK) | Auto-increment |
| `event_type` | text | `start` ou `stop` |
| `power_watts` | float8 | Potência no momento do evento (W) |
| `voltage` | float8 | Tensão (V) |
| `duration_seconds` | int4 | Duração da sessão anterior (s) — apenas em `stop` |
| `total_energy_wh` | float8 | Energia acumulada do Shelly (Wh) |
| `reactive_power` | float8 | Potência reativa (var) — apenas Furo |
| `shelly_name` | text | Nome do dispositivo |
| `shelly_ip` | text | IP do dispositivo |
| `created_at` | timestamptz | Timestamp do evento (default: now()) |

**RLS:** Habilitada com policy `service_role_all` (service role tem acesso total).

### 4.2 Tabela `v2c_charging_sessions`

Armazena sessões de carregamento do V2C Trydan.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | int8 (PK) | Auto-increment |
| `carro` | text | Nome do carro (Mitsubishi/Tesla/Outro/Desconhecido) |
| `start_time` | timestamptz | Início da sessão |
| `end_time` | timestamptz | Fim da sessão (NULL = em curso) |
| `duration_seconds` | int4 | Duração total (s) |
| `start_energy_wh` | float8 | Energia no início (kWh) |
| `end_energy_wh` | float8 | Energia no fim (kWh) |
| `total_energy_wh` | float8 | Energia total da sessão (kWh) |
| `avg_power_watts` | float8 | Potência média (W) |
| `max_power_watts` | float8 | Potência máxima (W) |
| `snapshots` | jsonb | Array de snapshots (dados a cada 60s) |
| `shelly_name` | text | Nome do dispositivo |
| `shelly_ip` | text | IP do dispositivo |
| `created_at` | timestamptz | Timestamp de criação |

**Nota:** O campo `total_energy_wh` armazena valores em **kWh** (não Wh) para sessões V2C. O nome é inconsistente mas o valor está em kWh.

**Snapshots (JSONB):**
```json
[
  {
    "time": "2026-06-21T10:00:00.000Z",
    "power": 7200,
    "energy": 12.5,
    "house_power": 3500,
    "fv_power": 2000,
    "battery_power": -1500,
    "intensity": 32,
    "charge_state": 2
  }
]
```

### 4.3 View `device_list`

```sql
CREATE OR REPLACE VIEW device_list AS
SELECT DISTINCT shelly_name, shelly_ip
FROM shelly_events
WHERE shelly_name IS NOT NULL
ORDER BY shelly_name;
```

Retorna a lista única de dispositivos que têm eventos na BD.

---

## 5. Frontend — Dashboard Web

### 5.1 Estrutura de Ficheiros

```
energy-dashboard/
├── src/
│   ├── App.jsx                    # HashRouter + rotas
│   ├── main.jsx                   # Entry point React
│   ├── services/
│   │   └── supabase.js            # Cliente Supabase REST API
│   ├── components/
│   │   ├── Layout.jsx             # Layout com header, bottom nav, dark/light mode
│   │   └── DeviceCard.jsx         # Card de dispositivo no dashboard
│   ├── contexts/
│   │   └── ThemeContext.jsx       # Context dark/light mode
│   └── pages/
│       ├── Dashboard.jsx          # Página principal (lista de dispositivos)
│       ├── DeviceDetail.jsx       # Detalhe do dispositivo (sessões + stats)
│       └── V2CPage.jsx            # Página V2C (sessões de carregamento)
├── public/
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service worker (PWA)
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

### 5.2 Serviço Supabase (supabase.js)

**Configuração:**
- URL: `https://lfatskduuzwdqoomtphh.supabase.co`
- Key: Publishable key (acesso anónimo, sem RLS)
- Comunicação: REST API via `fetch()` (PostgREST)

**Funções exportadas:**

| Função | Descrição |
|---|---|
| `getDevices()` | Lista dispositivos únicos (via view `device_list`) |
| `getLatestEvents(limit)` | Últimos N eventos (todos os dispositivos) |
| `getDeviceEvents(name, limit)` | Últimos N eventos de um dispositivo |
| `getDeviceStats(name)` | Estatísticas calculadas de um dispositivo |
| `getDailyEnergy(days)` | Energia diária por dispositivo (últimos N dias) |
| `getV2CSessions(limit)` | Sessões de carregamento V2C |
| `getV2CStats()` | Estatísticas globais V2C |

**Filtro de falsos positivos:** Tanto `getDeviceEvents` como `getDeviceStats` filtram eventos `start` com `power_watts < 10W` no código frontend. Isto é necessário porque a BD contém eventos antigos inseridos antes da correção do filtro no servidor.

### 5.3 Página Dashboard

**Localização:** `/`

**Dados carregados:**
1. Lista de dispositivos (via `getDevices()`)
2. Para cada dispositivo: estatísticas (via `getDeviceStats()`)
3. Últimos 10 eventos globais (via `getLatestEvents()`)

**Auto-refresh:** 30 segundos

**Apresentação:**
- **Top stats:** Potência total (W), dispositivos ativos, total de dispositivos
- **Device cards:** Grid de cards coloridos com gradiente, cada um mostrando:
  - Nome + IP
  - Estado (Ligado/Desligado)
  - Potência atual (W)
  - Tempo total de funcionamento
  - Energia total consumida
- **Eventos recentes:** Lista dos últimos 8 eventos com indicador de cor (verde=start, vermelho=stop)

### 5.4 Página DeviceDetail

**Localização:** `/device/:name`

**Dados carregados:**
- Últimos 100 eventos do dispositivo (via `getDeviceEvents()`)
- Filtrados: eventos `start` com `power_watts < 10W` são removidos

**Processamento:**
1. **Emparelhamento start/stop:** Itera eventos do mais antigo para o mais novo, emparelhando cada `stop` com o `start` anterior
2. **Sessão ativa:** Se existe um `start` sem `stop` correspondente, cria uma sessão "ativa" com duração em tempo real
3. **Cálculo de energia:** Diferença de `total_energy_wh` entre start e stop (se < 10000 Wh)

**Apresentação:**
- **Tabela de stats (períodos × métricas):**

| | Arranques | Tempo | Energia | Pot. Média |
|---|---|---|---|---|
| 1h | ... | ... | ... | ... |
| 24h | ... | ... | ... | ... |
| Hoje | ... | ... | ... | ... |
| Total | ... | ... | ... | ... |

- **Lista de sessões:** Cards individuais com data/hora, duração, energia, potência média
  - Sessões ativas: badge verde "EM CURSO" pulsante, fundo verde claro
  - Sessões completas: fundo branco/cinza

### 5.5 Página V2C

**Localização:** `/v2c`

**Dados carregados:**
- Últimas 20 sessões (via `getV2CSessions()`)
- Estatísticas globais (via `getV2CStats()`)

**Auto-refresh:** 30 segundos (dados) + 1 segundo (relógio da sessão ativa)

**Apresentação:**
- **Sessão ativa:** Card gradiente verde/teal com:
  - Nome do carro
  - Potência média (W)
  - Energia (kWh)
  - Duração (em tempo real)
  - Número de snapshots
  - Potência máxima
- **Stats globais:** Total sessões, energia total, tempo total, potência média
- **Snapshots:** Lista de snapshots da sessão ativa (mais recente primeiro)
- **Sessões anteriores:** Lista de sessões completadas

### 5.6 Componentes

#### Layout.jsx
- Header com título "Energy Dashboard" e botão dark/light mode
- Bottom nav com 2 tabs: Dashboard e V2C
- Conteúdo via `<Outlet />` (React Router v6)

#### DeviceCard.jsx
- Card colorido com gradiente por dispositivo
- Ícones e cores mapeados por nome de dispositivo
- Link para `/device/:name`

**Mapeamento de cores/ícones:**
| Dispositivo | Ícone | Gradiente |
|---|---|---|
| Bomba Furo | 💧 | blue-600 → blue-800 |
| Piscina | 🏊 | cyan-600 → cyan-800 |
| Maq. Lavar Roupa | 🧺 | purple-600 → purple-800 |
| Máq. Secar | 🌀 | orange-600 → orange-800 |
| Carregador | ⚡ | green-600 → green-800 |

---

## 6. Fluxo de Dados Completo

### 6.1 Eventos Shelly (Furo, Piscina, Lavar, Secar)

```
┌──────────┐     Webhook HTTP      ┌──────────┐     REST API      ┌──────────┐
│  Shelly   │ ──────────────────▶  │  Servidor │ ──────────────▶  │ Supabase │
│  Device   │  GET /webhook/...   │  Node.js  │  POST /shelly_   │  (BD)    │
│           │                      │           │    events        │          │
└──────────┘                      └─────┬─────┘                   └──────────┘
                                        │
                                        │ 1. Espera 2s
                                        │ 2. Lê Shelly ao vivo
                                        │ 3. Confirma potência
                                        │ 4. Se confirmado → insere BD
                                        │ 5. Envia Telegram
                                        ▼
                                  ┌──────────┐
                                  │ Telegram │
                                  │  (bot)   │
                                  └──────────┘
```

**Sequência detalhada:**

1. Shelly deteta mudança (ex: potência > 200W) → envia webhook `GET /webhook/pump/start`
2. Servidor recebe webhook → inicia `confirmStateChange()`
3. Espera 2 segundos (estabilização)
4. Faz `GET` ao Shelly para ler potência atual
5. Se potência < threshold → espera 5s e re-verifica
6. Se ainda < threshold → **ignora** (falso positivo)
7. Se confirmado → chama `handleWebhook()`
8. `handleWebhook()` verifica circuit-closing (desync) e chama `handleStateChange()`
9. `handleStateChange()` insere evento na BD via `logEvent()` e envia notificação Telegram
10. `checkAlerts()` verifica se há excesso de arranques na última hora

### 6.2 Sessões V2C

```
┌──────────┐     Webhook START     ┌──────────┐     REST API      ┌──────────┐
│ Shelly EM│ ──────────────────▶   │ server-  │ ──────────────▶   │ Supabase │
│(Carreg.) │                       │ v2c.js   │  POST /v2c_       │  (BD)    │
└──────────┘                       │          │    charging_      │          │
                                   │          │    sessions       │          │
                                   │          │                   │          │
                                   │          │ ◀── Polling 30s ──│          │
                                   │          │     /RealTimeData │          │
                                   │          │                   │          │
                                   │          │ ── Update BD ───▶ │          │
                                   │          │   (a cada 60s)    │          │
                                   └────┬─────┘                   └──────────┘
                                        │
                                        │ Telegram polling (getUpdates 3s)
                                        ▼
                                  ┌──────────┐
                                  │ Telegram │
                                  │  (bot)   │
                                  └──────────┘
```

**Sequência detalhada:**

1. Shelly EM (no circuito do carregador) deteta potência > 200W → envia webhook `/webhook/charger/start`
2. Servidor espera 2s → lê V2C via `GET /RealTimeData`
3. Verifica `ChargeState === 2` (carregando) — se não, ignora
4. Envia mensagem Telegram com botões inline para selecionar o carro
5. Aguarda seleção (timeout: 5 min → assume "Desconhecido")
6. Cria sessão na BD (`start_energy_wh`, `carro`, `start_time`)
7. Inicia polling V2C a cada 30s
8. A cada 60s: guarda snapshot (potência, energia, casa, FV, bateria, intensidade)
9. A cada 60s: atualiza BD com snapshots e estatísticas
10. A cada 15min: envia resumo Telegram
11. Quando webhook STOP ou `ChargeState === 0` por >60s: termina sessão, atualiza BD com dados finais

---

## 7. Estatísticas e Informações Entregues

### 7.1 Dashboard Principal

| Métrica | Cálculo |
|---|---|
| Potência total | Soma de `lastPower` de todos os dispositivos |
| Dispositivos ativos | Contagem onde `isOn === true` |
| Total dispositivos | Contagem de dispositivos na view `device_list` |
| Estado do dispositivo | `isOn`: último evento é `start` com `power_watts > 10` |
| Potência atual | `lastPower` do último evento |
| Tempo total | Soma de `duration_seconds` entre pares start/stop |
| Energia total | Soma de diferenças `total_energy_wh` entre pares start/stop |
| Eventos recentes | Últimos 8 eventos globais |

### 7.2 Detalhe do Dispositivo

| Métrica | Períodos | Cálculo |
|---|---|---|
| Arranques | 1h, 24h, Hoje, Total | Contagem de sessões com `startTime` no período |
| Tempo ligado | 1h, 24h, Hoje, Total | Soma de `duration` das sessões no período |
| Energia | 1h, 24h, Hoje, Total | Soma de `energy` das sessões no período |
| Potência média | 1h, 24h, Hoje, Total | Média de `(energy / duration) * 3600` das sessões |

**Sessões:** Lista de até 20 sessões (mais recentes primeiro), cada uma com:
- Data/hora de início
- Hora de fim (ou "agora" se ativa)
- Duração
- Energia consumida
- Potência média

### 7.3 Página V2C

| Métrica | Descrição |
|---|---|
| Sessão ativa | Carro, potência média, energia, duração, snapshots, potência máxima |
| Total sessões | Contagem de sessões completadas |
| Energia total | Soma de `total_energy_wh` de todas as sessões |
| Tempo total | Soma de `duration_seconds` de todas as sessões |
| Potência média | Média de `avg_power_watts` de todas as sessões |
| Snapshots | Dados a cada 60s: potência, energia, casa, FV, bateria, intensidade |

---

## 8. Bugs Conhecidos e Incongruências

### 8.1 Eventos Falsos Positivos na BD
**Problema:** A BD contém centenas de eventos `start` com `power_watts < 10W` inseridos antes da correção do filtro de falsos positivos no servidor.
**Impacto:** Distorcia estatísticas e pode fazer dispositivos aparecerem como "Ligados".
**Mitigação atual:** Filtro no frontend (ignora `start` com `< 10W`).
**Solução ideal:** Limpar os eventos falsos positivos da BD com SQL.

### 8.2 Nome do Campo `total_energy_wh` no V2C
**Problema:** O campo `total_energy_wh` na tabela `v2c_charging_sessions` armazena valores em **kWh** (não Wh).
**Impacto:** Confusão semântica. O frontend trata corretamente como kWh.
**Nota:** O campo `ChargeEnergy` da API V2C retorna kWh diretamente.

### 8.3 `getLatestEvents` Não Filtra Falsos Positivos
**Problema:** A função `getLatestEvents()` (usada na lista de eventos recentes do Dashboard) não filtra falsos positivos.
**Impacto:** Eventos falsos positivos podem aparecer na lista de "Eventos Recentes".

### 8.4 `getDailyEnergy` Não Filtra Falsos Positivos
**Problema:** A função `getDailyEnergy()` usa todos os eventos, incluindo falsos positivos.
**Impacto:** Cálculo de energia diária pode estar incorreto se houver falsos positivos.

### 8.5 Duplicação de Código nos Servidores
**Problema:** Os 4 servidores Shelly partilham ~90% do código (funções `supabaseInsert`, `supabaseQuery`, `sendTelegram`, `logEvent`, `confirmStateChange`, `handleWebhook`, `checkAlerts`).
**Impacto:** Manutenção difícil — uma correção precisa de ser replicada em 4 ficheiros.
**Solução ideal:** Extrair código comum para um módulo partilhado.

### 8.6 Threshold de Confirmação Duplicado no PM Mini
**Problema:** Nos servidores `server-maqlavar.js` e `server-maqsecar.js`, o `CONFIRM_THRESHOLD` é igual ao `POWER_THRESHOLD` (50W). Isto significa que um `start` só é confirmado se a potência for >= 50W, mas o webhook do Shelly é configurado para disparar com o mesmo threshold.
**Impacto:** Funciona corretamente, mas é redundante — o webhook já garante que a potência é >= 50W.

### 8.7 `reactive_power` Não é Inserido para Piscina/Lavar/Secar
**Problema:** O servidor Furo insere `reactive_power` na BD, mas os servidores Piscina, Lavar e Secar não.
**Impacto:** Campo `reactive_power` é NULL para todos os dispositivos exceto Furo.
**Nota:** Os Shelly Plus Plug S e PM Mini Gen 3 não fornecem potência reativa.

### 8.8 `lastAlertTime` Não Persiste
**Problema:** O timer de cooldown de alertas (`lastAlertTime`) é variável em memória.
**Impacto:** Se o servidor for reiniciado, o cooldown é perdido e um alerta pode ser enviado imediatamente.

### 8.9 Timeout de Carro V2C Não Cancela Polling
**Problema:** Quando o timeout de seleção de carro expira (5 min), o servidor assume "Desconhecido" e inicia a sessão. Se o utilizador selecionar o carro depois, a mensagem é ignorada mas o `carSelectTimer` já foi limpo.
**Impacto:** Funcionalmente correto, mas a experiência pode ser confusa.

### 8.10 `getDeviceStats` Pode Retornar `null` Após Filtragem
**Problema:** Se todos os eventos de um dispositivo forem falsos positivos, `filtered` será vazio e `filtered[0]` será `undefined`.
**Impacto:** `lastEvent` será `undefined`, causando erro no acesso a `lastEvent.power_watts`.
**Mitigação:** Improvável na prática (dispositivos reais têm eventos legítimos).

---

## 9. Configuração e Deploy

### 9.1 Variáveis de Ambiente

Cada servidor usa um ficheiro `.env` separado:

| Servidor | Ficheiro .env |
|---|---|
| Furo | `.env` |
| Piscina | `.env.piscina` |
| Máq. Lavar | `.env.maqlavar` |
| Máq. Secar | `.env.maqsecar` |
| V2C | `.env.v2c` |

**Variáveis comuns:**
```
SHELLY_IP=<IP do dispositivo>
SHELLY_NAME=<nome do dispositivo>
TELEGRAM_BOT_TOKEN=<token do bot>
TELEGRAM_CHAT_ID=<chat ID do grupo>
SUPABASE_URL=https://lfatskduuzwdqoomtphh.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
POLLING_ENABLED=false
POLL_INTERVAL=10
```

**Variáveis específicas do Furo:**
```
POWER_THRESHOLD=200
```

**Variáveis específicas do V2C:**
```
(nenhuma adicional — thresholds são fixos no código)
```

### 9.2 Arranque dos Servidores

**Manual (Windows):**
```batch
cd C:\GoogleDrive\Shared\ShellyMonitor
start-all.bat
```

**Auto-arranque (Windows Task Scheduler):**
```powershell
.\install-task.ps1
```

### 9.3 Deploy do Dashboard

O dashboard é um site estático deployado no Render:
- **URL:** `https://energy-dashboard-4cp8.onrender.com`
- **Auto-deploy:** Ativado (push para `main` no GitHub)
- **Repo:** `osmioia1-beep/energy-dashboard`
- **Build:** `npm run build` → `dist/`

### 9.4 PWA (Progressive Web App)

O dashboard pode ser instalado como app móvel:
- **Android:** Chrome menu → "Instalar app"
- **iPhone:** Safari → Partilhar → "Adicionar ao ecrã principal"

---

## Apêndice A: Endpoints da API

### Servidores Shelly (cada um)

| Endpoint | Método | Descrição |
|---|---|---|
| `/webhook/pump/start` | GET, POST | Início de funcionamento |
| `/webhook/pump/stop` | GET, POST | Fim de funcionamento |
| `/api/status` | GET | Estado atual do servidor |
| `/api/events/recent` | GET | Eventos recentes (BD) |
| `/health` | GET | Health check |

### Servidor V2C

| Endpoint | Método | Descrição |
|---|---|---|
| `/webhook/charger/start` | GET | Início de carregamento (do Shelly EM) |
| `/webhook/charger/stop` | GET | Fim de carregamento (do Shelly EM) |
| `/api/status` | GET | Estado atual do servidor + V2C |
| `/health` | GET | Health check |

---

## Apêndice B: Nomes de Dispositivos na BD

| Nome na BD | Descrição |
|---|---|
| `Bomba Furo` | Bomba do furo (Shelly EM) |
| `Piscina` | Bomba da piscina (Shelly Plus Plug S) |
| `Maq. Lavar Roupa` | Máquina de lavar roupa (Shelly PM Mini Gen 3) |
| `Máq. Secar` | Máquina de secar roupa (Shelly PM Mini Gen 3) |
| `V2C Trydan` | Carregador EV (apenas em `v2c_charging_sessions`) |

**Nota:** Os nomes devem corresponder exatamente entre o `.env` de cada servidor e o código do frontend (`DeviceCard.jsx`).

---

*Documentação gerada em 2026-06-21*
