import Optimization from '@contentful/optimization-react-native';
import {
  OPTIMIZATION_CLIENT_ID,
  OPTIMIZATION_ENVIRONMENT,
} from '@env';

/**
 * Creates and returns an Optimization SDK instance.
 * This is async because the SDK needs to initialize internal state.
 */
export async function createOptimizationInstance(): Promise<Optimization> {
  const optimization = await Optimization.create({
    clientId: OPTIMIZATION_CLIENT_ID,
    environment: OPTIMIZATION_ENVIRONMENT,
    logLevel: __DEV__ ? 'info' : 'warn',
    defaults: {
      consent: true,
    },
  });
  return optimization;
}
