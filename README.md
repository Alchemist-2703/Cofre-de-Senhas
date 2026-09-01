## Arquitetura e Tecnologias

* **Front-end:** React Native, Expo, Axios, React Navigation (Native Stack)
* **Back-end:** Python 3.12+, FastAPI, SQLAlchemy, Uvicorn, OpenAPI/Swagger
* **Banco de Dados:** PostgreSQL via Supabase (conexão via Session Pooler na porta `6543`)
* **Driver & Ferramentas:** Psycopg 3 (`psycopg`), EAS Build (para compilação de APK Android e preview iOS via Expo Go)

---

## Funcionalidades

1. **Autenticação e Segurança:** Login e navegação protegida por pilha de telas (Native Stack).
2. **Gerenciamento do Cofre:** Cadastro, visualização e manipulação de credenciais/senhas armazenadas no banco remoto.
3. **Sincronização em Tempo Real:** Conexão otimizada via Session Pooler do Supabase para prevenção de bloqueios de rede/firewall.
4. **Builds para Testes:** Suporte para geração de APK de preview para testes externos em dispositivos Android sem dependência das lojas.

---

## Como Rodar o Projeto Localmente

### 1. Back-end (FastAPI)

1. Entre no diretório do back-end e crie/ative um ambiente virtual:

```bash
cd cofre-backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate # Linux/macOS

```

2. Instale as dependências:

```bash
pip install -r requirements.txt

```

3. Crie um arquivo `.env` na raiz do back-end com as suas credenciais do Supabase:

```env
DATABASE_URL="postgresql+psycopg://postgres.SUA_REF:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?prepare_threshold=0"

```

4. Inicie a aplicação FastAPI:

```bash
uvicorn main:app --reload

```

*Documentação Swagger disponível em: `http://localhost:8000/docs*`

### 2. Front-end (React Native / Expo)

1. Entre no diretório do aplicativo mobile:

```bash
cd cofre-mobile
npm install

```

2. Certifique-se de atualizar o arquivo `src/services/api.js` com o seu IP local para teste no celular:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://SEU_IP_LOCAL:8000',
});

export default api;

```

3. Inicie o Metro Bundler limpando o cache:

```bash
npx expo start -c

```

*Abra o aplicativo **Expo Go** no celular e escaneie o QR Code gerado no terminal (garanta que o celular e o computador estejam na mesma rede).*