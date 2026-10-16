from fastapi import FastAPI, Depends, APIRouter, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from sqlalchemy.exc import IntegrityError
from typing import Optional

from database import engine, Base, get_db
import models
import schemas
import security

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Cofre de Senhas", version="1.0.0")

oauth2_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> models.Usuario:
    payload = security.decodificar_token_acesso(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")
    
    usuario = db.query(models.Usuario).filter(models.Usuario.email == payload.get("sub")).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if usuario.bloqueado:
        raise HTTPException(status_code=403, detail="Cofre bloqueado. Realize a recuperação.")
    return usuario

# --- AUTENTICAÇÃO E LOGIN ---

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
        raise HTTPException(
            status_code=403, 
            detail="Cofre BLOQUEADO! Limite de 5 tentativas excedido. Recupere com as perguntas."
        )

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

@app.get("/perguntas/minhas")
def listar_minhas_perguntas(
    current_user: models.Usuario = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        perguntas = db.query(models.PerguntaSeguranca).filter(
            models.PerguntaSeguranca.usuario_id == current_user.id
        ).all()
        return [{"id": p.id, "pergunta": p.pergunta} for p in perguntas]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro no banco: {str(e)}")

@app.post("/perguntas", response_model=schemas.PerguntaResponse, status_code=201)
def adicionar_pergunta(
    pergunta: schemas.PerguntaCreate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not pergunta.pergunta.strip() or not pergunta.resposta.strip():
        raise HTTPException(status_code=400, detail="Pergunta e resposta são obrigatórias para criação.")

    nova = models.PerguntaSeguranca(
        usuario_id=current_user.id,
        pergunta=pergunta.pergunta.strip(),
        resposta_hash=security.gerar_hash(pergunta.resposta.strip())
    )
    db.add(nova)
    db.commit()
    db.refresh(nova)
    return nova

@app.put("/perguntas/{pergunta_id}", status_code=status.HTTP_200_OK)
def atualizar_pergunta_por_id(
    pergunta_id: int,
    dados: schemas.PerguntaUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    pergunta_db = db.query(models.PerguntaSeguranca).filter(
        models.PerguntaSeguranca.id == pergunta_id,
        models.PerguntaSeguranca.usuario_id == current_user.id
    ).first()

    if not pergunta_db:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada.")

    tem_pergunta = dados.pergunta is not None and len(dados.pergunta.strip()) > 0
    tem_resposta = dados.resposta is not None and len(dados.resposta.strip()) > 0

    if not tem_pergunta and not tem_resposta:
        raise HTTPException(status_code=400, detail="Informe ao menos a pergunta ou a resposta para atualizar.")

    if tem_pergunta:
        pergunta_db.pergunta = dados.pergunta.strip()
    
    if tem_resposta:
        pergunta_db.resposta_hash = security.gerar_hash(dados.resposta.strip())

    db.commit()
    db.refresh(pergunta_db)

    return {
        "id": pergunta_db.id,
        "pergunta": pergunta_db.pergunta,
        "mensagem": "Atualizado com sucesso!"
    }

@app.delete("/perguntas/{pergunta_id}", status_code=status.HTTP_200_OK)
def deletar_pergunta(
    pergunta_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(get_current_user)
):
    pergunta_db = db.query(models.PerguntaSeguranca).filter(
        models.PerguntaSeguranca.id == pergunta_id,
        models.PerguntaSeguranca.usuario_id == current_user.id
    ).first()

    if not pergunta_db:
        raise HTTPException(status_code=404, detail="Pergunta não encontrada.")

    db.delete(pergunta_db)
    db.commit()

    return {"mensagem": "Pergunta removida com sucesso!"}

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
        # ✅ CORREÇÃO: alterado de security.verificar_hash para security.verificar_senha
        if r.pergunta_id not in dict_p or not security.verificar_senha(r.resposta.strip(), dict_p[r.pergunta_id]):
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

@app.delete("/cofre/senhas/{senha_id}")
def deletar_senha(
    senha_id: int,
    req: schemas.DeletarSenhaRequest,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item_senha = db.query(models.SenhaCofre).filter(
        models.SenhaCofre.id == senha_id,
        models.SenhaCofre.usuario_id == current_user.id
    ).first()

    if not item_senha:
        raise HTTPException(status_code=404, detail="Senha não encontrada.")

    if req.tipo_confirmacao == "senha":
        if not req.senha_master or not security.verificar_senha(req.senha_master, current_user.master_password_hash):
            raise HTTPException(status_code=400, detail="Senha mestra incorreta.")

    elif req.tipo_confirmacao == "pergunta":
        pergunta_obj = db.query(models.PerguntaSeguranca).filter(
            models.PerguntaSeguranca.usuario_id == current_user.id
        ).first()

        if not pergunta_obj:
            raise HTTPException(status_code=400, detail="Nenhuma pergunta de segurança cadastrada.")

        # ✅ CORREÇÃO: adicionado .strip() para evitar falhas com espaços extras
        if not req.resposta_seguranca or not security.verificar_senha(req.resposta_seguranca.strip(), pergunta_obj.resposta_hash):
            raise HTTPException(status_code=400, detail="Resposta de segurança incorreta.")

    else:
        raise HTTPException(status_code=400, detail="Tipo de confirmação inválido.")

    db.delete(item_senha)
    db.commit()

    return {"sucesso": True, "mensagem": "Senha excluída com sucesso."}

# --- GERENCIAMENTO DE PERFIL ---

@app.get("/perfil", summary="Obter dados do Perfil Logado")
def obter_perfil(
    current_user: models.Usuario = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "nome": getattr(current_user, "nome", None),
        "cpf": getattr(current_user, "cpf", None),
        "telefone": getattr(current_user, "telefone", None)
    }

@app.put("/perfil", summary="Atualizar / Preencher Perfil do Usuário")
def atualizar_perfil(
    dados: schemas.PerfilUpdate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if dados.nome is not None:
        current_user.nome = dados.nome
    if dados.cpf is not None:
        current_user.cpf = dados.cpf
    if dados.telefone is not None:
        current_user.telefone = dados.telefone
    if dados.email is not None and dados.email != current_user.email:
        current_user.email = dados.email

    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError as e:
        db.rollback()
        err_msg = str(e.orig)
        if "usuarios_telefone_key" in err_msg:
            raise HTTPException(status_code=400, detail="Este telefone já está cadastrado em outra conta.")
        elif "usuarios_cpf_key" in err_msg:
            raise HTTPException(status_code=400, detail="Este CPF já está cadastrado em outra conta.")
        elif "usuarios_email_key" in err_msg:
            raise HTTPException(status_code=400, detail="Este e-mail já está em uso.")
        else:
            raise HTTPException(status_code=400, detail="Dados duplicados já existem no sistema.")

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

@app.post("/perfil/verificar-duplicidade", summary="Verifica duplicidade de perfil")
def verificar_duplicidade(
    dados: schemas.PerfilUpdate,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    filtros = []

    if dados.email:
        filtros.append(models.Usuario.email == dados.email)
    if dados.telefone:
        filtros.append(models.Usuario.telefone == dados.telefone)
    if dados.cpf:
        filtros.append(models.Usuario.cpf == dados.cpf)

    if not filtros:
        return {"duplicado": False}

    usuario_existente = db.query(models.Usuario).filter(
        models.Usuario.id != current_user.id,
        or_(*filtros)
    ).first()

    if usuario_existente:
        campo_conflito = "desconhecido"
        valor_conflito = ""

        if dados.email and usuario_existente.email == dados.email:
            campo_conflito = "e-mail"
            valor_conflito = dados.email
        elif dados.telefone and usuario_existente.telefone == dados.telefone:
            campo_conflito = "telefone"
            valor_conflito = dados.telefone
        elif dados.cpf and usuario_existente.cpf == dados.cpf:
            campo_conflito = "CPF"
            valor_conflito = dados.cpf

        return {
            "duplicado": True,
            "campo_conflito": campo_conflito,
            "valor_conflito": valor_conflito,
            "usuario_existente_id": usuario_existente.id
        }

    return {"duplicado": False}

@app.post("/perfil/mesclar-cofres")
def mesclar_cofres(
    req: schemas.MesclarCofresRequest,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.usuario_destino_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operação não permitida."
        )

    try:
        query = text("""
            SELECT mesclar_cofres(
                CAST(:destino AS INTEGER),
                CAST(:origem AS INTEGER),
                CAST(:campo AS TEXT),
                CAST(:valor AS TEXT)
            );
        """)

        db.execute(
            query,
            {
                "destino": req.usuario_destino_id,
                "origem": req.usuario_origem_id,
                "campo": req.campo_duplicado,
                "valor": req.valor_duplicado
            }
        )
        db.commit()

        return {"sucesso": True, "mensagem": "Cofres unificados com sucesso."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao executar mesclagem no banco de dados: {str(e)}"
        )