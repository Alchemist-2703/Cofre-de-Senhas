import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import API from '../services/api';

const BACKGROUND_COLOR = '#0F172A'; // Azul escuro para o fundo do cofre

export default function DashboardScreen({ navigation }) {
  const [senhas, setSenhas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário de cadastro
  const [servico, setServico] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mostraForm, setMostraForm] = useState(false);

  // Visibilidade individual de senhas
  const [senhasVisiveis, setSenhasVisiveis] = useState({});

  // Estados do Modal de Exclusão e Confirmação
  const [modalVisible, setModalVisible] = useState(false);
  const [senhaParaDeletar, setSenhaParaDeletar] = useState(null);
  const [tipoConfirmacao, setTipoConfirmacao] = useState('senha'); // 'senha' ou 'pergunta'
  const [senhaMestraInput, setSenhaMestraInput] = useState('');
  const [respostaSegurancaInput, setRespostaSegurancaInput] = useState('');
  const [perguntaTexto, setPerguntaTexto] = useState('');
  const [deletando, setDeletando] = useState(false);

  useEffect(() => {
    carregarSenhas();
    carregarPerguntaSeguranca();
  }, []);

  const carregarSenhas = async () => {
    try {
      setLoading(true);
      const response = await API.get('/cofre/senhas');
      setSenhas(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar suas senhas.');
    } finally {
      setLoading(false);
    }
  };

  const carregarPerguntaSeguranca = async () => {
    try {
      const res = await API.get('/perguntas');
      if (res.data && res.data.pergunta) {
        setPerguntaTexto(res.data.pergunta);
      }
    } catch (error) {
      setPerguntaTexto('');
    }
  };

  const handleSalvarSenha = async () => {
    if (!servico || !identificador || !novaSenha) {
      Alert.alert('Atenção', 'Preencha todos os campos da nova senha!');
      return;
    }

    try {
      await API.post('/cofre/senhas', {
        servico: servico.trim(),
        identificador: identificador.trim(),
        senha: novaSenha,
      });

      Alert.alert('Sucesso', 'Senha salva com segurança!');
      setServico('');
      setIdentificador('');
      setNovaSenha('');
      setMostraForm(false);
      carregarSenhas();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar a senha.');
    }
  };

  const toggleVisibilidade = (id) => {
    setSenhasVisiveis((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Copia o texto exato da senha para a área de transferência
  const copiarSenha = async (senhaTexto) => {
    if (!senhaTexto) return;
    await Clipboard.setStringAsync(senhaTexto);
    Alert.alert('Copiado!', 'Senha copiada para a área de transferência.');
  };

  const abrirModalDeletar = (item) => {
    setSenhaParaDeletar(item);
    setSenhaMestraInput('');
    setRespostaSegurancaInput('');
    setTipoConfirmacao('senha');
    setModalVisible(true);
  };

  const confirmarExclusao = async () => {
    if (tipoConfirmacao === 'senha' && !senhaMestraInput.trim()) {
      Alert.alert('Atenção', 'Digite sua senha mestra.');
      return;
    }
    if (tipoConfirmacao === 'pergunta' && !respostaSegurancaInput.trim()) {
      Alert.alert('Atenção', 'Digite a resposta da pergunta de segurança.');
      return;
    }

    try {
      setDeletando(true);
      const payload = {
        tipo_confirmacao: tipoConfirmacao,
        senha_master: senhaMestraInput,
        resposta_seguranca: respostaSegurancaInput,
      };

      await API.delete(`/cofre/senhas/${senhaParaDeletar.id}`, { data: payload });

      Alert.alert('Sucesso', 'Senha excluída com sucesso!');
      setModalVisible(false);
      carregarSenhas();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao excluir senha.';
      Alert.alert('Erro de Validação', msg);
    } finally {
      setDeletando(false);
    }
  };

  const handleLogout = () => {
    delete API.defaults.headers.common['Authorization'];
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]}> 
      <View style={styles.innerContainer}>
        {/* Barra Superior */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Perfil')}
          >
            <Text style={styles.headerButtonText}>👤 Meu Perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Sair 🚪</Text>
          </TouchableOpacity>
        </View>

        {/* Botão de Nova Senha */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setMostraForm(!mostraForm)}
        >
          <Text style={styles.addButtonText}>
            {mostraForm ? '✕ Cancelar' : '+ Nova Senha'}
          </Text>
        </TouchableOpacity>

        {/* Formulário Retrátil */}
        {mostraForm && (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Cadastrar Nova Senha</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Serviço (ex: Netflix, Banco)"
              placeholderTextColor="#94A3B8"
              value={servico}
              onChangeText={setServico}
            />
            <TextInput
              style={styles.input}
              placeholder="Usuário / E-mail"
              placeholderTextColor="#94A3B8"
              value={identificador}
              onChangeText={setIdentificador}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Senha Secreta"
              placeholderTextColor="#94A3B8"
              value={novaSenha}
              onChangeText={setNovaSenha}
              secureTextEntry
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSalvarSenha}>
              <Text style={styles.saveButtonText}>Guardar no Cofre</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Título da Lista */}
        <Text style={styles.listTitle}>Minhas Senhas Salvas</Text>

        {/* Lista de Senhas */}
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={senhas}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhuma senha guardada ainda.</Text>
            }
            renderItem={({ item }) => {
              const isVisible = senhasVisiveis[item.id];
              // Exibe diretamente o valor bruto retornado pela API
              const valorSenha = item.senha_descriptografada || item.senha || '';

              return (
                <View style={styles.card}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.servico}</Text>
                    <Text style={styles.cardSub}>{item.identificador}</Text>
                    <Text style={styles.cardPassword}>
                      {isVisible ? valorSenha : '••••••••••••'}
                    </Text>
                  </View>

                  <View style={styles.cardActions}>
                    {/* Botão de Copiar */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => copiarSenha(valorSenha)}
                    >
                      <Text style={styles.actionText}>📋</Text>
                    </TouchableOpacity>

                    {/* Botão de Olho (Revelar/Ocultar) */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => toggleVisibilidade(item.id)}
                    >
                      <Text style={styles.actionText}>{isVisible ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>

                    {/* Botão de Apagar */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => abrirModalDeletar(item)}
                    >
                      <Text style={styles.actionText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar Exclusão</Text>
            <Text style={styles.modalSub}>
              Para apagar a senha de <Text style={{ fontWeight: 'bold', color: '#F8FAFC' }}>{senhaParaDeletar?.servico}</Text>, confirme sua identidade:
            </Text>

            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, tipoConfirmacao === 'senha' && styles.tabActive]}
                onPress={() => setTipoConfirmacao('senha')}
              >
                <Text style={tipoConfirmacao === 'senha' ? styles.tabTextActive : styles.tabText}>Senha Mestra</Text>
              </TouchableOpacity>

              {perguntaTexto ? (
                <TouchableOpacity
                  style={[styles.tab, tipoConfirmacao === 'pergunta' && styles.tabActive]}
                  onPress={() => setTipoConfirmacao('pergunta')}
                >
                  <Text style={tipoConfirmacao === 'pergunta' ? styles.tabTextActive : styles.tabText}>Pergunta</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {tipoConfirmacao === 'senha' ? (
              <TextInput
                style={styles.modalInput}
                placeholder="Digite sua senha mestra"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={senhaMestraInput}
                onChangeText={setSenhaMestraInput}
              />
            ) : (
              <View>
                <Text style={styles.labelPergunta}>{perguntaTexto}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Sua resposta secreta"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={respostaSegurancaInput}
                  onChangeText={setRespostaSegurancaInput}
                />
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={confirmarExclusao}
                disabled={deletando}
              >
                {deletando ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Apagar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { flex: 1, padding: 20 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerButtonText: { color: '#F8FAFC', fontWeight: '600', fontSize: 13 },
  logoutButton: { backgroundColor: '#451A03', borderColor: '#78350F' },
  logoutButtonText: { color: '#FDBA74', fontWeight: '600', fontSize: 13 },
  addButton: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  formContainer: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  input: {
    backgroundColor: '#0F172A',
    color: '#FFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#16A34A',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  saveButtonText: { color: '#FFF', fontWeight: 'bold' },
  listTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyText: { color: '#64748B', textAlign: 'center', marginTop: 30 },
  card: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: 'bold' },
  cardSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  cardPassword: { color: '#60A5FA', fontSize: 15, fontWeight: 'bold', marginTop: 6 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 18 },

  /* ESTILOS DO MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    width: '100%',
    maxWidth: 380,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginVertical: 10 },
  tabContainer: {
    flexDirection: 'row',
    marginVertical: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 2,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  labelPergunta: { fontSize: 13, fontWeight: '600', color: '#38BDF8', marginBottom: 8 },
  modalInput: {
    backgroundColor: '#0F172A',
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 10, justifyContent: 'center' },
  cancelBtnText: { color: '#94A3B8', fontWeight: 'bold' },
  confirmBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justify: 'center',
  },
  confirmBtnText: { color: '#FFF', fontWeight: 'bold' },
});