import React from 'react';
import {StyleSheet, StatusBar, View, StatusBarProps} from 'react-native';

type appStatusBar = {
  backgroundColor?: string;
} & StatusBarProps;

const AppStatusBar = ({
  backgroundColor = '#ED60CE',
  ...props
}: appStatusBar) => {
  return (
    <View style={[styles.statusBar, {backgroundColor}]}>
      <StatusBar backgroundColor={backgroundColor} {...props} translucent />
    </View>
  );
};

const BAR_HEIGHT = StatusBar.currentHeight;

const styles = StyleSheet.create({
  statusBar: {
    height: BAR_HEIGHT,
  },
});

export default AppStatusBar;
