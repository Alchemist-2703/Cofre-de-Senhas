import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import API from '../services/api';

const BACKGROUND_COLOR = '#1E3A8A';

export default function RecuperarSenhaScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  const handleBuscarPergunta = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Informe seu e-mail!');
      return;
    }
    try {
      const response = await API.get(`/perguntas/recuperacao/${email.trim()}`);
      if (response.data && response.data.length > 0) {
        setPergunta(response.data[0].pergunta);
        setStep(2);
      } else {
        Alert.alert('Erro', 'Nenhuma pergunta de segurança encontrada para este e-mail.');
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao buscar pergunta de segurança.';
      Alert.alert('Erro', msg);
    }
  };

  const handleRedefinirSenha = async () => {
    if (!resposta || !novaSenha) {
      Alert.alert('Atenção', 'Preencha a resposta e a nova senha!');
      return;
    }
    try {
      await API.post('/recuperar-chave-mestra', {
        email: email.trim(),
        resposta: resposta.trim(),
        nova_master_password: novaSenha,
      });
      Alert.alert('Sucesso', 'Sua senha foi redefinida com sucesso!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erro ao redefinir senha.';
      Alert.alert('Erro', msg);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.title}>Recuperar Acesso</Text>
          <Text style={styles.subtitle}>
            {step === 1 ? 'Informe seu e-mail para buscar a pergunta' : 'Responda à pergunta de segurança'}
          </Text>

          {step === 1 ? (
            <>
              <Text style={styles.label}>E-mail cadastrado</Text>
              <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor="#888" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

              <TouchableOpacity style={styles.button} onPress={handleBuscarPergunta}>
                <Text style={styles.buttonText}>Continuar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.perguntaBox}>{pergunta}</Text>

              <Text style={styles.label}>Sua Resposta</Text>
              <TextInput style={styles.input} placeholder="Digite sua resposta" placeholderTextColor="#888" value={resposta} onChangeText={setResposta} />

              <Text style={styles.label}>Nova Senha Mestra</Text>
              <TextInput style={styles.input} placeholder="Nova senha" placeholderTextColor="#888" value={novaSenha} onChangeText={setNovaSenha} secureTextEntry />

              <TouchableOpacity style={styles.button} onPress={handleRedefinirSenha}>
                <Text style={styles.buttonText}>Redefinir Senha</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkContainer}>
            <Text style={styles.linkText}>Voltar ao Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, elevation: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', color: '#0F172A', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 16 },
  perguntaBox: { backgroundColor: '#E2E8F0', color: '#1E293B', padding: 12, borderRadius: 8, fontWeight: '600', fontSize: 15, marginBottom: 16 },
  button: { backgroundColor: '#1E3A8A', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  linkContainer: { marginTop: 18 },
  linkText: { color: '#1E3A8A', textAlign: 'center', fontSize: 14, fontWeight: '600' }
});