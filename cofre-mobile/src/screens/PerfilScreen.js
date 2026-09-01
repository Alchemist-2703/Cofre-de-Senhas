import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import API from '../services/api';

const BACKGROUND_COLOR = '#1E3A8A';

export default function PerfilScreen({ navigation }) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');

  const handleSalvarPerfil = async () => {
    try {
      await API.put('/perfil', {
        nome: nome.trim(),
        cpf: cpf.trim(),
        telefone: telefone.trim(),
      });
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      navigation.goBack();
    } catch (error) {
  const apiMessage = error.response?.data?.message;

  // Se for uma lista (Array), junta tudo com vírgula. Se for objeto/outro, converte.
  const messageToShow = Array.isArray(apiMessage)
    ? apiMessage.join('\n')
    : typeof apiMessage === 'object'
    ? JSON.stringify(apiMessage)
    : apiMessage || 'Ocorreu um erro ao atualizar o perfil.';

  Alert.alert('Atenção', messageToShow);}
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.title}>Meu Perfil</Text>
          <Text style={styles.subtitle}>Complete suas informações de verificação</Text>

          <Text style={styles.label}>Nome Completo</Text>
          <TextInput style={styles.input} placeholder="Seu nome completo" placeholderTextColor="#888" value={nome} onChangeText={setNome} />

          <Text style={styles.label}>CPF</Text>
          <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor="#888" value={cpf} onChangeText={setCpf} keyboardType="numeric" />

          <Text style={styles.label}>Telefone</Text>
          <TextInput style={styles.input} placeholder="(00) 00000-0000" placeholderTextColor="#888" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />

          <TouchableOpacity style={styles.button} onPress={handleSalvarPerfil}>
            <Text style={styles.buttonText}>Salvar Perfil</Text>
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
  button: { backgroundColor: '#1E3A8A', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});