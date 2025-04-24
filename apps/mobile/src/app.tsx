import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet } from 'react-native'

import { DevicesListScreen } from './screens/devices-list-screen/devices-list-screen'

export function App() {
  return (
    <SafeAreaView style={styles.container}>
      <DevicesListScreen />
      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  }
})
