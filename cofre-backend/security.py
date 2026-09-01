import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "chave_secreta_padrao_desenvolvimento")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

FERNET_KEY = os.getenv("FERNET_KEY")
if not FERNET_KEY:
    # Caso não tenha chave no .env, gera uma estática de fallback
    FERNET_KEY = Fernet.generate_key().decode()

cipher_suite = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)


# ================================
# FUNÇÕES DE TOKEN JWT
# ================================

def criar_token_acesso(data: dict, expira_em: Optional[timedelta] = None) -> str:
    para_codificar = data.copy()
    if expira_em:
        expiracao = datetime.utcnow() + expira_em
    else:
        expiracao = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    para_codificar.update({"exp": expiracao})
    return jwt.encode(para_codificar, SECRET_KEY, algorithm=ALGORITHM)

def decodificar_token_acesso(token: str) -> Optional[dict]:
    """Decodifica e valida o token JWT."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

    
# ================================
# FUNÇÕES DE SENHA MESTRA (HASHING)
# ================================

def gerar_hash(senha: str) -> str:
    """Gera um hash Bcrypt seguro para a senha mestra."""
    # Garante que a senha tratada respeite o limite de 72 bytes do bcrypt
    senha_bytes = senha.strip().lower().encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(senha_bytes, salt)
    return hashed.decode('utf-8')

def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """Verifica se a senha fornecida bate com o hash salvo."""
    senha_bytes = senha_plana.strip().lower().encode('utf-8')[:72]
    hash_bytes = senha_hash.encode('utf-8')
    return bcrypt.checkpw(senha_bytes, hash_bytes)

# ================================
# FUNÇÕES DE TOKEN JWT
# ================================

def criar_token_acesso(data: dict, expira_em: Optional[timedelta] = None) -> str:
    para_codificar = data.copy()
    if expira_em:
        expiracao = datetime.utcnow() + expira_em
    else:
        expiracao = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    para_codificar.update({"exp": expiracao})
    return jwt.encode(para_codificar, SECRET_KEY, algorithm=ALGORITHM)

# ================================
# CRIPTOGRAFIA DAS SENHAS DO COFRE (AES-256)
# ================================

def criptografar_dado(texto: str) -> str:
    return cipher_suite.encrypt(texto.encode('utf-8')).decode('utf-8')

def descriptografar_dado(texto_criptografado: str) -> str:
    return cipher_suite.decrypt(texto_criptografado.encode('utf-8')).decode('utf-8')

criptografar_senha = criptografar_dado
descriptografar_senha = descriptografar_dado
verificar_hash = verificar_senha