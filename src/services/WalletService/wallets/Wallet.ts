import { DPath } from '@types';

import { DWAccountDisplay, ExtendedDPath } from '../deterministic/types';
import { KeyInfo } from './HardwareWallet';
import { WalletResult } from './types';

export default interface Wallet {
  /**
   * Initialize the wallet. Can be used to connect to the device and check the connection.
   */
  initialize(dpath?: DPath): Promise<void>;

  /**
   * Optional function that can be used to prefetch necessary info from a device.
   *
   * @param {DPath[]} paths The derivation paths to prefetch.
   * @return {Promise<any>} Can return the pre-fetched info for unit tests.
   */
  prefetch?(paths: DPath[]): Promise<{ [key: string]: KeyInfo }>;

  /**
   * Optional function that can be used to getMultipleAddresses from a device.
   *
   * @param {ExtendedDPath[]} paths The derivation paths to getMultipleAddresses.
   * @return {Promise<any>} Can return an array of deterministic wallet's account display objects.
   */
  getMultipleAddresses(paths: ExtendedDPath[]): Promise<DWAccountDisplay[]>;

  /**
   * Get an address or multiple addresses for a derivation path at a specific index.
   *
   * @param {DPath} dPath The derivation path.
   * @param {number} index The address or account index.
   * @return {Promise<WalletResult>} A Promise with the fetched result.
   */
  getAddress(dPath: DPath, index: number): Promise<WalletResult | WalletResult[]>;

  /**
   * Get the derivation paths that are supported by the wallet.
   */
  getDPaths(): DPath[];
}
