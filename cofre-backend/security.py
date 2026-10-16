import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import models
from database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "chave_secreta_padrao_desenvolvimento")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

FERNET_KEY = os.getenv("FERNET_KEY")
if not FERNET_KEY:
    raise RuntimeError("FERNET_KEY não definida")

cipher_suite = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)

# Usa o mesmo esquema HTTPBearer
oauth2_scheme = HTTPBearer()

def criar_token_acesso(data: dict, expira_em: Optional[timedelta] = None) -> str:
    para_codificar = data.copy()
    expiracao = datetime.utcnow() + (expira_em if expira_em else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    para_codificar.update({"exp": expiracao})
    return jwt.encode(para_codificar, SECRET_KEY, algorithm=ALGORITHM)

def decodificar_token_acesso(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def gerar_hash(senha: str) -> str:
    senha_bytes = senha.strip().lower().encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(senha_bytes, salt).decode('utf-8')

def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    senha_bytes = senha_plana.strip().lower().encode('utf-8')[:72]
    return bcrypt.checkpw(senha_bytes, senha_hash.encode('utf-8'))

def criptografar_dado(texto: str) -> str:
    if not texto:
        return ""
    return cipher_suite.encrypt(texto.encode('utf-8')).decode('utf-8')

def descriptografar_dado(texto_criptografado: str) -> str:
    try:
        if not texto_criptografado:
            return ""
        return cipher_suite.decrypt(texto_criptografado.encode('utf-8')).decode('utf-8')
    except Exception:
        return "[Erro na descriptografia]"

def obter_usuario_logado(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decodificar_token_acesso(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise credentials_exception
        
    usuario = db.query(models.Usuario).filter(models.Usuario.email == payload.get("sub")).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    if usuario.bloqueado:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cofre bloqueado.")
        
    return usuario

criptografar_senha = criptografar_dado
descriptografar_senha = descriptografar_dado
verificar_hash = verificar_senha