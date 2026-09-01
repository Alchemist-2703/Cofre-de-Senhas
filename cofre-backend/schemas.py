from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class UsuarioCreate(BaseModel):
    email: EmailStr
    master_password: str = Field(min_length=6)

class LoginMasterSchema(BaseModel):
    email: EmailStr
    master_password: str

class TokenSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UsuarioResponse(BaseModel):
    id: int
    email: EmailStr
    bloqueado: bool
    tentativas_falhas: int
    criado_em: datetime

    class Config:
        from_attributes = True

class PerguntaCreate(BaseModel):
    pergunta: str = Field(min_length=3)
    resposta: str = Field(min_length=1)

class PerguntaResponse(BaseModel):
    id: int
    pergunta: str
    criado_em: datetime

    class Config:
        from_attributes = True

class RespostaVerificacao(BaseModel):
    pergunta_id: int
    resposta: str

class RecuperarAcessoSchema(BaseModel):
    email: EmailStr
    respostas: List[RespostaVerificacao]
    nova_master_password: str = Field(min_length=6)

class AtualizarPerguntaSchema(BaseModel):
    pergunta_id: int
    nova_pergunta: Optional[str] = None
    nova_resposta: Optional[str] = None
    senha_master: str

class SenhaCofreCreate(BaseModel):
    servico: str = Field(min_length=1)
    identificador: str = Field(min_length=1)
    senha: str = Field(min_length=1)

class SenhaCofreResponse(BaseModel):
    id: int
    servico: str
    identificador: str
    senha_descriptografada: str
    criado_em: datetime

    class Config:
        from_attributes = True

class DeletarSenhaRequest(BaseModel):
    tipo_confirmacao: str
    senha_master: Optional[str] = None
    resposta_seguranca: Optional[str] = None

class PerfilUpdate(BaseModel):
    usuario_atual_id: Optional[int] = None
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    cpf: Optional[str] = None

class MesclarCofresRequest(BaseModel):
    usuario_destino_id: int
    usuario_origem_id: int
    campo_duplicado: str  # 'email', 'telefone' ou 'cpf'
    valor_duplicado: str