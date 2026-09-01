import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent chama AppRegistry.registerComponent('main', () => App);
// Ele garante que o aplicativo funcione perfeitamente tanto no Expo Go quanto na Web.
registerRootComponent(App);