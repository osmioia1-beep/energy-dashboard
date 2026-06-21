import React, { createContext, useContext, useRef, useCallback } from 'react'

const RefreshContext = createContext(null)

export function RefreshProvider({ children }) {
  const callbacks = useRef(new Set())

  const register = useCallback((fn) => {
    callbacks.current.add(fn)
    return () => callbacks.current.delete(fn)
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([...callbacks.current].map(fn => fn()))
  }, [])

  return (
    <RefreshContext.Provider value={{ register, refreshAll }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  return useContext(RefreshContext)
}
