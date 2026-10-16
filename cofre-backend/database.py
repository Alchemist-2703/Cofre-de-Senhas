import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cofre_db")

# Ajusta a URL para usar o driver psycopg3 do PostgreSQL
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# Determina os argumentos de conexão com base no tipo do banco
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args["check_same_thread"] = False
else:
    # Para PostgreSQL via PgBouncer / Supabase / Neon
    connect_args["prepare_threshold"] = 0

# Configuração única do Engine consolidando todas as opções necessárias
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Testa a conexão antes de usar, evitando quedas sutis
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()