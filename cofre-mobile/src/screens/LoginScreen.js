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
} from 'react-native';
import API from '../services/api';
import {
  isBiometriaAtivada,
  obterTokenSeguro,
  salvarTokenSeguro,
  autenticarComBiometria,
} from '../services/biometrics';

const BACKGROUND_COLOR = '#1E3A8A';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCadastro, setIsCadastro] = useState(false);
  const [temBiometriaDisponivel, setTemBiometriaDisponivel] = useState(false);

  // 1. Verifica se a biometria já foi habilitada no perfil e se temos um token guardado
  useEffect(() => {
    checarEExecutarBiometria();
  }, []);

  const checarEExecutarBiometria = async () => {
    const ativada = await isBiometriaAtivada();
    const token = await obterTokenSeguro();

    if (ativada && token) {
      setTemBiometriaDisponivel(true);
      // Tenta abrir a biometria automaticamente ao iniciar a tela
      await executarLoginBiometrico(token);
    }
  };

  const executarLoginBiometrico = async (tokenExistente = null) => {
    const token = tokenExistente || (await obterTokenSeguro());
    if (!token) return;

    const sucesso = await autenticarComBiometria();
    if (sucesso) {
      // Aplica o token aos cabeçalhos da API para validar as requisições
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha todos os campos!');
      return;
    }

    try {
      if (isCadastro) {
        // Requisição para cadastrar usuário
        await API.post('/cadastrar', {
          email: email.trim(),
          master_password: password,
        });
        Alert.alert('Sucesso', 'Conta criada com sucesso! Faça login.');
        setIsCadastro(false);
      } else {
        // Requisição para login tradicional
        const response = await API.post('/login-master', {
          email: email.trim(),
          master_password: password,
        });

        const { access_token } = response.data;

        // Salva o token de forma criptografada para acessos com biometria no futuro
        await salvarTokenSeguro(access_token);

        // Define o Token JWT no Axios
        API.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

        Alert.alert('Bem-vindo!', 'Login efetuado com sucesso.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Ocorreu um erro na conexão.';
      Alert.alert('Erro', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Cartão Branco Centralizado */}
        <View style={styles.card}>
          <Text style={styles.title}>🔐 Cofre de Senhas</Text>
          <Text style={styles.subtitle}>
            {isCadastro ? 'Criar Nova Conta' : 'Acessar seu Cofre'}
          </Text>

          {/* Campo de Entrada de E-mail / CPF */}
          <Text style={styles.label}>E-mail ou CPF</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite seu e-mail ou CPF"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Campo de Entrada de Senha Mestra */}
          <Text style={styles.label}>Senha Mestra</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite sua senha mestra"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Link para Recuperação de Senha */}
          {!isCadastro && (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => navigation.navigate('RecuperarSenha')}
            >
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>
          )}

          {/* Botão de Biometria (Exibido apenas se ativado no perfil e fora do modo cadastro) */}
          {!isCadastro && temBiometriaDisponivel && (
            <TouchableOpacity
              style={styles.bioButton}
              onPress={() => executarLoginBiometrico()}
            >
              <Text style={styles.bioButtonText}>👆 Entrar com Digital / Face ID</Text>
            </TouchableOpacity>
          )}

          {/* Botão de Ação Principal */}
          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>
              {isCadastro ? 'Cadastrar' : 'Entrar'}
            </Text>
          </TouchableOpacity>

          {/* Divisor Visual */}
          <View style={styles.divider} />

          {/* Alternar entre Login e Cadastro */}
          <TouchableOpacity onPress={() => setIsCadastro(!isCadastro)}>
            <Text style={styles.switchText}>
              {isCadastro
                ? 'Já possui conta? Faça Login'
                : 'Não tem conta? Cadastre-se'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    color: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    fontSize: 16,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
  bioButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#1E3A8A',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  bioButtonText: {
    color: '#1E3A8A',
    fontSize: 15,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#1E3A8A',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 18,
  },
  switchText: {
    color: '#1E3A8A',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});