import {ActivityIndicator, View} from 'react-native';
import React from 'react';

export const SimpleLoader = () => {
  return (
    <View
      style={{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
      }}>
      <ActivityIndicator size={90} color={'#0084e4'} style={{marginEnd: 10}} />
    </View>
  );
};
