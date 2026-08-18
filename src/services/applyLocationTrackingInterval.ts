import { configureLocationTrackingInterval } from './locationTrackingService';

/** Apply a live interval from GET /field/session: tracker, persisted session, Redux. */
export async function applyLocationTrackingIntervalFromApi(
  seconds?: number | null,
): Promise<void> {
  const normalized = configureLocationTrackingInterval(seconds);
  const { persistLocationTrackingInterval } = await import('./sessionStorage');
  await persistLocationTrackingInterval(normalized);
  const { store } = await import('../store');
  const { setLocationTrackingInterval } = await import(
    '../store/reducers/authSlice'
  );
  store.dispatch(setLocationTrackingInterval(normalized));
}
