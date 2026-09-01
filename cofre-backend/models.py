from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    master_password_hash = Column(String(255), nullable=False)
    tentativas_falhas = Column(Integer, default=0, nullable=False)
    bloqueado = Column(Boolean, default=False, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    nome = Column(String, nullable=True)
    cpf = Column(String, nullable=True)
    telefone = Column(String, nullable=True)

    perguntas = relationship("PerguntaSeguranca", back_populates="usuario", cascade="all, delete-orphan")
    senhas = relationship("SenhaCofre", back_populates="usuario", cascade="all, delete-orphan")

class PerguntaSeguranca(Base):
    __tablename__ = "perguntas_seguranca"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    pergunta = Column(Text, nullable=False)
    resposta_hash = Column(String(255), nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario", back_populates="perguntas")

class SenhaCofre(Base):
    __tablename__ = "senhas_cofre"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    servico = Column(String(100), nullable=False)
    identificador = Column(String(255), nullable=False)
    senha_criptografada = Column(Text, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    usuario = relationship("Usuario", back_populates="senhas")