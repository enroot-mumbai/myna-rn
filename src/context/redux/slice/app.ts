import {createSlice} from '@reduxjs/toolkit';
import type {PayloadAction} from '@reduxjs/toolkit';

// Define the initial state using that type
const initialState = {
  token: '',
};

export const appSlice = createSlice({
  name: 'appStore',
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    saveToken: (state, action: PayloadAction) => {
      state.token = action.payload;
      return state;
    },
    removeToken: state => {
      state.token = undefined;
      return state;
    },
  },
});

export const {saveToken, removeToken} = appSlice.actions;

export default appSlice.reducer;
