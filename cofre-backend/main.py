from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from schemas import PerfilUpdate, MesclarCofresRequest
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, Base, get_db
import models, schemas, security

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Cofre de Senhas", version="1.0.0")
oauth2_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.Usuario:
    payload = security.decodificar_token_acesso(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")
    
    usuario = db.query(models.Usuario).filter(models.Usuario.email == payload.get("sub")).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if usuario.bloqueado:
        raise HTTPException(status_code=403, detail="Cofre bloqueado. Realize a recuperação.")
    return usuario

# --- AUTENTICAÇÃO E BLOQUEIO APÓS 5 TENTATIVAS ---

@app.post("/cadastrar", response_model=schemas.UsuarioResponse, status_code=201)
def cadastrar_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(models.Usuario).filter(models.Usuario.email == usuario.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    novo_usuario = models.Usuario(
        email=usuario.email,
        master_password_hash=security.gerar_hash(usuario.master_password)
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return novo_usuario

@app.post("/login-master", response_model=schemas.TokenSchema)
def login_chave_mestra(credentials: schemas.LoginMasterSchema, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == credentials.email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não cadastrado.")

    if usuario.bloqueado or usuario.tentativas_falhas >= 5:
        usuario.bloqueado = True
        db.commit()
        raise HTTPException(status_code=403, detail="Cofre BLOQUEADO! Limite de 5 tentativas excedido. Recupere com as perguntas.")

    if not security.verificar_senha(credentials.master_password, usuario.master_password_hash):
        usuario.tentativas_falhas += 1
        if usuario.tentativas_falhas >= 5:
            usuario.bloqueado = True
            db.commit()
            raise HTTPException(status_code=403, detail="Você errou a Chave Mestra 5 vezes. Cofre BLOQUEADO!")
        
        db.commit()
        raise HTTPException(
            status_code=401,
            detail=f"Chave Mestra incorreta. Tentativas restantes: {5 - usuario.tentativas_falhas}/5"
        )

    usuario.tentativas_falhas = 0
    db.commit()
    return {"access_token": security.criar_token_acesso(data={"sub": usuario.email}), "token_type": "bearer"}

# --- PERGUNTAS DE SEGURANÇA E RECUPERAÇÃO ---

@app.post("/perguntas", response_model=schemas.PerguntaResponse, status_code=201)
def adicionar_pergunta(
    pergunta: schemas.PerguntaCreate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    nova = models.PerguntaSeguranca(
        usuario_id=current_user.id,
        pergunta=pergunta.pergunta,
        resposta_hash=security.gerar_hash(pergunta.resposta)
    )
    db.add(nova)
    db.commit()
    db.refresh(nova)
    return nova

@app.get("/perguntas/recuperacao/{email}", response_model=list[schemas.PerguntaResponse])
def obter_perguntas_para_recuperacao(email: str, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return db.query(models.PerguntaSeguranca).filter(models.PerguntaSeguranca.usuario_id == usuario.id).all()

@app.post("/recuperar-chave-mestra")
def recuperar_chave_mestra(dados: schemas.RecuperarAcessoSchema, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == dados.email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    perguntas = db.query(models.PerguntaSeguranca).filter(models.PerguntaSeguranca.usuario_id == usuario.id).all()
    dict_p = {p.id: p.resposta_hash for p in perguntas}

    for r in dados.respostas:
        if r.pergunta_id not in dict_p or not security.verificar_hash(r.resposta, dict_p[r.pergunta_id]):
            raise HTTPException(status_code=401, detail="Resposta incorreta. Falha na recuperação.")

    usuario.master_password_hash = security.gerar_hash(dados.nova_master_password)
    usuario.bloqueado = False
    usuario.tentativas_falhas = 0
    db.commit()
    return {"message": "Cofre desbloqueado com sucesso! Faça login com a nova Chave Mestra."}

# --- OPERAÇÕES DO COFRE ---

@app.post("/cofre/senhas", response_model=schemas.SenhaCofreResponse, status_code=201)
def salvar_senha(
    dado: schemas.SenhaCofreCreate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = models.SenhaCofre(
        usuario_id=current_user.id,
        servico=dado.servico,
        identificador=dado.identificador,
        senha_criptografada=security.criptografar_senha(dado.senha)
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return schemas.SenhaCofreResponse(
        id=item.id, servico=item.servico, identificador=item.identificador,
        senha_descriptografada=dado.senha, criado_em=item.criado_em
    )

@app.get("/cofre/senhas", response_model=list[schemas.SenhaCofreResponse])
def listar_senhas(
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    itens = db.query(models.SenhaCofre).filter(models.SenhaCofre.usuario_id == current_user.id).all()
    return [
        schemas.SenhaCofreResponse(
            id=i.id, servico=i.servico, identificador=i.identificador,
            senha_descriptografada=security.descriptografar_senha(i.senha_criptografada),
            criado_em=i.criado_em
        ) for i in itens
    ]

# --- GERENCIAMENTO DE PERFIL ---

@app.put("/perfil", summary="Atualizar / Preencher Perfil do Usuário")
def atualizar_perfil(
    dados: schemas.PerfilUpdate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atualiza as informações do perfil do usuário logado (Nome, CPF, Telefone).
    """
    if dados.nome is not None:
        current_user.nome = dados.nome
    if dados.cpf is not None:
        current_user.cpf = dados.cpf
    if dados.telefone is not None:
        current_user.telefone = dados.telefone
    if dados.email is not None and dados.email != current_user.email:
        current_user.email = dados.email

    db.commit()
    db.refresh(current_user)

    return {
        "mensagem": "Perfil atualizado com sucesso!",
        "usuario": {
            "id": current_user.id,
            "email": current_user.email,
            "nome": getattr(current_user, "nome", None),
            "cpf": getattr(current_user, "cpf", None),
            "telefone": getattr(current_user, "telefone", None)
        }
    }

@app.post("/perfil/verificar-duplicidade")
def verificar_duplicidade(
    dados: schemas.PerfilUpdate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifica se o e-mail, telefone ou CPF informado no perfil já pertence a outro usuário.
    """
    # Consulta SQL otimizada para buscar registros duplicados ignorando o próprio usuário logado
    query = text("""
        SELECT id, email, telefone, cpf 
        FROM usuarios 
        WHERE (
            (:email IS NOT NULL AND email = :email) OR
            (:telefone IS NOT NULL AND telefone = :telefone) OR
            (:cpf IS NOT NULL AND cpf = :cpf)
        ) 
        AND id != :usuario_atual_id
        LIMIT 1;
    """)

    result = db.execute(query, {
        "email": dados.email,
        "telefone": dados.telefone,
        "cpf": dados.cpf,
        "usuario_atual_id": current_user.id
    }).mappings().first()

    if result:
        usuario_existente = dict(result)
        
        # Identifica dinamicamente qual campo gerou a duplicidade
        campo_conflito = "email"
        valor_conflito = dados.email

        if dados.cpf and usuario_existente.get("cpf") == dados.cpf:
            campo_conflito = "cpf"
            valor_conflito = dados.cpf
        elif dados.telefone and usuario_existente.get("telefone") == dados.telefone:
            campo_conflito = "telefone"
            valor_conflito = dados.telefone

        return {
            "duplicado": True,
            "campo_conflito": campo_conflito,
            "valor_conflito": valor_conflito,
            "usuario_origem": usuario_existente
        }

    return {"duplicado": False, "usuario_existente": None}


@app.post("/perfil/mesclar-cofres")
def mesclar_cofres(
    req: schemas.MesclarCofresRequest,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executa a função RPC 'mesclar_cofres' no Supabase para unificar as senhas da conta antiga na conta atual.
    """
    # Garante que o usuário destino seja obrigatoriamente a conta logada
    if req.usuario_destino_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operação não permitida: Você só pode mover dados para o seu próprio cofre."
        )

    try:
        # Executa a Procedure / RPC armazenada no Supabase
        db.execute(
            text("SELECT mesclar_cofres(:destino, :origem, :campo, :valor);"),
            {
                "destino": req.usuario_destino_id,
                "origem": req.usuario_origem_id,
                "campo": req.campo_duplicado,
                "valor": req.valor_duplicado
            }
        )
        db.commit()

        return {
            "sucesso": True,
            "mensagem": "Cofres unificados e conta legada removida com sucesso."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao executar mesclagem no banco de dados: {str(e)}"
        )

    