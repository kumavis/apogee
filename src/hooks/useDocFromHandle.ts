import { DocHandle } from "@automerge/automerge-repo/slim";
import { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge/slim";
import { useCallback, useEffect, useState } from "react";
import { UseDocumentReturn } from "@automerge/automerge-repo-react-hooks/dist/useDocument";



export function useDocFromHandle<T>(
  handle: DocHandle<T> | undefined,
): UseDocumentReturn<T> | [undefined, () => void] {
  // Initialize with current doc state
  const [doc, setDoc] = useState<Doc<T> | undefined>(() => handle?.doc())
  const [deleteError, setDeleteError] = useState<Error>()

  // Reinitialize doc when handle changes
  useEffect(() => {
    setDoc(handle?.doc())
  }, [handle])

  useEffect(() => {
    if (!handle) {
      return
    }
    const onChange = () => setDoc(handle.doc())
    const onDelete = () => {
      setDeleteError(new Error(`Document ${handle.url} was deleted`))
    }

    handle.on("change", onChange)
    handle.on("delete", onDelete)

    return () => {
      handle.removeListener("change", onChange)
      handle.removeListener("delete", onDelete)
    }
  }, [handle])

  const changeDoc = useCallback(
    (changeFn: ChangeFn<T>, options?: ChangeOptions<T>) => {
      handle!.change(changeFn, options)
    },
    [handle]
  )

  if (deleteError) {
    throw deleteError
  }

  return [doc!, changeDoc]
}
