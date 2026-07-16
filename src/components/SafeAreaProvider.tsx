import React from 'react';
import {View, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AppStatusBar from './StatusBar';
import {useAppSelector} from '../context/redux/hooks';

const SafeAreaProvider = ({children}: {children: React.ReactElement}) => {
  const insets = useSafeAreaInsets();
  const {token} = useAppSelector(state => state?.appConfig);
  const backgroundColor = token ? '#ED60CE' : '#fff';

  return (
    <View style={styles.root}>
      <View
        style={[styles.topSafeArea, {backgroundColor}]}
      />
      <View style={[styles.container, {paddingBottom: insets.bottom}]}>
        <AppStatusBar backgroundColor={backgroundColor} />
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topSafeArea: {
    flexGrow: 0,
    flexShrink: 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default SafeAreaProvider;
