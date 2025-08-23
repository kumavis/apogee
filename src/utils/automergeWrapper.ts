import { DocHandle } from "@automerge/react";

/*

Tried to make a wrapper around automerge that would always give the latest values but would hold changes until you called commit.
This has a couple challeges. if you're intercepting and not applying the changes, you need to shadow the original values so you get the new ones.
You also need to be able to apply function calls and provide a return value. You could simplify this but just allowing certain function calls like array methods.

Even if you went with the approach of getting a doc and writing to it and then submitting it this turn, youd need to interact with the docHandle/Xstate machine backwards from how it wants to work.
Maybe you can do this, screwing with the doc refs, but i dont think so.

doc1 = handle.doc()
doc1.a = 1

handle.update(doc2 => {
  return doc1;
})

*/

type ChangeEntry = {
  type: "set" | "delete" | "call";
  path: string[];
  args: any[];
}

const isObject = (value: any) => {
  return Object(value) === value;
}

const getLastParent = (start: any, path: string[]) => {
  let current = start;
  for (let i = path.length - 2; i >= 0; i--) {
    const part = path[i];
    if (part !== undefined && current[part] !== undefined) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

const deepSet = (start: any, path: string[], value: any) => {
  const parent = getLastParent(start, path);
  if (parent !== undefined) {
    const last = path[path.length - 1];
    if (last !== undefined) {
      parent[last] = value;
    }
  }
}

const deepDelete = (start: any, path: string[]) => {  
  const parent = getLastParent(start, path);
  if (parent !== undefined) {
    const last = path[path.length - 1];
    if (last !== undefined) {
      delete parent[last];
    }
  }
}

const deepCall = (start: any, path: string[], args: any[]) => {
  const parent = getLastParent(start, path);
  if (parent !== undefined) {
    const last = path[path.length - 1];
    if (last !== undefined) {
      parent[last](...args);
    }
  }
}

const commitChanges = (handle: DocHandle<any>, changes: ChangeEntry[]) => {
  handle.update(doc => {
    changes.forEach(change => {
      switch (change.type) {
        case "set":
          deepSet(doc, change.path, change.args[0]);
          break;
        case "delete":
          deepDelete(doc, change.path);
          break;
        case "call":
          deepCall(doc, change.path, change.args);
          break;
      }
    });
    return doc;
  });
}

const makeWrapperInternal = <T extends object>(
  rawTarget: T,
  addChange: (change: ChangeEntry) => void,
  pathPrefix: string[] = [],
  isDocHandle: boolean = false,
): T => {
  return new Proxy(rawTarget, {
    get: (_rawTarget: never, prop: string | symbol) => {
      let target = isDocHandle ? (rawTarget as DocHandle<T>).doc() : rawTarget;
      // Only allow string property access, and only if the property exists on doc
      if (typeof prop === "string" && prop in target) {
        // @ts-expect-error: dynamic property access
        const value = target[prop];
        // Only create proxy for objects, return primitives directly
        if (isObject(value)) {
          return makeWrapperInternal<typeof value>(
            value,
            addChange,
            [...pathPrefix, prop as string],
          );
        }
        // Return primitives as-is (they'll be used for assignment/reading)
        return value;
      }
      return undefined;
    },
    set: (_rawTarget: never, prop: string | symbol, value: any) => {
      addChange({
        type: "set",
        path: [...pathPrefix, prop as string],
        args: [value],
      });
      return true;
    },
    deleteProperty: (_rawTarget: never, prop: string | symbol) => {
      addChange({
        type: "delete",
        path: [...pathPrefix, prop as string],
        args: [],
      });
      return true;
    },
    apply: (_rawTarget: never, thisArg: never, args: any[]) => {
      addChange({
        type: "call",
        path: [...pathPrefix],
        args,
      });
    },
  });
}

const makeDocHandleWrapper = <T>(handle: DocHandle<T>, addChange: (change: ChangeEntry) => void) => {
  const wrapper = makeWrapperInternal(
    handle,
    addChange,
    [],
    true,
  );
  // Override the return type because isDocHandle is true
  return wrapper as unknown as T;
}

export const makeAutomergeWrapper = <T>(
  handle: DocHandle<T>,
  onChange?: (change: ChangeEntry) => void,
) => {
  let changes: ChangeEntry[] = [];
  const wrapper = makeDocHandleWrapper(handle, (change) => {
    changes.push(change);
    onChange?.(change);
  });
  const commit = () => {
    commitChanges(handle, changes);
    changes = [];
  }
  return { wrapper, commit };
}

export const makeDebouncedAutocommitWrapper = <T>(
  handle: DocHandle<T>,
  debounceTime: number = 200,
  onCommit?: () => void,
) => {
  let timeoutId: NodeJS.Timeout | number;
  const onChange = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      originalCommit();
      onCommit?.();
    }, debounceTime);
  }
  const { wrapper, commit: originalCommit } = makeAutomergeWrapper(handle, onChange);
  
  // Create enhanced commit that clears pending auto-commit
  const commit = () => {
    clearTimeout(timeoutId); // Clear pending auto-commit
    originalCommit();
  };
  
  return { wrapper, commit };
}
