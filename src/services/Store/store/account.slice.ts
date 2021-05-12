import { BigNumber as EthersBN } from '@ethersproject/bignumber';
import { createAction, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { put, select, takeLatest } from 'redux-saga/effects';

import { translateRaw } from '@translations';
import {
  AssetBalanceObject,
  IAccount,
  IProvidersMappings,
  ITxStatus,
  LSKeys,
  StoreAsset,
  TUuid
} from '@types';
import { findIndex, propEq } from '@vendor';

import { getAssetByUUID } from './asset.slice';
import { sanitizeAccount } from './helpers';
import { getNetwork } from './network.slice';
import { getAppState } from './selectors';
import { addAccountsToFavorites, getFavorites, getIsDemoMode } from './settings.slice';

export const initialState = [] as IAccount[];

const sliceName = LSKeys.ACCOUNTS;

const slice = createSlice({
  name: sliceName,
  initialState,
  reducers: {
    create(state, action: PayloadAction<IAccount>) {
      state.push(sanitizeAccount(action.payload));
    },
    createMany(state, action: PayloadAction<IAccount[]>) {
      action.payload.forEach((a) => {
        state.push(sanitizeAccount(a));
      });
    },
    resetAndCreate(_, action: PayloadAction<IAccount>) {
      return [sanitizeAccount(action.payload)];
    },
    resetAndCreateMany(state, action: PayloadAction<IAccount[]>) {
      action.payload.forEach((a) => {
        state.push(sanitizeAccount(a));
      });
    },
    destroy(state, action: PayloadAction<TUuid>) {
      const idx = findIndex(propEq('uuid', action.payload), state);
      state.splice(idx, 1);
    },
    update(state, action: PayloadAction<IAccount>) {
      const idx = findIndex(propEq('uuid', action.payload.uuid), state);
      state[idx] = sanitizeAccount(action.payload);
    },
    updateMany(state, action: PayloadAction<IAccount[]>) {
      const accounts = action.payload;
      accounts.forEach((account) => {
        const idx = findIndex(propEq('uuid', account.uuid), state);
        state[idx] = sanitizeAccount(account);
      });
    },
    updateAssets(state, action: PayloadAction<Record<string, AssetBalanceObject[]>>) {
      const accounts = action.payload;
      Object.entries(accounts).forEach(([uuid, assets]) => {
        const idx = findIndex(propEq('uuid', uuid), state);
        state[idx].assets = assets;
      });
    },
    reset() {
      return initialState;
    }
  }
});

export const {
  create: createAccount,
  createMany: createAccounts,
  resetAndCreate: resetAndCreateAccount,
  resetAndCreateMany: resetAndCreateManyAccounts,
  destroy: destroyAccount,
  update: updateAccount,
  updateMany: updateAccounts,
  reset: resetAccount,
  updateAssets: updateAccountAssets
} = slice.actions;

export default slice;

/**
 * Selectors
 */
export const getAccounts = createSelector([getAppState], (s) => {
  const accounts = s[slice.name];
  return accounts?.map((a) => ({
    ...a,
    transactions: a.transactions?.map((t) => ({
      ...t,
      value: EthersBN.from(t.value),
      gasLimit: EthersBN.from(t.gasLimit),
      gasPrice: EthersBN.from(t.gasPrice),
      gasUsed: t.gasUsed && EthersBN.from(t.gasUsed)
    }))
  }));
});

export const selectCurrentAccounts = createSelector(
  [getAccounts, getFavorites],
  (accounts, favorites) => {
    return accounts.filter(({ uuid }) => favorites.indexOf(uuid) >= 0);
  }
);

export const selectAccountTxs = createSelector([getAccounts], (accounts) => {
  return accounts
    .filter(Boolean)
    .flatMap(({ transactions }) =>
      transactions.map((tx: any) => ({ ...tx, status: tx.status || tx.stage }))
    );
});

export const selectTxsByStatus = (status: ITxStatus) =>
  createSelector([selectAccountTxs], (txs) => {
    return txs.filter(({ status: s }) => s === status);
  });

export const getAccountsAssets = createSelector([getAccounts, (s) => s], (a, s) =>
  a
    .flatMap((a) => a.assets)
    .reduce((acc, asset) => [...acc, getAssetByUUID(asset.uuid)(s)], [] as StoreAsset[])
);

export const getAccountsAssetsMappings = createSelector([getAccountsAssets], (assets) =>
  assets.reduce(
    (acc, a) => (a ? { ...acc, [a.uuid]: a.mappings } : acc),
    {} as Record<string, IProvidersMappings>
  )
);

export const getStoreAccounts = (accounts: IAccount[]) =>
  createSelector([(s) => s], (s) => {
    return accounts.map((a) => {
      const accountAssets = a.assets.reduce(
        (acc, asset) =>
          [
            ...acc,
            // @ts-expect-error why tf are you crying ?
            { ...asset, balance: EthersBN.from(asset.balance), ...getAssetByUUID(asset.uuid)(s)! }
          ] as StoreAsset[],
        [] as StoreAsset[]
      );
      return {
        ...a,
        assets: accountAssets,
        // @ts-expect-error why tf are you crying ?
        network: getNetwork(a.networkId)(s),
        label: a.label ? a.label : translateRaw('NO_LABEL')
      };
    });
  });

/**
 * Actions
 */
export const addAccounts = createAction<IAccount[]>(`${slice.name}/addAccounts`);

/**
 * Sagas
 */
export function* accountsSaga() {
  yield takeLatest(addAccounts.type, handleAddAccounts);
}

export function* handleAddAccounts({ payload }: PayloadAction<IAccount[]>) {
  const isDemoMode: boolean = yield select(getIsDemoMode);
  // This is where demo mode is disabled when adding new accounts.
  if (isDemoMode) {
    yield put(slice.actions.resetAndCreateMany(payload));
    yield put(addAccountsToFavorites(payload.map(({ uuid }) => uuid)));
  } else {
    yield put(slice.actions.createMany(payload));
    yield put(addAccountsToFavorites(payload.map(({ uuid }) => uuid)));
  }
}
