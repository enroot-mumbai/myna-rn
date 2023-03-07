import React from 'react';
import {SafeAreaView, StatusBar, StyleSheet} from 'react-native';
import AppStatusBar from './StatusBar';
import {useAppSelector} from '../context/redux/hooks';

const SafeAreaProvider = ({children}: {children: React.ReactElement}) => {
  const {token} = useAppSelector(state => state?.appConfig);
  const backgroundColor = token ? '#ED60CE' : '#fff';

  return (
    <>
      <SafeAreaView style={[styles.topSafeArea, {backgroundColor}]} />
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor={token ? '#ED60CE' : '#fff'} />
        {children}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  topSafeArea: {
    flex: 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default SafeAreaProvider;
