import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

export async function checkConnection() {
  const state = await NetInfo.fetch();
  
  if (!state.isConnected) {
    Alert.alert(
      'No Internet Connection',
      'Please check your internet and try again.',
      [{ text: 'OK' }]
    );
    return false;
  }
  
  return true;
}