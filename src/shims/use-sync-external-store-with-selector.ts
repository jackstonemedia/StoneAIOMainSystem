import { useSyncExternalStore, useRef } from 'react';

type Snapshot<S> = () => S;
type IsEqual<S> = (a: S, b: S) => boolean;

export function useSyncExternalStoreWithSelector<S, T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: Snapshot<S>,
  getServerSnapshot: Snapshot<S> | undefined,
  selector: (snapshot: S) => T,
  isEqual?: IsEqual<T>,
): T {
  const instRef = useRef<{ hasValue: boolean; value: T } | null>(null);
  let inst = instRef.current;

  let hasMemo = false;
  let memoizedSnapshot: S;
  let memoizedSelection: T;

  const memoizedSelector = (nextSnapshot: S): T => {
    if (!hasMemo) {
      hasMemo = true;
      memoizedSnapshot = nextSnapshot;
      const nextSelection = selector(nextSnapshot);
      memoizedSelection = nextSelection;
      return nextSelection;
    }
    if (Object.is(memoizedSnapshot, nextSnapshot)) {
      return memoizedSelection;
    }
    const nextSelection = selector(nextSnapshot);
    if (isEqual !== undefined && isEqual(memoizedSelection, nextSelection)) {
      memoizedSnapshot = nextSnapshot;
      return memoizedSelection;
    }
    memoizedSnapshot = nextSnapshot;
    memoizedSelection = nextSelection;
    return nextSelection;
  };

  const value = useSyncExternalStore(
    subscribe,
    () => memoizedSelector(getSnapshot()),
    getServerSnapshot === undefined ? undefined : () => memoizedSelector(getServerSnapshot()),
  );

  if (inst !== null && !Object.is(inst.value, value)) {
    inst.hasValue = true;
    inst.value = value;
  } else if (inst === null) {
    instRef.current = { hasValue: true, value };
  }

  return value;
}

export default { useSyncExternalStoreWithSelector };
