import {configureStore} from '@reduxjs/toolkit';
import {setupListeners} from '@reduxjs/toolkit/query';
import appStoreReducer from '../slice/app';

export function setUpStore() {
  const store = configureStore({
    reducer: {
      appConfig: appStoreReducer,
    },
  });

  setupListeners(store.dispatch);

  return store;
}

const store = setUpStore();

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export default store;
