import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'user_jwt_token';
const BIOMETRICS_ENABLED_KEY = 'biometrics_enabled';

// Salva o token JWT de forma criptografada no dispositivo
export async function salvarTokenSeguro(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

// Recupera o token salvo
export async function obterTokenSeguro() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

// Limpa os dados ao fazer Logout
export async function removerTokenSeguro() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY);
}

// Define se o usuário ativou a biometria nas configurações do perfil
export async function setBiometriaAtivada(status) {
  await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, status ? 'true' : 'false');
}

export async function isBiometriaAtivada() {
  const value = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
  return value === 'true';
}

// Verifica se o aparelho celular suporta biometria (Digital ou Rosto)
export async function verificarSuporteBiometria() {
  const temHardware = await LocalAuthentication.hasHardwareAsync();
  const estaCadastrado = await LocalAuthentication.isEnrolledAsync();
  return temHardware && estaCadastrado;
}

// Executa a validação biométrica com prompt nativo
export async function autenticarComBiometria() {
  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirme sua identidade para entrar no Cofre',
    fallbackLabel: 'Usar Senha Mestra',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
  });

  return resultado.success;
}