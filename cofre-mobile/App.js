import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

import CadastroScreen from './src/screens/CadastroScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import RecuperarSenhaScreen from './src/screens/RecuperarSenhaScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            headerStyle: { backgroundColor: '#030303' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: '#030303' }, // Garante o fundo escuro da tela
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Meu Cofre de Senhas', headerBackVisible: false }}/>
          <Stack.Screen name="Cadastro" component={CadastroScreen} options={{ title: 'Nova Conta' }} />
          <Stack.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Meu Perfil' }} />
          <Stack.Screen name="RecuperarSenha" component={RecuperarSenhaScreen} options={{ title: 'Recuperar Acesso' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}