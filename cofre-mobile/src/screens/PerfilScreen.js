import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import API from '../services/api';
import {
  verificarSuporteBiometria,
  isBiometriaAtivada,
  setBiometriaAtivada,
  autenticarComBiometria,
} from '../services/biometrics';

const BACKGROUND_COLOR = '#1E3A8A';

export default function PerfilScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  // Estados de Biometria
  const [biometriaHabilitada, setBiometriaHabilitada] = useState(false);
  const [suportaBiometria, setSuportaBiometria] = useState(false);

  // Pergunta de segurança
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');

  // 1. Carrega dados salvos e verifica biometria assim que abre a tela
  useEffect(() => {
    inicializarTela();
  }, []);

  const inicializarTela = async () => {
    await carregarPerfil();
    await checarBiometria();
  };

  const carregarPerfil = async () => {
    try {
      setLoading(true);
      const response = await API.get('/perfil');
      const dados = response.data;

      if (dados) {
        setNome(dados.nome || '');
        setCpf(dados.cpf || '');
        setTelefone(dados.telefone || '');
        setEmail(dados.email || '');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as informações do perfil.');
    } finally {
      setLoading(false);
    }
  };

  const checarBiometria = async () => {
    const suportado = await verificarSuporteBiometria();
    setSuportaBiometria(suportado);

    if (suportado) {
      const ativada = await isBiometriaAtivada();
      setBiometriaHabilitada(ativada);
    }
  };

  const handleToggleBiometria = async (valor) => {
    if (valor) {
      // Exige uma confirmação biométrica no momento em que a chave é ativada
      const comSucesso = await autenticarComBiometria();
      if (comSucesso) {
        await setBiometriaAtivada(true);
        setBiometriaHabilitada(true);
        Alert.alert('Sucesso', 'Autenticação biométrica ativada com sucesso!');
      } else {
        Alert.alert('Erro', 'Não foi possível confirmar a biometria.');
      }
    } else {
      await setBiometriaAtivada(false);
      setBiometriaHabilitada(false);
    }
  };

  // 2. Função principal de salvamento do perfil
  const handleSalvarTudo = async () => {
    // Validação rápida: Impede salvar metade da pergunta de segurança
    if ((pergunta.trim() && !resposta.trim()) || (!pergunta.trim() && resposta.trim())) {
      Alert.alert(
        'Atenção',
        'Para cadastrar a pergunta de segurança, preencha tanto a pergunta quanto a resposta.'
      );
      return;
    }

    try {
      setLoading(true);

      const payloadPerfil = {};
      if (nome.trim()) payloadPerfil.nome = nome.trim();
      if (cpf.trim()) payloadPerfil.cpf = cpf.trim();
      if (telefone.trim()) payloadPerfil.telefone = telefone.trim();
      if (email.trim()) payloadPerfil.email = email.trim();

      // Checa se os dados pertencem a outro usuário
      const checagem = await API.post('/perfil/verificar-duplicidade', payloadPerfil);

      if (checagem.data?.duplicado) {
        setLoading(false); // Pausa o loading para exibir o alerta
        const { campo_conflito, valor_conflito, usuario_existente_id } = checagem.data;

        // Exibe a caixa de confirmação de mesclagem
        Alert.alert(
          'Conta Encontrada',
          `O ${campo_conflito.toUpperCase()} (${valor_conflito}) já pertence a outra conta.\n\nDeseja mesclar os cofres e mover as senhas para a sua conta atual?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Mesclar Cofres',
              onPress: () =>
                executarMesclagemCofres({
                  usuarioOrigemId: usuario_existente_id,
                  campoDuplicado: campo_conflito,
                  valorDuplicado: valor_conflito,
                  payloadPerfil: payloadPerfil,
                }),
            },
          ]
        );
        return;
      }

      // Se não houver duplicidades, atualiza o perfil diretamente
      await API.put('/perfil', payloadPerfil);

      if (pergunta.trim() && resposta.trim()) {
        await API.post('/perguntas', {
          pergunta: pergunta.trim(),
          resposta: resposta.trim(),
        });
      }

      Alert.alert('Sucesso', 'Perfil e configurações atualizados!');
      navigation.goBack();
    } catch (error) {
      const messageToShow =
        error.response?.data?.detail || 'Ocorreu um erro ao salvar o perfil.';
      Alert.alert(
        'Atenção',
        typeof messageToShow === 'object' ? JSON.stringify(messageToShow) : messageToShow
      );
    } finally {
      setLoading(false);
    }
  };

  // 3. Função de execução da mesclagem
  const executarMesclagemCofres = async ({
    usuarioOrigemId,
    campoDuplicado,
    valorDuplicado,
    payloadPerfil,
  }) => {
    try {
      setLoading(true);

      const resPerfil = await API.get('/perfil');
      const usuarioDestinoId = resPerfil.data?.id;

      if (!usuarioDestinoId) {
        Alert.alert('Erro', 'Não foi possível obter a identificação do seu usuário.');
        return;
      }

      await API.post('/perfil/mesclar-cofres', {
        usuario_destino_id: Number(usuarioDestinoId),
        usuario_origem_id: Number(usuarioOrigemId),
        campo_duplicado: String(campoDuplicado),
        valor_duplicado: String(valorDuplicado),
      });

      await API.put('/perfil', payloadPerfil);

      if (pergunta.trim() && resposta.trim()) {
        await API.post('/perguntas', {
          pergunta: pergunta.trim(),
          resposta: resposta.trim(),
        });
      }

      Alert.alert('Sucesso', 'Cofres unificados e perfil salvo com sucesso!');
      navigation.goBack();
    } catch (error) {
      const messageToShow =
        error.response?.data?.detail || 'Erro ao realizar a mesclagem.';
      Alert.alert(
        'Erro na Mesclagem',
        typeof messageToShow === 'object' ? JSON.stringify(messageToShow) : messageToShow
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: BACKGROUND_COLOR }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.title}>Meu Perfil</Text>
          <Text style={styles.subtitle}>Gerencie suas informações e segurança</Text>

          {/* DADOS DE PERFIL */}
          <Text style={styles.label}>Nome Completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Seu nome completo"
            placeholderTextColor="#888"
            value={nome}
            onChangeText={setNome}
          />

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>CPF</Text>
          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            placeholderTextColor="#888"
            value={cpf}
            onChangeText={setCpf}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(00) 00000-0000"
            placeholderTextColor="#888"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
          />

          <View style={styles.divider} />

          {/* PERGUNTA DE SEGURANÇA */}
          <Text style={styles.sectionTitle}>Cadastrar Pergunta de Segurança</Text>
          <Text style={styles.sectionSubtitle}>
            Necessária para recuperar o cofre caso esqueça a senha
          </Text>

          <Text style={styles.label}>Pergunta</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Qual o nome da sua primeira escola?"
            placeholderTextColor="#888"
            value={pergunta}
            onChangeText={setPergunta}
          />

          <Text style={styles.label}>Resposta Secreta</Text>
          <TextInput
            style={styles.input}
            placeholder="Sua resposta"
            placeholderTextColor="#888"
            value={resposta}
            onChangeText={setResposta}
            secureTextEntry
          />

          <View style={styles.divider} />

          {/* BIOMETRIA */}
          <Text style={styles.sectionTitle}>Segurança Biométrica</Text>
          <Text style={styles.sectionSubtitle}>
            Acesse seu cofre rapidamente sem digitar a senha mestra
          </Text>

          {suportaBiometria ? (
            <View style={styles.biometriaRow}>
              <Text style={styles.biometriaLabel}>Usar Digital / Face ID</Text>
              <Switch
                value={biometriaHabilitada}
                onValueChange={handleToggleBiometria}
                trackColor={{ false: '#CBD5E1', true: '#1E3A8A' }}
                thumbColor={biometriaHabilitada ? '#2563EB' : '#F1F5F9'}
              />
            </View>
          ) : (
            <Text style={styles.warningText}>
              Este dispositivo não possui biometria cadastrada ou suportada.
            </Text>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSalvarTudo}>
            <Text style={styles.buttonText}>Salvar Alterações</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, elevation: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginTop: 6 },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 14, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', color: '#0F172A', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },
  biometriaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 16,
  },
  biometriaLabel: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  warningText: { fontSize: 12, color: '#EF4444', fontStyle: 'italic', marginBottom: 16 },
  button: { backgroundColor: '#1E3A8A', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});