import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models
from database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "chave_secreta_padrao_desenvolvimento")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

FERNET_KEY = os.getenv("FERNET_KEY")
if not FERNET_KEY:
    # Caso não tenha chave no .env, gera uma estática de fallback
    FERNET_KEY = Fernet.generate_key().decode()

cipher_suite = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login-master")

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
# CRIPTOGRAFIA DAS SENHAS DO COFRE (AES-256)
# ================================

def criptografar_dado(texto: str) -> str:
    if not texto:
        return ""
    return cipher_suite.encrypt(texto.encode('utf-8')).decode('utf-8')

def descriptografar_dado(texto_criptografado: str) -> str:
    try:
        if not texto_criptografado:
            return ""
        return cipher_suite.decrypt(texto_criptografado.encode('utf-8')).decode('utf-8')
    except InvalidToken:
        # Retorna um aviso legível em vez de estourar erro 500 no backend
        return "[Chave incompatível ou dado corrompido]"
    except Exception:
        return "[Erro na descriptografia]"

def obter_usuario_logado(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.Usuario:
    """Valida o token JWT e retorna o objeto do usuário logado."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decodificar_token_acesso(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    usuario = db.query(models.Usuario).filter(models.Usuario.id == int(user_id)).first()
    if usuario is None:
        raise credentials_exception
        
    return usuario

criptografar_senha = criptografar_dado
descriptografar_senha = descriptografar_dado
verificar_hash = verificar_senha